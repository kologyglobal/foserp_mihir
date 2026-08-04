import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Check, CheckCircle2, Clock, ExternalLink, RefreshCw, Timer } from 'lucide-react'
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
import {
  categoryShort,
  getNotificationContext,
  priorityBadgeClass,
  priorityLabel,
  priorityTone,
} from './notificationPresentation'
import { TrafficLight } from '@/components/design-system/TrafficLight'

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

function MetaChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex max-w-full items-center truncate rounded-md bg-erp-surface-alt px-2 py-0.5 text-[11px] font-medium text-erp-text ring-1 ring-inset ring-erp-border/70">
      {children}
    </span>
  )
}

function NotificationCard({
  n,
  onChanged,
}: {
  n: AppNotification
  onChanged: () => void
}) {
  const ctx = getNotificationContext(n)
  const unread = n.status === 'UNREAD'
  const chips: { key: string; label: string }[] = []

  if (ctx.recordCode) {
    chips.push({
      key: 'record',
      label: ctx.recordKind ? `${ctx.recordKind} ${ctx.recordCode}` : ctx.recordCode,
    })
  }
  if (ctx.contact) chips.push({ key: 'contact', label: ctx.contact })
  if (ctx.dueTime && !ctx.shortSummary?.includes(ctx.dueTime)) {
    chips.push({ key: 'time', label: ctx.dueTime })
  }

  return (
    <li>
      <article
        className={cn(
          'relative overflow-hidden rounded-xl border bg-erp-surface p-4 shadow-sm transition-colors',
          unread ? 'border-erp-primary/25 bg-erp-primary-soft/15' : 'border-erp-border',
        )}
      >
        {unread ? (
          <span className="absolute inset-y-0 left-0 w-0.5 bg-erp-primary" aria-hidden />
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-1 gap-3">
            <div className="pt-1.5">
              <TrafficLight status={priorityTone(n.priority)} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  className={cn(
                    'text-[15px] leading-snug text-erp-text',
                    unread ? 'font-semibold' : 'font-medium',
                  )}
                >
                  {n.title}
                </h2>
                {n.priority !== 'NORMAL' && n.priority !== 'LOW' ? (
                  <span
                    className={cn(
                      'rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset',
                      priorityBadgeClass(n.priority),
                    )}
                  >
                    {priorityLabel(n.priority)}
                  </span>
                ) : null}
              </div>

              <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-erp-muted">
                {categoryShort(n.category)}
              </p>

              <div className="mt-2 space-y-1.5">
                {ctx.company ? (
                  <p className="text-[13px] font-medium leading-snug text-erp-text">{ctx.company}</p>
                ) : null}
                {ctx.shortSummary ? (
                  <p className="text-[12.5px] text-erp-muted">{ctx.shortSummary}</p>
                ) : null}
                {ctx.bodyMessage ? (
                  <p className="text-[13px] leading-relaxed text-erp-muted">{ctx.bodyMessage}</p>
                ) : null}
                {chips.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {chips.map((c) => (
                      <MetaChip key={c.key}>{c.label}</MetaChip>
                    ))}
                  </div>
                ) : null}
                {ctx.notes ? (
                  <p className="line-clamp-3 border-l-2 border-erp-border pl-2.5 text-[12px] leading-snug text-erp-muted">
                    {ctx.notes}
                  </p>
                ) : null}
              </div>

              <p className="mt-2.5 flex items-center gap-1 text-[11px] text-erp-muted">
                <Clock className="h-3 w-3 opacity-70" />
                {formatRelativeTime(n.createdAt)}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:max-w-[220px] sm:justify-end">
            {n.actionUrl ? (
              <Link to={n.actionUrl}>
                <ErpButton
                  size="sm"
                  variant="primary"
                  icon={ExternalLink}
                  onClick={() => {
                    void markNotificationRead(n.id)
                  }}
                >
                  Open
                </ErpButton>
              </Link>
            ) : null}
            {unread ? (
              <ErpButton
                size="sm"
                variant="secondary"
                icon={Check}
                onClick={() => void markNotificationRead(n.id).then(onChanged)}
              >
                Read
              </ErpButton>
            ) : null}
            <ErpButton
              size="sm"
              variant="ghost"
              icon={Timer}
              onClick={() => void snoozeNotification(n.id, { minutes: 60 }).then(onChanged)}
            >
              Snooze
            </ErpButton>
            <ErpButton
              size="sm"
              variant="ghost"
              icon={CheckCircle2}
              onClick={() => void resolveNotification(n.id).then(onChanged)}
            >
              Done
            </ErpButton>
            <ErpButton
              size="sm"
              variant="ghost"
              onClick={() => void dismissNotification(n.id).then(onChanged)}
            >
              Dismiss
            </ErpButton>
          </div>
        </div>
      </article>
    </li>
  )
}

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
    <div className="erp-page mx-auto max-w-3xl p-4 md:p-6">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-erp-primary-soft text-erp-primary">
              <Bell className="h-4 w-4" />
            </span>
            <div>
              <h1 className="text-lg font-semibold text-erp-text">Notification Centre</h1>
              <p className="text-sm text-erp-muted">
                Assignments, follow-ups, approvals, and CRM risks.
              </p>
            </div>
          </div>
          {counts ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-erp-surface-alt px-2.5 py-1 text-[11px] font-semibold text-erp-text ring-1 ring-erp-border">
                Unread {counts.unread}
              </span>
              <span className="rounded-full bg-erp-danger-soft px-2.5 py-1 text-[11px] font-semibold text-erp-danger-fg ring-1 ring-erp-danger/25">
                Critical {counts.critical}
              </span>
              <span className="rounded-full bg-erp-warning-soft px-2.5 py-1 text-[11px] font-semibold text-erp-warning-fg ring-1 ring-erp-warning/25">
                High {counts.high}
              </span>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <ErpButton variant="secondary" size="sm" icon={RefreshCw} onClick={() => void load()}>
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
              'rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors',
              section === s.id
                ? 'bg-erp-primary text-white shadow-sm'
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
        <div className="flex flex-col items-center rounded-xl border border-erp-border bg-erp-surface px-6 py-14 text-center shadow-sm">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-erp-success-soft text-erp-success-fg">
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <p className="text-[14px] font-semibold text-erp-text">No notifications here</p>
          <p className="mt-1 text-[13px] text-erp-muted">Try another filter or check back later.</p>
        </div>
      )}

      <ul className="space-y-2.5">
        {items.map((n) => (
          <NotificationCard key={n.id} n={n} onChanged={() => void load()} />
        ))}
      </ul>
    </div>
  )
}
