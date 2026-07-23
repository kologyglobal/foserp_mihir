import type { Prisma, PurchaseInvoiceStatus } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { resolveEffectivePurchaseDefaults } from '../shared/purchase-defaults.js'
import { PurchaseInvoiceNotFoundError, PurchaseInvoiceValidationError } from './purchase-invoice.errors.js'
import { mapPurchaseInvoice, type PurchaseInvoiceEnrichment } from './purchase-invoice.mapper.js'
import * as repo from './purchase-invoice.repository.js'
import type {
  CreatePurchaseInvoiceInput, ListPurchaseInvoicesQuery, PurchaseInvoiceLineInput, UpdatePurchaseInvoiceInput,
} from './purchase-invoice.validation.js'
import {
  assertInvoiceLines, assertInvoiceStatus, invoiceMoney, invoiceQty, parseInvoiceDate,
} from './purchase-invoice.workflow.js'

type Defaults = Awaited<ReturnType<typeof resolveEffectivePurchaseDefaults>>
type InvoiceRow = NonNullable<Awaited<ReturnType<typeof repo.findPurchaseInvoiceById>>>

function parsePaymentTermsDays(terms: string | null | undefined): number {
  if (!terms?.trim()) return 30
  const match = terms.match(/(\d+)/)
  const days = match ? Number(match[1]) : 30
  return Number.isFinite(days) && days >= 0 ? days : 30
}

function addDaysIso(dateIso: string | null | undefined, days: number): string | null {
  if (!dateIso) return null
  const base = new Date(`${dateIso}T00:00:00.000Z`)
  if (Number.isNaN(base.getTime())) return null
  base.setUTCDate(base.getUTCDate() + days)
  return base.toISOString().slice(0, 10)
}

async function enrichmentForInvoices(
  tenantId: string,
  invoices: Array<{ purchaseOrderId: string | null; goodsReceiptId: string | null; vendorInvoiceDate: Date | null; invoiceDate: Date }>,
): Promise<Map<number, PurchaseInvoiceEnrichment>> {
  const poIds = [...new Set(invoices.map((i) => i.purchaseOrderId).filter(Boolean))] as string[]
  const grnIds = [...new Set(invoices.map((i) => i.goodsReceiptId).filter(Boolean))] as string[]
  const [pos, grns] = await Promise.all([
    poIds.length
      ? prisma.purchaseOrder.findMany({
          where: { tenantId, id: { in: poIds }, deletedAt: null },
          select: { id: true, orderNumber: true, paymentTerms: true },
        })
      : Promise.resolve([]),
    grnIds.length
      ? prisma.goodsReceipt.findMany({
          where: { tenantId, id: { in: grnIds }, deletedAt: null },
          select: { id: true, grnNumber: true },
        })
      : Promise.resolve([]),
  ])
  const poById = new Map(pos.map((p) => [p.id, p]))
  const grnById = new Map(grns.map((g) => [g.id, g]))
  const out = new Map<number, PurchaseInvoiceEnrichment>()
  invoices.forEach((invoice, index) => {
    const po = invoice.purchaseOrderId ? poById.get(invoice.purchaseOrderId) : undefined
    const grn = invoice.goodsReceiptId ? grnById.get(invoice.goodsReceiptId) : undefined
    const paymentTerms = po?.paymentTerms || ''
    const baseDate = dateOnly(invoice.vendorInvoiceDate) || dateOnly(invoice.invoiceDate)
    out.set(index, {
      purchaseOrderNumber: po?.orderNumber ?? '',
      goodsReceiptNumber: grn?.grnNumber ?? '',
      paymentTerms,
      dueDate: addDaysIso(baseDate, parsePaymentTermsDays(paymentTerms)),
    })
  })
  return out
}

function dateOnly(value?: Date | null) {
  return value?.toISOString().slice(0, 10) ?? null
}

async function toInvoiceDto(tenantId: string, invoice: InvoiceRow) {
  const enrichment = await enrichmentForInvoices(tenantId, [invoice])
  return mapPurchaseInvoice(invoice, enrichment.get(0))
}

async function loadOrThrow(tenantId: string, id: string) {
  const invoice = await repo.findPurchaseInvoiceById(tenantId, id)
  if (!invoice) throw new PurchaseInvoiceNotFoundError()
  return invoice
}

