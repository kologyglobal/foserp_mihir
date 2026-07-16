import { cn } from '@/utils/cn'
import {
  CLOSE_TASK_STATUS_LABELS,
  type CloseTaskStatus,
  type ModuleLockStatus,
  type ReconciliationStatus,
  type ReopenRequestStatus,
} from '@/types/periodClose'

const TONE: Record<string, string> = {
  'Not Started': 'bg-slate-100 text-slate-800',
  'In Progress': 'bg-sky-100 text-sky-900',
  Waiting: 'bg-amber-100 text-amber-950',
  Blocked: 'bg-rose-100 text-rose-900',
  'Ready for Review': 'bg-indigo-100 text-indigo-900',
  Completed: 'bg-emerald-100 text-emerald-900',
  Reopened: 'bg-orange-100 text-orange-900',
  'Not Applicable': 'bg-slate-100 text-slate-600',
  Open: 'bg-slate-100 text-slate-800',
  Difference: 'bg-rose-100 text-rose-900',
  Reviewed: 'bg-sky-100 text-sky-900',
  Reconciled: 'bg-emerald-100 text-emerald-900',
  'Soft Locked': 'bg-amber-100 text-amber-950',
  'Hard Locked': 'bg-rose-100 text-rose-900',
  'Reopened Temporarily': 'bg-orange-100 text-orange-900',
  Closed: 'bg-slate-200 text-slate-800',
  Draft: 'bg-slate-100 text-slate-800',
  'Pending Approval': 'bg-amber-100 text-amber-950',
  Approved: 'bg-emerald-100 text-emerald-900',
  Rejected: 'bg-rose-100 text-rose-900',
  'Open Temporarily': 'bg-orange-100 text-orange-900',
  Expired: 'bg-slate-200 text-slate-700',
  Upcoming: 'bg-slate-100 text-slate-800',
  'Due Soon': 'bg-amber-100 text-amber-950',
  'Due Today': 'bg-orange-100 text-orange-900',
  Overdue: 'bg-rose-100 text-rose-900',
}

const LOCK_LABELS: Record<ModuleLockStatus, string> = {
  open: 'Open',
  soft_locked: 'Soft Locked',
  hard_locked: 'Hard Locked',
  reopened_temporarily: 'Reopened Temporarily',
  closed: 'Closed',
}

const RECON_LABELS: Record<ReconciliationStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  difference: 'Difference',
  reviewed: 'Reviewed',
  reconciled: 'Reconciled',
}

const REOPEN_LABELS: Record<ReopenRequestStatus, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  open_temporarily: 'Open Temporarily',
  expired: 'Expired',
  closed: 'Closed',
}

export function PeriodCloseStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full truncate rounded px-1.5 py-0.5 text-[10px] font-semibold',
        TONE[status] ?? 'bg-slate-100 text-slate-800',
        className,
      )}
      title={status}
    >
      {status}
    </span>
  )
}

export function taskStatusLabel(s: CloseTaskStatus): string {
  return CLOSE_TASK_STATUS_LABELS[s]
}

export function lockStatusLabel(s: ModuleLockStatus): string {
  return LOCK_LABELS[s]
}

export function reconStatusLabel(s: ReconciliationStatus): string {
  return RECON_LABELS[s]
}

export function reopenStatusLabel(s: ReopenRequestStatus): string {
  return REOPEN_LABELS[s]
}

export function LockStatusBadge({ status }: { status: ModuleLockStatus }) {
  return <PeriodCloseStatusBadge status={lockStatusLabel(status)} />
}

export function ReconStatusBadge({ status }: { status: ReconciliationStatus }) {
  return <PeriodCloseStatusBadge status={reconStatusLabel(status)} />
}

export function TaskStatusBadge({ status }: { status: CloseTaskStatus }) {
  return <PeriodCloseStatusBadge status={taskStatusLabel(status)} />
}

export function ReopenStatusBadge({ status }: { status: ReopenRequestStatus }) {
  return <PeriodCloseStatusBadge status={reopenStatusLabel(status)} />
}
