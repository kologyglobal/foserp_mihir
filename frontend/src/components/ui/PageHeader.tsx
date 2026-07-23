import type { ReactNode } from 'react'
import { useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { StickyCommandBar } from '../design-system/StickyCommandBar'
import { PageInsightsStrip, type PageInsight } from '../design-system/PageInsightsStrip'
import { buildRouteBreadcrumbs } from '../../utils/pageNavigation'
import { useWorkspacePageHeaderSetters } from '../../context/WorkspacePageHeaderContext'
import { cn } from '../../utils/cn'
import type { BreadcrumbItem } from './Breadcrumbs'

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

/**
 * Publishes title/actions into the sticky workspace header (right-side actions).
 * Does not render the legacy in-page hero (breadcrumbs / title / description / favorite).
 * Filter bars, insights, and non-merged command bars still render in-page.
 */
export function PageHeader({
  title,
  description: _description,
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
  const workspaceHeaderSetters = useWorkspacePageHeaderSetters()
  const setHeader = workspaceHeaderSetters?.setHeader
  const path = favoritePath ?? pathname
  const crumbItems = useMemo(
    () => breadcrumbs ?? (autoBreadcrumbs ? buildRouteBreadcrumbs(pathname) : undefined),
    [breadcrumbs, autoBreadcrumbs, pathname],
  )

  const headerMeta = useMemo(
    () => ({
      breadcrumbs: crumbItems,
      title,
      badge,
      favoritePath: path,
    }),
    [crumbItems, title, badge, path],
  )

  useEffect(() => {
    if (!setHeader) return
    setHeader({
      meta: headerMeta,
      commandBar: commandBar ?? null,
      actions: actions ?? null,
    })
  }, [setHeader, headerMeta, commandBar, actions])

  useEffect(() => {
    if (!setHeader) return
    return () => setHeader({ meta: null, commandBar: null, actions: null })
  }, [setHeader])

  const showLocalChrome =
    Boolean(filterBar) || Boolean(insights?.length) || (Boolean(commandBar) && !setHeader)

  if (!showLocalChrome) return null

  return (
    <header className={cn('erp-page-hero erp-page-hero--workspace-merged', className)}>
      {/* Title band removed — chrome lives in WorkspaceUnifiedHeader */}
      {commandBar && !setHeader ? <StickyCommandBar>{commandBar}</StickyCommandBar> : null}
      {insights && insights.length > 0 && (
        <div className="erp-page-hero-insights">
          <PageInsightsStrip insights={insights} />
        </div>
      )}
      {filterBar && <div className="erp-page-hero-filter">{filterBar}</div>}
    </header>
  )
}
