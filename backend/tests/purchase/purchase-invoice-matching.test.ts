import { describe, expect, it } from 'vitest'
import { billableGrnVendorQtyForInvoiceMatch, pctDiff } from '../../src/modules/purchase/invoices/purchase-invoice-matching.util.js'

describe('billableGrnVendorQtyForInvoiceMatch', () => {
  it('uses received qty before QC decision', () => {
    expect(
      billableGrnVendorQtyForInvoiceMatch({
        receivedQuantity: 20,
        receivedUomQuantity: 20,
        acceptedQuantity: 0,
        rejectedQuantity: 0,
      }),
    ).toBe(20)
  })

  it('uses QC accepted qty when line has rejections (stage PI-000010)', () => {
    expect(
      billableGrnVendorQtyForInvoiceMatch({
        receivedQuantity: 20,
        receivedUomQuantity: 20,
        acceptedQuantity: 15,
        acceptedUomQuantity: 15,
        rejectedQuantity: 5,
        rejectedUomQuantity: 5,
      }),
    ).toBe(15)
  })
})

describe('pctDiff', () => {
  it('returns 25% for invoice 15 vs received 20', () => {
    expect(pctDiff(15, 20)).toBe(25)
  })

  it('returns 0% for exact match', () => {
    expect(pctDiff(15, 15)).toBe(0)
  })
})
