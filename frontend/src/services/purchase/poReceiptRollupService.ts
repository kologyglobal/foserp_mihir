/**
 * PO-centric receipt rollup — FE composition only.
 * Summarizes ordered / received / pending / rejected per PO line with unmerged GRN drill-down.
 * Dual-mode: reuses getPurchaseOrderById + GRNs (list filtered by PO in API mode).
 */
import { isApiMode } from '../../config/apiConfig'
import type {
  GoodsReceiptNote,
  PurchaseOrder,
  PurchaseOrderLine,
} from '../../types/purchaseDomain'
import type {
  PoLineReceiptGrnContribution,
  PoLineReceiptRollup,
  PurchaseOrderReceiptRollup,
} from '../../types/operationalStockViews'
import * as grnApi from './goodsReceiptApi'
import { mapApiGoodsReceiptToDomain } from './purchaseMappers'
import { getGRNs, getPurchaseOrderById } from './purchaseApiFacade'
import { PurchaseServiceError } from './purchaseService'

function num(v: string | number | null | undefined): number {
  if (v == null || v === '') return 0
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function grnHref(id: string): string {
  return `/purchase/grn/${id}`
}

function isCountableGrnStatus(status: string): boolean {
  const s = String(status ?? '').toLowerCase()
  return s !== 'cancelled' && s !== 'reversed'
}

function orderedQty(line: PurchaseOrderLine): number {
  return num(line.quantity ?? line.uomQuantity)
}

function lineMatchesGrnLine(
  poLine: PurchaseOrderLine,
  grnLine: { purchaseOrderLineId?: string | null; itemId?: string | null },
): boolean {
  const poLineId = grnLine.purchaseOrderLineId
  if (poLineId && poLineId === poLine.id) return true
  // Fallback when PO line link is missing (legacy / partial demos)
  if ((!poLineId || poLineId === '') && grnLine.itemId && grnLine.itemId === poLine.itemId) {
    return true
  }
  return false
}

async function loadGrnsForPo(purchaseOrderId: string): Promise<GoodsReceiptNote[]> {
  if (!isApiMode()) {
    const all = await getGRNs()
    return all.filter((g) => g.purchaseOrderId === purchaseOrderId)
  }
  try {
    const res = await grnApi.listGoodsReceiptsApi({
      page: 1,
      pageSize: 100,
      purchaseOrderId,
      sortOrder: 'desc',
    })
    return res.data.map(mapApiGoodsReceiptToDomain)
  } catch {
    // Fallback: full list filter (same dual-mode path as reports)
    const all = await getGRNs()
    return all.filter((g) => g.purchaseOrderId === purchaseOrderId)
  }
}

function buildLineRollup(
  poLine: PurchaseOrderLine,
  grns: GoodsReceiptNote[],
): PoLineReceiptRollup {
  const ordered = orderedQty(poLine)
  const contributions: PoLineReceiptGrnContribution[] = []
  let receivedQty = 0
  let rejectedQty = 0

  for (const grn of grns) {
    if (!isCountableGrnStatus(String(grn.status))) continue
    for (const gl of grn.lines ?? []) {
      if (!lineMatchesGrnLine(poLine, gl)) continue
      const qty = num(gl.receivedQty ?? gl.acceptedQty)
      const rejected = num(gl.rejectedQty)
      const rate = num(gl.rate)
      const amount = num(gl.taxableAmount) || qty * rate
      receivedQty += qty
      rejectedQty += rejected
      // Include lines even when qty is 0 if there is a reject signal
      if (qty === 0 && rejected === 0) continue
      contributions.push({
        grnId: grn.id,
        grnLineId: gl.id,
        grnNumber: grn.documentNumber,
        receiptDate: grn.documentDate,
        vendorId: grn.vendor?.id ?? '',
        vendorName: grn.vendor?.name ?? '—',
        qty,
        acceptedQty: num(gl.acceptedQty) || qty,
        rejectedQty: rejected,
        rate,
        amount,
        status: String(grn.status ?? ''),
        href: grnHref(grn.id),
      })
    }
  }

  contributions.sort((a, b) => b.receiptDate.localeCompare(a.receiptDate))

  const hasGrnContributions = contributions.length > 0
  const receivedFromGrns = receivedQty
  const receivedFromPo = num(poLine.receivedQty)
  const effectiveReceived = hasGrnContributions ? receivedFromGrns : receivedFromPo
  const effectivePending = hasGrnContributions
    ? Math.max(0, ordered - receivedFromGrns)
    : num(poLine.pendingQty) > 0 || receivedFromPo > 0
      ? Math.max(0, num(poLine.pendingQty))
      : Math.max(0, ordered - receivedFromPo)

  return {
    poLineId: poLine.id,
    lineNo: poLine.lineNo,
    itemId: poLine.itemId,
    itemCode: poLine.itemCode,
    itemName: poLine.itemName,
    uom: poLine.uom,
    orderedQty: ordered,
    receivedQty: effectiveReceived,
    pendingQty: effectivePending,
    rejectedQty,
    rate: num(poLine.rate),
    amount: num(poLine.lineTotal) || ordered * num(poLine.rate),
    grnCount: new Set(contributions.map((c) => c.grnId)).size,
    grns: contributions,
  }
}

export function buildPurchaseOrderReceiptRollup(
  po: PurchaseOrder,
  grns: GoodsReceiptNote[],
): PurchaseOrderReceiptRollup {
  const forPo = grns.filter((g) => g.purchaseOrderId === po.id)
  const countable = forPo.filter((g) => isCountableGrnStatus(String(g.status)))
  return {
    purchaseOrderId: po.id,
    purchaseOrderNumber: po.documentNumber,
    grnDocumentCount: countable.length,
    lines: (po.lines ?? [])
      .slice()
      .sort((a, b) => a.lineNo - b.lineNo)
      .map((line) => buildLineRollup(line, forPo)),
  }
}

/**
 * Load PO + GRNs for this order and return per-line receipt rollup with unmerged GRN drill-down.
 */
export async function getPurchaseOrderReceiptRollup(
  purchaseOrderId: string,
): Promise<PurchaseOrderReceiptRollup | null> {
  const po = await getPurchaseOrderById(purchaseOrderId)
  if (!po) return null
  const grns = await loadGrnsForPo(purchaseOrderId)
  return buildPurchaseOrderReceiptRollup(po, grns)
}

/**
 * Same as getPurchaseOrderReceiptRollup but throws when PO is missing (for callers that assert).
 */
export async function requirePurchaseOrderReceiptRollup(
  purchaseOrderId: string,
): Promise<PurchaseOrderReceiptRollup> {
  const rollup = await getPurchaseOrderReceiptRollup(purchaseOrderId)
  if (!rollup) {
    throw new PurchaseServiceError('PO_NOT_FOUND', `Purchase order not found: ${purchaseOrderId}`)
  }
  return rollup
}
