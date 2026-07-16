import { useMemo, useState, type ReactNode } from 'react'
import {
  Activity,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  MessageSquare,
  Pencil,
  Sparkles,
  Trash2,
} from 'lucide-react'
import type { CrmActivity, FollowUp } from '../../types/crm'
import { ErpButton } from '../erp/ErpButton'
import { LiveStatusBadge } from '../premium/LiveStatusBadge'
import { cn } from '../../utils/cn'
import { formatDate, formatDateTime } from '../../utils/dates/format'
import {
  UNIFIED_FEED_FILTERS,
  countUnifiedFeedByKind,
  filterUnifiedFeed,
  type UnifiedFeedFilter,
  type UnifiedFeedItem,
  type UnifiedFeedKind,
} from '../../utils/crmUnifiedFeed'

const KIND_ICON: Record<UnifiedFeedKind, typeof Activity> = {
  activity: Activity,
  note: MessageSquare,
  followup: Calendar,
  system: Sparkles,
}

function formatFeedWhen(at: string): string {
  try {
    if (!at?.trim()) return formatDate(null)
    if (at.length >= 16) return formatDateTime(at)
    return formatDate(at)
  } catch {
    return formatDate(null)
  }
}

function badgeToneToLive(tone: UnifiedFeedItem['badgeTone']): 'healthy' | 'warning' | 'critical' | 'live' {
  if (tone === 'ok') return 'healthy'
  if (tone === 'warn') return 'warning'
  if (tone === 'critical') return 'critical'
  return 'live'
}

function isActivityCompleted(activity: CrmActivity): boolean {
  return Boolean(activity.outcome?.trim())
}

export interface CrmUnifiedActivityFeedProps {
  items: UnifiedFeedItem[]
  /** Upcoming follow-up callout above the feed */
  nextFollowUp?: FollowUp | null
  leadNextFollowUpDate?: string | null
  canAddActivity?: boolean
  canAddFollowUp?: boolean
  canAddNote?: boolean
  onLogActivity?: () => void
  onScheduleFollowUp?: () => void
  onAddNote?: () => void
  /** @deprecated unused — timeline shows Edit instead of View/Notes */
  onOpenActivityNotes?: (activity: CrmActivity) => void
  /** @deprecated unused — timeline shows Edit instead of View/Notes */
  onOpenFollowUpNotes?: (followUp: FollowUp) => void
  onEditActivity?: (activity: CrmActivity) => void
  onDeleteActivity?: (activity: CrmActivity) => void
  onEditFollowUp?: (followUp: FollowUp) => void
  onDeleteFollowUp?: (followUp: FollowUp) => void
  onCompleteActivity?: (activity: CrmActivity) => void
  pendingActivityId?: string | null
  pendingFollowUpId?: string | null
  /** Extra content when System filter is active (e.g. detailed change history) */
  systemExtra?: ReactNode
  emptyMessage?: string
  className?: string
}

