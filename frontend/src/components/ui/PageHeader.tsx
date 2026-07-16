import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { Star } from 'lucide-react'
import { Breadcrumbs, type BreadcrumbItem } from './Breadcrumbs'
import { StickyCommandBar } from '../design-system/StickyCommandBar'
import { PageInsightsStrip, type PageInsight } from '../design-system/PageInsightsStrip'
import { buildRouteBreadcrumbs, getPageLabel } from '../../utils/pageNavigation'
import { useUIStore } from '../../store/uiStore'
import { cn } from '../../utils/cn'

interface PageHeaderProps {
  title: string
  description?: string
  breadcrumbs?: BreadcrumbItem[]
  autoBreadcrumbs?: boolean
  favoritePath?: string
  actions?: ReactNode
  commandBar?: ReactNode
  insights?: PageInsight[]
  filterBar?: ReactNode
  className?: string
  badge?: string
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  autoBreadcrumbs = false,
  favoritePath,
  actions,
  commandBar,
  insights,
  filterBar,
  className,
  badge,
}: PageHeaderProps) {
  const { pathname } = useLocation()
  const toggleFavorite = useUIStore((s) => s.toggleFavorite)
  const isFavorite = useUIStore((s) => s.isFavorite)
  const path = favoritePath ?? pathname
  const fav = isFavorite(path)
  const crumbItems = breadcrumbs ?? (autoBreadcrumbs ? buildRouteBreadcrumbs(pathname) : undefined)

  return (
    <>
      <header className={cn('erp-page-hero', className)}>
        <div className="erp-page-hero-band">
          {crumbItems && crumbItems.length > 0 && (
            <Breadcrumbs items={crumbItems} className="mb-1" />
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
                <button
                  type="button"
                  onClick={() => toggleFavorite({ path, label: title || getPageLabel(path) })}
                  className={cn(
                    'inline-flex h-7 w-7 items-center justify-center rounded-md border transition-all',
                    fav
                      ? 'border-amber-300 bg-amber-50 text-amber-500'
                      : 'border-erp-border bg-erp-surface text-erp-muted hover:border-erp-primary/30 hover:text-erp-primary',
                  )}
                  title={fav ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <Star className={cn('h-3.5 w-3.5', fav && 'fill-current')} />
                </button>
              </div>
              {description && <p className="erp-page-subtitle mt-0.5 max-w-2xl">{description}</p>}
            </div>
            {actions && (
              <div className="flex shrink-0 flex-wrap items-center gap-1.5">{actions}</div>
            )}
          </div>
        </div>
        {commandBar && (
          <StickyCommandBar>{commandBar}</StickyCommandBar>
        )}
        {insights && insights.length > 0 && (
          <div className="erp-page-hero-insights">
            <PageInsightsStrip insights={insights} />
          </div>
        )}
        {filterBar && <div className="erp-page-hero-filter">{filterBar}</div>}
      </header>
    </>
  )
}
