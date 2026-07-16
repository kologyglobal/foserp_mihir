import { Sparkles, Star } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useUIStore } from '../../store/uiStore'
import { cn } from '../../utils/cn'
import type { EnterpriseWorkspaceMetaItem } from './types'

export interface EnterpriseWorkspaceHeaderProps {
  recordNo?: string
  recordTitle?: string
  status?: string
  statusTone?: EnterpriseWorkspaceMetaItem['tone']
  stage?: string
  createdDate?: string
  createdBy?: string
  modifiedDate?: string
  modifiedBy?: string
  owner?: string
  priority?: string
  company?: string
  lastSaved?: string
  showAi?: boolean
  favoritePath?: string
  favoriteLabel?: string
}

const toneClass: Record<NonNullable<EnterpriseWorkspaceMetaItem['tone']>, string> = {
  neutral: 'ent-ws-header__chip--neutral',
  info: 'ent-ws-header__chip--info',
  success: 'ent-ws-header__chip--success',
  warning: 'ent-ws-header__chip--warning',
  critical: 'ent-ws-header__chip--critical',
}

export function EnterpriseWorkspaceHeader({
  recordNo,
  recordTitle,
  status,
  statusTone = 'info',
  stage,
  createdDate,
  createdBy,
  modifiedDate,
  modifiedBy,
  owner,
  priority,
  company,
  lastSaved,
  showAi = true,
  favoritePath,
  favoriteLabel,
}: EnterpriseWorkspaceHeaderProps) {
  const { pathname } = useLocation()
  const toggleFavorite = useUIStore((s) => s.toggleFavorite)
  const isFavorite = useUIStore((s) => s.isFavorite)
  const favPath = favoritePath ?? pathname
  const fav = isFavorite(favPath)

  return (
    <div className="ent-ws-header" role="region" aria-label="Record information">
      <div className="ent-ws-header__primary">
        {recordNo ? <span className="ent-ws-header__record-no">{recordNo}</span> : null}
        {recordTitle ? <span className="ent-ws-header__title">{recordTitle}</span> : null}
        {status ? (
          <span className={cn('ent-ws-header__chip', toneClass[statusTone])}>{status}</span>
        ) : null}
        {stage ? <span className="ent-ws-header__chip ent-ws-header__chip--neutral">{stage}</span> : null}
        {priority ? <span className="ent-ws-header__chip ent-ws-header__chip--neutral">{priority}</span> : null}
      </div>
      <div className="ent-ws-header__secondary">
        {createdDate ? (
          <span className="ent-ws-header__meta">
            <strong>Created</strong> {createdDate}
            {createdBy ? ` · ${createdBy}` : ''}
          </span>
        ) : null}
        {modifiedDate ? (
          <span className="ent-ws-header__meta ent-ws-header__meta--muted">
            <strong>Modified</strong> {modifiedDate}
            {modifiedBy ? ` · ${modifiedBy}` : ''}
          </span>
        ) : null}
        {owner ? <span className="ent-ws-header__meta"><strong>Owner</strong> {owner}</span> : null}
        {company ? <span className="ent-ws-header__meta"><strong>Company</strong> {company}</span> : null}
        {lastSaved ? <span className="ent-ws-header__meta ent-ws-header__meta--muted">{lastSaved}</span> : null}
        {showAi ? (
          <span className="ent-ws-header__ai" title="AI-assisted workspace">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            AI
          </span>
        ) : null}
        <button
          type="button"
          className={cn('ent-ws-header__favorite', fav && 'ent-ws-header__favorite--on')}
          onClick={() => toggleFavorite({ path: favPath, label: favoriteLabel ?? recordTitle ?? 'Record' })}
          aria-label={fav ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star className={cn('h-4 w-4', fav && 'fill-current')} />
        </button>
      </div>
    </div>
  )
}
