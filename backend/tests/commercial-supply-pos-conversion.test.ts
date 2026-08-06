/**
 * Pure unit tests: commercial Place of Supply + supply type resolution.
 */
import { describe, expect, it } from 'vitest'
import {
  resolveCommercialPlaceOfSupply,
  resolveCommercialSupplyType,
} from '../src/modules/tax/commercial-supply-context.js'
import { applySchemeToMasterRate } from '../src/modules/tax/gst-tax-resolve.service.js'
import {
  applyDocumentTaxSchemeToLines,
  buildLinesFromInput,
} from '../src/modules/crm/sales-orders/sales-order.workflow.js'
import { sumLineTaxComponents } from '../src/modules/crm/sales-orders/sales-order-tax-header.js'

const itemId = 'aaaaaaaa-1111-4111-8111-111111111111'

describe('automatic place of supply', () => {
  it('GJ supplier context + customer/ship-to GJ → POS Gujarat', () => {
    const pos = resolveCommercialPlaceOfSupply({
      shipToState: 'Gujarat',
      customerState: 'Maharashtra',
    })
    expect(pos.placeOfSupplyStateCode).toBe('24')
    expect(pos.source).toBe('SHIP_TO')
  })

  it('ship-to Maharashtra beats bill-to Gujarat', () => {
    const auto = resolveCommercialPlaceOfSupply({
      shipToState: 'Maharashtra',
      billToState: 'Gujarat',
      customerState: 'Karnataka',
    })
    expect(auto.placeOfSupplyStateCode).toBe('27')
    expect(auto.source).toBe('SHIP_TO')
  })

  it('ship-to missing + customer GSTIN uses registration state', () => {
    // 24AAAAA0000A1Z5 → state 24 Gujarat
    const pos = resolveCommercialPlaceOfSupply({
      billToState: null,
      shipToState: null,
      customerGstin: '24AAAAA0000A1Z5',
      customerState: 'Maharashtra',
    })
    expect(pos.placeOfSupplyStateCode).toBe('24')
    expect(pos.source).toBe('CUSTOMER_GSTIN')
  })

  it('no reliable state → unresolved source', () => {
    const pos = resolveCommercialPlaceOfSupply({})
    expect(pos.placeOfSupplyStateCode).toBeNull()
    expect(pos.source).toBe('UNRESOLVED')
    expect(pos.warnings.length).toBeGreaterThan(0)
  })

  it('authorised override wins', () => {
    const override = resolveCommercialPlaceOfSupply({
      placeOfSupplyOverride: true,
      placeOfSupplyOverrideValue: '24',
      shipToState: 'Maharashtra',
    })
    expect(override.placeOfSupplyStateCode).toBe('24')
    expect(override.source).toBe('OVERRIDE')
  })

  it('does not stick to prior saved PoS without override flag', () => {
    // explicitPlaceOfSupply is ignored on auto path
    const pos = resolveCommercialPlaceOfSupply({
      explicitPlaceOfSupply: 'Gujarat',
      shipToState: 'Maharashtra',
    })
    expect(pos.placeOfSupplyStateCode).toBe('27')
    expect(pos.source).toBe('SHIP_TO')
  })
})

describe('automatic supply type', () => {
  it('GJ + GJ POS → Intra CGST+SGST', () => {
    const r = resolveCommercialSupplyType({
      supplierStateCode: '24',
      placeOfSupplyStateCode: '24',
    })
    expect(r.supplyType).toBe('INTRA_STATE')
    expect(r.taxScheme).toBe('cgst_sgst')
  })

  it('GJ + MH POS → Inter IGST', () => {
    const r = resolveCommercialSupplyType({
      supplierStateCode: '24',
      placeOfSupplyStateCode: '27',
    })
    expect(r.supplyType).toBe('INTER_STATE')
    expect(r.taxScheme).toBe('igst')
  })

  it('Delhi intra → UTGST pair', () => {
    const r = resolveCommercialSupplyType({
      supplierStateCode: '07',
      placeOfSupplyStateCode: '07',
    })
    expect(r.supplyType).toBe('INTRA_STATE')
    expect(r.taxScheme).toBe('utgst_pair')
  })

  it('missing POS → UNRESOLVED blocks posting intent', () => {
    const r = resolveCommercialSupplyType({
      supplierStateCode: '27',
      placeOfSupplyStateCode: null,
    })
    expect(r.supplyType).toBe('UNRESOLVED')
    expect(r.taxScheme).toBe('UNRESOLVED')
    expect(r.unresolved).toBe(true)
  })
})

