import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  HelpCircle,
  MinusCircle,
  ShieldAlert,
  XCircle,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import type {
  BankAccountStatus,
  BankDepositStatus,
  BankStatementStatus,
  CashCountStatus,
  CashVarianceStatus,
  ChequeStatus,
  FundTransferStatus,
  MatchConfidence,
  MatchStatus,
  ReconciliationStatus,
} from '@/types/bankCash'

function Badge({
  label,
  className,
  icon: Icon,
}: {
  label: string
  className: string
  icon?: typeof CheckCircle2
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1',
        className,
      )}
      title={label}
    >
      {Icon ? <Icon className="h-3 w-3" aria-hidden /> : null}
      <span>{label}</span>
    </span>
  )
}

const BANK_ACCOUNT_CFG: Record<BankAccountStatus, string> = {
  Active: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  Inactive: 'bg-slate-50 text-slate-600 ring-slate-200',
  Frozen: 'bg-rose-50 text-rose-800 ring-rose-200',
}

const TRANSFER_CFG: Record<FundTransferStatus, string> = {
  Draft: 'bg-slate-50 text-slate-700 ring-slate-200',
  'Pending Approval': 'bg-amber-50 text-amber-800 ring-amber-200',
  Approved: 'bg-sky-50 text-sky-800 ring-sky-200',
  'In Process': 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  Completed: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  Rejected: 'bg-rose-50 text-rose-800 ring-rose-200',
  Reversed: 'bg-orange-50 text-orange-800 ring-orange-200',
  Cancelled: 'bg-slate-50 text-slate-600 ring-slate-200',
}

const STATEMENT_CFG: Record<BankStatementStatus, string> = {
  Draft: 'bg-slate-50 text-slate-700 ring-slate-200',
  Imported: 'bg-sky-50 text-sky-800 ring-sky-200',
  Validated: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  'Partially Reconciled': 'bg-amber-50 text-amber-800 ring-amber-200',
  'Fully Reconciled': 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  'With Errors': 'bg-rose-50 text-rose-800 ring-rose-200',
  Cancelled: 'bg-slate-50 text-slate-600 ring-slate-200',
}

const RECON_CFG: Record<ReconciliationStatus, string> = {
  'Not Started': 'bg-slate-50 text-slate-700 ring-slate-200',
  Draft: 'bg-slate-50 text-slate-700 ring-slate-200',
  'In Progress': 'bg-amber-50 text-amber-800 ring-amber-200',
  Completed: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  Reopened: 'bg-orange-50 text-orange-800 ring-orange-200',
}

const MATCH_CFG: Record<MatchStatus, string> = {
  Unmatched: 'bg-amber-50 text-amber-800 ring-amber-200',
  Suggested: 'bg-sky-50 text-sky-800 ring-sky-200',
  Matched: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  'Partially Matched': 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  Difference: 'bg-rose-50 text-rose-800 ring-rose-200',
  Ignored: 'bg-slate-50 text-slate-600 ring-slate-200',
  'Adjustment Required': 'bg-orange-50 text-orange-800 ring-orange-200',
  Excluded: 'bg-slate-50 text-slate-600 ring-slate-200',
  Duplicate: 'bg-rose-50 text-rose-800 ring-rose-200',
}

const CONFIDENCE_CFG: Record<MatchConfidence, string> = {
  High: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  Medium: 'bg-amber-50 text-amber-800 ring-amber-200',
  Low: 'bg-rose-50 text-rose-800 ring-rose-200',
  Manual: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
}

const CHEQUE_CFG: Record<ChequeStatus, string> = {
  Draft: 'bg-slate-50 text-slate-700 ring-slate-200',
  Issued: 'bg-sky-50 text-sky-800 ring-sky-200',
  Deposited: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  Cleared: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  Bounced: 'bg-rose-50 text-rose-800 ring-rose-200',
  Cancelled: 'bg-slate-50 text-slate-600 ring-slate-200',
  Stopped: 'bg-orange-50 text-orange-800 ring-orange-200',
  PDC: 'bg-amber-50 text-amber-800 ring-amber-200',
}

const DEPOSIT_CFG: Record<BankDepositStatus, string> = {
  Draft: 'bg-slate-50 text-slate-700 ring-slate-200',
  Pending: 'bg-amber-50 text-amber-800 ring-amber-200',
  Deposited: 'bg-sky-50 text-sky-800 ring-sky-200',
  Cleared: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  Rejected: 'bg-rose-50 text-rose-800 ring-rose-200',
}

