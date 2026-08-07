import { describe, expect, it } from 'vitest'
import { billableGrnVendorQtyForInvoiceMatch, pctDiff } from './purchaseInvoiceMatching'

describe('billableGrnVendorQtyForInvoiceMatch', () => {
  it('uses received qty before QC', () => {
    expect(
      billableGrnVendorQtyForInvoiceMatch({
        receivedQty: 20,
        receivedUomQty: 20,
        acceptedQty: 0,
        rejectedQty: 0,
      }),
    ).toBe(20)
  })

  it('uses QC accepted qty after partial rejection (PI-000010 case)', () => {
    expect(
      billableGrnVendorQtyForInvoiceMatch({
        receivedQty: 20,
        receivedUomQty: 20,
        acceptedQty: 15,
        acceptedUomQty: 15,
        rejectedQty: 5,
        rejectedUomQty: 5,
      }),
    ).toBe(15)
  })

  it('derives vendor uom from base when uom column missing (factor 1)', () => {
    expect(
      billableGrnVendorQtyForInvoiceMatch({
        receivedQty: 10,
        acceptedQty: 8,
        rejectedQty: 2,
        uomConversionFactor: 1,
      }),
    ).toBe(8)
  })
})

describe('pctDiff', () => {
  it('computes variance vs baseline', () => {
    expect(pctDiff(15, 20)).toBe(25)
  })
})