async function resolveReferences(
  tenantId: string,
  input: Pick<CreatePurchaseInvoiceInput, 'vendorId' | 'purchaseOrderId' | 'goodsReceiptId'>,
  defaults: Defaults,
) {
  const vendor = await prisma.masterVendor.findFirst({ where: { id: input.vendorId, ...tenantActiveFilter(tenantId), status: 'ACTIVE' } })
  if (!vendor) throw new PurchaseInvoiceValidationError('Vendor not found or inactive.', [{ field: 'vendorId', message: 'Vendor not found or inactive.' }])
  const po = input.purchaseOrderId
    ? await prisma.purchaseOrder.findFirst({ where: { id: input.purchaseOrderId, ...tenantActiveFilter(tenantId), vendorId: input.vendorId }, include: { lines: true } })
    : null
  const grn = input.goodsReceiptId
    ? await prisma.goodsReceipt.findFirst({ where: { id: input.goodsReceiptId, ...tenantActiveFilter(tenantId), vendorId: input.vendorId }, include: { lines: true } })
    : null
  if (input.purchaseOrderId && !po) throw new PurchaseInvoiceValidationError('Purchase order does not belong to this tenant and vendor.', [{ field: 'purchaseOrderId', message: 'Invalid purchase order.' }])
  if (input.goodsReceiptId && !grn) throw new PurchaseInvoiceValidationError('Goods receipt does not belong to this tenant and vendor.', [{ field: 'goodsReceiptId', message: 'Invalid goods receipt.' }])
  if (po && grn && grn.purchaseOrderId !== po.id) throw new PurchaseInvoiceValidationError('Goods receipt does not belong to the selected purchase order.')
  const direct = !po && !grn
  const errors: Array<{ field: string; message: string }> = []
  if (direct && !defaults.allowDirectInvoice) errors.push({ field: 'purchaseOrderId', message: 'Direct invoices are disabled in Purchase Setup.' })
  if (defaults.requirePoMatch && !po) errors.push({ field: 'purchaseOrderId', message: 'Purchase order match is required.' })
  if (defaults.requireGrnMatch && !grn) errors.push({ field: 'goodsReceiptId', message: 'Goods receipt match is required.' })
  if (errors.length) throw new PurchaseInvoiceValidationError('Invoice matching requirements are not met.', errors)
  return { vendor, po, grn, direct }
}

function buildLines(
  inputs: PurchaseInvoiceLineInput[],
  refs: Awaited<ReturnType<typeof resolveReferences>>,
) {
  assertInvoiceLines(inputs)
  const poLines = new Map((refs.po?.lines ?? []).map((line) => [line.id, line]))
  const grnLines = new Map((refs.grn?.lines ?? []).map((line) => [line.id, line]))
  return inputs.map((input, index) => {
    const poLine = input.purchaseOrderLineId ? poLines.get(input.purchaseOrderLineId) : undefined
    const grnLine = input.goodsReceiptLineId ? grnLines.get(input.goodsReceiptLineId) : undefined
    if (input.purchaseOrderLineId && !poLine) throw new PurchaseInvoiceValidationError(`Invoice line ${index + 1} has an invalid PO line.`)
    if (input.goodsReceiptLineId && !grnLine) throw new PurchaseInvoiceValidationError(`Invoice line ${index + 1} has an invalid GRN line.`)
    if (poLine && grnLine && grnLine.purchaseOrderLineId !== poLine.id) throw new PurchaseInvoiceValidationError(`Invoice line ${index + 1} PO/GRN references do not match.`)
    const quantity = invoiceQty(input.quantity)
    const rate = invoiceQty(input.rate)
    const amount = invoiceMoney(quantity * rate)
    const taxAmount = invoiceMoney(amount * invoiceQty(input.taxRatePct) / 100)
    return {
      lineNumber: index + 1,
      purchaseOrderLineId: poLine?.id ?? null,
      goodsReceiptLineId: grnLine?.id ?? null,
      itemId: input.itemId ?? grnLine?.itemId ?? poLine?.itemId ?? null,
      itemCodeSnapshot: input.itemCode || grnLine?.itemCodeSnapshot || poLine?.itemCodeSnapshot || '',
      itemNameSnapshot: input.itemName || grnLine?.itemNameSnapshot || poLine?.itemNameSnapshot || '',
      description: input.description ?? poLine?.description ?? null,
      quantity, uomCodeSnapshot: input.uomCode ?? grnLine?.uomCodeSnapshot ?? '',
      rate, amount, taxRatePct: invoiceQty(input.taxRatePct), taxAmount,
      lineTotal: invoiceMoney(amount + taxAmount), remarks: input.remarks?.trim() || null,
    }
  })
}

function totals(lines: ReturnType<typeof buildLines>, roundOff = 0) {
  const subtotalAmount = invoiceMoney(lines.reduce((sum, line) => sum + line.amount, 0))
  const taxAmount = invoiceMoney(lines.reduce((sum, line) => sum + line.taxAmount, 0))
  return { subtotalAmount, taxAmount, roundOffAmount: invoiceMoney(roundOff), totalAmount: invoiceMoney(subtotalAmount + taxAmount + roundOff) }
}