const CASH_COUNT_CFG: Record<CashCountStatus, string> = {
  Draft: 'bg-slate-50 text-slate-700 ring-slate-200',
  Submitted: 'bg-amber-50 text-amber-800 ring-amber-200',
  Approved: 'bg-sky-50 text-sky-800 ring-sky-200',
  Posted: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  Cancelled: 'bg-slate-50 text-slate-600 ring-slate-200',
}

const VARIANCE_CFG: Record<CashVarianceStatus, string> = {
  Matched: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  Excess: 'bg-sky-50 text-sky-800 ring-sky-200',
  Shortage: 'bg-rose-50 text-rose-800 ring-rose-200',
}

export function BankAccountStatusBadge({ status }: { status: BankAccountStatus }) {
  return <Badge label={status} className={BANK_ACCOUNT_CFG[status]} icon={status === 'Frozen' ? ShieldAlert : undefined} />
}

export function FundTransferStatusBadge({ status }: { status: FundTransferStatus }) {
  return <Badge label={status} className={TRANSFER_CFG[status]} />
}

export function BankStatementStatusBadge({ status }: { status: BankStatementStatus }) {
  return <Badge label={status} className={STATEMENT_CFG[status]} icon={status === 'With Errors' ? AlertTriangle : undefined} />
}

export function ReconciliationStatusBadge({ status }: { status: ReconciliationStatus }) {
  return <Badge label={status} className={RECON_CFG[status]} icon={status === 'Completed' ? CheckCircle2 : undefined} />
}

export function MatchStatusBadge({ status }: { status: MatchStatus }) {
  return <Badge label={status} className={MATCH_CFG[status]} icon={status === 'Duplicate' ? Copy : undefined} />
}

export function MatchConfidenceBadge({ confidence }: { confidence: MatchConfidence }) {
  return <Badge label={confidence} className={CONFIDENCE_CFG[confidence]} />
}

export function ChequeStatusBadge({ status }: { status: ChequeStatus }) {
  return (
    <Badge
      label={status}
      className={CHEQUE_CFG[status]}
      icon={status === 'Bounced' ? XCircle : status === 'PDC' ? Clock : undefined}
    />
  )
}

export function BankDepositStatusBadge({ status }: { status: BankDepositStatus }) {
  return <Badge label={status} className={DEPOSIT_CFG[status]} />
}

export function CashCountStatusBadge({ status }: { status: CashCountStatus }) {
  return <Badge label={status} className={CASH_COUNT_CFG[status]} />
}

export function CashVarianceStatusBadge({ status }: { status: CashVarianceStatus }) {
  return (
    <Badge
      label={status}
      className={VARIANCE_CFG[status]}
      icon={status === 'Matched' ? CheckCircle2 : status === 'Shortage' ? MinusCircle : undefined}
    />
  )
}

export function BankCashStatusBadge({
  kind,
  value,
}: {
  kind:
    | 'bankAccount'
    | 'transfer'
    | 'statement'
    | 'reconciliation'
    | 'match'
    | 'confidence'
    | 'cheque'
    | 'deposit'
    | 'cashCount'
    | 'variance'
  value: string
}) {
  switch (kind) {
    case 'bankAccount':
      return <BankAccountStatusBadge status={value as BankAccountStatus} />
    case 'transfer':
      return <FundTransferStatusBadge status={value as FundTransferStatus} />
    case 'statement':
      return <BankStatementStatusBadge status={value as BankStatementStatus} />
    case 'reconciliation':
      return <ReconciliationStatusBadge status={value as ReconciliationStatus} />
    case 'match':
      return <MatchStatusBadge status={value as MatchStatus} />
    case 'confidence':
      return <MatchConfidenceBadge confidence={value as MatchConfidence} />
    case 'cheque':
      return <ChequeStatusBadge status={value as ChequeStatus} />
    case 'deposit':
      return <BankDepositStatusBadge status={value as BankDepositStatus} />
    case 'cashCount':
      return <CashCountStatusBadge status={value as CashCountStatus} />
    case 'variance':
      return <CashVarianceStatusBadge status={value as CashVarianceStatus} />
    default:
      return <Badge label={value} className="bg-slate-50 text-slate-700 ring-slate-200" icon={HelpCircle} />
  }
}
