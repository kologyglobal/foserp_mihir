/**
 * Pure GSTR-2B ↔ books matching helpers (Phase 3).
 * Never grants ITC eligibility automatically.
 */
import type { Gstr2bMatchStatus, GstItcClaimClass } from '@prisma/client'

export type BooksCandidate = {
  id: string
  vendorGstin: string | null
  supplierInvoiceNumber: string
  supplierInvoiceDate: Date | string
  taxableAmount: number
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
  cessAmount: number
  isRcm?: boolean
  itcEligibility?: string | null
}

export type Gstr2bLineLike = {
  supplierGstin: string
  invoiceNumber: string
  invoiceDate: Date | string
  taxableValue: number
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
  cessAmount: number
}

export function normalizeInvoiceNumber(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[\s\-_/\\.]/g, '')
    .replace(/^0+/, '') || value.trim().toUpperCase()
}

export function normalizeGstin(value: string | null | undefined): string {
  return (value ?? '').trim().toUpperCase()
}

function dayStamp(d: Date | string): number {
  const iso = typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10)
  return Date.parse(`${iso}T00:00:00.000Z`)
}

function daysBetween(a: Date | string, b: Date | string): number {
  return Math.abs(dayStamp(a) - dayStamp(b)) / 86_400_000
}

function nearlyEqual(a: number, b: number, absTol = 1, pctTol = 0.01): boolean {
  if (Math.abs(a - b) <= absTol) return true
  const base = Math.max(Math.abs(a), Math.abs(b), 1)
  return Math.abs(a - b) / base <= pctTol
}

export function taxTotal(row: {
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
  cessAmount: number
}): number {
  return row.cgstAmount + row.sgstAmount + row.igstAmount + row.cessAmount
}

export type MatchScoreResult = {
  score: number
  status: Gstr2bMatchStatus
  notes: string[]
}

/**
 * Score a 2B line against one books vendor invoice. Higher is better (max ~230).
 */
export function scoreGstr2bAgainstBooks(row: Gstr2bLineLike, books: BooksCandidate): MatchScoreResult {
  const notes: string[] = []
  let score = 0
  const rowGstin = normalizeGstin(row.supplierGstin)
  const booksGstin = normalizeGstin(books.vendorGstin)
  const rowInv = normalizeInvoiceNumber(row.invoiceNumber)
  const booksInv = normalizeInvoiceNumber(books.supplierInvoiceNumber)

  if (rowGstin && booksGstin && rowGstin === booksGstin) {
    score += 80
  } else if (rowInv && booksInv && rowInv === booksInv) {
    score += 20
    notes.push('Invoice number matched but GSTIN differs')
  }

  if (rowInv && booksInv && rowInv === booksInv) {
    score += 100
  } else if (rowInv && booksInv && (rowInv.includes(booksInv) || booksInv.includes(rowInv))) {
    score += 40
    notes.push('Invoice number partial match')
  }

  const dayDiff = daysBetween(row.invoiceDate, books.supplierInvoiceDate)
  if (dayDiff === 0) score += 50
  else if (dayDiff <= 3) {
    score += 25
    notes.push(`Invoice date off by ${dayDiff} day(s)`)
  } else if (dayDiff <= 15) {
    score += 10
    notes.push(`Invoice date off by ${dayDiff} days`)
  }

  if (nearlyEqual(row.taxableValue, books.taxableAmount, 1, 0.005)) score += 40
  else if (nearlyEqual(row.taxableValue, books.taxableAmount, 5, 0.02)) {
    score += 15
    notes.push('Taxable value variance within tolerance')
  } else {
    notes.push('Taxable value mismatch')
  }

  const rowTax = taxTotal(row)
  const booksTax =
    books.cgstAmount + books.sgstAmount + books.igstAmount + books.cessAmount
  if (nearlyEqual(rowTax, booksTax, 1, 0.005)) score += 40
  else if (nearlyEqual(rowTax, booksTax, 5, 0.02)) {
    score += 15
    notes.push('Tax amount variance within tolerance')
  } else {
    notes.push('Tax amount mismatch')
  }

  let status: Gstr2bMatchStatus = 'UNMATCHED'
  const gstinMismatch =
    Boolean(rowGstin && booksGstin && rowGstin !== booksGstin) && Boolean(rowInv && booksInv && rowInv === booksInv)

  // Invoice number + conflicting GSTIN is never a clean MATCH regardless of amount/date score
  if (gstinMismatch) {
    status = 'GSTIN_MISMATCH'
  } else if (score >= 200) {
    status = 'MATCHED'
  } else if (score >= 140) {
    status = 'PARTIAL_MATCH'
  } else if (rowInv === booksInv && !nearlyEqual(row.taxableValue, books.taxableAmount, 5, 0.02)) {
    status = 'VALUE_MISMATCH'
  } else if (rowInv === booksInv && !nearlyEqual(rowTax, booksTax, 5, 0.02)) {
    status = 'TAX_MISMATCH'
  } else if (score >= 80) {
    status = 'REVIEW_REQUIRED'
  }

  return { score, status, notes }
}

