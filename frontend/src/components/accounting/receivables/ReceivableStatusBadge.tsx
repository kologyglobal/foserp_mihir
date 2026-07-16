import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  FileWarning,
  HandCoins,
  PauseCircle,
  ShieldAlert,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import type {
  AllocationStatus,
  CollectionStatus,
  CustomerCreditStatus,
  DisputeStatus,
  PaymentPromiseStatus,
  ReceiptVoucherStatus,
  ReceivableInvoiceStatus,
} from '@/types/receivables'

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

const CREDIT_CFG: Record<CustomerCreditStatus, { className: string; icon: typeof CheckCircle2 }> = {
  'Within Limit': { className: 'bg-emerald-50 text-emerald-800 ring-emerald-200', icon: CheckCircle2 },
  'Near Limit': { className: 'bg-amber-50 text-amber-800 ring-amber-200', icon: AlertTriangle },
  'Over Limit': { className: 'bg-rose-50 text-rose-800 ring-rose-200', icon: ShieldAlert },
  'Credit Hold': { className: 'bg-rose-50 text-rose-900 ring-rose-300', icon: Ban },
  'Temporarily Released': { className: 'bg-sky-50 text-sky-800 ring-sky-200', icon: PauseCircle },
  'No Credit Limit': { className: 'bg-slate-50 text-slate-700 ring-slate-200', icon: HandCoins },
}

const INV_CFG: Record<ReceivableInvoiceStatus, string> = {
  Open: 'bg-sky-50 text-sky-800 ring-sky-200',
  'Partially Paid': 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  'Due Soon': 'bg-amber-50 text-amber-800 ring-amber-200',
  Overdue: 'bg-rose-50 text-rose-800 ring-rose-200',
  Disputed: 'bg-orange-50 text-orange-800 ring-orange-200',
  Paid: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  Cancelled: 'bg-slate-50 text-slate-600 ring-slate-200',
}

const COLL_CFG: Record<CollectionStatus, string> = {
  'Not Contacted': 'bg-slate-50 text-slate-700 ring-slate-200',
  'Follow-up Required': 'bg-amber-50 text-amber-800 ring-amber-200',
  Contacted: 'bg-sky-50 text-sky-800 ring-sky-200',
  'Promise Received': 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  'Partial Payment Expected': 'bg-violet-50 text-violet-800 ring-violet-200',
  Disputed: 'bg-orange-50 text-orange-800 ring-orange-200',
  Escalated: 'bg-rose-50 text-rose-800 ring-rose-200',
  'Credit Hold': 'bg-rose-50 text-rose-900 ring-rose-300',
  Closed: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
}

const RCPT_CFG: Record<ReceiptVoucherStatus, string> = {
  Draft: 'bg-slate-50 text-slate-700 ring-slate-200',
  'Pending Approval': 'bg-amber-50 text-amber-800 ring-amber-200',
  Approved: 'bg-sky-50 text-sky-800 ring-sky-200',
  Posted: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  Reversed: 'bg-rose-50 text-rose-800 ring-rose-200',
  Cancelled: 'bg-slate-50 text-slate-600 ring-slate-200',
}

const ALLOC_CFG: Record<AllocationStatus, string> = {
  Unallocated: 'bg-amber-50 text-amber-800 ring-amber-200',
  'Partially Allocated': 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  'Fully Allocated': 'bg-emerald-50 text-emerald-800 ring-emerald-200',
}

export function CreditStatusBadge({ status }: { status: CustomerCreditStatus }) {
  const cfg = CREDIT_CFG[status]
  return <Badge label={status} className={cfg.className} icon={cfg.icon} />
}

export function InvoiceStatusBadge({ status }: { status: ReceivableInvoiceStatus }) {
  return <Badge label={status} className={INV_CFG[status]} icon={status === 'Overdue' ? Clock : undefined} />
}

export function CollectionStatusBadge({ status }: { status: CollectionStatus }) {
  return <Badge label={status} className={COLL_CFG[status]} />
}

export function ReceiptStatusBadge({ status }: { status: ReceiptVoucherStatus }) {
  return <Badge label={status} className={RCPT_CFG[status]} />
}

export function AllocationStatusBadge({ status }: { status: AllocationStatus }) {
  return <Badge label={status} className={ALLOC_CFG[status]} />
}

export function DisputeStatusBadge({ status }: { status: DisputeStatus }) {
  const map: Record<DisputeStatus, string> = {
    Open: 'bg-rose-50 text-rose-800 ring-rose-200',
    'Under Review': 'bg-amber-50 text-amber-800 ring-amber-200',
    'Awaiting Customer': 'bg-sky-50 text-sky-800 ring-sky-200',
    'Awaiting Internal Team': 'bg-indigo-50 text-indigo-800 ring-indigo-200',
    Resolved: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    Rejected: 'bg-slate-50 text-slate-600 ring-slate-200',
    Closed: 'bg-slate-50 text-slate-700 ring-slate-200',
  }
  return <Badge label={status} className={map[status]} icon={FileWarning} />
}

export function PromiseStatusBadge({ status }: { status: PaymentPromiseStatus }) {
  const map: Record<PaymentPromiseStatus, string> = {
    Active: 'bg-sky-50 text-sky-800 ring-sky-200',
    'Partially Fulfilled': 'bg-indigo-50 text-indigo-800 ring-indigo-200',
    Fulfilled: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    Broken: 'bg-rose-50 text-rose-800 ring-rose-200',
    Cancelled: 'bg-slate-50 text-slate-600 ring-slate-200',
  }
  return <Badge label={status} className={map[status]} />
}

export function ReceivableStatusBadge({
  kind,
  value,
}: {
  kind: 'credit' | 'invoice' | 'collection' | 'receipt' | 'allocation' | 'dispute' | 'promise'
  value: string
}) {
  if (kind === 'credit') return <CreditStatusBadge status={value as CustomerCreditStatus} />
  if (kind === 'invoice') return <InvoiceStatusBadge status={value as ReceivableInvoiceStatus} />
  if (kind === 'collection') return <CollectionStatusBadge status={value as CollectionStatus} />
  if (kind === 'receipt') return <ReceiptStatusBadge status={value as ReceiptVoucherStatus} />
  if (kind === 'allocation') return <AllocationStatusBadge status={value as AllocationStatus} />
  if (kind === 'dispute') return <DisputeStatusBadge status={value as DisputeStatus} />
  return <PromiseStatusBadge status={value as PaymentPromiseStatus} />
}
