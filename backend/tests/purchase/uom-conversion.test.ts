import { describe, expect, it } from 'vitest'
import {
  assertValidFactor,
  lineAmountFromVendor,
  resolveDualQuantities,
  resolveUomConversionFactor,
  toPrimaryQty,
  toPrimaryUnitCost,
  toUomQuantity,
  UomConversionError,
} from '../../src/modules/purchase/shared/uom-conversion.js'

describe('uom-conversion', () => {
  it('converts vendor meters to NOS (3 m = 1 NOS)', () => {
    expect(toPrimaryQty(30, 3)).toBe(10)
    expect(toUomQuantity(10, 3)).toBe(30)
    expect(toPrimaryUnitCost(30, 3)).toBe(90)
    expect(lineAmountFromVendor(30, 30)).toBe(900)
    expect(toPrimaryUnitCost(30, 3) * toPrimaryQty(30, 3)).toBe(900)
  })

  it('keeps 1:1 when UOMs match', () => {
    expect(resolveUomConversionFactor({ factor: 5, purchaseUomId: 'a', baseUomId: 'a' })).toBe(1)
    expect(resolveUomConversionFactor({ factor: 5, purchaseUomId: null, baseUomId: 'a' })).toBe(1)
  })

  it('rejects zero / negative factor', () => {
    expect(() => assertValidFactor(0)).toThrow(UomConversionError)
    expect(() => toPrimaryQty(10, -1)).toThrow(UomConversionError)
  })

  it('resolves dual quantities preferring uomQuantity', () => {
    const dual = resolveDualQuantities({ uomQuantity: 50, quantity: 999, uomConversionFactor: 5 })
    expect(dual.uomQuantity).toBe(50)
    expect(dual.quantity).toBe(10)
    expect(dual.uomConversionFactor).toBe(5)
  })

  it('legacy quantity-only with factor>1 treats quantity as primary', () => {
    const dual = resolveDualQuantities({ quantity: 10, uomConversionFactor: 5 })
    expect(dual.quantity).toBe(10)
    expect(dual.uomQuantity).toBe(50)
  })

  it('KG rod: 16 NOS base → 800 KG vendor (factor 50)', () => {
    const dual = resolveDualQuantities({ quantity: 16, uomConversionFactor: 50 })
    expect(dual.quantity).toBe(16)
    expect(dual.uomQuantity).toBe(800)
    expect(lineAmountFromVendor(3, dual.uomQuantity)).toBe(2400)
  })
})
