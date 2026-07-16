import type { ReactNode } from 'react'
import { Star } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { HealthScoreCard } from '../premium/HealthScoreCard'
import { LiveStatusBadge } from '../premium/LiveStatusBadge'
import { useUIStore } from '../../store/uiStore'
import { getPageLabel } from '../../utils/pageNavigation'
import { cn } from '../../utils/cn'
import { SaaSKpiCard, type SaaSKpiCardProps } from './SaaSKpiCard'
import { DynamicsMetricStrip } from './DynamicsMetricStrip'

export function SaaSDashboardHero({
  title,
  subtitle,
  badge,
  healthScore,
  kpis,
  actions,
  favoritePath,
  layout = 'saas',
}: {
  title: string
  subtitle?: string
  badge?: string
  healthScore?: number
  kpis: SaaSKpiCardProps[]
  actions?: ReactNode
  favoritePath?: string
  layout?: 'saas' | 'dynamics'
}) {
  const { pathname } = useLocation()
  const toggleFavorite = useUIStore((s) => s.toggleFavorite)
  const isFavorite = useUIStore((s) => s.isFavorite)
  const path = favoritePath ?? pathname
  const fav = isFavorite(path)

  if (layout === 'dynamics') {
    return (
      <section className="mb-4">
        <div className="d365-panel">
          <div className="d365-panel-header">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="d365-panel-title">{title}</h1>
                {badge && <span className="saas-status-badge saas-status-info">{badge}</span>}
                <LiveStatusBadge label="Factory Live" tone="live" />
                <button
                  type="button"
                  onClick={() => toggleFavorite({ path, label: title || getPageLabel(path) })}
                  className={cn(
                    'inline-flex h-7 w-7 items-center justify-center rounded border border-[var(--d365-border)] transition-colors',
                    fav ? 'border-amber-300 bg-amber-50 text-amber-500' : 'text-[var(--d365-muted)] hover:bg-[var(--d365-nav-hover)]',
                  )}
                  title={fav ? 'Unpin' : 'Pin to sidebar'}
                >
                  <Star className={cn('h-3.5 w-3.5', fav && 'fill-current')} />
                </button>
              </div>
              {subtitle && <p className="d365-page-subtitle">{subtitle}</p>}
            </div>
            {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
          </div>
          <div className="d365-panel-body space-y-4">
            {healthScore != null && (
              <div className="max-w-xs">
                <HealthScoreCard score={healthScore} sublabel="Composite ops + QC + dispatch" />
              </div>
            )}
            <DynamicsMetricStrip metrics={kpis} />
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="saas-hero">
      <div className="saas-hero-glow" aria-hidden />
      <div className="saas-hero-band">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="saas-hero-title">{title}</h1>
              {badge && <span className="saas-status-badge saas-status-info">{badge}</span>}
              <LiveStatusBadge label="Factory Live" tone="live" />
              <button
                type="button"
                onClick={() => toggleFavorite({ path, label: title || getPageLabel(path) })}
                className={cn(
                  'inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--saas-border)] transition-colors',
                  fav ? 'border-amber-300 bg-amber-50 text-amber-500' : 'text-[var(--saas-muted)] hover:bg-[var(--saas-bg-subtle)]',
                )}
                title={fav ? 'Unpin' : 'Pin to sidebar'}
              >
                <Star className={cn('h-3.5 w-3.5', fav && 'fill-current')} />
              </button>
            </div>
            {subtitle && <p className="saas-hero-subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
        </div>
      </div>
      <div className="grid gap-0 lg:grid-cols-[minmax(220px,260px)_1fr]">
        {healthScore != null && (
          <div className="border-b border-[var(--saas-border)] p-3 lg:border-b-0 lg:border-r">
            <HealthScoreCard score={healthScore} sublabel="Composite ops + QC + dispatch" />
          </div>
        )}
        <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {kpis.map((kpi) => (
            <SaaSKpiCard key={kpi.label} {...kpi} />
          ))}
        </div>
      </div>
    </section>
  )
}
