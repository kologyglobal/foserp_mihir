/**
 * Phase 10 — Export / SEZ / LUT pure unit tests (no DB).
 */
import { describe, expect, it } from 'vitest'
import {
  applyZeroRatedTreatmentToRates,
  assessLutRequirement,
  classifyExportSez,
  evaluateLutValidity,
  isExportOrSezDocument,
  isExportOrSezPlaceOfSupply,
  partitionExportSezDocs,
  paymentModeFromTreatment,
  proposeIgstRefundFromExport,
  requiresLutCoverage,
} from '../src/modules/accounting/tax-compliance/export-sez-lut.util.js'
import { buildGstr1Sections, isExportOrSez, type LedgerRowLike } from '../src/modules/accounting/tax-compliance/gstr-registers.util.js'
import { applySchemeToMasterRate } from '../src/modules/tax/gst-tax-resolve.service.js'
import { applyZeroRatedTreatmentToRates as applyZero } from '../src/modules/accounting/tax-compliance/export-sez-lut.util.js'

describe('export-sez-lut classification', () => {
  it('classifies WPAY / WOPAY treatments', () => {
    expect(classifyExportSez({ taxTreatment: 'EXPORT_WITH_TAX' })).toBe('EXPORT_WPAY')
    expect(classifyExportSez({ taxTreatment: 'EXPORT_WITHOUT_TAX' })).toBe('EXPORT_WOPAY')
    expect(classifyExportSez({ taxTreatment: 'SEZ_WITHOUT_TAX' })).toBe('SEZ_WOPAY')
    expect(classifyExportSez({ supplyType: 'EXPORT' })).toBe('EXPORT_WPAY')
    expect(classifyExportSez({ placeOfSupply: '27-Maharashtra' })).toBe('DOMESTIC')
  })

  it('requires LUT only for without-payment zero-rated', () => {
    expect(requiresLutCoverage('EXPORT_WITHOUT_TAX')).toBe(true)
    expect(requiresLutCoverage('SEZ_WITHOUT_TAX')).toBe(true)
    expect(requiresLutCoverage('EXPORT_WITH_TAX')).toBe(false)
    expect(requiresLutCoverage('REGISTERED')).toBe(false)
  })

  it('validates LUT period and GSTIN', () => {
    const lut = {
      lutNumber: 'LUT/27/2025-26',
      companyGstin: '27AAAAA0000A1Z5',
      validFrom: '2025-04-01',
      validTo: '2026-03-31',
      isActive: true,
      status: 'ACTIVE',
    }
    expect(evaluateLutValidity(lut, { asOfDate: '2025-08-15', companyGstin: '27AAAAA0000A1Z5' }).ok).toBe(true)
    expect(evaluateLutValidity(lut, { asOfDate: '2026-04-01' }).status).toBe('EXPIRED')
    expect(evaluateLutValidity(lut, { asOfDate: '2025-03-01' }).status).toBe('NOT_YET_EFFECTIVE')
    expect(
      evaluateLutValidity(lut, { asOfDate: '2025-08-15', companyGstin: '29BBBBB0000B1Z5' }).status,
    ).toBe('GSTIN_MISMATCH')
  })

  it('soft-assesses missing LUT for WOPAY', () => {
    const soft = assessLutRequirement({
      taxTreatment: 'EXPORT_WITHOUT_TAX',
      lut: null,
      asOfDate: '2025-08-01',
      hardBlock: false,
    })
    expect(soft.required).toBe(true)
    expect(soft.blockers).toHaveLength(0)
    expect(soft.warnings.length).toBeGreaterThan(0)

    const hard = assessLutRequirement({
      taxTreatment: 'EXPORT_WITHOUT_TAX',
      lut: null,
      asOfDate: '2025-08-01',
      hardBlock: true,
    })
    expect(hard.blockers.length).toBeGreaterThan(0)
  })

  it('applies WOPAY rates to zero and WPAY to IGST only', () => {
    const wopay = applyZeroRatedTreatmentToRates({
      taxTreatment: 'EXPORT_WITHOUT_TAX',
      cgstRate: 9,
      sgstRate: 9,
      utgstRate: 0,
      igstRate: 18,
      gstRate: 18,
    })
    expect(wopay.applied).toBe(true)
    expect(wopay.taxCategory).toBe('ZERO_RATED')
    expect(wopay.gstRate).toBe(0)
    expect(wopay.paymentMode).toBe('WOPAY')

    const wpay = applyZeroRatedTreatmentToRates({
      taxTreatment: 'SEZ_WITH_TAX',
      cgstRate: 9,
      sgstRate: 9,
      utgstRate: 0,
      igstRate: 18,
      gstRate: 18,
    })
    expect(wpay.igstRate).toBe(18)
    expect(wpay.cgstRate).toBe(0)
    expect(wpay.paymentMode).toBe('WPAY')
  })

  it('proposes refund foundation from WPAY amounts', () => {
    const p = proposeIgstRefundFromExport({
      returnPeriod: '2025-08',
      exportWpayTaxable: 1000,
      exportWpayIgst: 180,
    })
    expect(p?.claimType).toBe('IGST_REFUND')
    expect(p?.igstAmount).toBe(180)
    expect(proposeIgstRefundFromExport({ returnPeriod: '2025-08', exportWpayTaxable: 0, exportWpayIgst: 0 })).toBeNull()
  })

  it('partitions export docs by payment mode', () => {
    const parts = partitionExportSezDocs([
      { taxTreatment: 'EXPORT_WITH_TAX', totalTax: 18 },
      { taxTreatment: 'EXPORT_WITHOUT_TAX', totalTax: 0 },
      { placeOfSupply: '96', totalTax: 0 },
    ])
    expect(parts.wpay).toHaveLength(1)
    expect(parts.wopay).toHaveLength(1)
    expect(parts.other).toHaveLength(1)
  })
})

