/**
 * E-Way bill register — generate / cancel / Part B vehicle update / validity extend.
 * Sources: POSTED SalesInvoice or ISSUED DeliveryChallan (+ dispatch panel soft-link).
 * Provider mode: same adapter as e-invoice (SIMULATED default; LIVE gated).
 * EWB number is never user-editable.
 */
import type { Request } from 'express'
import { randomUUID } from 'crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import { AuthorizationError, NotFoundError } from '../../../utils/errors.js'
import { formatForPersistence } from '../shared/finance-decimal.js'
import { parseDateOnly, toDateOnlyString } from '../shared/finance.helpers.js'
import {
  checkEwaySourceReadiness,
  evaluateThreshold,
  planEwayExtension,
  planEwayGenerate,
  validateEwayPartA,
  validateEwayPartB,
} from './eway-readiness.util.js'
import { getEInvoiceProviderMode, getNicGstAdapter } from './nic-gst.adapter.js'
import {
  GstEWayBillCancelError,
  GstEWayBillExtendError,
  GstEWayBillGenerateError,
  GstEWayBillNotReadyError,
  GstEWayBillVehicleUpdateError,
} from './tax-compliance.errors.js'
import type {
  CancelGstDocumentInput,
  EWayPanelQueryInput,
  ExtendEWayBillInput,
  GenerateEWayBillInput,
  ListGstDocumentQueryInput,
  UpdateEWayVehicleInput,
} from './tax-compliance.schemas.js'

/** Official FAQ general threshold — live rules/exceptions still apply at NIC. */
export const EWAY_CONSIGNMENT_THRESHOLD_INR = Number(process.env.GST_EWAY_THRESHOLD_INR ?? 50_000)

function hasPerm(req: Request, permission: string): boolean {
  const perms = req.context?.permissions ?? []
  return perms.includes('tenant.manage') || perms.includes(permission)
}

function assertPerm(req: Request, permission: string): void {
  if (!hasPerm(req, permission)) throw new AuthorizationError(`Missing permission: ${permission}`)
}

function money(v: { toString(): string } | string | number): string {
  return formatForPersistence(v.toString(), 4)
}

function asJson(value: Record<string, unknown> | null | undefined): Prisma.InputJsonValue | undefined {
  if (!value) return undefined
  return value as Prisma.InputJsonValue
}

type EwbRow = {
  id: string
  legalEntityId: string
  sourceType: string
  salesInvoiceId: string | null
  deliveryChallanId: string | null
  outboundDispatchId: string | null
  documentNumber: string
  documentDate: Date
  partyName: string
  partyGstin: string | null
  fromPlace: string
  toPlace: string
  distanceKm: number
  vehicleNumber: string | null
  transporterName: string | null
  transporterId: string | null
  transportMode?: string | null
  taxableAmount: { toString(): string }
  status: string
  ewbNumber: string | null
  generatedAt: Date | null
  validUpto: Date | null
  requiredReason: string | null
  movementReason: string | null
  cancelReason: string | null
  cancelledAt: Date | null
  exceptionMessage: string | null
  providerMode: string
  providerRef: string | null
  attemptCount?: number
  extensionCount?: number
  vehicleUpdatedAt?: Date | null
  lastRequestJson: unknown
  lastResponseJson: unknown
  createdAt: Date
  updatedAt: Date
}

