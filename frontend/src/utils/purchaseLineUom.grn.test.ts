import { describe, expect, it } from 'vitest'
import {
  calculateGRNLineConversion,
  formatGrnUomConversionLabel,
  purchaseQtyToBaseQty,
} from './purchaseLineUom'

describe('GRN UOM conversion helpers', () => {
  it('converts 1050 MTR to 350 NOS (factor 3)', () => {
    const r = calculateGRNLineConversion({
      receivedUomQuantity: 1050,
      conversionFactor: 3,
      baseUom: 'NOS',
    })
    expect(r.receivedQuantity).toBe(350)
    expect(r.baseUom).toBe('NOS')
  })

  it('formats conversion label', () => {
    expect(formatGrnUomConversionLabel(3, 'NOS', 'MTR')).toBe('1 NOS = 3 MTR')
    expect(formatGrnUomConversionLabel(1, 'NOS', 'NOS')).toBe('-')
  })

  it('purchaseQtyToBaseQty matches plan formula', () => {
    expect(purchaseQtyToBaseQty(1050, 3)).toBe(350)
    expect(purchaseQtyToBaseQty(2500, 25)).toBe(100)
  })
})
