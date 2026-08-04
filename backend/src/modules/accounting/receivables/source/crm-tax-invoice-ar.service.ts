/**
 * CRM Tax Invoice → Money In AR bridge.
 * Prefill + convert handoff; payment sync from AR open items back to CrmTaxInvoice.
 */
import { prisma } from '../../../../config/prisma.js'
import { NotFoundError, ValidationError } from '../../../../utils/errors.js'
import { createAuditLog } from '../../../../services/audit.service.js'

function dateOnly(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 10)
  return d.toISOString().slice(0, 10)
}

export type CrmPendingTaxInvoiceRow = {
  id: string
  invoiceNo: string
  invoiceDate: string
  dueDate: string
  customerId: string
  customerName: string
  grandTotal: string
  balanceDue: string
  paymentStatus: string
  status: string
  accountingStatus: string
  createdBy: string | null
  createdByName: string | null
  salesOrderId: string | null
  salesOrderNo: string | null
  salesInvoiceId: string | null
  salesInvoiceNumber: string | null
  accountingSubmittedAt: string | null
}

export type InvoicePrefillFromCrmTaxInvoice = {
  sourceType: 'CRM_TAX_INVOICE'
  sourceDocumentId: string
  customerId: string
  customerName: string
  invoiceDate: string
  dueDate: string | null
  customerPoNumber: string | null
  paymentTermsDays: number | null
  salesOrderId: string | null
  salesOrderNo: string | null
  narration: string | null
  createdByName: string | null
  lines: Array<{
    itemId: string | null
    itemCode: string | null
    description: string
    quantity: string
    unitPrice: string
    hsnCode: string | null
    uom: string | null
    taxRate: string | null
    sourceLineId: string | null
  }>
  sourceDocumentSnapshot: {
    crmTaxInvoiceId: string
    invoiceNo: string
    createdBy: string | null
    createdByName: string | null
  }
}

export async function listCrmPendingTaxInvoices(
  _tenantId: string,
  query?: { companyId?: string; search?: string; page?: number; limit?: number },
): Promise<{ items: CrmPendingTaxInvoiceRow[]; total: number; page: number; limit: number }> {
  // Unified model: no convert queue — CRM creates SalesInvoice directly.
  const page = query?.page ?? 1
  const limit = Math.min(query?.limit ?? 50, 100)
  return { items: [], total: 0, page, limit }
}

export async function buildPrefillFromCrmTaxInvoice(
  tenantId: string,
  crmTaxInvoiceId: string,
): Promise<InvoicePrefillFromCrmTaxInvoice> {
  const inv = await prisma.crmTaxInvoice.findFirst({
    where: { id: crmTaxInvoiceId, tenantId, deletedAt: null },
    include: { lines: { where: { deletedAt: null }, orderBy: { lineNo: 'asc' } } },
  })
  if (!inv) throw new NotFoundError('CRM tax invoice not found')
  if (inv.status === 'draft' || inv.status === 'cancelled') {
    throw new ValidationError('Only posted CRM tax invoices can be converted to Money In')
  }
  if (inv.accountingStatus === 'converted' && inv.salesInvoiceId) {
    throw new ValidationError(
      `Already converted to Sales Invoice ${inv.salesInvoiceNumber ?? inv.salesInvoiceId}`,
    )
  }
  if (inv.accountingStatus !== 'pending_review' && inv.accountingStatus !== 'none') {
    throw new ValidationError(`CRM tax invoice is not pending accounting review (${inv.accountingStatus})`)
  }

  // Existing SI with same source?
  const existing = await prisma.salesInvoice.findFirst({
    where: {
      tenantId,
      sourceType: 'CRM_TAX_INVOICE',
      sourceDocumentId: inv.id,
      status: { in: ['DRAFT', 'READY_TO_POST', 'POSTED'] },
    },
    select: { id: true, invoiceNumber: true, draftReference: true },
  })
  if (existing) {
    throw new ValidationError(
      `Sales Invoice already exists for this CRM tax invoice (${existing.invoiceNumber ?? existing.draftReference ?? existing.id})`,
    )
  }

  return {
    sourceType: 'CRM_TAX_INVOICE',
    sourceDocumentId: inv.id,
    customerId: inv.companyId,
    customerName: inv.customerNameSnapshot,
    invoiceDate: dateOnly(inv.invoiceDate),
    dueDate: dateOnly(inv.dueDate),
    customerPoNumber: inv.customerPoNumber,
    paymentTermsDays: null,
    salesOrderId: inv.salesOrderId,
    salesOrderNo: inv.salesOrderNo,
    narration: inv.remarks,
    createdByName: inv.createdByNameSnapshot,
    lines: inv.lines.map((l) => ({
      itemId: l.itemId,
      itemCode: l.itemCode,
      description: l.description,
      quantity: l.qty.toFixed(4),
      unitPrice: l.unitPrice.toFixed(2),
      hsnCode: l.hsnCode,
      uom: l.uom,
      taxRate: l.taxPct.toFixed(2),
      sourceLineId: l.id,
    })),
    sourceDocumentSnapshot: {
      crmTaxInvoiceId: inv.id,
      invoiceNo: inv.invoiceNo,
      createdBy: inv.createdBy,
      createdByName: inv.createdByNameSnapshot,
    },
  }
}

