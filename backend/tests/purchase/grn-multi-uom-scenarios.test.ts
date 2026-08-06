import { describe, expect, it } from 'vitest'
import { calculateGRNLineConversion, toPrimaryQty } from '../../src/modules/purchase/shared/uom-conversion.js'
import { evaluateGrnLineTolerance } from '../../src/modules/purchase/shared/grn-tolerance.js'
import { evaluateReceiptLine } from '../../src/modules/purchase/receiving-tolerance/receipt-line-evaluator.js'

const pipeFactor = 3 // 1 NOS = 3 MTR
const castingFactor = 25 // 1 NOS = 25 KG

describe('GRN multi-UOM plan — pipe MTR → NOS', () => {
  it('Case 1: receive 300 MTR → 100 NOS', () => {
    const r = calculateGRNLineConversion({ receivedUomQuantity: 300, conversionFactor: pipeFactor })
    expect(r.receivedQuantity).toBe(100)
  })

  it('Case 2: receive 310 MTR → 103.33 NOS — tolerance check on 100 NOS open', () => {
    const base = toPrimaryQty(310, pipeFactor)
    expect(base).toBeCloseTo(103.3333, 3)
    const openBase = 100 // 300 MTR pending
    const tol = evaluateGrnLineTolerance({
      openQuantity: openBase,
      receivedQuantity: base,
      itemTolerancePct: 2,
      allowOverReceipt: true,
    })
    expect(tol.toleranceStatus).toBe('EXCESS_OUTSIDE_TOLERANCE')
    expect(tol.requiresApproval).toBe(true)
  })
})

describe('GRN multi-UOM plan — casting KG → NOS', () => {
  it('Case 3: receive 2500 KG → 100 NOS', () => {
    const r = calculateGRNLineConversion({ receivedUomQuantity: 2500, conversionFactor: castingFactor })
    expect(r.receivedQuantity).toBe(100)
  })

  it('Case 4: 100 NOS + 2600 KG actual vs 2500 expected — weight tolerance approval', () => {
    const weightEval = evaluateReceiptLine({
      openUnitQuantity: 100,
      receivedUnitQuantity: 100,
      receivedWeight: 2600,
      standardWeightPerBaseUnit: 25,
      receiptEntryMode: 'UNIT_AND_WEIGHT',
      receivingToleranceId: 'tol-2',
      masterTolerance: { id: 'tol-2', code: 'STD2', name: '2%', percentage: 2 },
      weightReceivingToleranceId: 'wt-2',
      weightMasterTolerance: { id: 'wt-2', code: 'WT2', name: '2%', percentage: 2 },
      weightUomCode: 'KG',
    })
    expect(toPrimaryQty(2600, castingFactor)).toBe(104)
    expect(weightEval.weightToleranceStatus).toBe('EXCESS_OUTSIDE_TOLERANCE')
    expect(weightEval.requiresApproval).toBe(true)
  })

  it('Case 5: damage — 2500 KG received, 500 KG rejected → 80 NOS stock', () => {
    const receivedBase = toPrimaryQty(2500, castingFactor)
    expect(receivedBase).toBe(100)
    const rejectedBase = toPrimaryQty(500, castingFactor)
    expect(rejectedBase).toBe(20)
    const acceptedBase = receivedBase - rejectedBase
    expect(acceptedBase).toBe(80)
  })
})
