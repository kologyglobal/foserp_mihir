import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  FileWarning,
  HandCoins,
  Landmark,
  PauseCircle,
  ShieldAlert,
  XCircle,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import type {
  PayableDebitNoteStatus,
  PayableInvoiceStatus,
  PaymentAllocationStatus,
  PaymentProposalStatus,
  VendorAdvanceStatus,
  VendorDisputeStatus,
  VendorPaymentStatus,
} from '@/types/payables'

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

export type PayableMatchStatus =
  | 'Matched'
  | 'Partial Match'
  | 'Unmatched'
  | 'Within Tolerance'
  | 'Exception'

export type PaymentHoldStatus = 'Active' | 'Released' | 'Pending Review'

/** Aligns with `@/types/payables` VendorBankVerificationStatus */
export type BankVerificationStatus =
  | 'Verified'
  | 'Pending Verification'
  | 'Changed Recently'
  | 'Rejected'
  | 'Not Available'
  /** @deprecated prefer Pending Verification */
  | 'Pending'
  /** @deprecated prefer Rejected */
  | 'Failed'

const INV_CFG: Record<PayableInvoiceStatus, { className: string; icon?: typeof CheckCircle2 }> = {
  Open: { className: 'bg-sky-50 text-sky-800 ring-sky-200' },
  'Partially Paid': { className: 'bg-indigo-50 text-indigo-800 ring-indigo-200' },
  Paid: { className: 'bg-emerald-50 text-emerald-800 ring-emerald-200', icon: CheckCircle2 },
  Overdue: { className: 'bg-rose-50 text-rose-800 ring-rose-200', icon: Clock },
  Disputed: { className: 'bg-orange-50 text-orange-800 ring-orange-200', icon: FileWarning },
  Cancelled: { className: 'bg-slate-50 text-slate-600 ring-slate-200', icon: XCircle },
}

const MATCH_CFG: Record<PayableMatchStatus, { className: string; icon: typeof CheckCircle2 }> = {
  Matched: { className: 'bg-emerald-50 text-emerald-800 ring-emerald-200', icon: CheckCircle2 },
  'Partial Match': { className: 'bg-amber-50 text-amber-800 ring-amber-200', icon: AlertTriangle },
  Unmatched: { className: 'bg-rose-50 text-rose-800 ring-rose-200', icon: XCircle },
  'Within Tolerance': { className: 'bg-sky-50 text-sky-800 ring-sky-200', icon: CheckCircle2 },
  Exception: { className: 'bg-orange-50 text-orange-800 ring-orange-200', icon: ShieldAlert },
}

const PAY_CFG: Record<VendorPaymentStatus, string> = {
  Draft: 'bg-slate-50 text-slate-700 ring-slate-200',
  Submitted: 'bg-amber-50 text-amber-800 ring-amber-200',
  Approved: 'bg-sky-50 text-sky-800 ring-sky-200',
  Posted: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  Reversed: 'bg-rose-50 text-rose-800 ring-rose-200',
  Cancelled: 'bg-slate-50 text-slate-600 ring-slate-200',
}

const PROP_CFG: Record<PaymentProposalStatus, string> = {
  Draft: 'bg-slate-50 text-slate-700 ring-slate-200',
  Submitted: 'bg-amber-50 text-amber-800 ring-amber-200',
  'Pending Approval': 'bg-amber-50 text-amber-800 ring-amber-200',
  Approved: 'bg-sky-50 text-sky-800 ring-sky-200',
  'Partially Processed': 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  Processed: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  Rejected: 'bg-rose-50 text-rose-800 ring-rose-200',
  Converted: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  Cancelled: 'bg-slate-50 text-slate-600 ring-slate-200',
}

const ALLOC_CFG: Record<PaymentAllocationStatus, string> = {
  Unallocated: 'bg-amber-50 text-amber-800 ring-amber-200',
  'Partially Allocated': 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  'Fully Allocated': 'bg-emerald-50 text-emerald-800 ring-emerald-200',
}

const HOLD_CFG: Record<PaymentHoldStatus, { className: string; icon: typeof CheckCircle2 }> = {
  Active: { className: 'bg-rose-50 text-rose-900 ring-rose-300', icon: Ban },
  Released: { className: 'bg-emerald-50 text-emerald-800 ring-emerald-200', icon: CheckCircle2 },
  'Pending Review': { className: 'bg-amber-50 text-amber-800 ring-amber-200', icon: PauseCircle },
}

const BANK_CFG: Record<BankVerificationStatus, { className: string; icon: typeof CheckCircle2 }> = {
  Verified: { className: 'bg-emerald-50 text-emerald-800 ring-emerald-200', icon: CheckCircle2 },
  'Pending Verification': { className: 'bg-amber-50 text-amber-800 ring-amber-200', icon: Clock },
  Pending: { className: 'bg-amber-50 text-amber-800 ring-amber-200', icon: Clock },
  Rejected: { className: 'bg-rose-50 text-rose-800 ring-rose-200', icon: XCircle },
  Failed: { className: 'bg-rose-50 text-rose-800 ring-rose-200', icon: XCircle },
  'Changed Recently': { className: 'bg-orange-50 text-orange-800 ring-orange-200', icon: AlertTriangle },
  'Not Available': { className: 'bg-slate-50 text-slate-600 ring-slate-200', icon: Landmark },
}