/** Pick best books candidate for a 2B line (or null). */
export function pickBestBooksMatch(
  row: Gstr2bLineLike,
  candidates: BooksCandidate[],
): { books: BooksCandidate; result: MatchScoreResult } | null {
  let best: { books: BooksCandidate; result: MatchScoreResult } | null = null
  for (const c of candidates) {
    const result = scoreGstr2bAgainstBooks(row, c)
    if (!best || result.score > best.result.score) best = { books: c, result }
  }
  if (!best || best.result.score < 60) return null
  // Do not auto-select clear GSTIN conflicts — force human review path (null = MISSING_IN_BOOKS unless caller widens)
  if (best.result.status === 'GSTIN_MISMATCH' && best.result.score < 120) return null
  return best
}

/**
 * Suggest ITC claim class for books row — never upgrades to ELIGIBLE without review.
 * Auto-claim is blocked by design when data is incomplete.
 */
export function suggestItcClaimClass(input: {
  matchStatus: Gstr2bMatchStatus
  booksItcEligibility?: string | null
  isRcm?: boolean
  hasTaxInvoiceDetails: boolean
}): { claimClass: GstItcClaimClass; autoClaimBlocked: boolean; reasons: string[] } {
  const reasons: string[] = []
  if (!input.hasTaxInvoiceDetails) {
    reasons.push('Incomplete invoice particulars — cannot auto-claim ITC')
  }
  if (input.matchStatus !== 'MATCHED' && input.matchStatus !== 'PARTIAL_MATCH') {
    reasons.push(`Match status ${input.matchStatus} — claim requires review`)
  }
  if (input.isRcm) {
    return {
      claimClass: 'RCM_ELIGIBLE',
      autoClaimBlocked: true,
      reasons: [...reasons, 'RCM ITC recognition requires RCM liability settlement confirmation'],
    }
  }
  if (input.booksItcEligibility === 'INELIGIBLE') {
    return { claimClass: 'INELIGIBLE', autoClaimBlocked: true, reasons: [...reasons, 'Books marked INELIGIBLE'] }
  }
  if (input.booksItcEligibility === 'ELIGIBLE' && input.matchStatus === 'MATCHED' && input.hasTaxInvoiceDetails) {
    return {
      claimClass: 'ELIGIBLE',
      autoClaimBlocked: true,
      reasons: [...reasons, 'Eligible in books + matched — still requires reviewer confirmation (no auto-claim)'],
    }
  }
  return {
    claimClass: 'REVIEW_REQUIRED',
    autoClaimBlocked: true,
    reasons: reasons.length ? reasons : ['Default REVIEW_REQUIRED — no automatic ITC claim'],
  }
}
