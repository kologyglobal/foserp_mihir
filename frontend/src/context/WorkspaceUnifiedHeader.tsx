import type { ReactNode } from 'react'
import { Star } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { CrmPageTip } from '../components/crm/CrmPageTip'
import { Breadcrumbs } from '../components/ui/Breadcrumbs'
import { getPageLabel } from '../utils/pageNavigation'
import { useUIStore } from '../store/uiStore'
import { cn } from '../utils/cn'
import type { WorkspacePageHeaderMeta } from './WorkspacePageHeaderContext'

/**
 * Sticky workspace header — Leads / CRM register pattern for the entire app:
 *   Breadcrumbs
 *   Title + module badge + favorite + help    |    primary actions
 *   Module tabs
 */
export function WorkspaceUnifiedHeader({
  meta,
  commandBar,
  actions,
  tabs,
  pageTitle,
  moduleName,
}: {
  meta: WorkspacePageHeaderMeta
  commandBar?: ReactNode
  actions?: ReactNode
  tabs?: ReactNode
  /** Nav / route title when meta.title is empty */
  pageTitle?: string
  /** Module category shown as badge (e.g. CRM, Procurement) */
  moduleName?: string
}) {
  const { pathname } = useLocation()
  const toggleFavorite = useUIStore((s) => s.toggleFavorite)
  const isFavorite = useUIStore((s) => s.isFavorite)
  const path = meta.favoritePath ?? pathname
  const fav = path ? isFavorite(path) : false
  const badge = (meta.badge?.trim() || moduleName?.trim() || '').trim()
  const tip = <CrmPageTip />

  const hasActions = Boolean(commandBar || actions)
  const recordHeader = Boolean(meta.recordHeader)
  const chromeTitle = (meta.title?.trim() || pageTitle?.trim() || getPageLabel(pathname) || 'Page').trim()
  const crumbs = meta.breadcrumbs

  const actionsNode = hasActions ? (
    <div className="d365-workspace-unified-actions">
      {commandBar}
      {actions}
    </div>
  ) : null

  return (
    <div className="d365-workspace-unified-header">
      <div
        className={cn(
          'd365-workspace-unified-head',
          hasActions && 'd365-workspace-unified-head--with-actions',
          recordHeader && 'd365-workspace-unified-head--record',
        )}
      >
        <div className="d365-workspace-unified-main">
          {!recordHeader && crumbs && crumbs.length > 0 ? (
            <div className="d365-workspace-unified-breadcrumbs">
              <Breadcrumbs items={crumbs} />
            </div>
          ) : null}

          {!recordHeader ? (
            <div className="d365-workspace-unified-title">
              <h1 className="d365-workspace-unified-title-text">{chromeTitle}</h1>
              {badge ? <span className="d365-workspace-unified-badge">{badge}</span> : null}
              {path ? (
                <button
                  type="button"
                  onClick={() => toggleFavorite({ path, label: chromeTitle || getPageLabel(path) })}
                  className={cn(
                    'd365-workspace-unified-fav',
                    fav && 'd365-workspace-unified-fav--active',
                  )}
                  title={fav ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <Star className={cn('h-3.5 w-3.5', fav && 'fill-current')} />
                </button>
              ) : null}
              {tip}
            </div>
          ) : tip ? (
            <div className="d365-workspace-unified-title">{tip}</div>
          ) : null}
        </div>
        {actionsNode}
      </div>
      {tabs ? <div className="d365-workspace-unified-tabs-row">{tabs}</div> : null}
    </div>
  )
}
