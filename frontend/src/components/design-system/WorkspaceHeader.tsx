import type { ReactNode } from 'react'
import { Breadcrumbs } from '../ui/Breadcrumbs'
import { cn } from '../../utils/cn'

interface WorkspaceHeaderProps {
  title: string
  subtitle?: string
  breadcrumbs?: { label: string; to?: string }[]
  traffic?: 'green' | 'amber' | 'red'
  actions?: ReactNode
  commandBar?: ReactNode
  className?: string
  badge?: string
}

export function WorkspaceHeader({
  title,
  subtitle,
  breadcrumbs,
  traffic,
  actions,
  commandBar,
  className,
  badge,
}: WorkspaceHeaderProps) {
  return (
    <div className={cn('erp-page-hero', className)}>
      <div className="erp-page-hero-band">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <Breadcrumbs items={breadcrumbs} className="mb-1" />
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="erp-page-title">{title}</h1>
              {badge && (
                <span className="rounded-full border border-erp-primary/20 bg-erp-primary-soft px-2 py-0.5 text-[10px] font-semibold text-erp-primary">
                  {badge}
                </span>
              )}
              {traffic && (
                <span
                  className={cn(
                    'inline-flex h-2 w-2 rounded-full ring-2 ring-white',
                    traffic === 'green' && 'bg-emerald-500',
                    traffic === 'amber' && 'bg-amber-500',
                    traffic === 'red' && 'bg-red-500',
                  )}
                  title={`Status: ${traffic}`}
                />
              )}
            </div>
            {subtitle && <p className="erp-page-subtitle mt-0.5 max-w-2xl">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-1.5">{actions}</div>}
        </div>
      </div>
      {commandBar && (
        <div className="border-b border-erp-border px-2.5 py-1">
          {commandBar}
        </div>
      )}
    </div>
  )
}
