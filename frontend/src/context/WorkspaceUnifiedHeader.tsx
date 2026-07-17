import type { ReactNode } from 'react'
import { Star } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { CrmPageTip } from '../components/crm/CrmPageTip'
import { Breadcrumbs } from '../components/ui/Breadcrumbs'
import { PageBackLink } from '../components/ui/PageBackLink'
import { getPageLabel } from '../utils/pageNavigation'
import { isCrmPath } from '../utils/crmPageTipStorage'
import { useUIStore } from '../store/uiStore'
import { cn } from '../utils/cn'
import type { WorkspacePageHeaderMeta } from './WorkspacePageHeaderContext'

export function WorkspaceUnifiedHeader({
  meta,
  commandBar,
  actions,
  tabs,
}: {
  meta: WorkspacePageHeaderMeta
  commandBar?: ReactNode
  actions?: ReactNode
  tabs?: ReactNode
}) {
  const { pathname } = useLocation()
  const toggleFavorite = useUIStore((s) => s.toggleFavorite)
  const isFavorite = useUIStore((s) => s.isFavorite)
  const path = meta.favoritePath ?? ''
  const fav = path ? isFavorite(path) : false
  const showCrmTip = isCrmPath(pathname) || meta.badge === 'CRM'
  const tip = showCrmTip ? <CrmPageTip /> : null

  const hasActions = Boolean(commandBar || actions)
  const recordHeader = Boolean(meta.recordHeader)

  const actionsNode = hasActions ? (
    <div className="d365-workspace-unified-actions">
      {commandBar}
      {actions}
    </div>
  ) : null

  return (
    <div className="d365-workspace-unified-header">
      {meta.backLink ? (
        <div className="d365-workspace-unified-back">
          <PageBackLink to={meta.backLink.to} label={meta.backLink.label} />
        </div>
      ) : null}
      <div
        className={cn(
          'd365-workspace-unified-head',
          hasActions && 'd365-workspace-unified-head--with-actions',
          recordHeader && 'd365-workspace-unified-head--record',
        )}
      >
        <div className="d365-workspace-unified-main">
          {!recordHeader ? (
            <div className="d365-workspace-unified-title">
              <h1 className="d365-workspace-unified-title-text">{meta.title}</h1>
              {meta.badge && (
                <span className="d365-workspace-unified-badge">{meta.badge}</span>
              )}
              {path && (
                <button
                  type="button"
                  onClick={() => toggleFavorite({ path, label: meta.title || getPageLabel(path) })}
                  className={cn(
                    'd365-workspace-unified-fav',
                    fav && 'd365-workspace-unified-fav--active',
                  )}
                  title={fav ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <Star className={cn('h-3.5 w-3.5', fav && 'fill-current')} />
                </button>
              )}
              {tip}
            </div>
          ) : tip ? (
            <div className="d365-workspace-unified-title">{tip}</div>
          ) : null}
          {meta.breadcrumbs && meta.breadcrumbs.length > 0 && (
            <div className="d365-workspace-unified-breadcrumbs">
              <Breadcrumbs items={meta.breadcrumbs} />
            </div>
          )}
        </div>
        {actionsNode}
      </div>
      {tabs ? <div className="d365-workspace-unified-tabs-row">{tabs}</div> : null}
    </div>
  )
}
