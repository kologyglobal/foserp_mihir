/**
 * FIN-CLOSE-1 — GR/IR release plan for a vendor invoice.
 *
 * A GRN that posted inventory GL credited `GRIR_CLEARING` at receipt cost. When the vendor
 * invoice for that receipt posts, it must debit `GRIR_CLEARING` for the receipt cost (not the
 * invoice price) and send the difference to `PURCHASE_PRICE_VARIANCE`, so goods-received-not-
 * invoiced nets to zero.
 *
 * A line only participates when its GRN inward event actually reached `POSTED` — if
 * `INVENTORY_ACCOUNTING` was off at receipt time there is no GR/IR balance to clear, and the
 * line keeps the ordinary `LINE_DEBIT` (PURCHASE) treatment.
 */
import { prisma } from '../../../../../config/prisma.js'
import { add, divide, isZero, multiply, subtract, toDecimal } from '../../../shared/finance-decimal.js'
import { formatDecimal4 } from './vendor-invoice-decimal.js'
import type { VendorInvoiceAmountsCalculationResult } from './vendor-invoice-amounts.service.js'

/** Vendor invoice statuses that have already consumed GR/IR for a receipt line. */
const CONSUMED_STATUSES = ['POSTED'] as const

export interface VendorInvoiceGrirReleaseLine {
  lineNumber: number
  goodsReceiptId: string
  goodsReceiptLineId: string
  /** Receipt-cost value released from GR/IR on this line. */
  grirAmount: string
  /** invoice taxable − grirAmount. Positive = paid more than received cost. */
  varianceAmount: string
  /** Portion of variance capitalised into stock still on hand. */
  inventoryAdjustmentAmount: string
  /** Portion left in purchase price variance (already consumed or standard-cost stock). */
  ppvAmount: string
  inventoryMovementId: string
  receiptCostEntryId: string | null
  receiptCostLayerId: string | null
  itemId: string
  warehouseId: string
  valuationMethod: string
  receiptQuantity: string
  releaseQuantity: string
}

export interface VendorInvoiceGrirReleasePlan {
  lines: VendorInvoiceGrirReleaseLine[]
  byLineNumber: Record<number, VendorInvoiceGrirReleaseLine>
}

export function emptyGrirReleasePlan(): VendorInvoiceGrirReleasePlan {
  return { lines: [], byLineNumber: {} }
}

export function grirLineFor(
  plan: VendorInvoiceGrirReleasePlan | null | undefined,
  lineNumber: number,
): VendorInvoiceGrirReleaseLine | null {
  if (!plan) return null
  return plan.byLineNumber[lineNumber] ?? null
}

interface CandidateLine {
  lineNumber: number
  goodsReceiptId: string
  goodsReceiptLineId: string
  quantity: string
  taxableAmount: string
}

function collectCandidates(amountsResult: VendorInvoiceAmountsCalculationResult): CandidateLine[] {
  const out: CandidateLine[] = []
  for (const line of amountsResult.lines) {
    if (line.sourceLinkType !== 'GOODS_RECEIPT') continue
    if (!line.sourceDocumentId || !line.sourceDocumentLineId) continue
    out.push({
      lineNumber: line.lineNumber,
      goodsReceiptId: line.sourceDocumentId,
      goodsReceiptLineId: line.sourceDocumentLineId,
      quantity: line.quantity,
      taxableAmount: line.taxableAmount,
    })
  }
  return out
}

/**
 * Quantity on each GRN line already billed by a POSTED vendor invoice — GR/IR for that
 * quantity is gone, so a later invoice on the same receipt line must not release it again.
 */