function serialize(row: EwbRow) {
  return {
    id: row.id,
    legalEntityId: row.legalEntityId,
    sourceType: row.sourceType,
    salesInvoiceId: row.salesInvoiceId,
    deliveryChallanId: row.deliveryChallanId,
    outboundDispatchId: row.outboundDispatchId,
    documentNumber: row.documentNumber,
    documentDate: toDateOnlyString(row.documentDate),
    partyName: row.partyName,
    partyGstin: row.partyGstin,
    fromPlace: row.fromPlace,
    toPlace: row.toPlace,
    distanceKm: row.distanceKm,
    vehicleNumber: row.vehicleNumber,
    transporterName: row.transporterName,
    transporterId: row.transporterId,
    transportMode: row.transportMode ?? null,
    taxableAmount: money(row.taxableAmount),
    status: row.status,
    ewbNumber: row.ewbNumber,
    generatedAt: row.generatedAt?.toISOString() ?? null,
    validUpto: row.validUpto?.toISOString() ?? null,
    requiredReason: row.requiredReason,
    movementReason: row.movementReason,
    cancelReason: row.cancelReason,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    exceptionMessage: row.exceptionMessage,
    providerMode: row.providerMode,
    providerRef: row.providerRef,
    attemptCount: row.attemptCount ?? 0,
    extensionCount: row.extensionCount ?? 0,
    vehicleUpdatedAt: row.vehicleUpdatedAt?.toISOString() ?? null,
    lastRequestJson: row.lastRequestJson ?? null,
    lastResponseJson: row.lastResponseJson ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function assertPartAB(input: GenerateEWayBillInput, sellerGstin: string) {
  const partA = validateEwayPartA({
    fromPlace: input.fromPlace,
    toPlace: input.toPlace,
    distanceKm: input.distanceKm,
    sellerGstin,
  })
  if (!partA.ok) throw new GstEWayBillNotReadyError(partA.message)

  const partB = validateEwayPartB(
    {
      vehicleNumber: input.vehicleNumber,
      transporterId: input.transporterId,
      transporterName: input.transporterName,
      transportMode: input.transportMode,
    },
    { requirePartB: !input.allowIncompletePartB },
  )
  if (!partB.ok) throw new GstEWayBillNotReadyError(partB.message)
  return partB.warnings
}

export function getEWayProviderStatus(req: Request) {
  assertPerm(req, 'finance.tax.view')
  const mode = getEInvoiceProviderMode()
  return {
    providerMode: mode,
    isSimulated: mode === 'SIMULATED',
    thresholdInr: EWAY_CONSIGNMENT_THRESHOLD_INR,
    note:
      mode === 'SIMULATED'
        ? 'EWB is generated locally (SIMULATED). Not submitted to the GST e-Way portal.'
        : 'LIVE mode selected — UAT/connector gates apply; not portal-ready without certified UAT.',
  }
}

export async function listEWayBills(req: Request, tenantId: string, query: ListGstDocumentQueryInput) {
  assertPerm(req, 'finance.tax.view')
  const where = {
    tenantId,
    legalEntityId: query.legalEntityId,
    documentDate: {
      gte: parseDateOnly(query.fromDate),
      lte: parseDateOnly(query.toDate),
    },
    ...(query.search
      ? {
          OR: [
            { documentNumber: { contains: query.search } },
            { partyName: { contains: query.search } },
            { ewbNumber: { contains: query.search } },
            { vehicleNumber: { contains: query.search } },
          ],
        }
      : {}),
  }
  const [total, rows] = await Promise.all([
    prisma.gstEWayBill.count({ where }),
    prisma.gstEWayBill.findMany({
      where,
      orderBy: [{ documentDate: 'desc' }, { createdAt: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ])
  return {
    items: rows.map(serialize),
    total,
    page: query.page,
    pageSize: query.pageSize,
    providerMode: getEInvoiceProviderMode(),
  }
}

export async function getEWayBill(req: Request, tenantId: string, id: string) {
  assertPerm(req, 'finance.tax.view')
  const row = await prisma.gstEWayBill.findFirst({ where: { id, tenantId } })
  if (!row) throw new NotFoundError('E-way bill not found')
  return serialize(row)
}

/**
 * Dispatch / challan panel: required flag + reason + linked statutory register (if any).
 */
export async function getEWayPanel(req: Request, tenantId: string, query: EWayPanelQueryInput) {
  assertPerm(req, 'finance.tax.view')
  let challan = query.deliveryChallanId
    ? await prisma.deliveryChallan.findFirst({
        where: { id: query.deliveryChallanId, tenantId, deletedAt: null },
        include: { outboundDispatch: { select: { id: true, salesOrderId: true, dispatchNo: true } } },
      })
    : null

  if (!challan && query.outboundDispatchId) {
    challan = await prisma.deliveryChallan.findFirst({
      where: {
        tenantId,
        outboundDispatchId: query.outboundDispatchId,
        deletedAt: null,
        status: { in: ['ISSUED', 'APPROVED', 'DRAFT', 'READY_FOR_REVIEW'] },
      },
      orderBy: { createdAt: 'desc' },
      include: { outboundDispatch: { select: { id: true, salesOrderId: true, dispatchNo: true } } },
    })
  }

  if (!challan) {
    return {
      required: false,
      reason: null,
      thresholdInr: EWAY_CONSIGNMENT_THRESHOLD_INR,
      taxableAmount: '0.0000',
      deliveryChallanId: null,
      outboundDispatchId: query.outboundDispatchId ?? null,
      ewayBill: null,
      canGenerate: false,
      providerMode: getEInvoiceProviderMode(),
      message: 'No delivery challan found for e-Way evaluation',
    }
  }

  const taxable = await resolveChallanTaxableAmount(tenantId, challan)
  const evalT = evaluateThreshold(taxable, EWAY_CONSIGNMENT_THRESHOLD_INR)
  const ewayBill = await prisma.gstEWayBill.findFirst({
    where: { tenantId, deliveryChallanId: challan.id },
  })

  return {
    required: evalT.required,
    reason: evalT.reason,
    thresholdInr: EWAY_CONSIGNMENT_THRESHOLD_INR,
    taxableAmount: money(taxable),
    deliveryChallanId: challan.id,
    outboundDispatchId: challan.outboundDispatchId,
    dispatchNo: challan.outboundDispatch?.dispatchNo ?? null,
    challanNumber: challan.challanNumber,
    challanStatus: challan.status,
    vehicleNumber: challan.vehicleNumber,
    transporterName: challan.transporterName,
    destination: challan.destination,
    ewayBill: ewayBill ? serialize(ewayBill) : null,
    canGenerate: challan.status === 'ISSUED',
    providerMode: getEInvoiceProviderMode(),
  }
}

async function resolveChallanTaxableAmount(
  tenantId: string,
  challan: {
    outboundDispatchId: string
    outboundDispatch?: { salesOrderId: string | null } | null
  },
): Promise<number> {
  const salesOrderId = challan.outboundDispatch?.salesOrderId
  if (salesOrderId) {
    const so = await prisma.crmSalesOrder.findFirst({
      where: { id: salesOrderId, tenantId },
      select: { grandTotal: true, basicAmount: true },
    })
    if (so?.grandTotal != null) return Number(so.grandTotal)
    if (so?.basicAmount != null) return Number(so.basicAmount)
  }
  return 0
}

export async function generateEWayBill(req: Request, tenantId: string, input: GenerateEWayBillInput) {
  assertPerm(req, 'finance.tax.eway.manage')
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')
  const audit = auditFromRequest(req)

  if (input.sourceType === 'SALES_INVOICE') {
    if (!input.salesInvoiceId) throw new GstEWayBillNotReadyError('salesInvoiceId is required')
    return generateFromSalesInvoice(req, tenantId, userId, audit, input)
  }
  if (!input.deliveryChallanId) throw new GstEWayBillNotReadyError('deliveryChallanId is required')
  return generateFromDeliveryChallan(req, tenantId, userId, audit, input)
}

async function generateFromSalesInvoice(
  _req: Request,
  tenantId: string,
  userId: string,
  audit: ReturnType<typeof auditFromRequest>,
  input: GenerateEWayBillInput,
) {
  const providerMode = getEInvoiceProviderMode()
  const invoice = await prisma.salesInvoice.findFirst({
    where: { id: input.salesInvoiceId!, tenantId },
    include: { legalEntity: true },
  })
  if (!invoice) throw new NotFoundError('Sales invoice not found')

  const sourceOk = checkEwaySourceReadiness({
    sourceType: 'SALES_INVOICE',
    documentStatus: invoice.status,
  })
  if (!sourceOk.ok) throw new GstEWayBillNotReadyError(sourceOk.message)
  if (!invoice.legalEntity.gstin) {
    throw new GstEWayBillNotReadyError('Legal entity GSTIN is required')
  }

  assertPartAB(input, invoice.legalEntity.gstin)

  const taxable = Number(invoice.taxableAmount)
  const evalT = evaluateThreshold(taxable, EWAY_CONSIGNMENT_THRESHOLD_INR, input.force)
  const requiredReason = evalT.required ? evalT.reason : null

  if (!evalT.required) {
    const existing = await prisma.gstEWayBill.findFirst({
      where: { tenantId, salesInvoiceId: invoice.id },
    })
    if (existing) return { item: serialize(existing), idempotentReplay: true }
    const row = await prisma.gstEWayBill.create({
      data: {
        id: randomUUID(),
        tenantId,
        legalEntityId: invoice.legalEntityId,
        sourceType: 'SALES_INVOICE',
        salesInvoiceId: invoice.id,
        documentNumber: invoice.invoiceNumber ?? invoice.draftReference ?? invoice.id.slice(0, 8),
        documentDate: invoice.invoiceDate,
        partyName: invoice.customerNameSnapshot,
        partyGstin: invoice.customerGstinSnapshot,
        fromPlace: input.fromPlace,
        toPlace: input.toPlace,
        distanceKm: input.distanceKm,
        vehicleNumber: input.vehicleNumber ?? null,
        transporterName: input.transporterName ?? null,
        transporterId: input.transporterId ?? null,
        transportMode: input.transportMode ?? '1',
        taxableAmount: invoice.taxableAmount,
        status: 'NOT_REQUIRED',
        requiredReason: evalT.reason,
        movementReason: input.movementReason ?? null,
        providerMode,
        idempotencyKey: input.idempotencyKey ?? null,
        createdBy: userId,
      },
    })
    return { item: serialize(row), idempotentReplay: false }
  }

  const existing = await prisma.gstEWayBill.findFirst({
    where: { tenantId, salesInvoiceId: invoice.id },
  })
  const plan = planEwayGenerate(
    existing ? { status: existing.status, ewbNumber: existing.ewbNumber } : null,
  )
  if (plan.action === 'IDEMPOTENT_RETURN' && existing) {
    return { item: serialize(existing), idempotentReplay: true }
  }
  if (plan.action === 'BLOCK') {
    throw new GstEWayBillGenerateError(plan.reason ?? 'Cannot generate e-way bill')
  }

  const adapter = getNicGstAdapter()
  const nicRequest = {
    sellerGstin: invoice.legalEntity.gstin,
    buyerGstin: invoice.customerGstinSnapshot,
    documentType: 'INV' as const,
    documentNumber: invoice.invoiceNumber ?? invoice.id,
    documentDate: toDateOnlyString(invoice.invoiceDate),
    fromPlace: input.fromPlace,
    toPlace: input.toPlace,
    distanceKm: input.distanceKm,
    vehicleNumber: input.vehicleNumber ?? null,
    transporterId: input.transporterId ?? null,
    transporterName: input.transporterName ?? null,
    taxableAmount: money(invoice.taxableAmount),
    transportMode: input.transportMode ?? '1',
    movementReason: input.movementReason ?? null,
  }

  let nic
  try {
    nic = await adapter.generateEwb(nicRequest)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'NIC e-way generate failed'
    const failed = await prisma.gstEWayBill.upsert({
      where: { tenantId_salesInvoiceId: { tenantId, salesInvoiceId: invoice.id } },
      create: {
        id: randomUUID(),
        tenantId,
        legalEntityId: invoice.legalEntityId,
        sourceType: 'SALES_INVOICE',
        salesInvoiceId: invoice.id,
        documentNumber: invoice.invoiceNumber ?? invoice.draftReference ?? invoice.id.slice(0, 8),
        documentDate: invoice.invoiceDate,
        partyName: invoice.customerNameSnapshot,
        partyGstin: invoice.customerGstinSnapshot,
        fromPlace: input.fromPlace,
        toPlace: input.toPlace,
        distanceKm: input.distanceKm,
        vehicleNumber: input.vehicleNumber ?? null,
        transporterName: input.transporterName ?? null,
        transporterId: input.transporterId ?? null,
        transportMode: input.transportMode ?? '1',
        taxableAmount: invoice.taxableAmount,
        status: 'EXCEPTION',
        exceptionMessage: message.slice(0, 1000),
        requiredReason,
        movementReason: input.movementReason ?? null,
        providerMode,
        attemptCount: 1,
        lastAttemptAt: new Date(),
        lastRequestJson: asJson(nicRequest),
        lastResponseJson: asJson({ error: message }),
        createdBy: userId,
      },
      update: {
        status: 'EXCEPTION',
        exceptionMessage: message.slice(0, 1000),
        attemptCount: { increment: 1 },
        lastAttemptAt: new Date(),
        lastRequestJson: asJson(nicRequest),
        lastResponseJson: asJson({ error: message }),
        updatedBy: userId,
      },
    })
    await createAuditLog({
      tenantId,
      userId: audit.userId,
      module: 'finance',
      entity: 'gst_e_way_bill',
      entityId: failed.id,
      action: 'GENERATE_EXCEPTION',
      newValues: { salesInvoiceId: invoice.id, mode: providerMode, message: message.slice(0, 500) },
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
    })
    throw new GstEWayBillGenerateError(message, failed.id)
  }

  const row = await prisma.gstEWayBill.upsert({
    where: { tenantId_salesInvoiceId: { tenantId, salesInvoiceId: invoice.id } },
    create: {
      id: randomUUID(),
      tenantId,
      legalEntityId: invoice.legalEntityId,
      sourceType: 'SALES_INVOICE',
      salesInvoiceId: invoice.id,
      documentNumber: invoice.invoiceNumber ?? invoice.draftReference ?? invoice.id.slice(0, 8),
      documentDate: invoice.invoiceDate,
      partyName: invoice.customerNameSnapshot,
      partyGstin: invoice.customerGstinSnapshot,
      fromPlace: input.fromPlace,
      toPlace: input.toPlace,
      distanceKm: input.distanceKm,
      vehicleNumber: input.vehicleNumber ?? null,
      transporterName: input.transporterName ?? null,
      transporterId: input.transporterId ?? null,
      transportMode: input.transportMode ?? '1',
      taxableAmount: invoice.taxableAmount,
      status: 'GENERATED',
      ewbNumber: nic.ewbNumber,
      generatedAt: nic.generatedAt,
      validUpto: nic.validUpto,
      requiredReason,
      movementReason: input.movementReason ?? null,
      providerMode: nic.providerMode,
      providerRef: nic.providerRef,
      idempotencyKey: input.idempotencyKey ?? null,
      attemptCount: 1,
      lastAttemptAt: new Date(),
      lastRequestJson: asJson(nic.requestSnapshot),
      lastResponseJson: asJson(nic.responseSnapshot),
      createdBy: userId,
    },
    update: {
      status: 'GENERATED',
      ewbNumber: nic.ewbNumber,
      generatedAt: nic.generatedAt,
      validUpto: nic.validUpto,
      fromPlace: input.fromPlace,
      toPlace: input.toPlace,
      distanceKm: input.distanceKm,
      vehicleNumber: input.vehicleNumber ?? null,
      transporterName: input.transporterName ?? null,
      transporterId: input.transporterId ?? null,
      transportMode: input.transportMode ?? '1',
      requiredReason,
      movementReason: input.movementReason ?? null,
      providerMode: nic.providerMode,
      providerRef: nic.providerRef,
      attemptCount: { increment: 1 },
      lastAttemptAt: new Date(),
      lastRequestJson: asJson(nic.requestSnapshot),
      lastResponseJson: asJson(nic.responseSnapshot),
      exceptionMessage: null,
      updatedBy: userId,
    },
  })

  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'gst_e_way_bill',
    entityId: row.id,
    action: 'GENERATE',
    newValues: {
      ewbNumber: row.ewbNumber,
      sourceType: 'SALES_INVOICE',
      providerRef: row.providerRef,
      mode: nic.providerMode,
    },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })

  return { item: serialize(row), idempotentReplay: false }
}

async function generateFromDeliveryChallan(
  _req: Request,
  tenantId: string,
  userId: string,
  audit: ReturnType<typeof auditFromRequest>,
  input: GenerateEWayBillInput,
) {
  const providerMode = getEInvoiceProviderMode()
  const challan = await prisma.deliveryChallan.findFirst({
    where: { id: input.deliveryChallanId!, tenantId, deletedAt: null },
    include: { outboundDispatch: { select: { id: true, salesOrderId: true } } },
  })
  if (!challan) throw new NotFoundError('Delivery challan not found')

  const sourceOk = checkEwaySourceReadiness({
    sourceType: 'DELIVERY_CHALLAN',
    documentStatus: challan.status,
  })
  if (!sourceOk.ok) throw new GstEWayBillNotReadyError(sourceOk.message)

  const legalEntity = await prisma.legalEntity.findFirst({
    where: { tenantId, isActive: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  })
  if (!legalEntity?.gstin) {
    throw new GstEWayBillNotReadyError('Active legal entity with GSTIN is required')
  }

  assertPartAB(input, legalEntity.gstin)

  const customerSnap = (challan.customerSnapshotJson ?? {}) as Record<string, unknown>
  const partyName = String(customerSnap.name ?? customerSnap.customerName ?? 'Customer')
  const partyGstin =
    typeof customerSnap.gstin === 'string'
      ? customerSnap.gstin
      : typeof customerSnap.gstinNumber === 'string'
        ? customerSnap.gstinNumber
        : null

  const taxable = await resolveChallanTaxableAmount(tenantId, challan)
  const evalT = evaluateThreshold(taxable, EWAY_CONSIGNMENT_THRESHOLD_INR, input.force)
  const requiredReason = evalT.reason

  const existing = await prisma.gstEWayBill.findFirst({
    where: { tenantId, deliveryChallanId: challan.id },
  })
  const plan = planEwayGenerate(
    existing ? { status: existing.status, ewbNumber: existing.ewbNumber } : null,
  )
  if (plan.action === 'IDEMPOTENT_RETURN' && existing) {
    return { item: serialize(existing), idempotentReplay: true }
  }
  if (plan.action === 'BLOCK') {
    throw new GstEWayBillGenerateError(plan.reason ?? 'Cannot generate e-way bill')
  }

  if (!evalT.required) {
    const row = existing
      ? await prisma.gstEWayBill.update({
          where: { id: existing.id },
          data: {
            status: 'NOT_REQUIRED',
            requiredReason,
            taxableAmount: taxable,
            transportMode: input.transportMode ?? '1',
            providerMode,
            updatedBy: userId,
          },
        })
      : await prisma.gstEWayBill.create({
          data: {
            id: randomUUID(),
            tenantId,
            legalEntityId: legalEntity.id,
            sourceType: 'DELIVERY_CHALLAN',
            deliveryChallanId: challan.id,
            outboundDispatchId: challan.outboundDispatchId,
            documentNumber: challan.challanNumber ?? challan.id.slice(0, 8),
            documentDate: challan.documentDate,
            partyName,
            partyGstin,
            fromPlace: input.fromPlace,
            toPlace: input.toPlace || challan.destination || 'Destination',
            distanceKm: input.distanceKm,
            vehicleNumber: input.vehicleNumber ?? challan.vehicleNumber,
            transporterName: input.transporterName ?? challan.transporterName,
            transporterId: input.transporterId ?? null,
            transportMode: input.transportMode ?? '1',
            taxableAmount: taxable,
            status: 'NOT_REQUIRED',
            requiredReason,
            movementReason: input.movementReason ?? 'SALES_DELIVERY',
            providerMode,
            createdBy: userId,
          },
        })
    return { item: serialize(row), idempotentReplay: Boolean(existing) }
  }

  const adapter = getNicGstAdapter()
  const docNo = challan.challanNumber ?? challan.id.slice(0, 8)
  const nicRequest = {
    sellerGstin: legalEntity.gstin,
    buyerGstin: partyGstin,
    documentType: 'CHL' as const,
    documentNumber: docNo,
    documentDate: toDateOnlyString(challan.documentDate),
    fromPlace: input.fromPlace,
    toPlace: input.toPlace || challan.destination || 'Destination',
    distanceKm: input.distanceKm,
    vehicleNumber: input.vehicleNumber ?? challan.vehicleNumber,
    transporterId: input.transporterId ?? null,
    transporterName: input.transporterName ?? challan.transporterName,
    taxableAmount: money(taxable),
    transportMode: input.transportMode ?? '1',
    movementReason: input.movementReason ?? 'SALES_DELIVERY',
  }

  let nic
  try {
    nic = await adapter.generateEwb(nicRequest)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'NIC e-way generate failed'
    const failed = existing
      ? await prisma.gstEWayBill.update({
          where: { id: existing.id },
          data: {
            status: 'EXCEPTION',
            exceptionMessage: message.slice(0, 1000),
            attemptCount: { increment: 1 },
            lastAttemptAt: new Date(),
            lastRequestJson: asJson(nicRequest),
            lastResponseJson: asJson({ error: message }),
            updatedBy: userId,
          },
        })
      : await prisma.gstEWayBill.create({
          data: {
            id: randomUUID(),
            tenantId,
            legalEntityId: legalEntity.id,
            sourceType: 'DELIVERY_CHALLAN',
            deliveryChallanId: challan.id,
            outboundDispatchId: challan.outboundDispatchId,
            documentNumber: docNo,
            documentDate: challan.documentDate,
            partyName,
            partyGstin,
            fromPlace: input.fromPlace,
            toPlace: nicRequest.toPlace,
            distanceKm: input.distanceKm,
            vehicleNumber: nicRequest.vehicleNumber,
            transporterName: nicRequest.transporterName,
            transporterId: input.transporterId ?? null,
            transportMode: input.transportMode ?? '1',
            taxableAmount: taxable,
            status: 'EXCEPTION',
            exceptionMessage: message.slice(0, 1000),
            requiredReason,
            movementReason: input.movementReason ?? 'SALES_DELIVERY',
            providerMode,
            attemptCount: 1,
            lastAttemptAt: new Date(),
            lastRequestJson: asJson(nicRequest),
            lastResponseJson: asJson({ error: message }),
            createdBy: userId,
          },
        })
    throw new GstEWayBillGenerateError(message, failed.id)
  }

  const row = await prisma.$transaction(async (tx) => {
    const ewb = await tx.gstEWayBill.upsert({
      where: { tenantId_deliveryChallanId: { tenantId, deliveryChallanId: challan.id } },
      create: {
        id: randomUUID(),
        tenantId,
        legalEntityId: legalEntity.id,
        sourceType: 'DELIVERY_CHALLAN',
        deliveryChallanId: challan.id,
        outboundDispatchId: challan.outboundDispatchId,
        documentNumber: docNo,
        documentDate: challan.documentDate,
        partyName,
        partyGstin,
        fromPlace: input.fromPlace,
        toPlace: nicRequest.toPlace,
        distanceKm: input.distanceKm,
        vehicleNumber: nicRequest.vehicleNumber,
        transporterName: nicRequest.transporterName,
        transporterId: input.transporterId ?? null,
        transportMode: input.transportMode ?? '1',
        taxableAmount: taxable,
        status: 'GENERATED',
        ewbNumber: nic.ewbNumber,
        generatedAt: nic.generatedAt,
        validUpto: nic.validUpto,
        requiredReason,
        movementReason: input.movementReason ?? 'SALES_DELIVERY',
        providerMode: nic.providerMode,
        providerRef: nic.providerRef,
        attemptCount: 1,
        lastAttemptAt: new Date(),
        lastRequestJson: asJson(nic.requestSnapshot),
        lastResponseJson: asJson(nic.responseSnapshot),
        createdBy: userId,
      },
      update: {
        status: 'GENERATED',
        ewbNumber: nic.ewbNumber,
        generatedAt: nic.generatedAt,
        validUpto: nic.validUpto,
        outboundDispatchId: challan.outboundDispatchId,
        fromPlace: input.fromPlace,
        toPlace: nicRequest.toPlace,
        distanceKm: input.distanceKm,
        vehicleNumber: nicRequest.vehicleNumber,
        transporterName: nicRequest.transporterName,
        transporterId: input.transporterId ?? null,
        transportMode: input.transportMode ?? '1',
        taxableAmount: taxable,
        requiredReason,
        movementReason: input.movementReason ?? 'SALES_DELIVERY',
        providerMode: nic.providerMode,
        providerRef: nic.providerRef,
        attemptCount: { increment: 1 },
        lastAttemptAt: new Date(),
        lastRequestJson: asJson(nic.requestSnapshot),
        lastResponseJson: asJson(nic.responseSnapshot),
        exceptionMessage: null,
        updatedBy: userId,
      },
    })
    await tx.deliveryChallan.update({
      where: { id: challan.id },
      data: {
        eWayBillReference: nic.ewbNumber,
        eWayBillDate: nic.generatedAt,
        updatedBy: userId,
      },
    })
    return ewb
  })

  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'gst_e_way_bill',
    entityId: row.id,
    action: 'GENERATE',
    newValues: {
      ewbNumber: row.ewbNumber,
      sourceType: 'DELIVERY_CHALLAN',
      providerRef: row.providerRef,
      mode: nic.providerMode,
    },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })

  return { item: serialize(row), idempotentReplay: false }
}

export async function cancelEWayBill(req: Request, tenantId: string, id: string, input: CancelGstDocumentInput) {
  assertPerm(req, 'finance.tax.eway.manage')
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')
  const audit = auditFromRequest(req)

  const row = await prisma.gstEWayBill.findFirst({ where: { id, tenantId } })
  if (!row) throw new NotFoundError('E-way bill not found')
  if (row.status === 'CANCELLED') return serialize(row)
  if (row.status !== 'GENERATED' || !row.ewbNumber) {
    throw new GstEWayBillCancelError('Only generated e-way bills can be cancelled')
  }

  const adapter = getNicGstAdapter()
  let nic
  try {
    nic = await adapter.cancelEwb(row.ewbNumber, input.reason)
  } catch (e) {
    throw new GstEWayBillCancelError(e instanceof Error ? e.message : 'NIC cancel failed')
  }

  const updated = await prisma.gstEWayBill.update({
    where: { id: row.id },
    data: {
      status: 'CANCELLED',
      cancelReason: input.reason,
      cancelledAt: nic.cancelledAt,
      cancelledBy: userId,
      providerRef: nic.providerRef,
      lastRequestJson: asJson(nic.requestSnapshot),
      lastResponseJson: asJson(nic.responseSnapshot),
      updatedBy: userId,
    },
  })

  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'gst_e_way_bill',
    entityId: row.id,
    action: 'CANCEL',
    newValues: { reason: input.reason, ewbNumber: row.ewbNumber, mode: getEInvoiceProviderMode() },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })

  return serialize(updated)
}

export async function updateEWayVehicle(
  req: Request,
  tenantId: string,
  id: string,
  input: UpdateEWayVehicleInput,
) {
  assertPerm(req, 'finance.tax.eway.manage')
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')
  const audit = auditFromRequest(req)

  const row = await prisma.gstEWayBill.findFirst({ where: { id, tenantId } })
  if (!row) throw new NotFoundError('E-way bill not found')
  if (row.status !== 'GENERATED' || !row.ewbNumber) {
    throw new GstEWayBillVehicleUpdateError('Only generated e-way bills can update vehicle')
  }

  const adapter = getNicGstAdapter()
  let nic
  try {
    nic = await adapter.updateEwbVehicle({
      ewbNumber: row.ewbNumber,
      vehicleNumber: input.vehicleNumber,
      fromPlace: input.fromPlace ?? null,
      reasonCode: input.reasonCode ?? null,
    })
  } catch (e) {
    throw new GstEWayBillVehicleUpdateError(e instanceof Error ? e.message : 'NIC vehicle update failed')
  }

  const updated = await prisma.$transaction(async (tx) => {
    const ewb = await tx.gstEWayBill.update({
      where: { id: row.id },
      data: {
        vehicleNumber: input.vehicleNumber,
        vehicleUpdatedAt: nic.updatedAt,
        providerRef: nic.providerRef,
        lastRequestJson: asJson(nic.requestSnapshot),
        lastResponseJson: asJson(nic.responseSnapshot),
        updatedBy: userId,
      },
    })
    if (row.deliveryChallanId) {
      await tx.deliveryChallan.update({
        where: { id: row.deliveryChallanId },
        data: { vehicleNumber: input.vehicleNumber, updatedBy: userId },
      })
    }
    return ewb
  })

  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'gst_e_way_bill',
    entityId: row.id,
    action: 'UPDATE_VEHICLE',
    newValues: { vehicleNumber: input.vehicleNumber, ewbNumber: row.ewbNumber, providerRef: nic.providerRef },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })

  return serialize(updated)
}