function evaluateMatching(
  invoice: Awaited<ReturnType<typeof loadOrThrow>>,
  po: Awaited<ReturnType<typeof resolveReferences>>['po'],
  grn: Awaited<ReturnType<typeof resolveReferences>>['grn'],
  defaults: Defaults,
) {
  const poLines = new Map((po?.lines ?? []).map((line) => [line.id, line]))
  const grnLines = new Map((grn?.lines ?? []).map((line) => [line.id, line]))
  const failures: string[] = []
  for (const line of invoice.lines) {
    const poLine = line.purchaseOrderLineId ? poLines.get(line.purchaseOrderLineId) : undefined
    const grnLine = line.goodsReceiptLineId ? grnLines.get(line.goodsReceiptLineId) : undefined
    const qtyBase = invoiceQty(grnLine?.receivedQuantity ?? poLine?.quantity)
    const rateBase = invoiceQty(poLine?.rate)
    const quantity = invoiceQty(line.quantity)
    const rate = invoiceQty(line.rate)
    const amount = invoiceQty(line.amount)
    const expectedAmount = qtyBase * rateBase
    const qtyPct = qtyBase ? Math.abs(quantity - qtyBase) / qtyBase * 100 : (quantity ? Infinity : 0)
    const ratePct = rateBase ? Math.abs(rate - rateBase) / rateBase * 100 : (rate ? Infinity : 0)
    const amountDiff = Math.abs(amount - expectedAmount)
    const amountPct = expectedAmount ? amountDiff / expectedAmount * 100 : (amount ? Infinity : 0)
    if (defaults.requirePoMatch && !poLine) failures.push(`Line ${line.lineNumber}: PO line required`)
    if (defaults.requireGrnMatch && !grnLine) failures.push(`Line ${line.lineNumber}: GRN line required`)
    if (qtyPct > defaults.quantityTolerancePct) failures.push(`Line ${line.lineNumber}: quantity tolerance exceeded`)
    if (ratePct > defaults.rateTolerancePct) failures.push(`Line ${line.lineNumber}: rate tolerance exceeded`)
    if (amountDiff > defaults.amountToleranceInr && amountPct > defaults.amountTolerancePct) failures.push(`Line ${line.lineNumber}: amount tolerance exceeded`)
  }
  if (po && invoiceQty(po.subtotalAmount) > 0) {
    const expectedTax = invoiceQty(po.taxAmount) *
      (invoiceQty(invoice.subtotalAmount) / invoiceQty(po.subtotalAmount))
    const taxDiff = Math.abs(invoiceQty(invoice.taxAmount) - expectedTax)
    const taxPct = expectedTax
      ? taxDiff / expectedTax * 100
      : invoiceQty(invoice.taxAmount) ? Infinity : 0
    if (taxDiff > defaults.taxToleranceInr && taxPct > defaults.taxTolerancePct) {
      failures.push('Invoice tax tolerance exceeded')
    }
  }
  return failures
}

export async function listPurchaseInvoices(tenantId: string, query: ListPurchaseInvoicesQuery) {
  const result = await repo.findPurchaseInvoices(tenantId, query)
  const enrichment = await enrichmentForInvoices(tenantId, result.items)
  return {
    ...result,
    items: result.items.map((row, index) => mapPurchaseInvoice(row, enrichment.get(index))),
  }
}
export async function getPurchaseInvoice(tenantId: string, id: string) {
  return toInvoiceDto(tenantId, await loadOrThrow(tenantId, id))
}

