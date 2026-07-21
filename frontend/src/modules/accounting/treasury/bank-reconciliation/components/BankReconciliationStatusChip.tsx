import { ErpStatusChip } from '@/components/erp/ErpStatusChip'
import type {
  BankReconciliationExceptionStatus,
  BankReconciliationMatchStatus,
  BankReconciliationSessionStatus,
  BankReconciliationSuggestionStatus,
  BankStatementLineDirection,
  BankStatementLineMatchStatus,
} from '../api/bank-reconciliation.types'
import {
  CONFIDENCE_LABELS,
  DIRECTION_LABELS,
  EXCEPTION_STATUS_LABELS,
  LINE_MATCH_STATUS_LABELS,
  MATCH_STATUS_LABELS,
  SESSION_STATUS_LABELS,
  SUGGESTION_STATUS_LABELS,
  confidenceTone,
  exceptionStatusTone,
  lineMatchStatusTone,
  matchStatusTone,
  sessionStatusTone,
  suggestionStatusTone,
} from '../utils/bankReconciliationUi'

export function SessionStatusChip({ status }: { status: BankReconciliationSessionStatus }) {
  return <ErpStatusChip tone={sessionStatusTone(status)} label={SESSION_STATUS_LABELS[status] ?? status} />
}

export function LineMatchStatusChip({ status }: { status: BankStatementLineMatchStatus }) {
  return <ErpStatusChip tone={lineMatchStatusTone(status)} label={LINE_MATCH_STATUS_LABELS[status] ?? status} />
}

export function MatchStatusChip({ status }: { status: BankReconciliationMatchStatus }) {
  return <ErpStatusChip tone={matchStatusTone(status)} label={MATCH_STATUS_LABELS[status] ?? status} />
}

export function SuggestionStatusChip({ status }: { status: BankReconciliationSuggestionStatus }) {
  return <ErpStatusChip tone={suggestionStatusTone(status)} label={SUGGESTION_STATUS_LABELS[status] ?? status} />
}

export function ExceptionStatusChip({ status }: { status: BankReconciliationExceptionStatus }) {
  return <ErpStatusChip tone={exceptionStatusTone(status)} label={EXCEPTION_STATUS_LABELS[status] ?? status} />
}

export function ConfidenceChip({ level }: { level: string }) {
  return <ErpStatusChip tone={confidenceTone(level)} label={CONFIDENCE_LABELS[level as keyof typeof CONFIDENCE_LABELS] ?? level} />
}

/** Accessible text label for statement line direction (screen readers + colour-blind users). */
export function DirectionLabel({ direction }: { direction: BankStatementLineDirection }) {
  return (
    <span
      className={
        direction === 'CREDIT' ? 'font-medium text-emerald-700' : 'font-medium text-rose-700'
      }
    >
      {DIRECTION_LABELS[direction]}
    </span>
  )
}
