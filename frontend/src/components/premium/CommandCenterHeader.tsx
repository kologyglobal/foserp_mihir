import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { Star } from 'lucide-react'
import { LiveStatusBadge } from './LiveStatusBadge'
import { HealthScoreCard } from './HealthScoreCard'
import { PremiumKpiCard } from './PremiumKpiCard'
import type { PremiumKpiProps } from './types'
import { CrmPageTip } from '../crm/CrmPageTip'
import { useUIStore } from '../../store/uiStore'
import { getPageLabel } from '../../utils/pageNavigation'
import { isCrmPath } from '../../utils/crmPageTipStorage'
import { cn } from '../../utils/cn'

export interface CommandCenterMetric extends PremiumKpiProps {
  id: string
}

export function CommandCenterHeader({
  title,
  subtitle,
  plant = 'Pune Plant',
  shift = 'Shift A',
  healthScore,
  healthLabel,
  healthSublabel,
  metrics,
  actions,
  badge,
  favoritePath,
  showFactoryLive = true,
  heroLayout = 'default',
}: {
  title: string
  subtitle?: string
  plant?: string
  shift?: string
  healthScore?: number
  healthLabel?: string
  healthSublabel?: string
  metrics: CommandCenterMetric[]
  actions?: ReactNode
  badge?: string
  favoritePath?: string
  showFactoryLive?: boolean
  heroLayout?: 'default' | 'uniform'
}) {
  const { pathname } = useLocation()
  const toggleFavorite = useUIStore((s) => s.toggleFavorite)
  const isFavorite = useUIStore((s) => s.isFavorite)
  const path = favoritePath ?? pathname
  const fav = isFavorite(path)

  return (
    <section className="erp-command-hero overflow-hidden">
      <div className="erp-command-hero-band">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="erp-command-hero-title">{title}</h1>
              {badge && (
                <span className="erp-command-hero-badge">{badge}</span>
              )}
              {showFactoryLive && <LiveStatusBadge label="Factory Live" tone="live" />}
              <button
                type="button"
                onClick={() => toggleFavorite({ path, label: title || getPageLabel(path) })}
                className={cn(
                  'erp-command-favorite',
                  fav && 'erp-command-favorite-active',
                )}
                title={fav ? 'Remove from pinned' : 'Pin to sidebar'}
              >
                <Star className={cn('h-3.5 w-3.5', fav && 'fill-current')} />
              </button>
              {badge === 'CRM' || isCrmPath(pathname) ? <CrmPageTip /> : null}
            </div>
            <p className="erp-command-hero-subtitle mt-1.5">
              {subtitle ?? `${plant} · ${shift} · Vasant Trailers`}
            </p>
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      </div>
      <div
        className={cn(
          'erp-command-hero-body',
          heroLayout === 'uniform' && 'erp-command-hero-body--uniform',
          heroLayout === 'default' && metrics.length > 0 && `erp-command-hero-body--metrics-${Math.min(metrics.length, 6)}`,
        )}
        data-hero-tiles={(healthScore != null ? 1 : 0) + metrics.length}
      >
        {healthScore != null && (
          <div className="erp-command-health-cell">
            <HealthScoreCard
              score={healthScore}
              label={healthLabel}
              sublabel={healthSublabel}
              compact={heroLayout === 'uniform'}
            />
          </div>
        )}
        <div className="erp-command-metrics-grid">
          {metrics.map((m) => (
            <div key={m.id} className="erp-command-metric-cell">
              <PremiumKpiCard {...m} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
