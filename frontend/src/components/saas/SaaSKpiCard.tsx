import type { LucideIcon } from 'lucide-react'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '../../utils/cn'

export interface SaaSKpiCardProps {
  label: string
  value: string | number
  helper?: string
  trend?: string
  trendUp?: boolean
  href?: string
  onClick?: () => void
  icon?: LucideIcon
  lastUpdated?: string
  docNo?: string
}

export function SaaSKpiCard({
  label,
  value,
  helper,
  trend,
  trendUp,
  href,
  onClick,
  icon: Icon,
  lastUpdated,
  docNo,
}: SaaSKpiCardProps) {
  const interactive = Boolean(href || onClick)
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="saas-kpi-label">{label}</p>
          {docNo && <p className="saas-doc-no mt-0.5">{docNo}</p>}
          <p className="saas-kpi-value mt-1">{value}</p>
          {helper && <p className="saas-kpi-helper mt-1">{helper}</p>}
        </div>
        {Icon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--saas-primary-soft)] text-[var(--saas-primary)]">
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {trend && (
          <span className={trendUp ? 'saas-kpi-trend-up' : 'saas-kpi-trend-down'}>{trend}</span>
        )}
        {lastUpdated && <span className="text-[0.6875rem] text-[var(--saas-muted)]">Updated {lastUpdated}</span>}
        {interactive && (
          <span className="ml-auto inline-flex items-center gap-0.5 text-[0.6875rem] font-semibold text-[var(--saas-primary)] opacity-0 transition-opacity group-hover:opacity-100">
            View <ArrowRight className="h-3 w-3" />
          </span>
        )}
      </div>
    </>
  )

  const className = cn('saas-kpi-card group', interactive && 'saas-kpi-card-interactive cursor-pointer')

  if (href) {
    return <Link to={href} className={className}>{body}</Link>
  }
  if (onClick) {
    return <button type="button" onClick={onClick} className={cn(className, 'text-left')}>{body}</button>
  }
  return <div className={className}>{body}</div>
}
