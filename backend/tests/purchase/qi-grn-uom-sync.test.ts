/**
 * QI complete must sync GRN accepted/rejected commercial UOM from base qty × factor.
 */
import { describe, expect, it } from 'vitest'
import { syncGrnAcceptedRejectedUomFromBase } from '../../src/modules/purchase/shared/uom-conversion.js'

describe('QI → GRN UOM sync', () => {
  it('maps 90 NOS accepted + 10 NOS rejected at factor 50 → 4500 KG + 500 KG', () => {
    expect(syncGrnAcceptedRejectedUomFromBase(90, 10, 50)).toEqual({
      acceptedUomQuantity: 4500,
      rejectedUomQuantity: 500,
    })
  })

  it('factor 1 leaves commercial equal to base', () => {
    expect(syncGrnAcceptedRejectedUomFromBase(8, 2, 1)).toEqual({
      acceptedUomQuantity: 8,
      rejectedUomQuantity: 2,
    })
  })

  it('invalid factor falls back to base quantities', () => {
    expect(syncGrnAcceptedRejectedUomFromBase(5, 3, 0)).toEqual({
      acceptedUomQuantity: 5,
      rejectedUomQuantity: 3,
    })
  })
})
