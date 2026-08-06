import { describe, expect, it } from 'vitest'
import { resolvePurchaseOrderGstSupply } from './purchasePlaceOfSupply'
import type { PurchaseSetup } from '../types/purchaseDomain'

const setup = {
  tax: {
    placeOfSupplyState: 'Gujarat',
    placeOfSupplyStateCode: '24',
  },
} as PurchaseSetup

describe('resolvePurchaseOrderGstSupply', () => {
  it('intra-state when vendor and delivery POS are both Gujarat', () => {
    const gst = resolvePurchaseOrderGstSupply(
      { state: 'Gujarat', gstin: '24AAAAA0000A1Z5' },
      { state: 'Gujarat' },
      setup,
    )
    expect(gst.isInterstate).toBe(false)
    expect(gst.gstScheme).toBe('cgst_sgst')
  })

  it('inter-state when vendor is Maharashtra and delivery POS is Gujarat', () => {
    const gst = resolvePurchaseOrderGstSupply(
      { state: 'Maharashtra', gstin: '27AAAAA0000A1Z5' },
      { state: 'Gujarat' },
      setup,
    )
    expect(gst.isInterstate).toBe(true)
    expect(gst.gstScheme).toBe('igst')
  })

  it('falls back to setup POS when warehouse state is empty', () => {
    const gst = resolvePurchaseOrderGstSupply(
      { state: 'Maharashtra' },
      { state: '' },
      setup,
    )
    expect(gst.isInterstate).toBe(true)
  })

  it('updates IGST scheme when vendor changes against fixed delivery POS', () => {
    const delivery = { state: 'Gujarat' }
    const intra = resolvePurchaseOrderGstSupply({ state: 'Gujarat', gstin: '24AAAAA0000A1Z5' }, delivery, setup)
    const inter = resolvePurchaseOrderGstSupply({ state: 'Maharashtra', gstin: '27AAAAA0000A1Z5' }, delivery, setup)
    expect(intra.placeOfSupplyLabel).toBe(inter.placeOfSupplyLabel)
    expect(intra.isInterstate).toBe(false)
    expect(inter.isInterstate).toBe(true)
  })

  it('resolves vendor state from stateCode when state name is empty', () => {
    const gst = resolvePurchaseOrderGstSupply(
      { state: '', stateCode: '27', gstin: '27AAAAA0000A1Z5' },
      { state: 'Gujarat' },
      setup,
    )
    expect(gst.isInterstate).toBe(true)
  })
})
