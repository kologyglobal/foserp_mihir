import type { ReactNode } from 'react'
import { useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { Star } from 'lucide-react'
import { buildRouteBreadcrumbs, getPageLabel } from '../../utils/pageNavigation'
import { useUIStore } from '../../store/uiStore'
import { useWorkspacePageHeaderSetters } from '../../context/WorkspacePageHeaderContext'
import { Breadcrumbs } from '../ui/Breadcrumbs'
import { StickyCommandBar } from './StickyCommandBar'
import { PageInsightsStrip, type PageInsight } from './PageInsightsStrip'
import { EnterpriseKpiStrip } from '../../design-system/enterprise/EnterpriseKpiStrip'
import type { EnterpriseKpiItem } from '../../design-system/enterprise/enterpriseKpiTypes'
import { LiveAlertStrip } from '../live-erp/LiveAlertStrip'
import type { LiveAlert } from '../live-erp/types'
import { cn } from '../../utils/cn'
import { resolvePageGuide } from '../../config/pageGuideRegistry'
import { CrmPageTip } from '../crm/CrmPageTip'
import { ErpPageGuide } from '../erp/ErpPageGuide'
import { isCrmPath } from '../../utils/crmPageTipStorage'

interface OperationalPageShellProps {
  title: string
  description?: string
  breadcrumbs?: { label: string; to?: string }[]
  autoBreadcrumbs?: boolean
  badge?: string
  actions?: ReactNode
  commandBar?: ReactNode
  insights?: PageInsight[]
  /** Enterprise KPI cards — preferred for CRM/Sales list pages */
  kpiStrip?: EnterpriseKpiItem[]
  filterBar?: ReactNode
  favoritePath?: string
  liveAlerts?: LiveAlert[]
  pageGuide?: { purpose: string; nextStep?: string } | null
  children: ReactNode
  className?: string
  variant?: 'default' | 'dynamics'
  /**
   * enterprise — compact BC/D365 header: title + actions same row, filters below.
   * Default for dynamics variant.
   */
  layout?: 'default' | 'enterprise'
  /** Show description in enterprise layout (default: hidden to save vertical space) */
  showDescription?: boolean
  /** Merge breadcrumbs + title + actions into workspace tab header (Dynamics) */
  mergeHeaderWithWorkspace?: boolean
  /** Hide chrome title/fav — page commandBar supplies sticky record header */
  workspaceRecordHeader?: boolean
}

/**
 * Standard ERP list page layout.
 * Enterprise: Breadcrumb → Title + Actions → Search/Filters → Content
 */
export function OperationalPageShell({
  title,
  description,
  breadcrumbs,
  autoBreadcrumbs = true,
  badge,
  actions,
  commandBar,
  insights,
  kpiStrip,
  filterBar,
  favoritePath,
  liveAlerts,
  pageGuide,
  children,
  className,
  variant = 'default',
  layout,
  showDescription = false,
  mergeHeaderWithWorkspace,
  workspaceRecordHeader = false,
}: OperationalPageShellProps) {
  const { pathname } = useLocation()
  const toggleFavorite = useUIStore((s) => s.toggleFavorite)
  const isFavorite = useUIStore((s) => s.isFavorite)
  const workspaceHeaderSetters = useWorkspacePageHeaderSetters()
  const setHeader = workspaceHeaderSetters?.setHeader
  const path = favoritePath ?? pathname
  const fav = isFavorite(path)
  const crumbItems = useMemo(
    () => breadcrumbs ?? (autoBreadcrumbs ? buildRouteBreadcrumbs(pathname) : undefined),
    [breadcrumbs, autoBreadcrumbs, pathname],
  )
  const guide = pageGuide === null ? null : (pageGuide ?? resolvePageGuide(pathname))
  const isEnterprise = layout === 'enterprise' || (layout !== 'default' && variant === 'dynamics')
  const mergeHeader = mergeHeaderWithWorkspace ?? (variant === 'dynamics' && isEnterprise)
  /** Tip lives in WorkspaceUnifiedHeader when header is merged; local hero otherwise. */
  const showLocalCrmTip = !mergeHeader && (badge === 'CRM' || isCrmPath(pathname))

  const headerMeta = useMemo(
    () => ({
      breadcrumbs: crumbItems,
      title,
      badge,
      favoritePath: path,
      recordHeader: workspaceRecordHeader || undefined,
    }),
    [crumbItems, title, badge, path, workspaceRecordHeader],
  )

  useEffect(() => {
    if (!mergeHeader || !setHeader) return
    // Publish meta + action nodes in one state update so Dynamics chrome re-renders.
    // Use setters-only context so this publisher does not re-render on every publish
    // (that was causing Maximum update depth with fresh commandBar/actions nodes).
    setHeader({
      meta: headerMeta,
      commandBar: commandBar ?? null,
      actions: actions ?? null,
    })
  }, [mergeHeader, setHeader, headerMeta, commandBar, actions])

  useEffect(() => {
    if (!mergeHeader || !setHeader) return
    return () => setHeader({ meta: null, commandBar: null, actions: null })
  }, [mergeHeader, setHeader])

  const showLocalHero = !mergeHeader

  return (
    <div
      className={cn(
        'erp-page saas-page-shell',
        variant === 'dynamics' && 'dyn-page-shell',
        isEnterprise && 'erp-page--enterprise',
        className,
      )}
    >
      <header className={cn('erp-page-hero', !showLocalHero && 'erp-page-hero--workspace-merged')}>
        {showLocalHero && (
        <div className="erp-page-hero-band">
          {crumbItems && crumbItems.length > 0 && <Breadcrumbs items={crumbItems} className="mb-1" />}
          <div className={cn(isEnterprise ? 'erp-page-hero-enterprise-row' : 'flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between')}>
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
                {showLocalCrmTip ? <CrmPageTip /> : null}
              </div>
              {description && (!isEnterprise || showDescription) ? (
                <p className="erp-page-subtitle mt-0.5 max-w-2xl">{description}</p>
              ) : null}
            </div>
            <div className={cn('flex shrink-0 flex-wrap items-center gap-1.5', isEnterprise && 'erp-page-hero-enterprise-actions')}>
              {isEnterprise && commandBar ? commandBar : null}
              {actions}
            </div>
          </div>
        </div>
        )}
        {!isEnterprise && commandBar ? <StickyCommandBar>{commandBar}</StickyCommandBar> : null}
        {liveAlerts && liveAlerts.length > 0 && (
          <div className="border-b border-erp-border bg-erp-surface-alt/30 px-4 py-3">
            <LiveAlertStrip alerts={liveAlerts} />
          </div>
        )}
        {filterBar && <div className="erp-page-hero-filter">{filterBar}</div>}
        {kpiStrip && kpiStrip.length > 0 && (
          <div className="erp-page-hero-insights">
            <EnterpriseKpiStrip
              items={kpiStrip}
              columns={kpiStrip.length >= 5 ? 5 : kpiStrip.length}
            />
          </div>
        )}
        {!kpiStrip?.length && insights && insights.length > 0 && (
          <div className="erp-page-hero-insights">
            <PageInsightsStrip insights={insights} />
          </div>
        )}
      </header>

      {guide ? <ErpPageGuide purpose={guide.purpose} nextStep={guide.nextStep} className="mb-3" /> : null}

      {children}
    </div>
  )
}
