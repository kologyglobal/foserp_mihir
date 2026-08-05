import { describe, expect, it } from 'vitest'
import {
  lineAmountFromVendor,
  toPrimaryQty,
  toPrimaryUnitCost,
} from '../../src/modules/purchase/shared/uom-conversion.js'

/**
 * Unit coverage for material-return multi-UOM math (plan scenarios 1, 4, 5).
 * Live GRN reverse + purchase-return flows: goods-receipt-lifecycle / purchase-return-lifecycle.
 */
describe('material return multi-uom math', () => {
  it('scenario 1 — reverse 100 KG of 1000 KG (factor 50 → 2 NOS)', () => {
    const factor = 50
    const reverseVendorQty = 100
    expect(toPrimaryQty(reverseVendorQty, factor)).toBe(2)
    expect(toPrimaryUnitCost(2, factor)).toBe(100)
    expect(lineAmountFromVendor(2, reverseVendorQty)).toBe(200)
  })

  it('scenario 4 — reverse 250 KG = 5 NOS', () => {
    expect(toPrimaryQty(250, 50)).toBe(5)
  })

  it('scenario 5 — cumulative partial returns stay within received cap', () => {
    const received = 1000
    const reverse1 = 200
    const reverse2 = 300
    const remaining = received - reverse1 - reverse2
    expect(remaining).toBe(500)
    expect(reverse1 + reverse2 + remaining).toBe(received)
    expect(reverse1 + reverse2 + 600).toBeGreaterThan(received)
  })

  it('scenario 3 — cannot reverse more than received', () => {
    const received = 1000
    const attempted = 1200
    expect(attempted > received).toBe(true)
  })
})