export function CrmUnifiedActivityFeed({
  items,
  nextFollowUp,
  leadNextFollowUpDate,
  canAddActivity = true,
  canAddFollowUp = true,
  canAddNote = true,
  onLogActivity,
  onScheduleFollowUp,
  onAddNote,
  onEditActivity,
  onDeleteActivity,
  onEditFollowUp,
  onDeleteFollowUp,
  onCompleteActivity,
  pendingActivityId,
  pendingFollowUpId,
  systemExtra,
  emptyMessage = 'No history yet. Log an activity, add a note, or schedule a follow-up.',
  className,
}: CrmUnifiedActivityFeedProps) {
  const [filter, setFilter] = useState<UnifiedFeedFilter>('all')
  const counts = useMemo(() => countUnifiedFeedByKind(items), [items])
  const visible = useMemo(() => filterUnifiedFeed(items, filter), [items, filter])

  const upcomingLabel = nextFollowUp
    ? `${formatDate(nextFollowUp.dueDate)}${nextFollowUp.dueTime ? ` · ${nextFollowUp.dueTime}` : ''}`
    : leadNextFollowUpDate
      ? formatDate(leadNextFollowUpDate)
      : null

  return (
    <div className={cn('crm-unified-feed', className)}>
      <div className="crm-unified-feed__actions">
        {canAddActivity && onLogActivity ? (
          <ErpButton type="button" size="sm" variant="secondary" icon={Activity} onClick={onLogActivity}>
            Log activity
          </ErpButton>
        ) : null}
        {canAddNote && onAddNote ? (
          <ErpButton type="button" size="sm" variant="secondary" icon={FileText} onClick={onAddNote}>
            Add note
          </ErpButton>
        ) : null}
        {canAddFollowUp && onScheduleFollowUp ? (
          <ErpButton type="button" size="sm" variant="secondary" icon={Calendar} onClick={onScheduleFollowUp}>
            Schedule follow-up
          </ErpButton>
        ) : null}
      </div>

      {upcomingLabel ? (
        <div className="crm-unified-feed__upcoming">
          <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Next follow-up <strong>{upcomingLabel}</strong>
            {nextFollowUp ? ` · ${nextFollowUp.followUpType.replace(/_/g, ' ')}` : ''}
          </span>
          {onScheduleFollowUp ? (
            <button type="button" className="crm-unified-feed__upcoming-link" onClick={onScheduleFollowUp}>
              Change
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="crm-unified-feed__filters" role="tablist" aria-label="Activity timeline filters">
        {UNIFIED_FEED_FILTERS.map((f) => {
          const count = counts[f.id]
          const active = filter === f.id
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={cn('crm-unified-feed__filter', active && 'is-active')}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
              <span className="crm-unified-feed__filter-count">{count}</span>
            </button>
          )
        })}
      </div>

      {visible.length === 0 ? (
        <div className="crm-unified-feed__empty">
          <p>{emptyMessage}</p>
        </div>
      ) : (
        <ol className="crm-unified-feed__list">
          {visible.map((item, idx) => {
            const Icon = KIND_ICON[item.kind]
            const activity = item.activity
            const followUp = item.followUp
            const completed = activity ? isActivityCompleted(activity) : true
            const isPending = activity
              ? pendingActivityId === activity.id
              : followUp
                ? pendingFollowUpId === followUp.id
                : false
            // Notes / system items stay read-only. Activities & follow-ups expose Edit (+ optional Delete).
            const showActivityActions = Boolean(
              activity && (onEditActivity || onCompleteActivity || onDeleteActivity),
            )
            const showFollowUpActions = Boolean(
              followUp && (onEditFollowUp || onDeleteFollowUp),
            )
            return (
              <li key={item.id} className="crm-unified-feed__item">
                {idx < visible.length - 1 ? (
                  <span className="crm-unified-feed__rail" aria-hidden />
                ) : null}
                <span className={cn('crm-unified-feed__node', `crm-unified-feed__node--${item.kind}`)} aria-hidden>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="crm-unified-feed__body">
                  <div className="crm-unified-feed__head">
                    <span className="crm-unified-feed__title">{item.title}</span>
                    <span className="crm-unified-feed__when">{formatFeedWhen(item.at)}</span>
                  </div>
                  {item.body ? <p className="crm-unified-feed__text">{item.body}</p> : null}
                  <div className="crm-unified-feed__meta-row">
                    {item.meta ? <span className="crm-unified-feed__meta">{item.meta}</span> : null}
                    {item.badge ? (
                      <LiveStatusBadge
                        label={item.badge.replace(/_/g, ' ')}
                        tone={badgeToneToLive(item.badgeTone)}
                        pulse={false}
                      />
                    ) : null}
                  </div>
                  {showActivityActions || showFollowUpActions ? (
                    <div className="crm-unified-feed__item-actions">
                      {activity && onEditActivity ? (
                        <button
                          type="button"
                          className="crm-unified-feed__icon-btn"
                          aria-label="Edit"
                          title="Edit"
                          disabled={isPending}
                          onClick={() => onEditActivity(activity)}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      ) : null}
                      {activity && !completed && onCompleteActivity ? (
                        <button
                          type="button"
                          className="crm-unified-feed__icon-btn"
                          aria-label="Complete"
                          title="Complete"
                          disabled={isPending}
                          onClick={() => onCompleteActivity(activity)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      ) : null}
                      {activity && onDeleteActivity ? (
                        <button
                          type="button"
                          className="crm-unified-feed__icon-btn crm-unified-feed__icon-btn--danger"
                          aria-label="Delete"
                          title="Delete"
                          disabled={isPending}
                          onClick={() => onDeleteActivity(activity)}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      ) : null}
                      {followUp && onEditFollowUp ? (
                        <button
                          type="button"
                          className="crm-unified-feed__icon-btn"
                          aria-label="Edit"
                          title="Edit"
                          disabled={isPending}
                          onClick={() => onEditFollowUp(followUp)}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      ) : null}
                      {followUp && onDeleteFollowUp ? (
                        <button
                          type="button"
                          className="crm-unified-feed__icon-btn crm-unified-feed__icon-btn--danger"
                          aria-label="Delete"
                          title="Delete"
                          disabled={isPending}
                          onClick={() => onDeleteFollowUp(followUp)}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {filter === 'system' && systemExtra ? (
        <div className="crm-unified-feed__system-extra">
          {systemExtra}
        </div>
      ) : null}
    </div>
  )
}