async function loadAlreadyReleasedQuantity(
  tenantId: string,
  legalEntityId: string,
  goodsReceiptLineIds: string[],
  excludeVendorInvoiceId: string | null,
): Promise<Map<string, ReturnType<typeof toDecimal>>> {
  const rows = await prisma.vendorInvoiceLine.findMany({
    where: {
      tenantId,
      legalEntityId,
      sourceLinkType: 'GOODS_RECEIPT',
      sourceDocumentLineId: { in: goodsReceiptLineIds },
      vendorInvoice: {
        tenantId,
        status: { in: [...CONSUMED_STATUSES] },
        ...(excludeVendorInvoiceId ? { id: { not: excludeVendorInvoiceId } } : {}),
      },
    },
    select: { sourceDocumentLineId: true, quantity: true },
  })
  const byLine = new Map<string, ReturnType<typeof toDecimal>>()
  for (const row of rows) {
    if (!row.sourceDocumentLineId) continue
    const prev = byLine.get(row.sourceDocumentLineId) ?? toDecimal(0)
    byLine.set(row.sourceDocumentLineId, add(prev, toDecimal(row.quantity)))
  }
  return byLine
}

/**
 * GR/IR balance posted at receipt, per GRN line. Keyed by the deterministic inward movement
 * idempotency key (`grn-in:<grnId>:<grnLineId>`) so the join never has to guess which movement
 * belongs to which receipt line.
 */
async function loadPostedReceiptValues(
  tenantId: string,
  legalEntityId: string,
  candidates: CandidateLine[],
) {
  const keys = candidates.map((c) => `grn-in:${c.goodsReceiptId}:${c.goodsReceiptLineId}`)
  const movements = await prisma.inventoryStockMovement.findMany({
    where: { tenantId, idempotencyKey: { in: keys } },
    select: {
      id: true,
      idempotencyKey: true,
      quantity: true,
      itemId: true,
      warehouseId: true,
    },
  })
  if (movements.length === 0) return new Map<string, {
    movementId: string
    quantity: ReturnType<typeof toDecimal>
    amount: ReturnType<typeof toDecimal>
    itemId: string
    warehouseId: string
  }>()

  const events = await prisma.inventoryAccountingEvent.findMany({
    where: {
      tenantId,
      legalEntityId,
      eventType: 'GRN_INWARD',
      status: 'POSTED',
      movementId: { in: movements.map((m) => m.id) },
    },
    select: { movementId: true, amount: true },
  })
  const amountByMovement = new Map(events.map((e) => [e.movementId as string, toDecimal(e.amount)]))

  const byKey = new Map<string, {
    movementId: string
    quantity: ReturnType<typeof toDecimal>
    amount: ReturnType<typeof toDecimal>
    itemId: string
    warehouseId: string
  }>()
  for (const movement of movements) {
    if (!movement.idempotencyKey) continue
    const amount = amountByMovement.get(movement.id)
    // No POSTED GRN_INWARD event ⇒ no GR/IR balance exists for this receipt line.
    if (!amount) continue
    byKey.set(movement.idempotencyKey, {
      movementId: movement.id,
      quantity: toDecimal(movement.quantity).abs(),
      amount,
      itemId: movement.itemId,
      warehouseId: movement.warehouseId,
    })
  }
  return byKey
}

export interface ResolveGrirReleasePlanParams {
  tenantId: string
  legalEntityId: string
  amountsResult: VendorInvoiceAmountsCalculationResult
  /** Exclude this invoice when measuring quantity already released (re-preview of itself). */
  vendorInvoiceId?: string | null
}

