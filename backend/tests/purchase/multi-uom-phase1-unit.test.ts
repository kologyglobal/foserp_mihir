import { describe, expect, it } from 'vitest'
import {
  lineAmountFromVendor,
  resolveDualQuantities,
  toPrimaryQty,
} from '../../src/modules/purchase/shared/uom-conversion.js'

/** Simulates Comparison→PO: VQ commercial qty → normalized PO line. */
function commercialQtyToPoLine(input: {
  commercialQty: number
  factor: number
  rate: number
}) {
  const dual = resolveDualQuantities({
    uomQuantity: input.commercialQty,
    uomConversionFactor: input.factor,
  })
  return {
    uomQuantity: dual.uomQuantity,
    quantity: dual.quantity,
    uomConversionFactor: dual.uomConversionFactor,
    amount: lineAmountFromVendor(input.rate, dual.uomQuantity),
    unitCostPrimary: input.rate * input.factor,
  }
}

/** Simulates invoice line amount from base qty + vendor rate (fixed path). */
function invoiceAmountFromBaseQty(input: {
  baseQty: number
  vendorRate: number
  factor: number
}) {
  const vendorQty = input.factor === 1 ? input.baseQty : input.baseQty * input.factor
  return lineAmountFromVendor(input.vendorRate, vendorQty)
}

describe('multi-uom phase1 unit', () => {
  it('KG → NOS: 5000 KG @ factor 50 → 100 NOS, ₹400000', () => {
    const po = commercialQtyToPoLine({ commercialQty: 5000, factor: 50, rate: 80 })
    expect(po.uomQuantity).toBe(5000)
    expect(po.quantity).toBe(100)
    expect(po.uomConversionFactor).toBe(50)
    expect(po.amount).toBe(400_000)
    expect(po.unitCostPrimary).toBe(4000)
  })

  it('MTR → NOS: 30 MTR @ factor 3 → 10 NOS', () => {
    expect(toPrimaryQty(30, 3)).toBe(10)
    const po = commercialQtyToPoLine({ commercialQty: 30, factor: 3, rate: 30 })
    expect(po.quantity).toBe(10)
    expect(po.amount).toBe(900)
  })

  it('invoice amount uses vendor qty × vendor rate (not base × vendor rate)', () => {
    expect(invoiceAmountFromBaseQty({ baseQty: 100, vendorRate: 80, factor: 50 })).toBe(400_000)
    expect(invoiceAmountFromBaseQty({ baseQty: 100, vendorRate: 80, factor: 50 })).not.toBe(8000)
  })

  it('GRN receive 5100 KG → 102 NOS at factor 50', () => {
    const dual = resolveDualQuantities({ uomQuantity: 5100, uomConversionFactor: 50 })
    expect(dual.quantity).toBe(102)
  })

  it('partial GRN 4500 KG → 90 NOS; PO open 10 NOS', () => {
    const dual = resolveDualQuantities({ uomQuantity: 4500, uomConversionFactor: 50 })
    expect(dual.quantity).toBe(90)
    expect(100 - dual.quantity).toBe(10)
  })

  it('excess GRN 5300 KG → 106 NOS (+6% vs 100 NOS PO)', () => {
    const dual = resolveDualQuantities({ uomQuantity: 5300, uomConversionFactor: 50 })
    expect(dual.quantity).toBe(106)
    const variancePct = ((dual.quantity - 100) / 100) * 100
    expect(variancePct).toBe(6)
  })
})