export async function createPurchaseInvoice(tenantId: string, actorId: string, input: CreatePurchaseInvoiceInput) {
  const defaults = await resolveEffectivePurchaseDefaults(tenantId, input.plantId)
  const refs = await resolveReferences(tenantId, input, defaults)
  const lines = buildLines(input.lines, refs)
  const calculated = totals(lines, input.roundOffAmount)
  const invoiceNumber = await nextCode(tenantId, 'PURCHASE_INVOICE')
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.purchaseInvoice.create({ data: {
      tenantId, invoiceNumber, invoiceDate: parseInvoiceDate(input.invoiceDate) ?? new Date(),
      vendorInvoiceNumber: input.vendorInvoiceNumber?.trim() || null,
      vendorInvoiceDate: parseInvoiceDate(input.vendorInvoiceDate),
      vendorId: refs.vendor.id, purchaseOrderId: refs.po?.id ?? null, goodsReceiptId: refs.grn?.id ?? null,
      status: 'DRAFT', isDirectInvoice: refs.direct,
      currencyCode: input.currencyCode ?? defaults.defaultCurrencyCode,
      gstScheme: input.gstScheme ?? defaults.defaultGstScheme,
      placeOfSupplyState: input.placeOfSupplyState ?? defaults.placeOfSupplyState,
      placeOfSupplyStateCode: input.placeOfSupplyStateCode ?? defaults.placeOfSupplyStateCode,
      reverseCharge: input.reverseCharge ?? defaults.reverseChargeDefault,
      ...calculated, overrideAuthorized: false, overrideRemarks: null,
      remarks: input.remarks?.trim() || null, createdById: actorId, updatedById: actorId,
      lines: { create: lines.map((line) => ({ ...line, tenantId })) },
    }, include: repo.includePurchaseInvoice })
    await repo.addInvoiceHistory(tenantId, row.id, row.invoiceNumber, 'INVOICE_CREATED', null, 'DRAFT', actorId, undefined, tx)
    return row
  })
  return toInvoiceDto(tenantId, created as InvoiceRow)
}

export async function updatePurchaseInvoice(tenantId: string, id: string, actorId: string, input: UpdatePurchaseInvoiceInput) {
  const existing = await loadOrThrow(tenantId, id)
  assertInvoiceStatus(existing.status, ['DRAFT'], 'updated')
  const vendorId = input.vendorId ?? existing.vendorId
  const purchaseOrderId = input.purchaseOrderId !== undefined ? input.purchaseOrderId : existing.purchaseOrderId
  const goodsReceiptId = input.goodsReceiptId !== undefined ? input.goodsReceiptId : existing.goodsReceiptId
  const defaults = await resolveEffectivePurchaseDefaults(tenantId, input.plantId)
  const refs = await resolveReferences(tenantId, { vendorId, purchaseOrderId, goodsReceiptId }, defaults)
  const lines = input.lines ? buildLines(input.lines, refs) : undefined
  const calculated = lines ? totals(lines, input.roundOffAmount ?? invoiceQty(existing.roundOffAmount)) : undefined
  await prisma.$transaction(async (tx) => {
    if (lines) await repo.replacePurchaseInvoiceLines(tenantId, id, lines, tx)
    await repo.updatePurchaseInvoice(tenantId, id, {
      vendorId, purchaseOrderId, goodsReceiptId, isDirectInvoice: refs.direct, updatedById: actorId,
      ...(input.invoiceDate !== undefined ? { invoiceDate: parseInvoiceDate(input.invoiceDate) ?? existing.invoiceDate } : {}),
      ...(input.vendorInvoiceNumber !== undefined ? { vendorInvoiceNumber: input.vendorInvoiceNumber?.trim() || null } : {}),
      ...(input.vendorInvoiceDate !== undefined ? { vendorInvoiceDate: parseInvoiceDate(input.vendorInvoiceDate) } : {}),
      ...(input.currencyCode !== undefined ? { currencyCode: input.currencyCode } : {}),
      ...(input.gstScheme !== undefined ? { gstScheme: input.gstScheme } : {}),
      ...(input.placeOfSupplyState !== undefined ? { placeOfSupplyState: input.placeOfSupplyState } : {}),
      ...(input.placeOfSupplyStateCode !== undefined ? { placeOfSupplyStateCode: input.placeOfSupplyStateCode } : {}),
      ...(input.reverseCharge !== undefined ? { reverseCharge: input.reverseCharge } : {}),
      ...(input.remarks !== undefined ? { remarks: input.remarks?.trim() || null } : {}),
      ...(calculated ?? {}),
    }, tx)
    await repo.addInvoiceHistory(tenantId, id, existing.invoiceNumber, 'INVOICE_UPDATED', existing.status, existing.status, actorId, undefined, tx)
  })
  return toInvoiceDto(tenantId, await loadOrThrow(tenantId, id))
}

