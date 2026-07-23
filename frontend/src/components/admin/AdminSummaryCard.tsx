import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '../../utils/cn'

export type AdminSummaryAccent = 'blue' | 'green' | 'amber' | 'red' | 'slate'

const ACCENT: Record<AdminSummaryAccent, string> = {
  blue: 'border-erp-primary/20 bg-erp-primary-soft/40 text-erp-primary',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  red: 'border-red-200 bg-red-50 text-red-700',
  slate: 'border-erp-border bg-erp-surface-alt text-erp-muted',
}

export function AdminSummaryCard({
  label,
  value,
  helper,
  icon: Icon,
  accent = 'slate',
  to,
}: {
  label: string
  value: number | string
  helper?: string
  icon?: LucideIcon
  accent?: AdminSummaryAccent
  to?: string
}) {
  const body = (
    <div
      className={cn(
        'rounded-xl border px-4 py-3 shadow-sm transition-colors',
        ACCENT[accent],
        to && 'hover:ring-2 hover:ring-erp-primary/20',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-erp-text">{value}</p>
          {helper ? <p className="mt-1 text-xs text-erp-muted">{helper}</p> : null}
        </div>
        {Icon ? <Icon className="h-5 w-5 shrink-0 opacity-70" strokeWidth={1.75} /> : null}
      </div>
    </div>
  )
  if (to) return <Link to={to} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-erp-primary">{body}</Link>
  return body
}

export function AdminSummaryStrip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-4', className)}>
      {children}
    </div>
  )
}