/** Validity extension (SIMULATED path + LIVE gate via same adapter). */
export async function extendEWayBill(
  req: Request,
  tenantId: string,
  id: string,
  input: ExtendEWayBillInput,
) {
  assertPerm(req, 'finance.tax.eway.manage')
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')
  const audit = auditFromRequest(req)

  const row = await prisma.gstEWayBill.findFirst({ where: { id, tenantId } })
  if (!row) throw new NotFoundError('E-way bill not found')
  if (!row.ewbNumber || !row.validUpto) {
    throw new GstEWayBillExtendError('E-way bill has no EWB number / validity to extend')
  }

  const plan = planEwayExtension({
    status: row.status,
    validUpto: row.validUpto,
    extensionHours: input.extensionHours,
  })
  if (!plan.ok) throw new GstEWayBillExtendError(plan.message)

  const adapter = getNicGstAdapter()
  let nic
  try {
    nic = await adapter.extendEwb({
      ewbNumber: row.ewbNumber,
      extensionHours: input.extensionHours,
      currentValidUpto: row.validUpto,
      reason: input.reason ?? null,
    })
  } catch (e) {
    throw new GstEWayBillExtendError(e instanceof Error ? e.message : 'NIC extend failed')
  }

  const updated = await prisma.gstEWayBill.update({
    where: { id: row.id },
    data: {
      validUpto: nic.validUpto,
      extensionCount: { increment: 1 },
      providerRef: nic.providerRef,
      lastRequestJson: asJson(nic.requestSnapshot),
      lastResponseJson: asJson(nic.responseSnapshot),
      updatedBy: userId,
    },
  })

  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'gst_e_way_bill',
    entityId: row.id,
    action: 'EXTEND',
    newValues: {
      ewbNumber: row.ewbNumber,
      validUpto: nic.validUpto.toISOString(),
      extensionHours: input.extensionHours,
      mode: getEInvoiceProviderMode(),
    },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })

  return serialize(updated)
}
