import type { GoodsReceiptLine, GrnDomainStatus } from '@/types/purchaseDomain'
import { GRN_DOMAIN_STATUS_LABELS } from '@/types/purchaseDomain'

/** PO quantity still open after this GRN line's received qty is applied. */
export function remainingPoOpenAfterGrn(line: Pick<GoodsReceiptLine, 'pendingQty' | 'receivedQty'>): number {
  return Math.max(0, (Number(line.pendingQty) || 0) - (Number(line.receivedQty) || 0))
}

export interface GrnReceiptSummary {
  /** Lines with received qty = 0 on this GRN (not received this time). */
  notReceivedLineCount: number
  /** Lines with received qty > 0 on this GRN. */
  receivedLineCount: number
  /** Sum of PO open qty still remaining after this GRN. */
  stillOpenOnPoTotal: number
  /** Some lines received, some not — normal partial delivery. */
  partialReceipt: boolean
}

export function summarizeGrnReceipt(
  lines: Pick<GoodsReceiptLine, 'pendingQty' | 'receivedQty'>[],
): GrnReceiptSummary {
  let notReceivedLineCount = 0
  let receivedLineCount = 0
  let stillOpenOnPoTotal = 0
  for (const line of lines) {
    const received = Number(line.receivedQty) || 0
    if (received > 0) receivedLineCount += 1
    else notReceivedLineCount += 1
    stillOpenOnPoTotal += remainingPoOpenAfterGrn(line)
  }
  return {
    notReceivedLineCount,
    receivedLineCount,
    stillOpenOnPoTotal,
    partialReceipt: receivedLineCount > 0 && notReceivedLineCount > 0,
  }
}

export function formatGrnStatusLabel(
  status: GrnDomainStatus,
  lines: Pick<GoodsReceiptLine, 'pendingQty' | 'receivedQty'>[],
): string {
  const base = GRN_DOMAIN_STATUS_LABELS[status] ?? status
  if (status === 'posted') {
    const summary = summarizeGrnReceipt(lines)
    if (summary.partialReceipt || summary.stillOpenOnPoTotal > 0) {
      return 'Posted · partial receipt'
    }
  }
  return base
}
