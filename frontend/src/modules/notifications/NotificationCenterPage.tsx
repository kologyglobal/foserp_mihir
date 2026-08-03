import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, RefreshCw } from 'lucide-react'
import { useApiMode } from '@/hooks/useApiMode'
import {
  dismissNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  resolveNotification,
  snoozeNotification,
  type AppNotification,
  type NotificationCounts,
} from '@/services/api/notificationsApi'
import { formatRelativeTime } from '@/utils/dates/format'
import { ErpButton } from '@/components/erp/ErpButton'
import { PageLoadingFallback } from '@/components/system/PageLoadingFallback'
import { cn } from '@/utils/cn'
import { notify } from '@/store/toastStore'

const SECTIONS = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'critical', label: 'Critical' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'follow_ups', label: 'Follow-ups' },
  { id: 'meetings', label: 'Meetings' },
  { id: 'risks', label: 'CRM Risks' },
  { id: 'system', label: 'Integrations' },
] as const

export function NotificationCenterPage() {
  const apiMode = useApiMode()
  const [section, setSection] = useState<(typeof SECTIONS)[number]['id']>('all')
  const [items, setItems] = useState<AppNotification[]>([])
  const [counts, setCounts] = useState<NotificationCounts | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const query = useMemo(() => {
    if (section === 'unread') return { unreadOnly: true as const }
    if (section === 'critical') return { priority: 'CRITICAL' }
    if (section === 'approvals') return { category: 'APPROVAL' }
    if (section === 'follow_ups') return { category: 'FOLLOW_UP' }
    if (section === 'meetings') return { category: 'MEETING' }
    if (section === 'risks') return { category: 'RISK' }
    if (section === 'system') return { category: 'INTEGRATION' }
    return {}
  }, [section])

  const load = useCallback(async () => {
    if (!apiMode) {
      setLoading(false)
      setItems([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await fetchNotifications({ limit: 50, ...query })
      setItems(data.items)
      setCounts(data.counts)
    } catch (err) {
      setError((err as Error).message || 'Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }, [apiMode, query])

  useEffect(() => {
    void load()
  }, [load])

  if (!apiMode) {
    return (
      <div className="erp-page p-6">
        <h1 className="text-lg font-semibold">Notification Centre</h1>
        <p className="mt-2 text-sm text-erp-muted">
          Enable API mode (`VITE_USE_API=true`) to use database-backed CRM notifications.
          Demo mode continues to show operational alerts via the top-bar bell.
        </p>
      </div>
    )
  }

  return (
    <div className="erp-page mx-auto max-w-5xl p-4 md:p-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-erp-primary" />
            <h1 className="text-lg font-semibold text-erp-text">Notification Centre</h1>
          </div>
          <p className="mt-1 text-sm text-erp-muted">
            Actionable CRM alerts — assignments, follow-ups, approvals, and risks.
          </p>
          {counts && (
            <p className="mt-2 text-xs text-erp-muted">
              Unread <strong className="text-erp-text">{counts.unread}</strong>
              {' · '}
              Critical <strong className="text-erp-text">{counts.critical}</strong>
              {' · '}
              High <strong className="text-erp-text">{counts.high}</strong>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <ErpButton
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={() => void load()}
          >
            Refresh
          </ErpButton>
          <ErpButton
            variant="secondary"
            size="sm"
            onClick={() => {
              void markAllNotificationsRead().then(() => {
                notify.success('All marked as read')
                void load()
              })
            }}
          >
            Mark all read
          </ErpButton>
          <Link to="/notifications/settings">
            <ErpButton variant="ghost" size="sm">
              Preferences
            </ErpButton>
          </Link>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            className={cn(
              'rounded-full px-3 py-1 text-[12px] font-semibold transition-colors',
              section === s.id
                ? 'bg-erp-primary text-white'
                : 'bg-erp-surface-alt text-erp-muted hover:text-erp-text',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading && <PageLoadingFallback label="Loading notifications…" />}
      {error && !loading && (
        <div className="rounded-lg border border-erp-danger-border bg-erp-danger-soft p-4 text-sm text-erp-danger-fg">
          {error}
        </div>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="rounded-lg border border-erp-border bg-erp-surface p-10 text-center text-sm text-erp-muted">
          No notifications in this view.
        </div>
      )}

      <ul className="space-y-2">
        {items.map((n) => (
          <li
            key={n.id}
            className={cn(
              'rounded-xl border bg-erp-surface p-4 shadow-sm',
              n.status === 'UNREAD' ? 'border-erp-primary/30' : 'border-erp-border',
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-erp-muted">
                  {n.priority} · {n.category.replace(/_/g, ' ')}
                </p>
                <h2 className="text-[15px] font-semibold text-erp-text">{n.title}</h2>
                <p className="mt-1 text-[13px] leading-snug text-erp-muted">{n.message}</p>
                {(n.entityCode || n.entityName) && (
                  <p className="mt-1 text-[12px] font-medium text-erp-text">
                    {[n.entityCode, n.entityName].filter(Boolean).join(' · ')}
                  </p>
                )}
                {n.metadata && typeof n.metadata.contactName === 'string' && n.metadata.contactName ? (
                  <p className="mt-0.5 text-[12px] text-erp-text">
                    Contact: {n.metadata.contactName}
                    {typeof n.metadata.dueTime === 'string' && n.metadata.dueTime
                      ? ` · Time: ${n.metadata.dueTime}`
                      : ''}
                  </p>
                ) : typeof n.metadata?.dueTime === 'string' && n.metadata.dueTime ? (
                  <p className="mt-0.5 text-[12px] text-erp-text">Time: {n.metadata.dueTime}</p>
                ) : null}
                {typeof n.metadata?.notesSnippet === 'string' && n.metadata.notesSnippet ? (
                  <p className="mt-0.5 text-[12px] italic text-erp-muted">{n.metadata.notesSnippet}</p>
                ) : null}
                <p className="mt-1 text-[11px] text-erp-muted">{formatRelativeTime(n.createdAt)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {n.actionUrl && (
                  <Link to={n.actionUrl}>
                    <ErpButton
                      size="sm"
                      variant="primary"
                      onClick={() => {
                        void markNotificationRead(n.id)
                      }}
                    >
                      Open
                    </ErpButton>
                  </Link>
                )}
                {n.status === 'UNREAD' && (
                  <ErpButton size="sm" variant="secondary" onClick={() => void markNotificationRead(n.id).then(load)}>
                    Mark read
                  </ErpButton>
                )}
                <ErpButton
                  size="sm"
                  variant="ghost"
                  onClick={() => void snoozeNotification(n.id, { minutes: 60 }).then(load)}
                >
                  Snooze 1h
                </ErpButton>
                <ErpButton
                  size="sm"
                  variant="ghost"
                  onClick={() => void resolveNotification(n.id).then(load)}
                >
                  Resolve
                </ErpButton>
                <ErpButton
                  size="sm"
                  variant="ghost"
                  onClick={() => void dismissNotification(n.id).then(load)}
                >
                  Dismiss
                </ErpButton>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
