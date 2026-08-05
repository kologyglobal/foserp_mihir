/**
 * Phase 11 — GST special schemes / specials pure unit tests (no DB).
 */
import { describe, expect, it } from 'vitest'
import {
  allocateAdvanceAgainstInvoice,
  assertCompositionAllowsEInvoice,
  buildPhase11CapabilityMatrix,
  classifyGstSupply,
  computeGstTdsLiability,
  evaluateJobWorkGstTreatment,
  isCompositionScheme,
  isNilExemptOrNonGstClass,
  isPhase11SpecialsEnabled,
} from '../src/modules/accounting/tax-compliance/gst-specials.util.js'
import { checkEInvoiceReadiness } from '../src/modules/accounting/tax-compliance/einvoice-readiness.util.js'

describe('classifyGstSupply', () => {
  it('labels NIL_RATED when rate is 0 without explicit hint', () => {
    const r = classifyGstSupply({ gstRate: 0 })
    expect(r.supplyClass).toBe('NIL_RATED')
    expect(r.isZeroTaxVisible).toBe(true)
    expect(r.warnings.length).toBeGreaterThan(0)
  })

  it('respects EXEMPT / NON_GST / ZERO_RATED hints', () => {
    expect(classifyGstSupply({ gstRate: 0, taxCategoryHint: 'EXEMPT' }).supplyClass).toBe('EXEMPT')
    expect(classifyGstSupply({ gstRate: 0, taxCategoryHint: 'NON_GST' }).supplyClass).toBe('NON_GST')
    expect(
      classifyGstSupply({
        gstRate: 0,
        taxTreatment: 'EXPORT_WITHOUT_TAX',
      }).supplyClass,
    ).toBe('ZERO_RATED')
  })

  it('flags composition seller', () => {
    const r = classifyGstSupply({ gstRate: 18, registrationScheme: 'COMPOSITION' })
    expect(r.supplyClass).toBe('COMPOSITION')
    expect(r.warnings.some((w) => w.toLowerCase().includes('composition'))).toBe(true)
  })

  it('classifies reverse charge', () => {
    expect(classifyGstSupply({ gstRate: 18, reverseCharge: true }).supplyClass).toBe('REVERSE_CHARGE')
  })
})

describe('composition e-invoice gate', () => {
  it('blocks composition registration', () => {
    const g = assertCompositionAllowsEInvoice({ sellerRegistrationScheme: 'COMPOSITION' })
    expect(g.allowed).toBe(false)
    if (!g.allowed) expect(g.code).toBe('COMPOSITION_EINVOICE')
  })

  it('allows regular registration', () => {
    expect(assertCompositionAllowsEInvoice({ sellerRegistrationScheme: 'REGULAR' }).allowed).toBe(true)
  })

  it('wires into e-invoice readiness', () => {
    const r = checkEInvoiceReadiness({
      salesInvoiceStatus: 'POSTED',
      legalEntityGstin: '27AAAAA0000A1Z5',
      customerGstin: '29BBBBB0000B1Z5',
      invoiceNumber: 'INV-1',
      sellerRegistrationScheme: 'COMPOSITION',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('COMPOSITION_EINVOICE')
  })
})

describe('GST TDS/TCS liability', () => {
  it('splits CGST/SGST for intra TDS 2%', () => {
    const r = computeGstTdsLiability({ kind: 'GST_TDS', taxableValue: 10000, isInterstate: false })
    expect(r.ratePct).toBe(2)
    expect(r.totalWithheld).toBe(200)
    expect(r.tdsCgst + r.tdsSgst).toBeCloseTo(200, 2)
    expect(r.tdsIgst).toBe(0)
  })

  it('uses IGST for interstate TCS', () => {
    const r = computeGstTdsLiability({ kind: 'GST_TCS', taxableValue: 10000, isInterstate: true })
    expect(r.ratePct).toBe(1)
    expect(r.tdsIgst).toBe(100)
    expect(r.tdsCgst).toBe(0)
  })
})

describe('advance allocation', () => {
  it('allocates partially and reports remainder', () => {
    const r = allocateAdvanceAgainstInvoice({
      advanceTaxable: 1000,
      advanceTax: 180,
      invoiceTaxable: 400,
      invoiceTax: 72,
    })
    expect(r.adjustableTaxable).toBe(400)
    expect(r.remainingAdvanceTaxable).toBe(600)
    expect(r.fullyAdjusted).toBe(false)
  })

  it('fully adjusts when invoice covers remainder', () => {
    const r = allocateAdvanceAgainstInvoice({
      advanceTaxable: 500,
      advanceTax: 90,
      invoiceTaxable: 600,
      invoiceTax: 108,
      alreadyAdjustedTaxable: 0,
      alreadyAdjustedTax: 0,
    })
    expect(r.fullyAdjusted).toBe(true)
    expect(r.remainingAdvanceTaxable).toBe(0)
  })
})

describe('job work eval', () => {
  it('notes process charges path on JOBWORK_INVOICE', () => {
    const r = evaluateJobWorkGstTreatment({ movement: 'JOBWORK_INVOICE', processCharges: 2500 })
    expect(r.gstOnProcessChargesOnly).toBe(true)
    expect(r.notes.length).toBeGreaterThan(0)
  })
})

describe('capability matrix honest labels', () => {
  it('never claims full compliance', () => {
    const m = buildPhase11CapabilityMatrix()
    expect(m.notFullGstCompliant).toBe(true)
    expect(m.verdict).toBe('READY_WITH_CONDITIONS')
    expect(m.capabilities.some((c) => c.id === 'portal_filing' && c.status === 'PARTIAL')).toBe(true)
    expect(m.capabilities.some((c) => c.id === 'export_lut_sez' && c.status === 'PARTIAL')).toBe(true)
  })

  it('feature flag defaults on', () => {
    expect(isPhase11SpecialsEnabled({ GST_PHASE11_SPECIALS_ENABLED: undefined })).toBe(true)
    expect(isPhase11SpecialsEnabled({ GST_PHASE11_SPECIALS_ENABLED: 'false' })).toBe(false)
  })

  it('composition helpers', () => {
    expect(isCompositionScheme('composition_scheme')).toBe(true)
    expect(isNilExemptOrNonGstClass('EXEMPT')).toBe(true)
  })
})
