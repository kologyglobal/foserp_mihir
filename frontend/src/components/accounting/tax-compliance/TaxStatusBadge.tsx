import { cn } from '@/utils/cn'

const TONE: Record<string, string> = {
  Open: 'bg-slate-100 text-slate-800',
  'In Progress': 'bg-sky-100 text-sky-900',
  'Ready for Review': 'bg-indigo-100 text-indigo-900',
  'Marked Filed Externally': 'bg-emerald-100 text-emerald-900',
  Exception: 'bg-rose-100 text-rose-900',
  Overdue: 'bg-amber-100 text-amber-950',
  Matched: 'bg-emerald-100 text-emerald-900',
  Mismatch: 'bg-rose-100 text-rose-900',
  'Pending Review': 'bg-amber-100 text-amber-950',
  Accepted: 'bg-emerald-100 text-emerald-900',
  Rejected: 'bg-slate-200 text-slate-800',
  'Books Only': 'bg-orange-100 text-orange-900',
  '2B Only': 'bg-violet-100 text-violet-900',
  Pending: 'bg-amber-100 text-amber-950',
  Deducted: 'bg-sky-100 text-sky-900',
  Deposited: 'bg-emerald-100 text-emerald-900',
  Critical: 'bg-rose-100 text-rose-900',
  High: 'bg-orange-100 text-orange-900',
  Medium: 'bg-amber-100 text-amber-950',
  Low: 'bg-slate-100 text-slate-700',
}

export function TaxStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full truncate rounded px-1.5 py-0.5 text-[10px] font-semibold',
        TONE[status] ?? 'bg-slate-100 text-slate-800',
        className,
      )}
    >
      {status}
    </span>
  )
}