export async function submitPurchaseInvoice(
  tenantId: string, id: string, actorId: string,
  body: { remarks?: string; overrideAuthorized?: boolean; overrideRemarks?: string } = {},
) {
  const existing = await loadOrThrow(tenantId, id)
  assertInvoiceStatus(existing.status, ['DRAFT', 'REJECTED'], 'submitted')
  assertInvoiceLines(existing.lines)
  const defaults = await resolveEffectivePurchaseDefaults(tenantId)
  const refs = await resolveReferences(tenantId, existing, defaults)
  const failures = evaluateMatching(existing, refs.po, refs.grn, defaults)
  const override = Boolean(body.overrideAuthorized)
  if (failures.length && (!override || !defaults.allowAuthorizedOverride || !body.overrideRemarks?.trim())) {
    throw new PurchaseInvoiceValidationError('Invoice matching tolerances exceeded.', failures.map((message) => ({ field: 'lines', message })))
  }
  const matchingStatus = failures.length ? 'OVERRIDDEN' : 'MATCHED'
  await transition(tenantId, existing, actorId, 'PENDING_APPROVAL', 'INVOICE_SUBMITTED', body.remarks, {
    submittedAt: new Date(), matchingStatus, matchingRemarks: failures.join('; ') || null,
    overrideAuthorized: failures.length ? true : false,
    overrideRemarks: failures.length ? body.overrideRemarks!.trim() : null,
  })
  return toInvoiceDto(tenantId, await loadOrThrow(tenantId, id))
}

async function transition(
  tenantId: string, existing: Awaited<ReturnType<typeof loadOrThrow>>, actorId: string,
  status: PurchaseInvoiceStatus, action: string, remarks?: string,
  extra: Prisma.PurchaseInvoiceUncheckedUpdateInput = {},
) {
  await prisma.$transaction(async (tx) => {
    await repo.updatePurchaseInvoice(tenantId, existing.id, { status, updatedById: actorId, remarks: remarks?.trim() || existing.remarks, ...extra }, tx)
    await repo.addInvoiceHistory(tenantId, existing.id, existing.invoiceNumber, action, existing.status, status, actorId, remarks, tx)
  })
}

export async function approvePurchaseInvoice(tenantId: string, id: string, actorId: string, body: { remarks?: string } = {}) {
  const existing = await loadOrThrow(tenantId, id); assertInvoiceStatus(existing.status, ['PENDING_APPROVAL'], 'approved')
  await transition(tenantId, existing, actorId, 'APPROVED', 'INVOICE_APPROVED', body.remarks, { approvedAt: new Date() })
  return toInvoiceDto(tenantId, await loadOrThrow(tenantId, id))
}
export async function rejectPurchaseInvoice(tenantId: string, id: string, actorId: string, body: { remarks?: string } = {}) {
  const existing = await loadOrThrow(tenantId, id); assertInvoiceStatus(existing.status, ['PENDING_APPROVAL'], 'rejected')
  await transition(tenantId, existing, actorId, 'REJECTED', 'INVOICE_REJECTED', body.remarks)
  return toInvoiceDto(tenantId, await loadOrThrow(tenantId, id))
}
export async function postPurchaseInvoice(tenantId: string, id: string, actorId: string, body: { remarks?: string } = {}) {
  const existing = await loadOrThrow(tenantId, id); assertInvoiceStatus(existing.status, ['APPROVED', 'MATCHED', 'PARTIALLY_MATCHED'], 'posted')
  await transition(tenantId, existing, actorId, 'POSTED', 'INVOICE_POSTED', body.remarks, { postedAt: new Date() })
  await prisma.$transaction(existing.lines.filter((line) => line.purchaseOrderLineId).map((line) =>
    prisma.purchaseOrderLine.updateMany({
      where: { id: line.purchaseOrderLineId!, tenantId },
      data: { invoicedQuantity: { increment: invoiceQty(line.quantity) } },
    })))
  // Soft AP handoff — create VendorInvoice draft (no GL posting from Purchase).
  const { handoffPurchaseInvoiceToVendorInvoiceDraft } = await import('./purchase-invoice-ap-handoff.service.js')
  const ap = await handoffPurchaseInvoiceToVendorInvoiceDraft(tenantId, id, actorId)
  const mapped = await toInvoiceDto(tenantId, await loadOrThrow(tenantId, id))
  return { ...mapped, apHandoff: ap }
}

export async function previewPurchaseInvoiceApHandoff(tenantId: string, id: string) {
  await loadOrThrow(tenantId, id)
  const { buildVendorInvoiceDraftPreview } = await import('./purchase-invoice-ap-handoff.service.js')
  return buildVendorInvoiceDraftPreview(tenantId, id)
}
export async function cancelPurchaseInvoice(tenantId: string, id: string, actorId: string, body: { remarks?: string } = {}) {
  const existing = await loadOrThrow(tenantId, id); assertInvoiceStatus(existing.status, ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'MATCHED', 'PARTIALLY_MATCHED', 'MISMATCH'], 'cancelled')
  await transition(tenantId, existing, actorId, 'CANCELLED', 'INVOICE_CANCELLED', body.remarks, { cancelledAt: new Date() })
  return toInvoiceDto(tenantId, await loadOrThrow(tenantId, id))
}
