import type { ReactNode } from 'react'
import { Sparkles, Info } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { WorkOrderListStatus, WorkOrderStatus } from '@/types/manufacturingWorkOrder'
import { WO_LIST_STATUS_LABELS, WO_STATUS_LABELS } from '@/types/manufacturingWorkOrder'
import { ManufacturingRoleBar } from './ManufacturingRoleBar'
import { ManufacturingCommandMap, ManufacturingScreenRoleLine } from './ManufacturingCommandCenter'

export function ManufacturingDemoBanner({
  message = 'Manufacturing is demo data only — no production or inventory backend is connected.',
  showRoleBar = true,
  showCommandMap = false,
}: {
  message?: string
  showRoleBar?: boolean
  /** Full command map (use on dashboard / hub). Other pages show a one-line screen role. */
  showCommandMap?: boolean
}) {
  return (
    <div className="mb-3 space-y-2">
      <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>{message}</span>
      </div>
      {showCommandMap ? (
        <ManufacturingCommandMap />
      ) : (
        <div className="rounded-lg border border-erp-border bg-white px-3 py-2">
          <ManufacturingScreenRoleLine />
        </div>
      )}
      {showRoleBar ? <ManufacturingRoleBar /> : null}
    </div>
  )
}

/** Right-side insight box — short guides, not a chatbot. */
export function ManufacturingAiAssist({
  title = 'AI Insights',
  subtitle = 'Guides for this screen — not a chatbot.',
  suggestions,
  className,
}: {
  title?: string
  subtitle?: string
  suggestions: string[]
  className?: string
}) {
  const items = suggestions.length
    ? suggestions
    : ['No special alerts right now. Continue with the next status action.']

  return (
    <aside
      className={cn(
        'h-fit rounded-xl border border-sky-200 bg-gradient-to-b from-sky-50 via-white to-white p-4 shadow-sm',
        'lg:sticky lg:top-4',
        className,
      )}
      aria-label={title}
    >
      <div className="mb-1 flex items-center gap-2 text-[13px] font-semibold text-sky-950">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
          <Sparkles className="h-4 w-4" aria-hidden />
        </span>
        {title}
      </div>
      {subtitle ? <p className="mb-3 text-[11px] text-sky-800/70">{subtitle}</p> : null}
      <ul className="space-y-2.5">
        {items.map((s) => (
          <li
            key={s}
            className="rounded-lg border border-sky-100 bg-white/80 px-2.5 py-2 text-[12px] leading-snug text-sky-950/90"
          >
            {s}
          </li>
        ))}
      </ul>
    </aside>
  )
}

/** Main content + sticky right-side AI rail. */
export function ManufacturingAiRail({
  children,
  suggestions,
  title = 'AI Insights',
  subtitle,
  className,
}: {
  children: ReactNode
  suggestions: string[]
  title?: string
  subtitle?: string
  className?: string
}) {
  return (
    <div className={cn('grid gap-4 lg:grid-cols-[minmax(0,1fr)_272px] lg:items-start', className)}>
      <div className="min-w-0 space-y-3">{children}</div>
      <ManufacturingAiAssist title={title} subtitle={subtitle} suggestions={suggestions} />
    </div>
  )
}

const WO_STEPS_SIMPLE = ['draft', 'ready', 'in_progress', 'completed', 'closed'] as const
const WO_STEPS_QC = ['draft', 'ready', 'in_progress', 'completed', 'qc_pending', 'closed'] as const

