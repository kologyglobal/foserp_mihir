/**
 * Auto-create DRAFT Sales Invoice from a successful Dispatch posting.
 * Idempotent per DispatchPosting id. Does not post the invoice.
 */
import { prisma } from '../../../config/database.js'
import { env } from '../../../config/env.js'
import { createAuditLog } from '../../../services/audit.service.js'
import { logger } from '../../../config/logger.js'
import { calculateSalesInvoice } from '../../accounting/receivables/calculation/sales-invoice-calculation.service.js'
import { requireActiveCustomerParty } from '../../accounting/receivables/customer-party/customer-party.service.js'
import { buildInvoicePrefillFromDispatchLines } from '../../accounting/receivables/source/invoice-ready.service.js'
import * as siRepo from '../../accounting/receivables/sales-invoices/sales-invoice.repository.js'
import type { CreateSalesInvoiceInput } from '../../accounting/receivables/sales-invoices/sales-invoice.schemas.js'
import { buildCalculationInputFromRequest } from '../../accounting/receivables/sales-invoices/sales-invoice-validation.service.js'
import { getLegalEntityOrThrow } from '../../accounting/shared/finance.helpers.js'

export function isAutoSalesInvoiceFromDispatchEnabled(): boolean {
  return Boolean(env.ENABLE_AUTO_SALES_INVOICE_FROM_DISPATCH)
}

export type AutoDraftInvoiceResult =
  | { status: 'created'; salesInvoiceId: string; draftReference: string | null }
  | { status: 'existing'; salesInvoiceId: string; draftReference: string | null }
  | { status: 'skipped'; reason: string }

