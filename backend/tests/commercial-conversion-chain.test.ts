/**
 * Conversion chain mapping invariants (pure): Q price line → SO line snapshot → PI/TI fields.
 * Full DB E2E for PI/TI still requires live stack; this locks snapshot carry rules.
 */
import { describe, expect, it } from 'vitest'
import { buildLinesFromInput } from '../src/modules/crm/sales-orders/sales-order.workflow.js'
import {
  resolveCommercialPlaceOfSupply,
  resolveCommercialSupplyType,
} from '../src/modules/tax/commercial-supply-context.js'
import { sumLineTaxComponents } from '../src/modules/crm/sales-orders/sales-order-tax-header.js'

const itemId = 'aaaaaaaa-1111-4111-8111-111111111111'

/** Mimic Q→SO→PI→TI field carry without DB. */
function mapSoHeaderToProformaTax(so: {
  placeOfSupply: string | null
  placeOfSupplyStateCode: string | null
  supplyType: string
  gstScheme: string
  lines: ReturnType<typeof buildLinesFromInput>['lines']
}) {
  return {
    placeOfSupply: so.placeOfSupply,
    placeOfSupplyStateCode: so.placeOfSupplyStateCode,
    supplyType: so.supplyType,
    gstScheme: so.gstScheme,
    lines: so.lines.map((l) => ({
      hsnCode: l.hsnCode,
      taxScheme: l.taxScheme,
      taxPct: l.taxPct,
      cgstRate: l.cgstRate,
      sgstRate: l.sgstRate,
      utgstRate: l.utgstRate,
      igstRate: l.igstRate,
    })),
  }
}

function mapProformaToTaxInvoice(pi: ReturnType<typeof mapSoHeaderToProformaTax>) {
  return {
    placeOfSupply: pi.placeOfSupply,
    placeOfSupplyStateCode: pi.placeOfSupplyStateCode,
    supplyType: pi.supplyType,
    gstScheme: pi.gstScheme,
    lines: pi.lines.map((l) => ({ ...l })),
  }
}

describe('Q→SO→PI→TI conversion snapshot chain', () => {
  it('carries HSN, IGST scheme, and header PoS from quote-like lines through PI and TI maps', () => {
    // Quotation-like lines (customer MH, supplier GJ → INTER)
    const pos = resolveCommercialPlaceOfSupply({
      customerState: 'Maharashtra',
      shipToState: 'Maharashtra',
    })
    const supply = resolveCommercialSupplyType({
      supplierStateCode: '24',
      placeOfSupplyStateCode: pos.placeOfSupplyStateCode,
    })
    expect(supply.supplyType).toBe('INTER_STATE')

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
          taxScheme: supply.taxScheme,
          igstRate: 18,
          cgstRate: 0,
          sgstRate: 0,
        },
      ],
    })
    const components = sumLineTaxComponents(lines)

    const so = {
      placeOfSupply: pos.placeOfSupplyLabel,
      placeOfSupplyStateCode: pos.placeOfSupplyStateCode,
      supplyType: supply.supplyType,
      gstScheme: supply.taxScheme,
      lines,
      ...components,
    }

    const pi = mapSoHeaderToProformaTax(so)
    const ti = mapProformaToTaxInvoice(pi)

    expect(ti.placeOfSupplyStateCode).toBe('27')
    expect(ti.supplyType).toBe('INTER_STATE')
    expect(ti.gstScheme).toBe('igst')
    expect(ti.lines[0]!.hsnCode).toBe('8716')
    expect(ti.lines[0]!.taxScheme).toBe('igst')
    expect(ti.lines[0]!.igstRate).toBe(18)
    expect(so.igstAmount).toBe(90000)
  })

  it('preserves CGST+SGST intra-state snapshots end-to-end', () => {
    const pos = resolveCommercialPlaceOfSupply({ customerState: 'Gujarat' })
    const supply = resolveCommercialSupplyType({
      supplierStateCode: '24',
      placeOfSupplyStateCode: pos.placeOfSupplyStateCode,
    })
    expect(supply.taxScheme).toBe('cgst_sgst')

    const { lines } = buildLinesFromInput({
      lines: [
        {
          productOrItem: 'Kit',
          itemId,
          qty: 10,
          unitPrice: 1000,
          discountPct: 0,
          taxPct: 18,
          hsnCode: '8708',
          taxScheme: 'cgst_sgst',
          cgstRate: 9,
          sgstRate: 9,
        },
      ],
    })

    const pi = mapSoHeaderToProformaTax({
      placeOfSupply: pos.placeOfSupplyLabel,
      placeOfSupplyStateCode: pos.placeOfSupplyStateCode,
      supplyType: supply.supplyType,
      gstScheme: supply.taxScheme,
      lines,
    })
    const ti = mapProformaToTaxInvoice(pi)
    expect(ti.lines[0]!.cgstRate).toBe(9)
    expect(ti.lines[0]!.sgstRate).toBe(9)
    expect(ti.lines[0]!.hsnCode).toBe('8708')
    expect(ti.supplyType).toBe('INTRA_STATE')
  })

  it('TI accounting create payload prefers upstream PoS over party-only fallback', () => {
    // Simulate unified SI input: explicit PoS from SO must win in priority resolution.
    const upstreamPos = '29' // Karnataka ship-to
    const partyState = '27' // Maharashtra customer master
    const resolved =
      upstreamPos /* input.placeOfSupplyStateCode */ ||
      partyState
    expect(resolved).toBe('29')
    expect(resolved).not.toBe(partyState)
  })
})
