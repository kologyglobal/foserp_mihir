/**
 * Phase 9 — multi-GSTIN isolation unit tests (no DB).
 */
import { describe, expect, it } from 'vitest'
import {
  buildSeriesPrefixHint,
  detectGstinContamination,
  filterLedgerRowsForGstinIsolation,
  normalizeGstin,
  resolveBranchTransferTaxTreatment,
  resolveCompanyGstinScope,
} from '../src/modules/accounting/tax-compliance/gst-registration-scope.util.js'

describe('resolveCompanyGstinScope', () => {
  it('prefers branch GSTIN when present', () => {
    const r = resolveCompanyGstinScope({
      legalEntityId: 'le1',
      legalEntityGstin: '27AAAAA0000A1Z5',
      branchId: 'b1',
      branchGstin: '29BBBBB0000B1Z5',
      branchStateCode: '29',
    })
    expect('ok' in r && r.ok === false).toBe(false)
    if (!('ok' in r)) {
      expect(r.source).toBe('BRANCH')
      expect(r.gstin).toBe('29BBBBB0000B1Z5')
      expect(r.isBranchScoped).toBe(true)
    }
  })
  it('falls back to LE GSTIN', () => {
    const r = resolveCompanyGstinScope({
      legalEntityId: 'le1',
      legalEntityGstin: '27AAAAA0000A1Z5',
      branchId: 'b1',
    })
    if (!('ok' in r)) {
      expect(r.source).toBe('LEGAL_ENTITY')
      expect(r.gstin).toBe('27AAAAA0000A1Z5')
    }
  })
  it('fails when nothing configured', () => {
    const r = resolveCompanyGstinScope({ legalEntityId: 'le1' })
    expect('ok' in r && r.ok === false).toBe(true)
  })
})

describe('filterLedgerRowsForGstinIsolation', () => {
  const rows = [
    { companyGstin: '27AAAAA0000A1Z5', id: 1 },
    { companyGstin: '29BBBBB0000B1Z5', id: 2 },
    { companyGstin: null, id: 3 },
  ]
  it('hard-isolates without legacy orphans', () => {
    const f = filterLedgerRowsForGstinIsolation(rows, '27AAAAA0000A1Z5')
    expect(f.map((r) => r.id)).toEqual([1])
  })
  it('optionally includes legacy null orphans', () => {
    const f = filterLedgerRowsForGstinIsolation(rows, '27AAAAA0000A1Z5', { allowLegacyOrphans: true })
    expect(f.map((r) => r.id).sort()).toEqual([1, 3])
  })
})

describe('detectGstinContamination', () => {
  it('flags multiple GSTINs', () => {
    expect(detectGstinContamination(['27A', null, '29B']).contaminated).toBe(false) // short invalid
    expect(
      detectGstinContamination(['27AAAAA0000A1Z5', null, '29BBBBB0000B1Z5']).contaminated,
    ).toBe(true)
  })
})

describe('resolveBranchTransferTaxTreatment', () => {
  it('blocks when not configured', () => {
    const r = resolveBranchTransferTaxTreatment({
      policy: 'NOT_CONFIGURED',
      fromGstin: '27AAAAA0000A1Z5',
      toGstin: '27AAAAA0000A1Z5',
    })
    expect(r.allowed).toBe(false)
  })
  it('same GSTIN stock no tax', () => {
    const r = resolveBranchTransferTaxTreatment({
      policy: 'SAME_GSTIN_STOCK_NO_TAX',
      fromGstin: '27AAAAA0000A1Z5',
      toGstin: '27AAAAA0000A1Z5',
    })
    expect(r.allowed).toBe(true)
    expect(r.chargeGst).toBe(false)
  })
  it('cross GSTIN taxable under policy', () => {
    const r = resolveBranchTransferTaxTreatment({
      policy: 'CROSS_GSTIN_TAXABLE_SUPPLY',
      fromGstin: '27AAAAA0000A1Z5',
      toGstin: '29BBBBB0000B1Z5',
    })
    expect(r.allowed).toBe(true)
    expect(r.chargeGst).toBe(true)
  })
})

describe('buildSeriesPrefixHint', () => {
  it('uses registration prefix first', () => {
    expect(buildSeriesPrefixHint({ registrationSeriesPrefix: 'mum', legalEntityCode: 'LE' })).toBe('MUM')
  })
  it('composes LE-branch', () => {
    expect(buildSeriesPrefixHint({ legalEntityCode: 'LE1', branchCode: 'HO', documentHint: 'SI' })).toBe(
      'LE1-HO-SI',
    )
  })
})

describe('normalizeGstin', () => {
  it('uppercases and trims', () => {
    expect(normalizeGstin(' 27aaaaa0000a1z5 ')).toBe('27AAAAA0000A1Z5')
  })
})
