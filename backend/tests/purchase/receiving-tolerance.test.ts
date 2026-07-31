import { describe, expect, it } from 'vitest'
import { evaluateReceiptLine } from '../../src/modules/purchase/receiving-tolerance/receipt-line-evaluator.js'
import { resolveReceivingTolerance } from '../../src/modules/purchase/receiving-tolerance/receiving-tolerance-resolver.js'
import { qtyToNumber } from '../../src/modules/purchase/receiving-tolerance/purchase-quantity-decimal.js'

describe('receiving-tolerance resolver', () => {
  it('uses master 0% when FK is set (never setup fallback)', () => {
    const resolved = resolveReceivingTolerance({
      receivingToleranceId: 'tol-exact',
      masterTolerance: { id: 'tol-exact', code: 'EXACT', name: 'Exact', percentage: 0 },
      setupTolerancePct: 10,
      allowOverReceipt: true,
    })
    expect(qtyToNumber(resolved.percentage)).toBe(0)
    expect(resolved.source).toBe('MASTER')
  })

  it('falls back to setup when FK is null and over-receipt allowed', () => {
    const resolved = resolveReceivingTolerance({
      receivingToleranceId: null,
      setupTolerancePct: 5,
      allowOverReceipt: true,
    })
    expect(qtyToNumber(resolved.percentage)).toBe(5)
    expect(resolved.source).toBe('SETUP')
  })
})

describe('receiving-tolerance weight validation (casting example)', () => {
  const master20 = {
    id: 'tol-bulk20',
    code: 'BULK20',
    name: 'Bulk 20%',
    percentage: 20,
  }

  it('100 Nos × 10 Kg/No → expected 1000 Kg, max 1200 Kg', () => {
    const full = evaluateReceiptLine({
      openUnitQuantity: 100,
      receivedUnitQuantity: 100,
      receivedWeight: 1150,
      standardWeightPerBaseUnit: 10,
      receiptEntryMode: 'UNIT_AND_WEIGHT',
      receivingToleranceId: master20.id,
      masterTolerance: master20,
      weightUomCode: 'KG',
    })
    expect(qtyToNumber(full.expectedWeight!)).toBe(1000)
    expect(qtyToNumber(full.maximumAllowedWeight!)).toBe(1200)
    expect(full.weightToleranceStatus).toBe('EXCESS_WITHIN_TOLERANCE')
    expect(full.requiresApproval).toBe(false)

    const over = evaluateReceiptLine({
      openUnitQuantity: 100,
      receivedUnitQuantity: 100,
      receivedWeight: 1250,
      standardWeightPerBaseUnit: 10,
      receiptEntryMode: 'UNIT_AND_WEIGHT',
      receivingToleranceId: master20.id,
      masterTolerance: master20,
      weightUomCode: 'KG',
    })
    expect(over.weightToleranceStatus).toBe('EXCESS_OUTSIDE_TOLERANCE')
    expect(over.approvalReasons).toContain('WEIGHT_OVER_TOLERANCE')
    expect(over.requiresApproval).toBe(true)
  })

  it('partial 80 Nos → expected 800 Kg', () => {
    const partial = evaluateReceiptLine({
      openUnitQuantity: 100,
      receivedUnitQuantity: 80,
      receivedWeight: 800,
      standardWeightPerBaseUnit: 10,
      receiptEntryMode: 'UNIT_AND_WEIGHT',
      receivingToleranceId: master20.id,
      masterTolerance: master20,
    })
    expect(partial.unitToleranceStatus).toBe('PARTIAL')
    expect(qtyToNumber(partial.expectedWeight!)).toBe(800)
  })
})
