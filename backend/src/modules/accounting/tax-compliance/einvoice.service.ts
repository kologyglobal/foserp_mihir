/**
 * E-Invoice register — generate/cancel IRN via NIC adapter (SIMULATED by default).
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
  return { items: rows.map(serialize), total, page: query.page, pageSize: query.pageSize }
}

export async function getEInvoice(req: Request, tenantId: string, id: string) {
  assertPerm(req, 'finance.tax.view')
  const row = await prisma.gstEInvoice.findFirst({ where: { id, tenantId } })
  if (!row) throw new NotFoundError('E-invoice not found')
  return serialize(row)
}

export async function generateEInvoice(req: Request, tenantId: string, input: GenerateEInvoiceInput) {
  assertPerm(req, 'finance.tax.einvoice.manage')
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')
  const audit = auditFromRequest(req)

  const invoice = await prisma.salesInvoice.findFirst({
    where: { id: input.salesInvoiceId, tenantId },
    include: { legalEntity: true },
  })
  if (!invoice) throw new NotFoundError('Sales invoice not found')
  if (invoice.status !== 'POSTED') {
    throw new GstEInvoiceNotReadyError('Only posted sales invoices can generate an e-invoice')
  }
  if (!invoice.legalEntity.gstin) {
    throw new GstEInvoiceNotReadyError('Legal entity GSTIN is required to generate an e-invoice')
  }
  if (!invoice.customerGstinSnapshot) {
    throw new GstEInvoiceNotReadyError('Customer GSTIN is required for B2B e-invoice generation')
  }

  const existing = await prisma.gstEInvoice.findFirst({
    where: { tenantId, salesInvoiceId: invoice.id },
  })
  if (existing?.status === 'GENERATED') {
    return { item: serialize(existing), idempotentReplay: true }
  }
  if (existing?.status === 'CANCELLED') {
    throw new GstEInvoiceGenerateError('Previous IRN was cancelled — create a revised invoice before regenerating')
  }

  const adapter = getNicGstAdapter()
  let nic
  try {
    nic = await adapter.generateIrn({
      sellerGstin: invoice.legalEntity.gstin,
      buyerGstin: invoice.customerGstinSnapshot,
      invoiceNumber: invoice.invoiceNumber ?? invoice.draftReference ?? invoice.id,
      invoiceDate: toDateOnlyString(invoice.invoiceDate),
      taxableAmount: money(invoice.taxableAmount),
      taxAmount: money(invoice.totalTaxAmount),
      totalAmount: money(invoice.totalAmount),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'NIC generate failed'
    const failed = await prisma.gstEInvoice.upsert({
      where: { tenantId_salesInvoiceId: { tenantId, salesInvoiceId: invoice.id } },
      create: {
        id: randomUUID(),
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
        status: 'EXCEPTION',
        exceptionMessage: message.slice(0, 1000),
        providerMode: 'SIMULATED',
        createdBy: userId,
      },
      update: {
        status: 'EXCEPTION',
        exceptionMessage: message.slice(0, 1000),
        updatedBy: userId,
      },
    })
    throw new GstEInvoiceGenerateError(message, failed.id)
  }

  const row = await prisma.gstEInvoice.upsert({
    where: { tenantId_salesInvoiceId: { tenantId, salesInvoiceId: invoice.id } },
    create: {
      id: randomUUID(),
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
      status: 'GENERATED',
      irn: nic.irn,
      ackNo: nic.ackNo,
      ackDate: nic.ackDate,
      qrPayload: nic.qrPayload,
      providerMode: nic.providerMode,
      providerRef: nic.providerRef,
      createdBy: userId,
    },
    update: {
      status: 'GENERATED',
      irn: nic.irn,
      ackNo: nic.ackNo,
      ackDate: nic.ackDate,
      qrPayload: nic.qrPayload,
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
    entity: 'gst_e_invoice',
    entityId: row.id,
    action: 'GENERATE',
    newValues: { irn: row.irn, salesInvoiceId: invoice.id, mode: nic.providerMode },
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
  const nic = await adapter.cancelIrn(row.irn, input.reason)
  const updated = await prisma.gstEInvoice.update({
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
    entity: 'gst_e_invoice',
    entityId: row.id,
    action: 'CANCEL',
    newValues: { reason: input.reason, irn: row.irn },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })

  return serialize(updated)
}
