import { describe, expect, it } from 'vitest'
import { filterIncludedGrnLines, isIncludedGrnLine, recalcGrnLineDraft, type GrnLineDraft } from './grnLineDraft'

function baseDraft(overrides: Partial<GrnLineDraft> = {}): GrnLineDraft {
  return {
    purchaseOrderLineId: 'line-1',
    itemId: 'item-1',
    itemCode: 'ITM-1',
    itemName: 'Test Item',
    description: '',
    uom: 'NOS',
    baseUom: 'NOS',
    uomConversionFactor: 1,
    orderedQty: 100,
    orderedUomQty: 100,
    previouslyReceivedQty: 0,
    pendingQty: 100,
    pendingUomQty: 100,
    receivedQty: 0,
    receivedUomQty: 0,
    acceptedQty: 0,
    rejectedQty: 0,
    shortQty: 0,
    excessQty: 0,
    damagedQty: 0,
    receivedWeight: null,
    expectedWeight: null,
    weightVariancePercentage: null,
    weightToleranceStatus: 'NOT_APPLICABLE',
    quantityTolerancePct: 0,
    weightTolerancePct: 0,
    receiptEntryMode: 'UNIT_ONLY',
    standardWeightPerBaseUnit: 0,
    weightUomCode: '',
    batchNumber: '',
    lotNumber: '',
    serialNumber: '',
    manufacturingDate: '',
    expiryDate: '',
    warehouseId: '',
    warehouseName: '',
    binId: null,
    bin: '',
    allowExcess: false,
    batchControlled: false,
    serialControlled: false,
    expiryControlled: false,
    qcRequired: false,
    tolerancePercentage: 0,
    variancePercentage: null,
    toleranceStatus: 'EXACT',
    receivingCondition: 'NORMAL',
    receivingConditionReason: '',
    closeOpenQuantity: false,
    shortCloseReason: '',
    remarks: '',
    ...overrides,
  }
}

describe('recalcGrnLineDraft — QC deferral (Phase 2)', () => {
  const setup = { allowOverReceipt: false, overReceiptTolerancePct: 0 }

  it('accepts full received qty when QC is not required', () => {
    const row = baseDraft({ receivedQty: 100, qcRequired: false })
    const recalced = recalcGrnLineDraft(row, setup, false)
    expect(recalced.acceptedQty).toBe(100)
    expect(recalced.rejectedQty).toBe(0)
  })

  it('forces accepted=0 and rejected=0 when the line requires QC', () => {
    const row = baseDraft({ receivedQty: 100, qcRequired: true, rejectedQty: 20, damagedQty: 20 })
    const recalced = recalcGrnLineDraft(row, setup, false)
    expect(recalced.acceptedQty).toBe(0)
    expect(recalced.rejectedQty).toBe(0)
  })

  it('forces accepted=0 and rejected=0 when inspection is required at the GRN header level', () => {
    const row = baseDraft({ receivedQty: 50, qcRequired: false, rejectedQty: 10 })
    const recalced = recalcGrnLineDraft(row, setup, true)
    expect(recalced.acceptedQty).toBe(0)
    expect(recalced.rejectedQty).toBe(0)
  })
})

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