describe('gstr-1 export section phase 10', () => {
  function row(partial: Partial<LedgerRowLike> & Pick<LedgerRowLike, 'documentId' | 'taxType' | 'taxableValue' | 'taxAmount'>): LedgerRowLike {
    return {
      documentNumber: 'SI-1',
      documentDate: '2026-08-10',
      documentType: 'SALES_INVOICE',
      documentLineId: 'L1',
      direction: 'OUTWARD',
      partyGstin: null,
      companyGstin: '27AAAAA0000A1Z5',
      placeOfSupply: '96',
      hsnSacCode: '87089900',
      taxRate: 0,
      isReverseCharge: false,
      itcEligibility: null,
      filingStatus: 'NOT_FILED',
      ...partial,
    }
  }

  it('keeps legacy POS export heuristic', () => {
    expect(isExportOrSez('EXPORT')).toBe(true)
    expect(isExportOrSezPlaceOfSupply('96')).toBe(true)
    expect(isExportOrSezDocument({ taxTreatment: 'EXPORT_WITHOUT_TAX' })).toBe(true)
  })

  it('routes zero-rated treatment rows into exportSez even when POS is domestic-looking', () => {
    const rows: LedgerRowLike[] = [
      row({
        documentId: 'e1',
        taxType: 'OUTPUT_IGST',
        taxableValue: 500,
        taxAmount: 0,
        taxTreatment: 'EXPORT_WITHOUT_TAX',
        placeOfSupply: '27',
        zeroRatedMode: 'WOPAY',
      }),
    ]
    const g1 = buildGstr1Sections(rows)
    expect(g1.exportSez).toHaveLength(1)
    expect(g1.exportSezWopay).toHaveLength(1)
    expect(g1.b2c).toHaveLength(0)
  })

  it('splits WPAY into exportSezWpay with IGST liability', () => {
    const rows: LedgerRowLike[] = [
      row({
        documentId: 'e2',
        taxType: 'OUTPUT_IGST',
        taxableValue: 1000,
        taxAmount: 180,
        taxTreatment: 'EXPORT_WITH_TAX',
        taxRate: 18,
        zeroRatedMode: 'WPAY',
      }),
    ]
    const g1 = buildGstr1Sections(rows)
    expect(g1.exportSezWpay).toHaveLength(1)
    expect(g1.exportSezWpay[0].igst).toBe(180)
  })
})

describe('tax resolve zero-rated rate path (pure compose)', () => {
  it('master IGST 18 then WOPAY forces zero', () => {
    const scheme = applySchemeToMasterRate(
      { cgstRate: '9', sgstRate: '9', igstRate: '18', gstRate: '18' },
      { isInterstate: true },
    )
    const z = applyZero({
      taxTreatment: 'EXPORT_WITHOUT_TAX',
      ...scheme,
      utgstRate: 0,
    })
    expect(z.gstRate).toBe(0)
    expect(paymentModeFromTreatment('EXPORT_WITHOUT_TAX')).toBe('WOPAY')
  })
})
