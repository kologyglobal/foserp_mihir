/**
 * FIN-CLOSE-1 — Purchase Return → AP adjustment (Vendor Debit Note).
 *
 * Ownership: Purchase owns the return document; Accounting owns the liability.
 * This service only creates a VendorAdjustment DRAFT through the canonical Money Out
 * service — it never posts GL and never touches PayableOpenItem directly.
 *
 * Eligibility is computed here (backend-only). The frontend must not derive the
 * adjustable value.
 */
import type { Request } from 'express'
import { prisma } from '../../../config/prisma.js'
import { ensureDefaultLegalEntity } from '../../accounting/legal-entities/ensure-default-legal-entity.js'
import { createVendorAdjustmentDraft } from '../../accounting/payables/vendor-adjustments/vendor-adjustment-draft.service.js'
import type { CreateVendorAdjustmentInput } from '../../accounting/payables/vendor-adjustments/vendor-adjustment.schemas.js'
import { PurchaseReturnNotFoundError, PurchaseReturnValidationError } from './purchase-return.errors.js'
import * as repo from './purchase-return.repository.js'

/** Purchase invoice statuses that represent a real vendor liability. */
const INVOICED_STATUSES = ['POSTED', 'CLOSED'] as const

export type ReturnApAdjustmentReason =
  | 'ELIGIBLE'
  | 'NO_POSTED_INVOICE'
  | 'ALREADY_ADJUSTED'
  | 'RETURN_NOT_COMPLETED'
  | 'ZERO_VALUE'

export interface ReturnApAdjustmentLinePreview {
  purchaseReturnLineId: string
  lineNumber: number
  itemCodeSnapshot: string
  itemNameSnapshot: string
  returnedQuantity: number
  invoicedQuantity: number
  alreadyAdjustedQuantity: number
  eligibleQuantity: number
  invoicedRate: number
  gstRate: number
  eligibleAmount: number
}

export interface ReturnApAdjustmentPreview {
  purchaseReturnId: string
  returnNumber: string
  vendorId: string
  legalEntityId: string | null
  adjustmentType: 'VENDOR_DEBIT_NOTE'
  financialAdjustmentRequired: boolean
  reason: ReturnApAdjustmentReason
  eligibleQuantity: number
  eligibleAmount: number
  lines: ReturnApAdjustmentLinePreview[]
  existingVendorAdjustmentId: string | null
  existingVendorAdjustmentDraftRef: string | null
}

function num(value: unknown): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function dateStr(value: Date | null | undefined): string {
  return (value ?? new Date()).toISOString().slice(0, 10)
}

