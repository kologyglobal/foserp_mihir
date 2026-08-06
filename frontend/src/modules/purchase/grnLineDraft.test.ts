import { describe, expect, it } from 'vitest'
import { filterIncludedGrnLines, isIncludedGrnLine } from './grnLineDraft'

describe('isIncludedGrnLine / filterIncludedGrnLines', () => {
  it('includes lines with received qty > 0', () => {
    expect(isIncludedGrnLine({ receivedQty: 5 })).toBe(true)
    expect(isIncludedGrnLine({ receivedUomQty: 2, receivedQty: 0 })).toBe(true)
  })

  it('includes short-closed zero-qty lines', () => {
    expect(isIncludedGrnLine({ receivedQty: 0, closeOpenQuantity: true })).toBe(true)
    expect(isIncludedGrnLine({ receivedQty: 0, shortCloseRequested: true })).toBe(true)
  })

  it('excludes idle open PO rows (zero and not short-closed)', () => {
    expect(isIncludedGrnLine({ receivedQty: 0 })).toBe(false)
    expect(isIncludedGrnLine({ receivedQty: 0, closeOpenQuantity: false })).toBe(false)
  })

  it('filters multi-line create drafts to only received / short-closed lines', () => {
    const kept = filterIncludedGrnLines([
      { purchaseOrderLineId: 'a', receivedQty: 0, itemCode: 'A' },
      { purchaseOrderLineId: 'b', receivedQty: 10, itemCode: 'B' },
      { purchaseOrderLineId: 'c', receivedQty: 0, closeOpenQuantity: true, itemCode: 'C' },
      { purchaseOrderLineId: 'd', receivedQty: 0, itemCode: 'D' },
    ])
    expect(kept.map((l) => l.purchaseOrderLineId)).toEqual(['b', 'c'])
  })
})