/** Mark CRM tax invoice as converted after Money In draft is created. */
export async function linkCrmTaxInvoiceToSalesInvoice(args: {
  tenantId: string
  crmTaxInvoiceId: string
  salesInvoiceId: string
  salesInvoiceNumber: string | null
  userId?: string | null
}): Promise<void> {
  const inv = await prisma.crmTaxInvoice.findFirst({
    where: { id: args.crmTaxInvoiceId, tenantId: args.tenantId, deletedAt: null },
  })
  if (!inv) throw new NotFoundError('CRM tax invoice not found')
  if (inv.salesInvoiceId && inv.salesInvoiceId !== args.salesInvoiceId) {
    throw new ValidationError('CRM tax invoice already linked to another Sales Invoice')
  }

  await prisma.crmTaxInvoice.updateMany({
    where: { id: args.crmTaxInvoiceId, tenantId: args.tenantId, deletedAt: null },
    data: {
      accountingStatus: 'converted',
      salesInvoiceId: args.salesInvoiceId,
      salesInvoiceNumber: args.salesInvoiceNumber,
      accountingConvertedAt: new Date(),
      updatedBy: args.userId ?? undefined,
    },
  })

  await createAuditLog({
    tenantId: args.tenantId,
    userId: args.userId ?? null,
    module: 'crm',
    entity: 'crmTaxInvoice',
    entityId: args.crmTaxInvoiceId,
    action: 'AR_CONVERT',
    newValues: {
      salesInvoiceId: args.salesInvoiceId,
      salesInvoiceNumber: args.salesInvoiceNumber,
    },
  })
}

/**
 * Sync CRM tax invoice payment fields from AR open-item settlement.
 * @deprecated Unified invoice: payment lives on SalesInvoice / open items only. No-op.
 */
export async function syncCrmTaxInvoicePaymentFromSalesInvoice(
  _tenantId: string,
  _salesInvoiceId: string,
  _userId?: string | null,
): Promise<void> {
  return
}

/** Alias for syncCrmTaxInvoicePaymentFromSalesInvoice — centralized naming. */
export const syncAccountingPaymentStateToCrmTaxInvoice = syncCrmTaxInvoicePaymentFromSalesInvoice

/** Sync all CRM-linked invoices touched by an allocation batch. */
export async function syncCrmTaxInvoicesForAllocationBatch(
  tenantId: string,
  salesInvoiceIds: string[],
  userId?: string | null,
): Promise<void> {
  const unique = [...new Set(salesInvoiceIds.filter(Boolean))]
  for (const id of unique) {
    await syncCrmTaxInvoicePaymentFromSalesInvoice(tenantId, id, userId)
  }
}