async function resolveLegalEntityId(tenantId: string, create: boolean): Promise<string | null> {
  const settings = await prisma.financeSettings.findFirst({
    where: { tenantId },
    select: { legalEntityId: true },
    orderBy: { createdAt: 'asc' },
  })
  if (settings?.legalEntityId) return settings.legalEntityId
  const le = await prisma.legalEntity.findFirst({
    where: { tenantId, isActive: true },
    select: { id: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  })
  if (le) return le.id
  return create ? ensureDefaultLegalEntity(tenantId) : null
}

/**
 * Invoiced quantity + rate per GRN line, from posted Purchase Invoices for this vendor.
 * Uses explicit `goodsReceiptLineId` / `purchaseOrderLineId` references — never a guess.
 */
async function loadInvoicedByReference(tenantId: string, vendorId: string) {
  const lines = await prisma.purchaseInvoiceLine.findMany({
    where: {
      tenantId,
      purchaseInvoice: {
        tenantId,
        vendorId,
        deletedAt: null,
        status: { in: [...INVOICED_STATUSES] },
      },
    },
    select: {
      goodsReceiptLineId: true,
      purchaseOrderLineId: true,
      quantity: true,
      rate: true,
      taxRatePct: true,
    },
  })

  const byGrnLine = new Map<string, { quantity: number; rate: number; gstRate: number }>()
  const byPoLine = new Map<string, { quantity: number; rate: number; gstRate: number }>()

  for (const line of lines) {
    const qty = num(line.quantity)
    if (qty <= 0) continue
    const entry = { quantity: qty, rate: num(line.rate), gstRate: num(line.taxRatePct) }
    if (line.goodsReceiptLineId) {
      const prev = byGrnLine.get(line.goodsReceiptLineId)
      byGrnLine.set(line.goodsReceiptLineId, {
        quantity: (prev?.quantity ?? 0) + qty,
        rate: entry.rate || prev?.rate || 0,
        gstRate: entry.gstRate || prev?.gstRate || 0,
      })
    } else if (line.purchaseOrderLineId) {
      const prev = byPoLine.get(line.purchaseOrderLineId)
      byPoLine.set(line.purchaseOrderLineId, {
        quantity: (prev?.quantity ?? 0) + qty,
        rate: entry.rate || prev?.rate || 0,
        gstRate: entry.gstRate || prev?.gstRate || 0,
      })
    }
  }
  return { byGrnLine, byPoLine }
}

/**
 * Quantity already covered by an AP adjustment on *other* returns for the same
 * GRN / PO line — prevents adjusting the same invoiced quantity twice.
 */
async function loadAlreadyAdjusted(tenantId: string, vendorId: string, excludeReturnId: string) {
  const lines = await prisma.purchaseReturnLine.findMany({
    where: {
      tenantId,
      purchaseReturn: {
        tenantId,
        vendorId,
        deletedAt: null,
        id: { not: excludeReturnId },
        vendorAdjustmentId: { not: null },
      },
    },
    select: { goodsReceiptLineId: true, purchaseOrderLineId: true, returnQuantity: true },
  })
  const byGrnLine = new Map<string, number>()
  const byPoLine = new Map<string, number>()
  for (const line of lines) {
    const qty = num(line.returnQuantity)
    if (qty <= 0) continue
    if (line.goodsReceiptLineId) {
      byGrnLine.set(line.goodsReceiptLineId, (byGrnLine.get(line.goodsReceiptLineId) ?? 0) + qty)
    } else if (line.purchaseOrderLineId) {
      byPoLine.set(line.purchaseOrderLineId, (byPoLine.get(line.purchaseOrderLineId) ?? 0) + qty)
    }
  }
  return { byGrnLine, byPoLine }
}

export async function buildPurchaseReturnApAdjustmentPreview(
  tenantId: string,
  purchaseReturnId: string,
  options: { createLegalEntity?: boolean } = {},
): Promise<ReturnApAdjustmentPreview> {
  const row = await repo.findPurchaseReturnById(tenantId, purchaseReturnId)
  if (!row) throw new PurchaseReturnNotFoundError()

  const [legalEntityId, invoiced, adjusted] = await Promise.all([
    resolveLegalEntityId(tenantId, options.createLegalEntity ?? false),
    loadInvoicedByReference(tenantId, row.vendorId),
    loadAlreadyAdjusted(tenantId, row.vendorId, row.id),
  ])

  const lines: ReturnApAdjustmentLinePreview[] = []
  for (const line of row.lines) {
    const grnLineId = line.goodsReceiptLineId
    const poLineId = line.purchaseOrderLineId
    const invoicedEntry = grnLineId
      ? invoiced.byGrnLine.get(grnLineId)
      : poLineId
        ? invoiced.byPoLine.get(poLineId)
        : undefined
    const alreadyAdjusted = grnLineId
      ? adjusted.byGrnLine.get(grnLineId) ?? 0
      : poLineId
        ? adjusted.byPoLine.get(poLineId) ?? 0
        : 0

    const returnedQuantity = num(line.returnQuantity)
    const invoicedQuantity = invoicedEntry?.quantity ?? 0
    // Never adjust beyond the invoiced quantity that has not already been adjusted.
    const eligibleQuantity = Math.max(
      0,
      Math.min(returnedQuantity, invoicedQuantity - alreadyAdjusted),
    )
    // Value at the invoiced rate — the return rate may differ from what the vendor billed.
    const invoicedRate = invoicedEntry?.rate ?? num(line.rate)
    const gstRate = invoicedEntry?.gstRate ?? 0

    lines.push({
      purchaseReturnLineId: line.id,
      lineNumber: line.lineNumber,
      itemCodeSnapshot: line.itemCodeSnapshot,
      itemNameSnapshot: line.itemNameSnapshot,
      returnedQuantity,
      invoicedQuantity,
      alreadyAdjustedQuantity: alreadyAdjusted,
      eligibleQuantity,
      invoicedRate,
      gstRate,
      eligibleAmount: round2(eligibleQuantity * invoicedRate),
    })
  }

  const eligibleQuantity = lines.reduce((sum, line) => sum + line.eligibleQuantity, 0)
  const eligibleAmount = round2(lines.reduce((sum, line) => sum + line.eligibleAmount, 0))
  const anyInvoiced = lines.some((line) => line.invoicedQuantity > 0)
  const anyAlreadyAdjusted = lines.some((line) => line.alreadyAdjustedQuantity > 0)

  let reason: ReturnApAdjustmentReason = 'ELIGIBLE'
  if (!anyInvoiced) reason = 'NO_POSTED_INVOICE'
  else if (eligibleQuantity <= 0) reason = anyAlreadyAdjusted ? 'ALREADY_ADJUSTED' : 'ZERO_VALUE'
  else if (eligibleAmount <= 0) reason = 'ZERO_VALUE'

  return {
    purchaseReturnId: row.id,
    returnNumber: row.returnNumber,
    vendorId: row.vendorId,
    legalEntityId,
    adjustmentType: 'VENDOR_DEBIT_NOTE',
    financialAdjustmentRequired: reason === 'ELIGIBLE',
    reason,
    eligibleQuantity,
    eligibleAmount,
    lines,
    existingVendorAdjustmentId: row.vendorAdjustmentId,
    existingVendorAdjustmentDraftRef: row.vendorAdjustmentDraftRef,
  }
}

function buildCreateVendorAdjustmentInput(args: {
  legalEntityId: string
  vendorId: string
  returnNumber: string
  returnDate: Date
  preview: ReturnApAdjustmentPreview
  goodsReceiptId: string | null
  purchaseOrderId: string | null
  purchaseReturnId: string
}): CreateVendorAdjustmentInput {
  const eligible = args.preview.lines.filter((line) => line.eligibleQuantity > 0)
  const documentDate = dateStr(args.returnDate)

  const sourceLinks: CreateVendorAdjustmentInput['sourceLinks'] = [
    {
      sourceType: 'PURCHASE_RETURN',
      sourceDocumentId: args.purchaseReturnId,
      sourceDocumentNumberSnapshot: args.returnNumber,
      sourceDocumentDateSnapshot: documentDate,
      metadata: { purchaseReturnId: args.purchaseReturnId, returnNumber: args.returnNumber },
    },
  ]
  if (args.goodsReceiptId) {
    sourceLinks.push({
      sourceType: 'GOODS_RECEIPT',
      sourceDocumentId: args.goodsReceiptId,
      sourceDocumentNumberSnapshot: null,
      sourceDocumentDateSnapshot: documentDate,
      metadata: { purchaseReturnId: args.purchaseReturnId },
    })
  }
  if (args.purchaseOrderId) {
    sourceLinks.push({
      sourceType: 'PURCHASE_ORDER',
      sourceDocumentId: args.purchaseOrderId,
      sourceDocumentNumberSnapshot: null,
      sourceDocumentDateSnapshot: documentDate,
      metadata: { purchaseReturnId: args.purchaseReturnId },
    })
  }

  return {
    legalEntityId: args.legalEntityId,
    vendorId: args.vendorId,
    adjustmentType: 'VENDOR_DEBIT_NOTE',
    reason: 'PURCHASE_RETURN',
    supplierReferenceNumber: args.returnNumber,
    supplierReferenceDate: documentDate,
    documentDate,
    currencyCode: 'INR',
    exchangeRate: '1',
    taxEffect: 'REVERSE_RECOVERABLE_INPUT_TAX',
    itcTreatment: 'FULL_ITC_REVERSAL',
    tdsTreatment: 'NO_TDS_CHANGE',
    purchaseTaxTreatment: 'REGULAR',
    lines: eligible.map((line, index) => ({
      lineNumber: index + 1,
      lineType: 'ITEM' as const,
      description:
        line.itemNameSnapshot || line.itemCodeSnapshot || `Return line ${line.lineNumber}`,
      itemCodeSnapshot: line.itemCodeSnapshot || null,
      itemNameSnapshot: line.itemNameSnapshot || null,
      quantity: String(line.eligibleQuantity),
      unitPrice: String(line.invoicedRate),
      gstRate: String(line.gstRate),
      sourceLinkType: 'PURCHASE_RETURN' as const,
      sourceDocumentId: args.purchaseReturnId,
      sourceDocumentNumber: args.returnNumber,
      sourceDocumentLineId: line.purchaseReturnLineId,
    })),
    sourceLinks,
  }
}

/**
 * Creates (or returns the existing) Vendor Debit Note draft for the invoiced portion of a
 * completed purchase return. Idempotent on `PurchaseReturn.vendorAdjustmentId`.
 * Returns `{ skipped: true }` when no posted invoice covers the returned goods.
 */
export async function handoffPurchaseReturnToVendorAdjustmentDraft(
  tenantId: string,
  purchaseReturnId: string,
  actorId: string,
) {
  const row = await repo.findPurchaseReturnById(tenantId, purchaseReturnId)
  if (!row) throw new PurchaseReturnNotFoundError()
  if (row.status !== 'COMPLETED') {
    throw new PurchaseReturnValidationError(
      'Purchase return must be completed before an AP adjustment can be raised.',
    )
  }

  if (row.vendorAdjustmentId) {
    const existing = await prisma.vendorAdjustment.findFirst({
      where: { id: row.vendorAdjustmentId, tenantId },
      select: { id: true, draftReference: true, status: true, vendorAdjustmentNumber: true },
    })
    if (existing) {
      return {
        skipped: false as const,
        reused: true as const,
        reason: 'ELIGIBLE' as ReturnApAdjustmentReason,
        vendorAdjustmentId: existing.id,
        draftReference: existing.draftReference,
        status: existing.status,
        vendorAdjustmentNumber: existing.vendorAdjustmentNumber,
      }
    }
  }

  const preview = await buildPurchaseReturnApAdjustmentPreview(tenantId, purchaseReturnId, {
    createLegalEntity: true,
  })
  if (!preview.financialAdjustmentRequired || !preview.legalEntityId) {
    return {
      skipped: true as const,
      reused: false as const,
      reason: preview.legalEntityId ? preview.reason : ('NO_POSTED_INVOICE' as ReturnApAdjustmentReason),
      vendorAdjustmentId: null,
      draftReference: null,
      status: null,
      vendorAdjustmentNumber: null,
    }
  }

  const input = buildCreateVendorAdjustmentInput({
    legalEntityId: preview.legalEntityId,
    vendorId: row.vendorId,
    returnNumber: row.returnNumber,
    returnDate: row.returnDate,
    preview,
    goodsReceiptId: row.goodsReceiptId,
    purchaseOrderId: row.purchaseOrderId,
    purchaseReturnId: row.id,
  })

  const req = { context: { userId: actorId } } as unknown as Request
  const created = await createVendorAdjustmentDraft(req, tenantId, input)

  await repo.updatePurchaseReturn(tenantId, purchaseReturnId, {
    vendorAdjustmentId: created.id,
    vendorAdjustmentDraftRef: created.draftReference ?? null,
    updatedById: actorId,
  })

  return {
    skipped: false as const,
    reused: false as const,
    reason: 'ELIGIBLE' as ReturnApAdjustmentReason,
    vendorAdjustmentId: created.id,
    draftReference: created.draftReference ?? null,
    status: created.status,
    vendorAdjustmentNumber: created.vendorAdjustmentNumber ?? null,
  }
}
