import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

interface WorkspaceSectionProps {
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  noPadding?: boolean
}

export function WorkspaceSection({
  title,
  subtitle,
  action,
  children,
  className,
  noPadding,
}: WorkspaceSectionProps) {
  return (
    <section className={cn('erp-bc-section', className)}>
      <div className="erp-bc-section-header flex items-start justify-between gap-3">
        <div>
          <h2 className="erp-section-title">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[12px] text-erp-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className={cn(!noPadding && 'p-4')}>{children}</div>
    </section>
  )
}

export function WorkspaceGrid({ children, cols = 4 }: { children: ReactNode; cols?: 2 | 3 | 4 | 5 }) {
  const colClass =
    cols === 2 ? 'sm:grid-cols-2' :
    cols === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' :
    cols === 5 ? 'sm:grid-cols-2 lg:grid-cols-5' :
    'sm:grid-cols-2 lg:grid-cols-4'
  return <div className={cn('grid gap-4', colClass)}>{children}</div>
}

export function AttentionList({
  items,
  empty = 'Nothing needs attention',
}: {
  items: { id: string; label: string; meta: string; severity: 'green' | 'amber' | 'red'; href?: string }[]
  empty?: string
}) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-[13px] text-erp-muted">{empty}</p>
  }
  return (
    <ul className="divide-y divide-erp-border">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-3 py-3 first:pt-0">
          <span
            className={cn(
              'h-2 w-2 shrink-0 rounded-full',
              item.severity === 'green' && 'bg-emerald-500',
              item.severity === 'amber' && 'bg-amber-500',
              item.severity === 'red' && 'bg-red-500',
            )}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-erp-text">{item.label}</p>
            <p className="text-[12px] text-erp-muted">{item.meta}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}

export function QuickActions({ actions }: { actions: { label: string; onClick: () => void }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => (
        <button
          key={a.label}
          type="button"
          onClick={a.onClick}
          className="rounded-lg border border-erp-border bg-erp-surface px-3.5 py-2 text-[12px] font-semibold text-erp-text shadow-sm transition-all hover:border-erp-primary/40 hover:bg-erp-primary-soft hover:text-erp-primary hover:shadow-erp"
        >
          {a.label}
        </button>
      ))}
    </div>
  )
}

export function ProgressRing({ value, label, size = 88 }: { value: number; label: string; size?: number }) {
  const r = (size - 8) / 2
  const c = 2 * Math.PI * r
  const pct = Math.min(100, Math.max(0, value))
  const offset = c - (pct / 100) * c
  const color = pct >= 75 ? '#16a34a' : pct >= 40 ? '#d97706' : '#dc2626'
  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={6} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={6} strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[18px] font-bold tabular-nums">{pct}%</span>
        </div>
      </div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-erp-muted">{label}</p>
    </div>
  )
}
