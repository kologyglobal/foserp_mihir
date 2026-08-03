import { describe, expect, it } from 'vitest'
import {
  calcAdjustmentAmount,
  calcOrderDocumentTotals,
  normalizeCalcType,
  sanitizePct,
} from '../../src/modules/crm/quotations/orderAdjustmentsCalc.js'

describe('orderAdjustmentsCalc', () => {
  it('flat freight equals entered amount', () => {
    expect(calcAdjustmentAmount('FLAT', 5000, 90_000)).toBe(5000)
  })

  it('percentage freight is % of discounted taxable', () => {
    // Taxable 100k − 10% order disc = 90k; freight 5% ⇒ 4500
    expect(calcAdjustmentAmount('PERCENTAGE', 5, 90_000)).toBe(4500)
  })

  it('clamps percentage inputs 0–100', () => {
    expect(sanitizePct(150)).toBe(100)
    expect(sanitizePct(-5)).toBe(0)
    expect(sanitizePct(Number.NaN)).toBe(0)
  })

  it('normalizes calc type aliases', () => {
    expect(normalizeCalcType('percent')).toBe('PERCENTAGE')
    expect(normalizeCalcType('%')).toBe('PERCENTAGE')
    expect(normalizeCalcType('FLAT')).toBe('FLAT')
  })

  it('full sequence: flat discount + % freight non-taxable', () => {
    const lines = [{ qty: 1, unitPrice: 100_000, discountPct: 0, taxPct: 18 }]
    const totals = calcOrderDocumentTotals(lines, {
      orderDiscount: { calculationType: 'PERCENTAGE', value: 10 },
      freight: { calculationType: 'PERCENTAGE', value: 5, isTaxable: false },
      installation: { calculationType: 'FLAT', value: 0, isTaxable: false },
      otherCharges: { calculationType: 'FLAT', value: 0, isTaxable: false },
    })
    expect(totals.taxableAmount).toBe(100_000)
    expect(totals.orderDiscount.calculatedAmount).toBe(10_000)
    expect(totals.discountedTaxableAmount).toBe(90_000)
    expect(totals.freight.calculatedAmount).toBe(4_500)
    // GST on 90k @ 18% only (freight non-taxable)
    expect(totals.gstAmount).toBe(16_200)
    // 90k + 4500 freight + 16200 gst
    expect(totals.grandTotal).toBe(110_700)
  })

  it('taxable freight adds GST on freight amount', () => {
    const lines = [{ qty: 1, unitPrice: 100_000, discountPct: 0, taxPct: 18 }]
    const totals = calcOrderDocumentTotals(lines, {
      orderDiscount: { calculationType: 'PERCENTAGE', value: 10 },
      freight: { calculationType: 'PERCENTAGE', value: 5, isTaxable: true, taxRate: 18 },
      installation: { calculationType: 'FLAT', value: 0, isTaxable: false },
      otherCharges: { calculationType: 'FLAT', value: 0, isTaxable: false },
    })
    expect(totals.freight.calculatedAmount).toBe(4_500)
    expect(totals.freight.taxAmount).toBe(810) // 4500 * 18%
    // GST: 16200 (goods) + 810 (freight)
    expect(totals.gstAmount).toBe(17_010)
    // 90k + 4500 + 17010
    expect(totals.grandTotal).toBe(111_510)
  })

  it('installation and other charges follow same rules as freight', () => {
    const lines = [{ qty: 2, unitPrice: 10_000, discountPct: 0, taxPct: 18 }]
    const totals = calcOrderDocumentTotals(lines, {
      orderDiscount: { calculationType: 'FLAT', value: 0 },
      freight: { calculationType: 'FLAT', value: 1_000, isTaxable: false },
      installation: { calculationType: 'PERCENTAGE', value: 10, isTaxable: true, taxRate: 18 },
      otherCharges: { calculationType: 'FLAT', value: 500, isTaxable: false },
    })
    // taxable 20000, install 10% = 2000, tax 360
    expect(totals.installation.calculatedAmount).toBe(2_000)
    expect(totals.installation.taxAmount).toBe(360)
    expect(totals.freightAmount).toBe(1_000)
    expect(totals.customCharges).toBe(500)
    // goods gst 3600 + install gst 360 = 3960
    expect(totals.gstAmount).toBe(3_960)
    // 20000 + 1000 + 2000 + 500 + 3960
    expect(totals.grandTotal).toBe(27_460)
  })

  it('empty adjustment fields treat as zero (no NaN)', () => {
    const totals = calcOrderDocumentTotals(
      [{ qty: 1, unitPrice: 1000, discountPct: 0, taxPct: 0 }],
      {
        orderDiscount: { calculationType: 'FLAT', value: Number.NaN as unknown as number },
        freight: {
          calculationType: 'PERCENTAGE',
          value: undefined as unknown as number,
          isTaxable: true,
        },
      },
    )
    expect(totals.orderDiscount.calculatedAmount).toBe(0)
    expect(totals.freight.calculatedAmount).toBe(0)
    expect(Number.isFinite(totals.grandTotal)).toBe(true)
    expect(totals.grandTotal).toBe(1000)
  })
})