export function WorkOrderExecutionStepper({
  listStatus,
  qualityRequired,
  className,
}: {
  listStatus: WorkOrderListStatus
  qualityRequired?: boolean
  className?: string
  status?: WorkOrderStatus
  qualityHold?: boolean
}) {
  if (listStatus === 'cancelled') {
    return (
      <p className={cn('rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-800', className)}>
        Cancelled — execution stopped
      </p>
    )
  }

  const steps = qualityRequired ? WO_STEPS_QC : WO_STEPS_SIMPLE
  const normalized: WorkOrderListStatus =
    listStatus === 'on_hold' || listStatus === 'qc_hold'
      ? 'in_progress'
      : listStatus === 'qc_pending'
        ? 'qc_pending'
        : listStatus

  const activeIndex = Math.max(0, (steps as readonly string[]).indexOf(normalized))

  return (
    <ol
      className={cn('flex flex-wrap items-center gap-1 rounded-xl border border-erp-border bg-white p-2 sm:gap-2', className)}
      aria-label="Work order execution steps"
    >
      {steps.map((step, i) => {
        const done = activeIndex > i || (listStatus === 'closed' && i < steps.length - 1)
        const current =
          activeIndex === i
          || (listStatus === 'on_hold' && step === 'in_progress')
          || (listStatus === 'qc_hold' && step === 'qc_pending')
        const label =
          step === 'ready'
            ? 'Ready'
            : step === 'qc_pending'
              ? 'QC Pending'
              : WO_LIST_STATUS_LABELS[step as WorkOrderListStatus] ?? WO_STATUS_LABELS[step as WorkOrderStatus]
        return (
          <li key={step} className="flex items-center gap-1 sm:gap-2">
            {i > 0 ? <span className="hidden h-px w-3 bg-erp-border sm:block" aria-hidden /> : null}
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1',
                done && !current && 'bg-emerald-50 text-emerald-800 ring-emerald-200',
                current && 'bg-erp-primary/10 text-erp-primary ring-erp-primary/30',
                !done && !current && 'bg-slate-50 text-slate-500 ring-slate-200',
              )}
            >
              {i + 1}. {label}
              {current && listStatus === 'on_hold' ? ' (Hold)' : ''}
              {current && listStatus === 'qc_hold' ? ' (QC Hold)' : ''}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export function ManufacturingQuickActionCard({
  title,
  description,
  icon,
  onClick,
  accent = 'slate',
}: {
  title: string
  description: string
  icon: ReactNode
  onClick: () => void
  accent?: 'blue' | 'green' | 'amber' | 'slate'
}) {
  const accents = {
    blue: 'border-sky-200 hover:border-sky-300 hover:bg-sky-50/60',
    green: 'border-emerald-200 hover:border-emerald-300 hover:bg-emerald-50/60',
    amber: 'border-amber-200 hover:border-amber-300 hover:bg-amber-50/60',
    slate: 'border-erp-border hover:border-erp-primary/40 hover:bg-erp-surface-hover/40',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-[88px] w-full flex-col items-start gap-1 rounded-xl border bg-white p-4 text-left shadow-sm transition',
        accents[accent],
      )}
    >
      <span className="text-erp-primary">{icon}</span>
      <span className="text-[14px] font-semibold text-erp-text">{title}</span>
      <span className="text-[12px] text-erp-muted">{description}</span>
    </button>
  )
}

export function ShopfloorStatusChip({
  status,
}: {
  status: WorkOrderStatus | WorkOrderListStatus | 'quality_hold' | 'due_today' | 'shortage'
}) {
  const map: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700 ring-slate-200',
    ready: 'bg-teal-100 text-teal-800 ring-teal-200',
    in_progress: 'bg-sky-100 text-sky-800 ring-sky-200',
    on_hold: 'bg-amber-100 text-amber-900 ring-amber-200',
    completed: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
    qc_pending: 'bg-violet-100 text-violet-800 ring-violet-200',
    qc_hold: 'bg-fuchsia-100 text-fuchsia-900 ring-fuchsia-200',
    closed: 'bg-slate-100 text-slate-600 ring-slate-200',
    cancelled: 'bg-rose-100 text-rose-800 ring-rose-200',
    quality_hold: 'bg-violet-100 text-violet-800 ring-violet-200',
    due_today: 'bg-orange-100 text-orange-900 ring-orange-200',
    shortage: 'bg-rose-100 text-rose-800 ring-rose-200',
  }
  const label =
    status === 'quality_hold'
      ? 'QC Hold'
      : status === 'due_today'
        ? 'Due Today'
        : status === 'shortage'
          ? 'Material Shortage'
          : status in WO_LIST_STATUS_LABELS
            ? WO_LIST_STATUS_LABELS[status as WorkOrderListStatus]
            : WO_STATUS_LABELS[status as WorkOrderStatus]
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1', map[status] ?? map.draft)}>
      {label}
    </span>
  )
}
