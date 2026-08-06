import type { GoodsReceiptNote } from '@/types/purchaseDomain'

/** GRN statuses that never allow material return. */
const GRN_RETURN_BLOCKED = new Set<GoodsReceiptNote['status']>([
  'draft',
  'cancelled',
  'reversed',
  'pending_tolerance_approval',
])

/** Remaining returnable qty on a GRN line (from API detail / summarize). */
export function grnLineReturnableQty(line: GoodsReceiptNote['lines'][number]): number {
  return Math.max(0, Number(line.returnableQty) || 0)
}

export function grnHasReceivedLines(grn: GoodsReceiptNote): boolean {
  return grn.lines.some((l) => (Number(l.receivedQty) || 0) > 0)
}

export function grnHasReturnableQuantity(grn: GoodsReceiptNote): boolean {
  if (GRN_RETURN_BLOCKED.has(grn.status)) return false
  if (!grnHasReceivedLines(grn)) return false
  const headerTotal = grn.totalReturnableQty
  if (headerTotal != null && headerTotal > 0) return true
  return grn.lines.some((l) => grnLineReturnableQty(l) > 0)
}

/** GRNs eligible in return origin / header dropdowns (submitted receipt with returnable stock). */
export function isGrnEligibleForPurchaseReturn(grn: GoodsReceiptNote): boolean {
  if (GRN_RETURN_BLOCKED.has(grn.status)) return false
  if (!grnHasReceivedLines(grn)) return false
  return grnHasReturnableQuantity(grn)
}

export function filterGrnsForPurchaseReturn(
  grns: GoodsReceiptNote[],
  opts?: { vendorId?: string; purchaseOrderId?: string },
): GoodsReceiptNote[] {
  return grns.filter((g) => {
    if (opts?.vendorId && g.vendor.id !== opts.vendorId) return false
    if (opts?.purchaseOrderId && g.purchaseOrderId !== opts.purchaseOrderId) return false
    return isGrnEligibleForPurchaseReturn(g)
  })
}
