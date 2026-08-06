import { describe, expect, it } from 'vitest'
import {
  formatGrnStatusLabel,
  remainingPoOpenAfterGrn,
  summarizeGrnReceipt,
} from './grnReceiptSummary'

describe('grnReceiptSummary reverse-aware helpers', () => {
  it('nets reversed qty for PO open after GRN', () => {
    expect(remainingPoOpenAfterGrn({ pendingQty: 10, receivedQty: 10, reversedQty: 0 })).toBe(0)
    expect(remainingPoOpenAfterGrn({ pendingQty: 10, receivedQty: 10, reversedQty: 10 })).toBe(10)
    expect(remainingPoOpenAfterGrn({ pendingQty: 10, receivedQty: 6, reversedQty: 2 })).toBe(6)
  })

  it('summarizes partial reverse', () => {
    const summary = summarizeGrnReceipt([
      { pendingQty: 10, receivedQty: 10, reversedQty: 10 },
      { pendingQty: 5, receivedQty: 5, reversedQty: 0 },
    ])
    expect(summary.reversedLineCount).toBe(1)
    expect(summary.receivedLineCount).toBe(1)
    expect(summary.partialReverse).toBe(true)
    expect(formatGrnStatusLabel('posted', [
      { pendingQty: 10, receivedQty: 10, reversedQty: 10 },
      { pendingQty: 5, receivedQty: 5, reversedQty: 0 },
    ])).toBe('Posted · partially reversed')
  })
})