function dateOnlyIso(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

async function resolveLegalEntityId(tenantId: string): Promise<string | null> {
  const preferred = await prisma.legalEntity.findFirst({
    where: { tenantId, isActive: true, isDefault: true },
    select: { id: true },
  })
  if (preferred) return preferred.id
  const any = await prisma.legalEntity.findFirst({
    where: { tenantId, isActive: true },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })
  return any?.id ?? null
}

async function findExistingAutoInvoice(tenantId: string, postingId: string) {
  // Snapshot JSON path — MySQL JSON_EXTRACT via Prisma filter on string contains is weak;
  // use sourceDocumentId + metadata in snapshot by scanning recent OUTBOUND_DISPATCH drafts.
  const candidates = await prisma.salesInvoice.findMany({
    where: {
      tenantId,
      sourceType: 'OUTBOUND_DISPATCH',
      status: { in: ['DRAFT', 'READY_TO_POST', 'POSTED'] },
    },
    select: {
      id: true,
      draftReference: true,
      invoiceNumber: true,
      sourceDocumentId: true,
      sourceDocumentSnapshot: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  for (const row of candidates) {
    const snap = row.sourceDocumentSnapshot as { autoFromDispatchPostingId?: string } | null
    if (snap?.autoFromDispatchPostingId === postingId) {
      return row
    }
  }
  return null
}

/**
 * Create (or return existing) DRAFT Sales Invoice for a DispatchPosting.
 */
export async function createDraftSalesInvoiceFromDispatchPosting(
  tenantId: string,
  postingId: string,
  options?: { actorUserId?: string | null },
): Promise<AutoDraftInvoiceResult> {
  if (!isAutoSalesInvoiceFromDispatchEnabled()) {
    return { status: 'skipped', reason: 'ENABLE_AUTO_SALES_INVOICE_FROM_DISPATCH is off' }
  }

  const existing = await findExistingAutoInvoice(tenantId, postingId)
  if (existing) {
    return {
      status: 'existing',
      salesInvoiceId: existing.id,
      draftReference: existing.draftReference ?? existing.invoiceNumber,
    }
  }

  const posting = await prisma.dispatchPosting.findFirst({
    where: { id: postingId, tenantId },
    include: {
      lines: { orderBy: { lineNo: 'asc' } },
      outboundDispatch: {
        select: {
          id: true,
          dispatchNo: true,
          status: true,
          salesOrderId: true,
          salesOrderNo: true,
          customerId: true,
          deletedAt: true,
        },
      },
    },
  })
  if (!posting) return { status: 'skipped', reason: 'Dispatch posting not found' }
  if (posting.status === 'REVERSED') {
    return { status: 'skipped', reason: 'Dispatch posting is fully reversed' }
  }
  if (posting.outboundDispatch.deletedAt) {
    return { status: 'skipped', reason: 'Outbound dispatch deleted' }
  }
  if (posting.outboundDispatch.status === 'CANCELLED') {
    return { status: 'skipped', reason: 'Outbound dispatch cancelled' }
  }
  if (posting.outboundDispatch.status === 'REVERSED') {
    return { status: 'skipped', reason: 'Outbound dispatch reversed' }
  }

  const { getDispatchPostingPolicy } = await import('./dispatch-policy.js')
  const { isPodStatusInvoiceReady } = await import('../pod/dispatch-pod.service.js')
  const policy = getDispatchPostingPolicy({ forceHardened: true })
  if (policy.requirePodBeforeInvoice) {
    const pod = await prisma.dispatchProofOfDelivery.findFirst({
      where: { tenantId, outboundDispatchId: posting.outboundDispatchId },
      select: { status: true },
    })
    if (!isPodStatusInvoiceReady(pod?.status)) {
      return { status: 'skipped', reason: 'POD_REQUIRED_BEFORE_INVOICE' }
    }
  }
  if (posting.outboundDispatch.status !== 'CONFIRMED') {
    return { status: 'skipped', reason: `Outbound status ${posting.outboundDispatch.status} is not CONFIRMED` }
  }

  const lineIds = posting.lines
    .filter((l) => Number(l.quantity) - Number(l.reversedQuantity) > 1e-9)
    .map((l) => l.outboundDispatchLineId)
  if (!lineIds.length) {
    return { status: 'skipped', reason: 'No net posted quantity remaining to invoice' }
  }

  const prefill = await buildInvoicePrefillFromDispatchLines(tenantId, lineIds)
  // Restrict to this outbound only (prefill may reload broader ready set).
  const linesForDispatch = prefill.lines.filter((l) => l.outboundDispatchId === posting.outboundDispatchId)
  const linksForDispatch = prefill.sourceLinks.filter(
    (l) => l.sourceDocumentId === posting.outboundDispatchId,
  )
  if (!linesForDispatch.length || !linksForDispatch.length) {
    return { status: 'skipped', reason: 'No invoice-ready quantity on this dispatch (already invoiced or reversed)' }
  }

  const legalEntityId = await resolveLegalEntityId(tenantId)
  if (!legalEntityId) {
    return { status: 'skipped', reason: 'No active legal entity for tenant' }
  }
  const legalEntity = await getLegalEntityOrThrow(tenantId, legalEntityId)
  const party = await requireActiveCustomerParty(tenantId, prefill.customerId)

  const today = dateOnlyIso(
    posting.postingDate instanceof Date ? posting.postingDate : new Date(posting.postingDate),
  )
  let dueDate: string | null = null
  if (prefill.paymentTermsDays != null && prefill.paymentTermsDays > 0) {
    const due = new Date(`${today}T00:00:00.000Z`)
    due.setUTCDate(due.getUTCDate() + prefill.paymentTermsDays)
    dueDate = due.toISOString().slice(0, 10)
  }

  const placeOfSupply = party.stateCode || legalEntity.stateCode || null

  const input: CreateSalesInvoiceInput = {
    legalEntityId,
    branchId: null,
    customerId: prefill.customerId,
    sourceType: 'OUTBOUND_DISPATCH',
    sourceDocumentId: posting.outboundDispatchId,
    invoiceDate: today,
    postingDate: today,
    dueDate,
    paymentTermsDays: prefill.paymentTermsDays,
    placeOfSupply,
    taxTreatment: party.gstin ? 'REGISTERED' : 'UNREGISTERED',
    currencyCode: 'INR',
    exchangeRate: '1',
    taxPricingMode: 'EXCLUSIVE',
    freightMode: 'NON_TAXABLE',
    freightAmount: prefill.freightAmount ?? '0',
    otherChargesAmount: '0',
    roundingMode: 'NONE',
    referenceNumber: posting.outboundDispatch.dispatchNo,
    customerPoNumber: prefill.customerPoNumber,
    narration: `Auto draft from Dispatch ${posting.outboundDispatch.dispatchNo} / Posting ${posting.postingNumber}`,
    lines: linesForDispatch.map((l) => ({
      lineNumber: l.lineNumber,
      itemId: l.itemId,
      itemCode: l.itemCode,
      itemName: l.itemName,
      description: l.description,
      hsnCode: l.hsnCode,
      uom: l.uom,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      lineDiscountType: l.discountPct > 0 ? ('PERCENTAGE' as const) : undefined,
      lineDiscountValue: l.discountPct > 0 ? String(l.discountPct) : undefined,
      gstRate: l.taxPct > 0 ? String(l.taxPct) : undefined,
      cessRate: undefined,
      revenueAccountId: null,
      costCentreId: null,
      isTaxInclusive: undefined,
      sourceLineId: l.outboundDispatchLineId,
    })),
  }

  const calcInput = buildCalculationInputFromRequest(input, legalEntity.stateCode)
  const calc = calculateSalesInvoice(calcInput)
  if (!calc.valid) {
    const msg = calc.errors[0]?.message ?? 'Invoice calculation failed'
    logger.warn('auto_si_from_dispatch.calc_failed', { tenantId, postingId, message: msg })
    return { status: 'skipped', reason: `Calculation failed: ${msg}` }
  }

  // Race-safe re-check before create
  const raced = await findExistingAutoInvoice(tenantId, postingId)
  if (raced) {
    return {
      status: 'existing',
      salesInvoiceId: raced.id,
      draftReference: raced.draftReference ?? raced.invoiceNumber,
    }
  }

  const snapshot = {
    autoFromDispatchPostingId: postingId,
    postingNumber: posting.postingNumber,
    outboundDispatchId: posting.outboundDispatchId,
    dispatchNo: posting.outboundDispatch.dispatchNo,
    salesOrderId: posting.salesOrderId ?? posting.outboundDispatch.salesOrderId,
    salesOrderNo: posting.outboundDispatch.salesOrderNo,
    deliveryChallanId: posting.deliveryChallanId,
    billingAddress: prefill.billingAddress,
    shippingAddress: prefill.shippingAddress,
    projectRef: prefill.projectRef,
    projectNameSnapshot: prefill.projectNameSnapshot,
    createdByAutomation: true,
    createdAt: new Date().toISOString(),
  }

  const invoice = await siRepo.createSalesInvoiceDraft(
    tenantId,
    input,
    calc,
    party,
    options?.actorUserId ?? posting.postedBy ?? undefined,
    {
      sourceDocumentSnapshot: snapshot,
      sourceLinks: linksForDispatch.map((l) => ({
        sourceType: 'OUTBOUND_DISPATCH' as const,
        sourceDocumentId: l.sourceDocumentId,
        sourceLineId: l.sourceLineId,
        salesOrderId: l.salesOrderId,
        salesOrderLineId: l.salesOrderLineId,
        deliveryChallanId: l.deliveryChallanId,
        deliveryChallanLineId: l.deliveryChallanLineId,
        quantity: l.quantity,
        itemId: l.itemId,
        sourceDocumentNumberSnapshot: posting.outboundDispatch.dispatchNo,
      })),
    },
  )

  await createAuditLog({
    tenantId,
    userId: options?.actorUserId ?? posting.postedBy ?? undefined,
    module: 'finance',
    entity: 'sales_invoice',
    entityId: invoice.id,
    action: 'SALES_INVOICE_DRAFT_AUTO_FROM_DISPATCH',
    newValues: {
      draftReference: invoice.draftReference,
      postingId,
      outboundDispatchId: posting.outboundDispatchId,
      status: 'DRAFT',
    },
  }).catch(() => {})

  logger.info('auto_si_from_dispatch.created', {
    tenantId,
    postingId,
    salesInvoiceId: invoice.id,
    draftReference: invoice.draftReference,
  })

  return {
    status: 'created',
    salesInvoiceId: invoice.id,
    draftReference: invoice.draftReference,
  }
}
