import { formatCrmCurrency } from './crmMetrics'

/** Absolute rupee floor — ignores float noise below ₹1. */
export const OPP_QUOTE_MISMATCH_ABS_INR = 1

/** Relative floor — material when ≥ 0.5% of the larger amount. */
export const OPP_QUOTE_MISMATCH_PCT = 0.005

const DISMISS_STORAGE_KEY = 'fos-opp-quote-value-mismatch-dismissed'

export interface OpportunityQuotationValueComparison {
  opportunityValue: number
  quotationGrandTotal: number
  delta: number
  absDelta: number
  quoteIsLower: boolean
  message: string
}

export function compareOpportunityQuotationValues(
  opportunityValue: number,
  quotationGrandTotal: number,
): OpportunityQuotationValueComparison | null {
  if (!Number.isFinite(opportunityValue) || !Number.isFinite(quotationGrandTotal)) return null
  if (opportunityValue <= 0 || quotationGrandTotal <= 0) return null

  const delta = quotationGrandTotal - opportunityValue
  const absDelta = Math.abs(delta)
  const base = Math.max(Math.abs(opportunityValue), Math.abs(quotationGrandTotal), 1)
  const threshold = Math.max(OPP_QUOTE_MISMATCH_ABS_INR, base * OPP_QUOTE_MISMATCH_PCT)
  if (absDelta < threshold) return null

  const quoteIsLower = delta < 0
  const message = quoteIsLower
    ? `Quotation value is ${formatCrmCurrency(absDelta)} lower than the opportunity estimate.`
    : `Quotation value is ${formatCrmCurrency(absDelta)} higher than the opportunity estimate.`

  return {
    opportunityValue,
    quotationGrandTotal,
    delta,
    absDelta,
    quoteIsLower,
    message,
  }
}

export function buildMismatchDismissKey(
  opportunityId: string,
  documentKey: string,
  opportunityValue: number,
  quotationGrandTotal: number,
): string {
  return `${opportunityId}:${documentKey}:${Math.round(opportunityValue)}:${Math.round(quotationGrandTotal)}`
}

function readDismissedKeys(): Set<string> {
  try {
    const raw = sessionStorage.getItem(DISMISS_STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

function writeDismissedKeys(keys: Set<string>) {
  try {
    sessionStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify([...keys].slice(-80)))
  } catch {
    /* ignore */
  }
}

export function isOppQuoteMismatchDismissed(dismissKey: string): boolean {
  return readDismissedKeys().has(dismissKey)
}

export function dismissOppQuoteMismatch(dismissKey: string): void {
  const next = readDismissedKeys()
  next.add(dismissKey)
  writeDismissedKeys(next)
}