export function PayableInvoiceStatusBadge({ status }: { status: PayableInvoiceStatus }) {
  const cfg = INV_CFG[status]
  return <Badge label={status} className={cfg.className} icon={cfg.icon} />
}

export function PayableMatchStatusBadge({ status }: { status: PayableMatchStatus }) {
  const cfg = MATCH_CFG[status]
  return <Badge label={status} className={cfg.className} icon={cfg.icon} />
}

export function VendorPaymentStatusBadge({ status }: { status: VendorPaymentStatus }) {
  return <Badge label={status} className={PAY_CFG[status]} />
}

export function PaymentProposalStatusBadge({ status }: { status: PaymentProposalStatus }) {
  return <Badge label={status} className={PROP_CFG[status]} />
}

export function PaymentAllocationStatusBadge({ status }: { status: PaymentAllocationStatus }) {
  return <Badge label={status} className={ALLOC_CFG[status]} />
}

export function PaymentHoldStatusBadge({ status }: { status: PaymentHoldStatus }) {
  const cfg = HOLD_CFG[status]
  return <Badge label={status} className={cfg.className} icon={cfg.icon} />
}

export function BankVerificationStatusBadge({ status }: { status: BankVerificationStatus }) {
  const cfg = BANK_CFG[status]
  return <Badge label={status} className={cfg.className} icon={cfg.icon ?? Landmark} />
}

export function VendorDisputeStatusBadge({ status }: { status: VendorDisputeStatus }) {
  const map: Record<VendorDisputeStatus, string> = {
    Open: 'bg-rose-50 text-rose-800 ring-rose-200',
    'Under Review': 'bg-amber-50 text-amber-800 ring-amber-200',
    'Awaiting Vendor': 'bg-sky-50 text-sky-800 ring-sky-200',
    'Awaiting Internal Team': 'bg-indigo-50 text-indigo-800 ring-indigo-200',
    Resolved: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    Rejected: 'bg-slate-50 text-slate-600 ring-slate-200',
    Closed: 'bg-slate-50 text-slate-700 ring-slate-200',
  }
  return <Badge label={status} className={map[status]} icon={FileWarning} />
}

export function VendorAdvanceStatusBadge({ status }: { status: VendorAdvanceStatus }) {
  const map: Record<VendorAdvanceStatus, string> = {
    Open: 'bg-sky-50 text-sky-800 ring-sky-200',
    'Partially Adjusted': 'bg-indigo-50 text-indigo-800 ring-indigo-200',
    'Fully Adjusted': 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    Cancelled: 'bg-slate-50 text-slate-600 ring-slate-200',
  }
  return <Badge label={status} className={map[status]} icon={HandCoins} />
}

export function PayableDebitNoteStatusBadge({ status }: { status: PayableDebitNoteStatus }) {
  const map: Record<PayableDebitNoteStatus, string> = {
    Draft: 'bg-slate-50 text-slate-700 ring-slate-200',
    'Pending Approval': 'bg-amber-50 text-amber-800 ring-amber-200',
    Posted: 'bg-sky-50 text-sky-800 ring-sky-200',
    Applied: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    'Partially Applied': 'bg-indigo-50 text-indigo-800 ring-indigo-200',
    Unapplied: 'bg-amber-50 text-amber-800 ring-amber-200',
    Cancelled: 'bg-slate-50 text-slate-600 ring-slate-200',
  }
  return <Badge label={status} className={map[status]} />
}

export function PayableStatusBadge({
  kind,
  value,
}: {
  kind:
    | 'invoice'
    | 'match'
    | 'payment'
    | 'proposal'
    | 'allocation'
    | 'hold'
    | 'bank'
    | 'dispute'
    | 'advance'
    | 'debit_note'
  value: string
}) {
  if (kind === 'invoice') return <PayableInvoiceStatusBadge status={value as PayableInvoiceStatus} />
  if (kind === 'match') return <PayableMatchStatusBadge status={value as PayableMatchStatus} />
  if (kind === 'payment') return <VendorPaymentStatusBadge status={value as VendorPaymentStatus} />
  if (kind === 'proposal') return <PaymentProposalStatusBadge status={value as PaymentProposalStatus} />
  if (kind === 'allocation') return <PaymentAllocationStatusBadge status={value as PaymentAllocationStatus} />
  if (kind === 'hold') return <PaymentHoldStatusBadge status={value as PaymentHoldStatus} />
  if (kind === 'bank') return <BankVerificationStatusBadge status={value as BankVerificationStatus} />
  if (kind === 'dispute') return <VendorDisputeStatusBadge status={value as VendorDisputeStatus} />
  if (kind === 'advance') return <VendorAdvanceStatusBadge status={value as VendorAdvanceStatus} />
  return <PayableDebitNoteStatusBadge status={value as PayableDebitNoteStatus} />
}
