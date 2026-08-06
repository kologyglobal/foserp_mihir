import { describe, expect, it } from 'vitest'
import { applyGeneralQuantityToPurchaseUoms } from '../../components/masters/ItemUomConversionEditor'
import { purchaseQtyToBaseQty, toUomQuantityFromBase } from '../../utils/purchaseLineUom'

describe('applyGeneralQuantityToPurchaseUoms', () => {
  const base = 'base-uom'

  it('keeps base factor at 1 and updates default purchase alternate only', () => {
    const next = applyGeneralQuantityToPurchaseUoms(
      [
        { uomId: base, conversionFactor: 1, isPurchaseAllowed: true, isDefaultPurchase: false },
        { uomId: 'mtr', conversionFactor: 1, isPurchaseAllowed: true, isDefaultPurchase: true },
      ],
      base,
      30,
    )
    expect(next.find((r) => r.uomId === base)?.conversionFactor).toBe(1)
    expect(next.find((r) => r.uomId === 'mtr')?.conversionFactor).toBe(30)
  })

  it('does not overwrite non-default multi-UOM factors', () => {
    const next = applyGeneralQuantityToPurchaseUoms(
      [
        { uomId: base, conversionFactor: 1, isPurchaseAllowed: true, isDefaultPurchase: false },
        { uomId: 'kg', conversionFactor: 50, isPurchaseAllowed: true, isDefaultPurchase: true },
        { uomId: 'g', conversionFactor: 50000, isPurchaseAllowed: true, isDefaultPurchase: false },
      ],
      base,
      55,
    )
    expect(next.find((r) => r.uomId === 'kg')?.conversionFactor).toBe(55)
    expect(next.find((r) => r.uomId === 'g')?.conversionFactor).toBe(50000)
  })

  it('uses 1 when quantity is zero or invalid', () => {
    const next = applyGeneralQuantityToPurchaseUoms(
      [{ uomId: 'mtr', conversionFactor: 9, isPurchaseAllowed: true, isDefaultPurchase: true }],
      base,
      0,
    )
    expect(next.find((r) => r.uomId === 'mtr')?.conversionFactor).toBe(1)
    expect(next.some((r) => r.uomId === base)).toBe(true)
  })
})

describe('purchase dual quantity conversion direction', () => {
  it('divides purchase qty by factor for base stock (1 NOS = 50 KG → 5000 KG = 100 NOS)', () => {
    expect(purchaseQtyToBaseQty(5000, 50)).toBe(100)
    expect(toUomQuantityFromBase(100, 50)).toBe(5000)
  })

  it('keeps 1:1 when factor is 1', () => {
    expect(purchaseQtyToBaseQty(12, 1)).toBe(12)
    expect(toUomQuantityFromBase(12, 1)).toBe(12)
  })
})
