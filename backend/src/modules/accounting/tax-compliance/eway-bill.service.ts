/**
 * E-Way bill register — generate/cancel via NIC adapter (SIMULATED by default).
 */
import type { Request } from 'express'
import { randomUUID } from 'crypto'
import { prisma } from '../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import { AuthorizationError, NotFoundError } from '../../../utils/errors.js'
import { formatForPersistence } from '../shared/finance-decimal.js'
import { parseDateOnly, toDateOnlyString } from '../shared/finance.helpers.js'
import { getNicGstAdapter } from './nic-gst.adapter.js'
import {
  GstEWayBillCancelError,
  GstEWayBillGenerateError,
  GstEWayBillNotReadyError,
} from './tax-compliance.errors.js'
import type {
  CancelGstDocumentInput,
  GenerateEWayBillInput,
  ListGstDocumentQueryInput,
} from './tax-compliance.schemas.js'

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

function serialize(row: {
  id: string
  legalEntityId: string
  sourceType: string
  salesInvoiceId: string | null
  deliveryChallanId: string | null
  documentNumber: string
  documentDate: Date
  partyName: string
  partyGstin: string | null
  fromPlace: string
  toPlace: string
  distanceKm: number
  vehicleNumber: string | null
  transporterName: string | null
  taxableAmount: { toString(): string }
  status: string
  ewbNumber: string | null
  validUpto: Date | null
  cancelReason: string | null
  cancelledAt: Date | null
  exceptionMessage: string | null
  providerMode: string
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: row.id,
    legalEntityId: row.legalEntityId,
    sourceType: row.sourceType,
    salesInvoiceId: row.salesInvoiceId,
    deliveryChallanId: row.deliveryChallanId,
    documentNumber: row.documentNumber,
    documentDate: toDateOnlyString(row.documentDate),
    partyName: row.partyName,
    partyGstin: row.partyGstin,
    fromPlace: row.fromPlace,
    toPlace: row.toPlace,
    distanceKm: row.distanceKm,
    vehicleNumber: row.vehicleNumber,
    transporterName: row.transporterName,
    taxableAmount: money(row.taxableAmount),
    status: row.status,
    ewbNumber: row.ewbNumber,
    validUpto: row.validUpto?.toISOString() ?? null,
    cancelReason: row.cancelReason,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    exceptionMessage: row.exceptionMessage,
    providerMode: row.providerMode,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
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
  return { items: rows.map(serialize), total, page: query.page, pageSize: query.pageSize }
}

export async function getEWayBill(req: Request, tenantId: string, id: string) {
  assertPerm(req, 'finance.tax.view')
  const row = await prisma.gstEWayBill.findFirst({ where: { id, tenantId } })
  if (!row) throw new NotFoundError('E-way bill not found')
  return serialize(row)
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
  const invoice = await prisma.salesInvoice.findFirst({
    where: { id: input.salesInvoiceId!, tenantId },
    include: { legalEntity: true },
  })
  if (!invoice) throw new NotFoundError('Sales invoice not found')
  if (invoice.status !== 'POSTED') {
    throw new GstEWayBillNotReadyError('Only posted sales invoices can generate an e-way bill')
  }
  if (!invoice.legalEntity.gstin) {
    throw new GstEWayBillNotReadyError('Legal entity GSTIN is required')
  }

  const taxable = Number(invoice.taxableAmount)
  if (taxable < 50000 && !input.force) {
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
        taxableAmount: invoice.taxableAmount,
        status: 'NOT_REQUIRED',
        providerMode: 'SIMULATED',
        createdBy: userId,
      },
    })
    return { item: serialize(row), idempotentReplay: false }
  }

  const existing = await prisma.gstEWayBill.findFirst({
    where: { tenantId, salesInvoiceId: invoice.id },
  })
  if (existing?.status === 'GENERATED') {
    return { item: serialize(existing), idempotentReplay: true }
  }

  const adapter = getNicGstAdapter()
  let nic
  try {
    nic = await adapter.generateEwb({
      sellerGstin: invoice.legalEntity.gstin,
      buyerGstin: invoice.customerGstinSnapshot,
      documentNumber: invoice.invoiceNumber ?? invoice.id,
      documentDate: toDateOnlyString(invoice.invoiceDate),
      fromPlace: input.fromPlace,
      toPlace: input.toPlace,
      distanceKm: input.distanceKm,
      vehicleNumber: input.vehicleNumber ?? null,
      taxableAmount: money(invoice.taxableAmount),
    })
  } catch (e) {
    throw new GstEWayBillGenerateError(e instanceof Error ? e.message : 'NIC e-way generate failed')
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
      taxableAmount: invoice.taxableAmount,
      status: 'GENERATED',
      ewbNumber: nic.ewbNumber,
      validUpto: nic.validUpto,
      providerMode: nic.providerMode,
      providerRef: nic.providerRef,
      createdBy: userId,
    },
    update: {
      status: 'GENERATED',
      ewbNumber: nic.ewbNumber,
      validUpto: nic.validUpto,
      fromPlace: input.fromPlace,
      toPlace: input.toPlace,
      distanceKm: input.distanceKm,
      vehicleNumber: input.vehicleNumber ?? null,
      transporterName: input.transporterName ?? null,
      providerMode: nic.providerMode,
      providerRef: nic.providerRef,
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
    newValues: { ewbNumber: row.ewbNumber, sourceType: 'SALES_INVOICE' },
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
  const challan = await prisma.deliveryChallan.findFirst({
    where: { id: input.deliveryChallanId!, tenantId, deletedAt: null },
  })
  if (!challan) throw new NotFoundError('Delivery challan not found')
  if (challan.status !== 'ISSUED') {
    throw new GstEWayBillNotReadyError('Only issued delivery challans can generate an e-way bill')
  }

  const legalEntity = await prisma.legalEntity.findFirst({
    where: { tenantId, isActive: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  })
  if (!legalEntity?.gstin) {
    throw new GstEWayBillNotReadyError('Active legal entity with GSTIN is required')
  }

  const customerSnap = (challan.customerSnapshotJson ?? {}) as Record<string, unknown>
  const partyName = String(customerSnap.name ?? customerSnap.customerName ?? 'Customer')
  const partyGstin =
    typeof customerSnap.gstin === 'string'
      ? customerSnap.gstin
      : typeof customerSnap.gstinNumber === 'string'
        ? customerSnap.gstinNumber
        : null

  const existing = await prisma.gstEWayBill.findFirst({
    where: { tenantId, deliveryChallanId: challan.id },
  })
  if (existing?.status === 'GENERATED') {
    return { item: serialize(existing), idempotentReplay: true }
  }

  const adapter = getNicGstAdapter()
  const docNo = challan.challanNumber ?? challan.id.slice(0, 8)
  const nic = await adapter.generateEwb({
    sellerGstin: legalEntity.gstin,
    buyerGstin: partyGstin,
    documentNumber: docNo,
    documentDate: toDateOnlyString(challan.documentDate),
    fromPlace: input.fromPlace,
    toPlace: input.toPlace || challan.destination || 'Destination',
    distanceKm: input.distanceKm,
    vehicleNumber: input.vehicleNumber ?? challan.vehicleNumber,
    taxableAmount: '0.0000',
  })

  const row = await prisma.$transaction(async (tx) => {
    const ewb = await tx.gstEWayBill.upsert({
      where: { tenantId_deliveryChallanId: { tenantId, deliveryChallanId: challan.id } },
      create: {
        id: randomUUID(),
        tenantId,
        legalEntityId: legalEntity.id,
        sourceType: 'DELIVERY_CHALLAN',
        deliveryChallanId: challan.id,
        documentNumber: docNo,
        documentDate: challan.documentDate,
        partyName,
        partyGstin,
        fromPlace: input.fromPlace,
        toPlace: input.toPlace || challan.destination || 'Destination',
        distanceKm: input.distanceKm,
        vehicleNumber: input.vehicleNumber ?? challan.vehicleNumber,
        transporterName: input.transporterName ?? challan.transporterName,
        taxableAmount: 0,
        status: 'GENERATED',
        ewbNumber: nic.ewbNumber,
        validUpto: nic.validUpto,
        providerMode: nic.providerMode,
        providerRef: nic.providerRef,
        createdBy: userId,
      },
      update: {
        status: 'GENERATED',
        ewbNumber: nic.ewbNumber,
        validUpto: nic.validUpto,
        fromPlace: input.fromPlace,
        toPlace: input.toPlace || challan.destination || 'Destination',
        distanceKm: input.distanceKm,
        vehicleNumber: input.vehicleNumber ?? challan.vehicleNumber,
        transporterName: input.transporterName ?? challan.transporterName,
        providerMode: nic.providerMode,
        providerRef: nic.providerRef,
        exceptionMessage: null,
        updatedBy: userId,
      },
    })
    await tx.deliveryChallan.update({
      where: { id: challan.id },
      data: {
        eWayBillReference: nic.ewbNumber,
        eWayBillDate: challan.documentDate,
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
    newValues: { ewbNumber: row.ewbNumber, sourceType: 'DELIVERY_CHALLAN' },
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
  const nic = await adapter.cancelEwb(row.ewbNumber, input.reason)
  const updated = await prisma.gstEWayBill.update({
    where: { id: row.id },
    data: {
      status: 'CANCELLED',
      cancelReason: input.reason,
      cancelledAt: nic.cancelledAt,
      cancelledBy: userId,
      providerRef: nic.providerRef,
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
    newValues: { reason: input.reason, ewbNumber: row.ewbNumber },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })

  return serialize(updated)
}