describe('scheme recalculation on POS change', () => {
  it('ship-to GJ→MH clears CGST/SGST and applies IGST', () => {
    const { lines: intra } = buildLinesFromInput({
      lines: [
        {
          productOrItem: 'Kit',
          itemId,
          qty: 1,
          unitPrice: 1000,
          taxPct: 18,
          taxScheme: 'cgst_sgst',
          hsnCode: '8708',
        },
      ],
    })
    expect(sumLineTaxComponents(intra).cgstAmount).toBe(90)
    expect(sumLineTaxComponents(intra).igstAmount).toBe(0)

    const inter = applyDocumentTaxSchemeToLines(intra, 'igst')
    const c = sumLineTaxComponents(inter)
    expect(c.cgstAmount).toBe(0)
    expect(c.sgstAmount).toBe(0)
    expect(c.utgstAmount).toBe(0)
    expect(c.igstAmount).toBe(180)
    expect(inter[0]!.taxScheme).toBe('igst')
  })

  it('ship-to MH→GJ clears IGST and applies CGST/SGST', () => {
    const { lines: inter } = buildLinesFromInput({
      lines: [
        {
          productOrItem: 'Kit',
          itemId,
          qty: 1,
          unitPrice: 1000,
          taxPct: 18,
          taxScheme: 'igst',
          hsnCode: '8708',
        },
      ],
    })
    const intra = applyDocumentTaxSchemeToLines(inter, 'cgst_sgst')
    const c = sumLineTaxComponents(intra)
    expect(c.igstAmount).toBe(0)
    expect(c.cgstAmount).toBe(90)
    expect(c.sgstAmount).toBe(90)
  })
})

describe('applySchemeToMasterRate UTGST + cess', () => {
  it('applies master utgst and cess for union territory intra', () => {
    const scheme = applySchemeToMasterRate(
      {
        cgstRate: '9',
        sgstRate: '9',
        igstRate: '18',
        gstRate: '18',
        utgstRate: '9',
        cessRate: '1',
      },
      { isInterstate: false, isUnionTerritory: true },
    )
    expect(scheme.taxScheme).toBe('utgst_pair')
    expect(scheme.cgstRate).toBe(9)
    expect(scheme.sgstRate).toBe(0)
    expect(scheme.utgstRate).toBe(9)
    expect(scheme.igstRate).toBe(0)
    expect(scheme.cessRate).toBe(1)
  })

  it('clears SGST/UTGST on interstate', () => {
    const scheme = applySchemeToMasterRate(
      {
        cgstRate: '9',
        sgstRate: '9',
        igstRate: '18',
        gstRate: '18',
        cessRate: '0.5',
      },
      { isInterstate: true },
    )
    expect(scheme.taxScheme).toBe('igst')
    expect(scheme.cgstRate).toBe(0)
    expect(scheme.sgstRate).toBe(0)
    expect(scheme.utgstRate).toBe(0)
    expect(scheme.igstRate).toBe(18)
  })
})

describe('quotation line snapshot carry into SO lines', () => {
  it('keeps HSN and component rates from quote-like payload', () => {
    const { lines } = buildLinesFromInput({
      lines: [
        {
          productOrItem: 'Trailer',
          itemId,
          qty: 1,
          unitPrice: 500000,
          discountPct: 0,
          taxPct: 18,
          hsnCode: '8716',
          taxScheme: 'igst',
          igstRate: 18,
          cgstRate: 0,
          sgstRate: 0,
        },
      ],
    })
    expect(lines[0]!.hsnCode).toBe('8716')
    expect(lines[0]!.taxScheme).toBe('igst')
    expect(lines[0]!.igstAmount).toBe(90000)
  })
})
