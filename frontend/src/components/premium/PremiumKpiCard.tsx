import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '../../utils/cn'
import type { PremiumKpiProps } from './types'

const accentBorder: Record<NonNullable<PremiumKpiProps['accent']>, string> = {
  blue: 'border-l-[var(--erp-primary)]',
  cyan: 'border-l-[var(--erp-accent)]',
  green: 'border-l-[var(--erp-success)]',
  amber: 'border-l-[var(--erp-warning)]',
  red: 'border-l-[var(--erp-danger)]',
  indigo: 'border-l-[var(--erp-indigo)]',
  orange: 'border-l-[var(--erp-orange)]',
  purple: 'border-l-purple-500',
}

const accentIcon: Record<NonNullable<PremiumKpiProps['accent']>, string> = {
  blue: 'bg-erp-primary-soft text-erp-primary',
  cyan: 'bg-erp-accent-soft text-erp-accent',
  green: 'bg-erp-success-soft text-erp-success',
  amber: 'bg-erp-warning-soft text-erp-warning',
  red: 'bg-erp-danger-soft text-erp-danger',
  indigo: 'bg-indigo-50 text-erp-indigo',
  orange: 'bg-orange-50 text-erp-orange',
  purple: 'bg-purple-50 text-purple-600',
}

function KpiCardBody({
  label,
  value,
  helper,
  trend,
  trendUp,
  icon: Icon,
  accent,
  lastUpdated,
  docNo,
  interactive,
}: PremiumKpiProps & { interactive: boolean }) {
  return (
    <div className="relative z-[1] flex flex-1 flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="erp-type-caption font-medium text-erp-muted">{label}</p>
          {docNo && <p className="erp-doc-no mt-0.5">{docNo}</p>}
          <p className="erp-kpi-value mt-1.5">{value}</p>
          {helper && <p className="erp-type-caption mt-1 line-clamp-2">{helper}</p>}
        </div>
        {Icon && (
          <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md', accentIcon[accent ?? 'blue'])}>
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        {trend && (
          <span
            className={cn(
              'inline-flex rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
              trendUp ? 'bg-erp-success-soft text-erp-success' : 'bg-erp-danger-soft text-erp-danger',
            )}
          >
            {trend}
          </span>
        )}
        {lastUpdated && <span className="text-[10px] text-erp-muted">Updated {lastUpdated}</span>}
        {interactive && (
          <span className="ml-auto flex items-center gap-0.5 text-[11px] font-semibold text-erp-primary">
            View <ArrowRight className="h-3 w-3" />
          </span>
        )}
      </div>
    </div>
  )
}

export function PremiumKpiCard(props: PremiumKpiProps) {
  const { href, onClick, accent = 'blue' } = props
  const interactive = Boolean(href || onClick)
  const className = cn(
    'erp-premium-kpi group relative flex h-full flex-col border-l-[3px] text-left',
    accentBorder[accent],
    interactive && 'cursor-pointer',
  )

  if (href) {
    return (
      <Link to={href} className={className}>
        <KpiCardBody {...props} interactive />
      </Link>
    )
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        <KpiCardBody {...props} interactive />
      </button>
    )
  }

  return (
    <div className={className}>
      <KpiCardBody {...props} interactive={false} />
    </div>
  )
}
