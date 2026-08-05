/**
 * Pure unit tests: commercial Place of Supply + supply type resolution.
 */
import { describe, expect, it } from 'vitest'
import {
  resolveCommercialPlaceOfSupply,
  resolveCommercialSupplyType,
} from '../src/modules/tax/commercial-supply-context.js'
import { applySchemeToMasterRate } from '../src/modules/tax/gst-tax-resolve.service.js'
import { buildLinesFromInput } from '../src/modules/crm/sales-orders/sales-order.workflow.js'
import { sumLineTaxComponents } from '../src/modules/crm/sales-orders/sales-order-tax-header.js'

describe('commercial place of supply', () => {
  it('prefers ship-to for goods and allows authorised override', () => {
    const auto = resolveCommercialPlaceOfSupply({
      shipToState: 'Maharashtra',
      billToState: 'Gujarat',
      customerState: 'Karnataka',
    })
    expect(auto.placeOfSupplyStateCode).toBe('27')
    expect(auto.source).toBe('SHIP_TO')

    const override = resolveCommercialPlaceOfSupply({
      placeOfSupplyOverride: true,
      placeOfSupplyOverrideValue: '24',
      shipToState: 'Maharashtra',
    })
    expect(override.placeOfSupplyStateCode).toBe('24')
    expect(override.source).toBe('OVERRIDE')
  })
})

describe('commercial supply type', () => {
  it('marks GJ supplier + MH place of supply as INTER_STATE / IGST', () => {
    const r = resolveCommercialSupplyType({
      supplierStateCode: '24',
      placeOfSupplyStateCode: '27',
    })
    expect(r.supplyType).toBe('INTER_STATE')
    expect(r.taxScheme).toBe('igst')
    expect(r.unresolved).toBe(false)
  })

  it('marks Delhi intra as UTGST pair', () => {
    const r = resolveCommercialSupplyType({
      supplierStateCode: '07',
      placeOfSupplyStateCode: '07',
    })
    expect(r.supplyType).toBe('INTRA_STATE')
    expect(r.taxScheme).toBe('utgst_pair')
    expect(r.isUnionTerritory).toBe(true)
  })

  it('returns UNRESOLVED when place of supply is missing', () => {
    const r = resolveCommercialSupplyType({
      supplierStateCode: '27',
      placeOfSupplyStateCode: null,
    })
    expect(r.supplyType).toBe('UNRESOLVED')
    expect(r.taxScheme).toBe('UNRESOLVED')
    expect(r.unresolved).toBe(true)
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
    expect(scheme.cessRate).toBe(0.5)
  })
})

describe('conversion Q→SO line tax carry + header aggregates', () => {
  const itemId = '11111111-1111-4111-8111-111111111111'

  it('builds SO line with HSN + scheme from quote-like payload and aggregates header components', () => {
    const { lines } = buildLinesFromInput({
      lines: [
        {
          productOrItem: 'Chassis',
          description: 'Trailer',
          itemId,
          qty: 1,
          uom: 'NOS',
          unitPrice: 100000,
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
    expect(lines[0]!.igstAmount).toBe(18000)

    const sum = sumLineTaxComponents(lines)
    expect(sum.igstAmount).toBe(18000)
    expect(sum.cgstAmount).toBe(0)
    expect(sum.dominantScheme).toBe('igst')
  })

  it('carries CGST+SGST through conversion-style line and UTGST scheme line', () => {
    const intra = buildLinesFromInput({
      lines: [
        {
          productOrItem: 'Part',
          itemId,
          qty: 2,
          unitPrice: 500,
          discountPct: 0,
          taxPct: 18,
          hsnCode: '8708',
          taxScheme: 'cgst_sgst',
          cgstRate: 9,
          sgstRate: 9,
          igstRate: 0,
        },
      ],
    })
    expect(intra.lines[0]!.cgstAmount).toBe(90)
    expect(intra.lines[0]!.sgstAmount).toBe(90)

    const ut = buildLinesFromInput({
      lines: [
        {
          productOrItem: 'Part UT',
          itemId,
          qty: 1,
          unitPrice: 1000,
          discountPct: 0,
          taxPct: 18,
          hsnCode: '8708',
          taxScheme: 'utgst_pair',
          cgstRate: 9,
          utgstRate: 9,
        },
      ],
    })
    expect(ut.lines[0]!.taxScheme).toBe('utgst_pair')
    expect(ut.lines[0]!.utgstAmount).toBe(90)
    expect(ut.lines[0]!.sgstAmount).toBe(0)
    expect(ut.lines[0]!.igstAmount).toBe(0)
    const sum = sumLineTaxComponents(ut.lines)
    expect(sum.dominantScheme).toBe('utgst_pair')
    expect(sum.utgstAmount).toBe(90)
  })
})