export async function resolveVendorInvoiceGrirReleasePlan(
  params: ResolveGrirReleasePlanParams,
): Promise<VendorInvoiceGrirReleasePlan> {
  const candidates = collectCandidates(params.amountsResult)
  if (candidates.length === 0) return emptyGrirReleasePlan()

  const [receiptValues, alreadyReleased] = await Promise.all([
    loadPostedReceiptValues(params.tenantId, params.legalEntityId, candidates),
    loadAlreadyReleasedQuantity(
      params.tenantId,
      params.legalEntityId,
      candidates.map((c) => c.goodsReceiptLineId),
      params.vendorInvoiceId ?? null,
    ),
  ])

  const lines: VendorInvoiceGrirReleaseLine[] = []
  for (const candidate of candidates) {
    const receipt = receiptValues.get(`grn-in:${candidate.goodsReceiptId}:${candidate.goodsReceiptLineId}`)
    if (!receipt || isZero(receipt.quantity)) continue

    const consumed = alreadyReleased.get(candidate.goodsReceiptLineId) ?? toDecimal(0)
    const remainingQty = subtract(receipt.quantity, consumed)
    if (remainingQty.lte(0)) continue

    const invoiceQty = toDecimal(candidate.quantity).abs()
    const releaseQty = invoiceQty.lt(remainingQty) ? invoiceQty : remainingQty
    if (isZero(releaseQty)) continue

    const unitCost = divide(receipt.amount, receipt.quantity)
    // Snap the final release to the exact remaining balance so repeated division never
    // leaves a stranded paisa in GR/IR.
    const consumedValue = toDecimal(formatDecimal4(multiply(unitCost, consumed)))
    const remainingValue = subtract(receipt.amount, consumedValue)
    const grirAmount = releaseQty.eq(remainingQty)
      ? remainingValue
      : toDecimal(formatDecimal4(multiply(unitCost, releaseQty)))
    const varianceAmount = subtract(toDecimal(candidate.taxableAmount), grirAmount)
    const [costEntry, balance] = await Promise.all([
      prisma.inventoryCostEntry.findFirst({
        where: { tenantId: params.tenantId, inventoryMovementId: receipt.movementId },
        select: {
          id: true,
          valuationMethod: true,
          costLayerId: true,
          costLayer: {
            select: { originalQuantity: true, remainingQuantity: true },
          },
        },
      }),
      prisma.inventoryStockBalance.findFirst({
        where: {
          tenantId: params.tenantId,
          itemId: receipt.itemId,
          warehouseId: receipt.warehouseId,
        },
        select: { onHandQty: true },
      }),
    ])
    const method = costEntry?.valuationMethod ?? 'MOVING_WEIGHTED_AVERAGE'
    let onHandRatio = toDecimal(0)
    if (method === 'FIFO' || method === 'SPECIFIC_IDENTIFICATION') {
      const original = toDecimal(costEntry?.costLayer?.originalQuantity ?? 0).abs()
      const remaining = toDecimal(costEntry?.costLayer?.remainingQuantity ?? 0).abs()
      onHandRatio = original.greaterThan(0)
        ? divide(remaining.greaterThan(original) ? original : remaining, original)
        : toDecimal(0)
    } else if (method === 'MOVING_WEIGHTED_AVERAGE') {
      // Moving average is fungible and has no receipt layers. Capitalise no more than
      // the invoiced receipt quantity that can still be represented by current on-hand.
      const available = toDecimal(balance?.onHandQty ?? 0).abs()
      const attributable = available.greaterThan(releaseQty) ? releaseQty : available
      onHandRatio = releaseQty.greaterThan(0) ? divide(attributable, releaseQty) : toDecimal(0)
    }
    const inventoryAdjustmentAmount =
      method === 'STANDARD_COST'
        ? toDecimal(0)
        : toDecimal(formatDecimal4(multiply(varianceAmount, onHandRatio)))
    const ppvAmount = subtract(varianceAmount, inventoryAdjustmentAmount)

    lines.push({
      lineNumber: candidate.lineNumber,
      goodsReceiptId: candidate.goodsReceiptId,
      goodsReceiptLineId: candidate.goodsReceiptLineId,
      grirAmount: formatDecimal4(grirAmount),
      varianceAmount: formatDecimal4(varianceAmount),
      inventoryAdjustmentAmount: formatDecimal4(inventoryAdjustmentAmount),
      ppvAmount: formatDecimal4(ppvAmount),
      inventoryMovementId: receipt.movementId,
      receiptCostEntryId: costEntry?.id ?? null,
      receiptCostLayerId: costEntry?.costLayerId ?? null,
      itemId: receipt.itemId,
      warehouseId: receipt.warehouseId,
      valuationMethod: method,
      receiptQuantity: formatDecimal4(receipt.quantity),
      releaseQuantity: formatDecimal4(releaseQty),
    })
  }

  const byLineNumber: Record<number, VendorInvoiceGrirReleaseLine> = {}
  for (const line of lines) byLineNumber[line.lineNumber] = line
  return { lines, byLineNumber }
}
