import type { ErpStatusChipTone } from '@/components/erp/ErpStatusChip'
import type { BankStatementStatus } from '../../bank-statements/api/bank-statement.types'
import type {
  BankReconciliationExceptionReason,
  BankReconciliationExceptionStatus,
  BankReconciliationMatchStatus,
  BankReconciliationSessionStatus,
  BankReconciliationSuggestionStatus,
  BankStatementLineMatchStatus,
  ConfidenceLevel,
} from '../api/bank-reconciliation.types'

export const SESSION_STATUS_LABELS: Record<BankReconciliationSessionStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  READY_TO_FINALIZE: 'Ready to Finalize',
  FINALIZED: 'Finalized',
  REOPENED: 'Reopened',
  CANCELLED: 'Cancelled',
}

export const LINE_MATCH_STATUS_LABELS: Record<BankStatementLineMatchStatus, string> = {
  UNMATCHED: 'Unmatched',
  PARTIALLY_MATCHED: 'Partially Matched',
  MATCHED: 'Matched',
  EXCEPTION: 'Exception',
  EXCLUDED: 'Excluded',
  RECONCILED: 'Reconciled',
  REVERSED: 'Reversed',
}

export const MATCH_STATUS_LABELS: Record<BankReconciliationMatchStatus, string> = {
  ACTIVE: 'Active',
  REVERSED: 'Reversed',
}

export const SUGGESTION_STATUS_LABELS: Record<BankReconciliationSuggestionStatus, string> = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
  INVALIDATED: 'Invalidated',
}

export const EXCEPTION_STATUS_LABELS: Record<BankReconciliationExceptionStatus, string> = {
  OPEN: 'Open',
  RESOLVED: 'Resolved',
}

export const EXCEPTION_REASON_LABELS: Record<BankReconciliationExceptionReason, string> = {
  UNKNOWN_TRANSACTION: 'Unknown transaction',
  REFERENCE_MISSING: 'Reference missing',
  AMOUNT_MISMATCH: 'Amount mismatch',
  DATE_MISMATCH: 'Date mismatch',
  POSSIBLE_DUPLICATE: 'Possible duplicate',
  BANK_CHARGE_REQUIRES_JOURNAL: 'Bank charge — requires journal',
  INTEREST_REQUIRES_JOURNAL: 'Interest — requires journal',
  CURRENCY_MISMATCH: 'Currency mismatch',
  SOURCE_DOCUMENT_NOT_POSTED: 'Source document not posted',
  OTHER: 'Other',
}

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  HIGH: 'High confidence',
  MEDIUM: 'Medium confidence',
  LOW: 'Low confidence',
}

export const DIRECTION_LABELS = {
  CREDIT: 'Credit (money in)',
  DEBIT: 'Debit (money out)',
} as const

export function sessionStatusTone(status: BankReconciliationSessionStatus): ErpStatusChipTone {
  switch (status) {
    case 'FINALIZED':
      return 'success'
    case 'READY_TO_FINALIZE':
      return 'warning'
    case 'IN_PROGRESS':
    case 'OPEN':
      return 'info'
    case 'REOPENED':
      return 'warning'
    case 'CANCELLED':
      return 'neutral'
    default:
      return 'neutral'
  }
}

export function lineMatchStatusTone(status: BankStatementLineMatchStatus): ErpStatusChipTone {
  switch (status) {
    case 'MATCHED':
    case 'RECONCILED':
      return 'success'
    case 'PARTIALLY_MATCHED':
      return 'warning'
    case 'EXCEPTION':
      return 'critical'
    case 'EXCLUDED':
    case 'REVERSED':
      return 'neutral'
    case 'UNMATCHED':
      return 'neutral'
    default:
      return 'neutral'
  }
}

export function matchStatusTone(status: BankReconciliationMatchStatus): ErpStatusChipTone {
  return status === 'ACTIVE' ? 'success' : 'neutral'
}

export function suggestionStatusTone(status: BankReconciliationSuggestionStatus): ErpStatusChipTone {
  switch (status) {
    case 'ACCEPTED':
      return 'success'
    case 'PENDING':
      return 'info'
    case 'REJECTED':
      return 'neutral'
    case 'EXPIRED':
    case 'INVALIDATED':
      return 'warning'
    default:
      return 'neutral'
  }
}

export function exceptionStatusTone(status: BankReconciliationExceptionStatus): ErpStatusChipTone {
  return status === 'OPEN' ? 'critical' : 'success'
}

export function confidenceTone(level: string): ErpStatusChipTone {
  switch (level) {
    case 'HIGH':
      return 'success'
    case 'MEDIUM':
      return 'warning'
    case 'LOW':
      return 'neutral'
    default:
      return 'neutral'
  }
}

export function parseDecimal(value: string | number | null | undefined): number {
  if (value == null || value === '') return 0
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

/** Statuses under which the statement's reconciliation workspace can be opened (mirrors backend RECONCILABLE_STATEMENT_STATUSES). */
export const RECONCILABLE_STATEMENT_STATUSES: BankStatementStatus[] = ['VALIDATED', 'READY_TO_RECONCILE', 'PARTIALLY_RECONCILED']

export const WORKSPACE_TABS = [
  { id: 'unmatched', label: 'Unmatched' },
  { id: 'suggestions', label: 'Suggestions' },
  { id: 'partial', label: 'Partially Matched' },
  { id: 'matched', label: 'Matched' },
  { id: 'exceptions', label: 'Exceptions' },
  { id: 'all', label: 'All' },
] as const

export type WorkspaceTabId = (typeof WORKSPACE_TABS)[number]['id']

/** Live reconciliation sub-routes under Bank & Cash (API mode). */
export const RECONCILIATION_LIVE_LINKS = [
  { label: 'Reconciliation', path: '/accounting/bank-cash/reconciliation' },
  { label: 'History', path: '/accounting/bank-cash/reconciliation/history' },
  { label: 'Exceptions', path: '/accounting/bank-cash/reconciliation/exceptions' },
] as const
