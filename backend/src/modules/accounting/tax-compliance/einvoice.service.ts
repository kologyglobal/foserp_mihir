/**
 * E-Invoice register — generate/cancel IRN via NIC adapter (SIMULATED by default).
 * Phase 6: readiness gates, idempotency, retry of EXCEPTION, request/response audit snapshots.
 * IRN only from canonical POSTED SalesInvoice.
 */
import type { Request } from 'express'
import { randomUUID } from 'crypto'
import { prisma } from '../../../config/prisma.js'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import { AuthorizationError, NotFoundError } from '../../../utils/errors.js'
import { formatForPersistence } from '../shared/finance-decimal.js'
import { parseDateOnly, toDateOnlyString } from '../shared/finance.helpers.js'
import {
  checkEInvoiceReadiness,
  planEInvoiceGenerate,
} from './einvoice-readiness.util.js'
import { getEInvoiceProviderMode, getNicGstAdapter } from './nic-gst.adapter.js'
import {
  GstEInvoiceCancelError,
  GstEInvoiceGenerateError,
  GstEInvoiceNotReadyError,
} from './tax-compliance.errors.js'
import type { CancelGstDocumentInput, GenerateEInvoiceInput, ListGstDocumentQueryInput } from './tax-compliance.schemas.js'

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
  salesInvoiceId: string
  invoiceNumber: string | null
  invoiceDate: Date
  customerName: string
  customerGstin: string | null
  taxableAmount: { toString(): string }
  taxAmount: { toString(): string }
  totalAmount: { toString(): string }
  status: string
  irn: string | null
  ackNo: string | null
  ackDate: Date | null
  cancelReason: string | null
  cancelledAt: Date | null
  exceptionMessage: string | null
  providerMode: string
  attemptCount?: number
  lastAttemptAt?: Date | null
  idempotencyKey?: string | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: row.id,
    legalEntityId: row.legalEntityId,
    salesInvoiceId: row.salesInvoiceId,
    invoiceNumber: row.invoiceNumber,
    invoiceDate: toDateOnlyString(row.invoiceDate),
    customerName: row.customerName,
    customerGstin: row.customerGstin,
    taxableAmount: money(row.taxableAmount),
    taxAmount: money(row.taxAmount),
    totalAmount: money(row.totalAmount),
    status: row.status,
    irn: row.irn,
    ackNo: row.ackNo,
    ackDate: row.ackDate?.toISOString() ?? null,
    cancelReason: row.cancelReason,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    exceptionMessage: row.exceptionMessage,
    providerMode: row.providerMode,
    attemptCount: row.attemptCount ?? 0,
    lastAttemptAt: row.lastAttemptAt?.toISOString() ?? null,
    idempotencyKey: row.idempotencyKey ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listEInvoices(req: Request, tenantId: string, query: ListGstDocumentQueryInput) {
  assertPerm(req, 'finance.tax.view')
  const where = {
    tenantId,
    legalEntityId: query.legalEntityId,
    invoiceDate: {
      gte: parseDateOnly(query.fromDate),
      lte: parseDateOnly(query.toDate),
    },
    ...(query.search
      ? {
          OR: [
            { invoiceNumber: { contains: query.search } },
            { customerName: { contains: query.search } },
            { irn: { contains: query.search } },
            { customerGstin: { contains: query.search } },
          ],
        }
      : {}),
  }
  const [total, rows] = await Promise.all([
    prisma.gstEInvoice.count({ where }),
    prisma.gstEInvoice.findMany({
      where,
      orderBy: [{ invoiceDate: 'desc' }, { createdAt: 'desc' }],
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

export async function getEInvoice(req: Request, tenantId: string, id: string) {
  assertPerm(req, 'finance.tax.view')
  const row = await prisma.gstEInvoice.findFirst({ where: { id, tenantId } })
  if (!row) throw new NotFoundError('E-invoice not found')
  return serialize(row)
}

export function getEInvoiceProviderStatus(req: Request) {
  assertPerm(req, 'finance.tax.view')
  const mode = getEInvoiceProviderMode()
  return {
    providerMode: mode,
    isSimulated: mode === 'SIMULATED',
    note:
      mode === 'SIMULATED'
        ? 'IRN is generated locally (SIMULATED). Not submitted to GST portal.'
        : 'LIVE mode selected — UAT certification and HTTP transport gates apply; do not claim portal-ready without UAT.',
  }
}

export async function generateEInvoice(req: Request, tenantId: string, input: GenerateEInvoiceInput) {
  assertPerm(req, 'finance.tax.einvoice.manage')
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')
  const audit = auditFromRequest(req)
  const providerMode = getEInvoiceProviderMode()
  const idempotencyKey = input.idempotencyKey?.trim() || null

  const invoice = await prisma.salesInvoice.findFirst({
    where: { id: input.salesInvoiceId, tenantId },
    include: { legalEntity: true },
  })
  if (!invoice) throw new NotFoundError('Sales invoice not found')

  // Phase 11 — composition registration blocks IRN
  let sellerRegistrationScheme: string | null = null
  const reg = await prisma.gstRegistration.findFirst({
    where: {
      tenantId,
      legalEntityId: invoice.legalEntityId,
      isActive: true,
      OR: invoice.legalEntity.gstin
        ? [{ gstin: invoice.legalEntity.gstin }, { isPrimary: true }]
        : [{ isPrimary: true }],
    },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    select: { registrationType: true },
  })
  sellerRegistrationScheme = reg?.registrationType ?? null

  const readiness = checkEInvoiceReadiness({
    salesInvoiceStatus: invoice.status,
    legalEntityGstin: invoice.legalEntity.gstin,
    customerGstin: invoice.customerGstinSnapshot,
    invoiceNumber: invoice.invoiceNumber ?? invoice.draftReference,
    sellerRegistrationScheme,
  })
  if (!readiness.ok) {
    throw new GstEInvoiceNotReadyError(readiness.message)
  }

  const existing = await prisma.gstEInvoice.findFirst({
    where: { tenantId, salesInvoiceId: invoice.id },
  })

  const plan = planEInvoiceGenerate({
    existing: existing
      ? {
          status: existing.status,
          irn: existing.irn,
          idempotencyKey: existing.idempotencyKey,
        }
      : null,
    requestIdempotencyKey: idempotencyKey,
  })

  if (plan.action === 'IDEMPOTENT_RETURN' && existing) {
    return { item: serialize(existing), idempotentReplay: true }
  }
  if (plan.action === 'BLOCK') {
    throw new GstEInvoiceGenerateError(plan.reason ?? 'Cannot generate e-invoice')
  }

  // Stale PENDING lock: if another attempt is in flight recently, surface conflict.
  if (
    existing?.status === 'PENDING' &&
    existing.lastAttemptAt &&
    Date.now() - existing.lastAttemptAt.getTime() < 15_000
  ) {
    throw new GstEInvoiceGenerateError(
      'IRN generation already in progress for this invoice — retry shortly',
      existing.id,
    )
  }

  const baseSnapshot = {
    tenantId,
    legalEntityId: invoice.legalEntityId,
    salesInvoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    customerName: invoice.customerNameSnapshot,
    customerGstin: invoice.customerGstinSnapshot,
    taxableAmount: invoice.taxableAmount,
    taxAmount: invoice.totalTaxAmount,
    totalAmount: invoice.totalAmount,
    status: 'PENDING' as const,
    providerMode,
    idempotencyKey: idempotencyKey ?? existing?.idempotencyKey ?? null,
    lastAttemptAt: new Date(),
    exceptionMessage: null as string | null,
  }

  const pendingRow = await prisma.gstEInvoice.upsert({
    where: { tenantId_salesInvoiceId: { tenantId, salesInvoiceId: invoice.id } },
    create: {
      id: randomUUID(),
      ...baseSnapshot,
      attemptCount: 1,
      createdBy: userId,
    },
    update: {
      status: 'PENDING',
      providerMode,
      exceptionMessage: null,
      idempotencyKey: idempotencyKey ?? undefined,
      lastAttemptAt: new Date(),
      attemptCount: { increment: 1 },
      updatedBy: userId,
    },
  })

  const adapter = getNicGstAdapter()
  const irnRequest = {
    sellerGstin: invoice.legalEntity.gstin!,
    buyerGstin: invoice.customerGstinSnapshot,
    invoiceNumber: invoice.invoiceNumber ?? invoice.draftReference ?? invoice.id,
    invoiceDate: toDateOnlyString(invoice.invoiceDate),
    taxableAmount: money(invoice.taxableAmount),
    taxAmount: money(invoice.totalTaxAmount),
    totalAmount: money(invoice.totalAmount),
  }

  let nic
  try {
    nic = await adapter.generateIrn(irnRequest)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'NIC generate failed'
    const failed = await prisma.gstEInvoice.update({
      where: { id: pendingRow.id },
      data: {
        status: 'EXCEPTION',
        exceptionMessage: message.slice(0, 1000),
        lastRequestJson: irnRequest,
        lastResponseJson: { error: message, mode: providerMode },
        providerMode,
        updatedBy: userId,
      },
    })
    await createAuditLog({
      tenantId,
      userId: audit.userId,
      module: 'finance',
      entity: 'gst_e_invoice',
      entityId: failed.id,
      action: 'GENERATE_EXCEPTION',
      newValues: {
        salesInvoiceId: invoice.id,
        mode: providerMode,
        message: message.slice(0, 500),
        attemptCount: failed.attemptCount,
      },
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
    })
    throw new GstEInvoiceGenerateError(message, failed.id)
  }

  const row = await prisma.gstEInvoice.update({
    where: { id: pendingRow.id },
    data: {
      status: 'GENERATED',
      irn: nic.irn,
      ackNo: nic.ackNo,
      ackDate: nic.ackDate,
      qrPayload: nic.qrPayload,
      providerMode: nic.providerMode,
      providerRef: nic.providerRef,
      lastRequestJson: nic.requestSnapshot ?? irnRequest,
      lastResponseJson: nic.responseSnapshot ?? { irn: nic.irn, ackNo: nic.ackNo },
      exceptionMessage: null,
      updatedBy: userId,
    },
  })

  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'gst_e_invoice',
    entityId: row.id,
    action: 'GENERATE',
    newValues: {
      irn: row.irn,
      salesInvoiceId: invoice.id,
      mode: nic.providerMode,
      attemptCount: row.attemptCount,
      idempotencyKey: row.idempotencyKey,
    },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })

  return { item: serialize(row), idempotentReplay: false }
}

export async function cancelEInvoice(req: Request, tenantId: string, id: string, input: CancelGstDocumentInput) {
  assertPerm(req, 'finance.tax.einvoice.manage')
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')
  const audit = auditFromRequest(req)

  const row = await prisma.gstEInvoice.findFirst({ where: { id, tenantId } })
  if (!row) throw new NotFoundError('E-invoice not found')
  if (row.status === 'CANCELLED') return serialize(row)
  if (row.status !== 'GENERATED' || !row.irn) {
    throw new GstEInvoiceCancelError('Only generated e-invoices with an IRN can be cancelled')
  }

  const adapter = getNicGstAdapter()
  let nic
  try {
    nic = await adapter.cancelIrn(row.irn, input.reason)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'NIC cancel failed'
    await prisma.gstEInvoice.update({
      where: { id: row.id },
      data: {
        exceptionMessage: message.slice(0, 1000),
        lastRequestJson: { irn: row.irn, reason: input.reason },
        lastResponseJson: { error: message },
        updatedBy: userId,
      },
    })
    throw new GstEInvoiceCancelError(message)
  }

  const updated = await prisma.gstEInvoice.update({
    where: { id: row.id },
    data: {
      status: 'CANCELLED',
      cancelReason: input.reason,
      cancelledAt: nic.cancelledAt,
      cancelledBy: userId,
      providerRef: nic.providerRef,
      lastRequestJson: nic.requestSnapshot,
      lastResponseJson: nic.responseSnapshot,
      exceptionMessage: null,
      updatedBy: userId,
    },
  })

  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'gst_e_invoice',
    entityId: row.id,
    action: 'CANCEL',
    newValues: { reason: input.reason, irn: row.irn, mode: getEInvoiceProviderMode() },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })

  return serialize(updated)
}
