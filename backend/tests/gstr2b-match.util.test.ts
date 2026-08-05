import { describe, expect, it } from 'vitest'
import {
  normalizeGstin,
  normalizeInvoiceNumber,
  pickBestBooksMatch,
  scoreGstr2bAgainstBooks,
  suggestItcClaimClass,
  taxTotal,
  type BooksCandidate,
  type Gstr2bLineLike,
} from '../src/modules/accounting/tax-compliance/gstr2b-match.util.js'

const baseRow: Gstr2bLineLike = {
  supplierGstin: '27AAAAA0000A1Z5',
  invoiceNumber: 'INV-1001',
  invoiceDate: '2026-06-15',
  taxableValue: 10_000,
  cgstAmount: 900,
  sgstAmount: 900,
  igstAmount: 0,
  cessAmount: 0,
}

const baseBooks: BooksCandidate = {
  id: 'vi-1',
  vendorGstin: '27AAAAA0000A1Z5',
  supplierInvoiceNumber: 'INV-1001',
  supplierInvoiceDate: '2026-06-15',
  taxableAmount: 10_000,
  cgstAmount: 900,
  sgstAmount: 900,
  igstAmount: 0,
  cessAmount: 0,
  isRcm: false,
  itcEligibility: 'ELIGIBLE',
}

describe('gstr2b-match.util normalize', () => {
  it('normalizes invoice numbers (strip separators / leading zeros of whole token)', () => {
    // Separators removed; leading zeros of entire normalized string stripped; internal zeros kept
    expect(normalizeInvoiceNumber('inv-001/2')).toBe('INV0012')
    expect(normalizeInvoiceNumber('  00AB-10 ')).toBe('AB10')
    expect(normalizeInvoiceNumber('  AB-10 ')).toBe('AB10')
  })

  it('normalizes GSTIN to upper case', () => {
    expect(normalizeGstin(' 27aaaaa0000a1z5 ')).toBe('27AAAAA0000A1Z5')
    expect(normalizeGstin(null)).toBe('')
  })
})

describe('scoreGstr2bAgainstBooks', () => {
  it('scores a full match as MATCHED (high score)', () => {
    const r = scoreGstr2bAgainstBooks(baseRow, baseBooks)
    expect(r.score).toBeGreaterThanOrEqual(200)
    expect(r.status).toBe('MATCHED')
  })

  it('detects value mismatch when invoice number matches', () => {
    const r = scoreGstr2bAgainstBooks(baseRow, {
      ...baseBooks,
      taxableAmount: 12_000,
      cgstAmount: 1080,
      sgstAmount: 1080,
    })
    expect(r.status === 'VALUE_MISMATCH' || r.status === 'PARTIAL_MATCH' || r.notes.some((n) => n.includes('Taxable'))).toBe(
      true,
    )
  })

  it('flags GSTIN mismatch when invoice number equals', () => {
    const r = scoreGstr2bAgainstBooks(baseRow, {
      ...baseBooks,
      vendorGstin: '29BBBBB1111B2Z6',
    })
    expect(r.status).toBe('GSTIN_MISMATCH')
    expect(r.score).toBeGreaterThan(0)
  })
})

describe('pickBestBooksMatch', () => {
  it('returns null when no candidate scores enough', () => {
    const best = pickBestBooksMatch(baseRow, [
      {
        id: 'noise',
        vendorGstin: '99XXXXX9999X9Z9',
        supplierInvoiceNumber: 'ZZZ-999',
        supplierInvoiceDate: '2020-01-01',
        taxableAmount: 1,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        cessAmount: 0,
      },
    ])
    expect(best).toBeNull()
  })

  it('picks the highest scoring candidate', () => {
    const weak: BooksCandidate = {
      ...baseBooks,
      id: 'weak',
      supplierInvoiceNumber: 'INV-OTHER',
      taxableAmount: 9900,
    }
    const best = pickBestBooksMatch(baseRow, [weak, baseBooks])
    expect(best?.books.id).toBe('vi-1')
  })
})

describe('suggestItcClaimClass', () => {
  it('always sets autoClaimBlocked true even when MATCHED+ELIGIBLE', () => {
    const out = suggestItcClaimClass({
      matchStatus: 'MATCHED',
      booksItcEligibility: 'ELIGIBLE',
      isRcm: false,
      hasTaxInvoiceDetails: true,
    })
    expect(out.claimClass).toBe('ELIGIBLE')
    expect(out.autoClaimBlocked).toBe(true)
    expect(out.reasons.some((r) => r.toLowerCase().includes('auto-claim') || r.toLowerCase().includes('reviewer'))).toBe(
      true,
    )
  })

  it('returns INELIGIBLE when books mark INELIGIBLE', () => {
    const out = suggestItcClaimClass({
      matchStatus: 'MATCHED',
      booksItcEligibility: 'INELIGIBLE',
      hasTaxInvoiceDetails: true,
    })
    expect(out.claimClass).toBe('INELIGIBLE')
    expect(out.autoClaimBlocked).toBe(true)
  })

  it('returns RCM_ELIGIBLE suggestion with auto-claim blocked', () => {
    const out = suggestItcClaimClass({
      matchStatus: 'MATCHED',
      isRcm: true,
      hasTaxInvoiceDetails: true,
    })
    expect(out.claimClass).toBe('RCM_ELIGIBLE')
    expect(out.autoClaimBlocked).toBe(true)
  })

  it('defaults to REVIEW_REQUIRED for unmatched', () => {
    const out = suggestItcClaimClass({
      matchStatus: 'MISSING_IN_BOOKS',
      hasTaxInvoiceDetails: true,
    })
    expect(out.claimClass).toBe('REVIEW_REQUIRED')
    expect(out.autoClaimBlocked).toBe(true)
  })
})

describe('taxTotal', () => {
  it('sums components', () => {
    expect(taxTotal({ cgstAmount: 1, sgstAmount: 2, igstAmount: 3, cessAmount: 0.5 })).toBe(6.5)
  })
})
