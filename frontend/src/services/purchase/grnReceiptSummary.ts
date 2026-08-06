import type { GoodsReceiptLine, GrnDomainStatus } from '@/types/purchaseDomain'
import { GRN_DOMAIN_STATUS_LABELS } from '@/types/purchaseDomain'

/** PO quantity still open after this GRN line's net received qty is applied. */
export function remainingPoOpenAfterGrn(
  line: Pick<GoodsReceiptLine, 'pendingQty' | 'receivedQty'> & { reversedQty?: number },
): number {
  const netReceived = Math.max(0, (Number(line.receivedQty) || 0) - (Number(line.reversedQty) || 0))
  return Math.max(0, (Number(line.pendingQty) || 0) - netReceived)
}

export interface GrnReceiptSummary {
  /** Lines with net received qty = 0 on this GRN (not received this time or fully reversed). */
  notReceivedLineCount: number
  /** Lines with net received qty > 0 on this GRN. */
  receivedLineCount: number
  /** Lines that were received and later reversed. */
  reversedLineCount: number
  /** Sum of PO open qty still remaining after this GRN (net of reverse). */
  stillOpenOnPoTotal: number
  /** Some lines received, some not — normal partial delivery. */
  partialReceipt: boolean
  /** Some but not all received lines reversed. */
  partialReverse: boolean
}

export function summarizeGrnReceipt(
  lines: (Pick<GoodsReceiptLine, 'pendingQty' | 'receivedQty'> & {
    reversedQty?: number
  })[],
): GrnReceiptSummary {
  let notReceivedLineCount = 0
  let receivedLineCount = 0
  let reversedLineCount = 0
  let stillOpenOnPoTotal = 0
  for (const line of lines) {
    const received = Number(line.receivedQty) || 0
    const reversed = Number(line.reversedQty) || 0
    const net = Math.max(0, received - reversed)
    if (reversed > 0 && received > 0) reversedLineCount += 1
    if (net > 0) receivedLineCount += 1
    else notReceivedLineCount += 1
    stillOpenOnPoTotal += remainingPoOpenAfterGrn(line)
  }
  return {
    notReceivedLineCount,
    receivedLineCount,
    reversedLineCount,
    stillOpenOnPoTotal,
    partialReceipt: receivedLineCount > 0 && notReceivedLineCount > 0,
    partialReverse: reversedLineCount > 0 && receivedLineCount > 0,
  }
}

export function formatGrnStatusLabel(
  status: GrnDomainStatus,
  lines: (Pick<GoodsReceiptLine, 'pendingQty' | 'receivedQty'> & { reversedQty?: number })[],
): string {
  const base = GRN_DOMAIN_STATUS_LABELS[status] ?? status
  if (status === 'posted') {
    const summary = summarizeGrnReceipt(lines)
    if (summary.partialReverse) {
      return 'Posted · partially reversed'
    }
    if (summary.partialReceipt || summary.stillOpenOnPoTotal > 0) {
      return 'Posted · partial receipt'
    }
  }
  return base
}
