import type { BankStatementLine } from '@prisma/client'
import { toDecimal } from '../../shared/finance-decimal.js'
import type { LedgerCandidateDto, ScoredLedgerCandidateDto } from './bank-reconciliation.types.js'

/** Trim, uppercase, strip safe punctuation, collapse whitespace. Never mutates stored values. */
export function normalizeReference(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .trim()
    .toUpperCase()
    .replace(/[.,;:'"`~!@#$%^&*_+=\\/|<>?()[\]{}-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(Math.round((a.getTime() - b.getTime()) / 86_400_000))
}

export interface ScoringSettings {
  dateToleranceDays: number
  amountTolerance: string
  referenceNormalizationEnabled: boolean
}

/**
 * Transparent 0-100 scoring:
 *  - Amount exact match: +50; within tolerance (not exact): +25
 *  - Date within tolerance: up to +25 (linear decay to 0 at the tolerance boundary)
 *  - Reference match (normalized): +25
 * confidenceLevel: >=90 HIGH, >=70 MEDIUM, else LOW.
 */
export function scoreCandidate(
  line: BankStatementLine,
  candidate: LedgerCandidateDto,
  settings: ScoringSettings,
): ScoredLedgerCandidateDto {
  const reasonCodes: string[] = []
  let score = 0

  const lineAmount = toDecimal(line.amount)
  const candidateAmount = toDecimal(candidate.unreconciledAmount)
  const amountDiff = lineAmount.sub(candidateAmount).abs()
  const tolerance = toDecimal(settings.amountTolerance)

  if (amountDiff.isZero()) {
    score += 50
    reasonCodes.push('AMOUNT_EXACT')
  } else if (amountDiff.lte(tolerance) && tolerance.gt(0)) {
    score += 25
    reasonCodes.push('AMOUNT_WITHIN_TOLERANCE')
  } else {
    reasonCodes.push('AMOUNT_MISMATCH')
  }

  const lineDate = line.transactionDate
  const candidateDate = new Date(candidate.postingDate)
  const dateDiffDays = daysBetween(lineDate, candidateDate)
  const dateTolerance = Math.max(settings.dateToleranceDays, 0)
  if (dateTolerance === 0) {
    if (dateDiffDays === 0) {
      score += 25
      reasonCodes.push('DATE_EXACT')
    } else {
      reasonCodes.push('DATE_OUTSIDE_TOLERANCE')
    }
  } else if (dateDiffDays <= dateTolerance) {
    const proximityScore = Math.round(25 * (1 - dateDiffDays / (dateTolerance + 1)))
    score += proximityScore
    reasonCodes.push(dateDiffDays === 0 ? 'DATE_EXACT' : 'DATE_WITHIN_TOLERANCE')
  } else {
    reasonCodes.push('DATE_OUTSIDE_TOLERANCE')
  }

  const lineRef = settings.referenceNormalizationEnabled
    ? normalizeReference(line.referenceNumber ?? line.utrReference ?? line.chequeNumber)
    : (line.referenceNumber ?? '').trim()
  const candidateRef = settings.referenceNormalizationEnabled
    ? normalizeReference(candidate.referenceNumber ?? candidate.sourceDocumentNumber ?? candidate.voucherNumber)
    : (candidate.referenceNumber ?? candidate.voucherNumber ?? '').trim()
  if (lineRef && candidateRef && lineRef === candidateRef) {
    score += 25
    reasonCodes.push('REFERENCE_MATCH')
  } else {
    reasonCodes.push('REFERENCE_NO_MATCH')
  }

  score = Math.max(0, Math.min(100, score))
  const confidenceLevel: ScoredLedgerCandidateDto['confidenceLevel'] = score >= 90 ? 'HIGH' : score >= 70 ? 'MEDIUM' : 'LOW'

  return {
    ...candidate,
    score,
    confidenceLevel,
    reasonCodes,
    dateDiffDays,
    amountDiff: amountDiff.toFixed(4),
  }
}

export function scoreCandidates(
  line: BankStatementLine,
  candidates: LedgerCandidateDto[],
  settings: ScoringSettings,
): ScoredLedgerCandidateDto[] {
  return candidates
    .map((c) => scoreCandidate(line, c, settings))
    .sort((a, b) => b.score - a.score)
}
