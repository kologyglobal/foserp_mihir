import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  PackageX,
  Settings,
  Timer,
  Truck,
  X,
} from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { useNotifications } from '../../utils/workspaceMetrics'
import { TrafficLight } from './TrafficLight'
import { cn } from '../../utils/cn'
import { formatRelativeTime } from '../../utils/dates/format'
import { useApiMode } from '@/hooks/useApiMode'
import { useAppNotifications } from '@/hooks/useAppNotifications'
import type { AppNotification } from '@/services/api/notificationsApi'
import {
  categoryShort,
  getNotificationContext,
  priorityBadgeClass,
  priorityLabel,
  priorityTone,
} from '@/modules/notifications/notificationPresentation'

const GROUPS = [
  { id: 'all', label: 'All' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'production', label: 'Production' },
  { id: 'quality', label: 'Quality' },
  { id: 'purchase', label: 'Purchase' },
  { id: 'dispatch', label: 'Dispatch' },
] as const

const SUMMARY_GROUPS = [
  { key: 'shortage' as const, label: 'Material Shortages', icon: PackageX, softClass: 'erp-status-soft-danger', labelClass: 'erp-status-label-danger' },
  { key: 'qc' as const, label: 'QC Failures', icon: AlertTriangle, softClass: 'erp-status-soft-warning', labelClass: 'erp-status-label-warning' },
  { key: 'approval' as const, label: 'Pending Approvals', icon: CheckCircle2, softClass: 'erp-status-soft-info', labelClass: 'erp-status-label-info' },
  { key: 'delay' as const, label: 'Delayed Delivery', icon: Truck, softClass: 'erp-status-soft-danger', labelClass: 'erp-status-label-danger' },
]

function MetaChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex max-w-full items-center truncate rounded-md bg-erp-surface-alt px-2 py-0.5 text-[11px] font-medium text-erp-text ring-1 ring-inset ring-erp-border/70">
      {children}
    </span>
  )
}

function ApiNotificationBody({ n }: { n: AppNotification }) {
  const ctx = getNotificationContext(n)
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
    <div className="min-w-0 space-y-1.5">
      {ctx.company ? (
        <p className="truncate text-[12.5px] font-medium leading-snug text-erp-text">{ctx.company}</p>
      ) : null}

      {ctx.shortSummary ? (
        <p className="text-[12px] leading-snug text-erp-muted">{ctx.shortSummary}</p>
      ) : null}

      {ctx.bodyMessage ? (
        <p className="text-[12px] leading-relaxed text-erp-muted">{ctx.bodyMessage}</p>
      ) : null}

      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {chips.map((c) => (
            <MetaChip key={c.key}>{c.label}</MetaChip>
          ))}
        </div>
      ) : null}

      {ctx.notes ? (
        <p className="line-clamp-2 border-l-2 border-erp-border pl-2 text-[11.5px] leading-snug text-erp-muted">
          {ctx.notes}
        </p>
      ) : null}
    </div>
  )
}

function ActionGhostBtn({
  onClick,
  children,
  icon: Icon,
}: {
  onClick: () => void
  children: React.ReactNode
  icon?: typeof Check
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-erp-muted transition-colors hover:bg-erp-surface-alt hover:text-erp-text"
    >
      {Icon ? <Icon className="h-3 w-3 opacity-70" /> : null}
      {children}
    </button>
  )
}

function ApiNotificationPanel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const { recent, counts, loading, error, markRead, markAllRead, resolve, snooze, refresh } =
    useAppNotifications()
  const [section, setSection] = useState<'critical' | 'today' | 'earlier'>('today')

  const grouped = useMemo(() => {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const critical: AppNotification[] = []
    const today: AppNotification[] = []
    const earlier: AppNotification[] = []
    for (const n of recent) {
      if (n.status === 'DISMISSED' || n.status === 'RESOLVED') continue
      if (n.priority === 'CRITICAL') critical.push(n)
      const created = Date.parse(n.createdAt)
      if (created >= startOfDay.getTime()) today.push(n)
      else earlier.push(n)
    }
    return { critical, today, earlier }
  }, [recent])

  const list =
    section === 'critical' ? grouped.critical : section === 'today' ? grouped.today : grouped.earlier

  const tabs = [
    { id: 'critical' as const, label: 'Critical', count: counts.critical },
    { id: 'today' as const, label: 'Today', count: grouped.today.length },
    { id: 'earlier' as const, label: 'Earlier', count: grouped.earlier.length },
  ]

  return (
    <>
      <div className="erp-detail-scrim fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <aside
        className="erp-detail-panel fixed right-0 top-0 z-50 flex h-screen w-full max-w-[400px] flex-col border-l border-erp-border bg-erp-surface shadow-erp-lg"
        role="dialog"
        aria-label="Notifications"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-erp-border px-4 py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-erp-primary-soft text-erp-primary">
              <Bell className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold leading-tight text-erp-text">Notifications</h2>
              <p className="text-[11px] text-erp-muted">
                {counts.unread === 0
                  ? 'You are all caught up'
                  : `${counts.unread > 99 ? '99+' : counts.unread} unread`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-erp-muted transition-colors hover:bg-erp-surface-alt hover:text-erp-text"
            aria-label="Close notifications"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Segmented filter */}
        <div className="border-b border-erp-border px-3 py-2.5">
          <div className="flex rounded-lg bg-erp-surface-alt p-0.5" role="tablist">
            {tabs.map((tab) => {
              const active = section === tab.id
              const danger = tab.id === 'critical' && tab.count > 0
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSection(tab.id)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] font-semibold transition-all',
                    active
                      ? 'bg-erp-surface text-erp-text shadow-sm ring-1 ring-erp-border/80'
                      : 'text-erp-muted hover:text-erp-text',
                  )}
                >
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      'min-w-[1.25rem] rounded-full px-1.5 py-px text-center text-[10px] font-bold tabular-nums',
                      active && danger
                        ? 'bg-erp-danger-soft text-erp-danger-fg'
                        : active
                          ? 'bg-erp-primary-soft text-erp-primary'
                          : 'bg-erp-surface text-erp-muted',
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* List */}
        <ul className="flex-1 overflow-y-auto overscroll-contain">
          {loading && (
            <li className="px-4 py-10 text-center text-[13px] text-erp-muted">Loading…</li>
          )}
          {error && !loading && (
            <li className="px-4 py-10 text-center text-[13px] text-erp-danger-fg">
              {error}
              <button
                type="button"
                className="mt-2 block w-full text-[12px] font-semibold text-erp-primary underline"
                onClick={() => void refresh()}
              >
                Retry
              </button>
            </li>
          )}
          {!loading && !error && list.length === 0 && (
            <li className="flex flex-col items-center px-6 py-14 text-center">
              <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-erp-success-soft text-erp-success-fg">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <p className="text-[13px] font-semibold text-erp-text">All clear</p>
              <p className="mt-1 text-[12px] text-erp-muted">Nothing needs attention right now.</p>
            </li>
          )}
          {list.slice(0, 12).map((n) => {
            const unread = n.status === 'UNREAD'
            return (
              <li key={n.id} className="border-b border-erp-border/80 last:border-b-0">
                <article
                  className={cn(
                    'relative px-4 py-3.5 transition-colors',
                    unread ? 'bg-erp-primary-soft/25' : 'bg-erp-surface',
                    'hover:bg-erp-surface-alt/80',
                  )}
                >
                  {unread ? (
                    <span
                      className="absolute inset-y-3 left-0 w-0.5 rounded-r bg-erp-primary"
                      aria-hidden
                    />
                  ) : null}

                  <div className="flex gap-3">
                    <div className="pt-1.5">
                      <TrafficLight status={priorityTone(n.priority)} />
                    </div>

                    <div className="min-w-0 flex-1">
                      {/* Title row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h3
                              className={cn(
                                'truncate text-[13px] leading-snug text-erp-text',
                                unread ? 'font-semibold' : 'font-medium',
                              )}
                            >
                              {n.title}
                            </h3>
                          </div>
                          <p className="mt-0.5 text-[10.5px] font-medium uppercase tracking-wide text-erp-muted">
                            {categoryShort(n.category)}
                          </p>
                        </div>
                        {n.priority !== 'NORMAL' && n.priority !== 'LOW' ? (
                          <span
                            className={cn(
                              'shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset',
                              priorityBadgeClass(n.priority),
                            )}
                          >
                            {priorityLabel(n.priority)}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-2">
                        <ApiNotificationBody n={n} />
                      </div>

                      <p className="mt-2 flex items-center gap-1 text-[11px] text-erp-muted">
                        <Clock className="h-3 w-3 shrink-0 opacity-70" />
                        <span>{formatRelativeTime(n.createdAt)}</span>
                      </p>

                      {/* Actions */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-1 border-t border-erp-border/60 pt-2">
                        {n.actionUrl ? (
                          <button
                            type="button"
                            className="inline-flex h-7 items-center gap-1 rounded-md bg-erp-primary px-2.5 text-[11px] font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
                            onClick={() => {
                              void markRead(n.id)
                              onClose()
                              navigate(n.actionUrl!)
                            }}
                          >
                            <ExternalLink className="h-3 w-3 opacity-90" />
                            {n.primaryAction === 'REVIEW' ? 'Review' : 'Open'}
                          </button>
                        ) : null}
                        {unread ? (
                          <ActionGhostBtn icon={Check} onClick={() => void markRead(n.id)}>
                            Read
                          </ActionGhostBtn>
                        ) : null}
                        <ActionGhostBtn icon={Timer} onClick={() => void snooze(n.id, 60)}>
                          Snooze
                        </ActionGhostBtn>
                        <ActionGhostBtn icon={CheckCircle2} onClick={() => void resolve(n.id)}>
                          Done
                        </ActionGhostBtn>
                      </div>
                    </div>
                  </div>
                </article>
              </li>
            )
          })}
        </ul>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-erp-border bg-erp-surface-alt/40 px-4 py-3">
          <button
            type="button"
            className="text-[12px] font-semibold text-erp-primary hover:underline"
            onClick={() => void markAllRead()}
          >
            Mark all read
          </button>
          <div className="flex items-center gap-1">
            <Link
              to="/notifications/settings"
              onClick={onClose}
              className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[12px] font-medium text-erp-muted transition-colors hover:bg-erp-surface hover:text-erp-text"
            >
              <Settings className="h-3.5 w-3.5" />
              Settings
            </Link>
            <Link
              to="/notifications"
              onClick={onClose}
              className="inline-flex h-8 items-center rounded-md bg-erp-surface px-2.5 text-[12px] font-semibold text-erp-primary shadow-sm ring-1 ring-erp-border transition-colors hover:bg-erp-primary-soft"
            >
              View all
            </Link>
          </div>
        </div>
      </aside>
    </>
  )
}

/** Legacy demo panel (purchase/production derived alerts). */
function DemoNotificationPanel({ onClose }: { onClose: () => void }) {
  const readIds = useUIStore((s) => s.notificationReadIds)
  const snoozedUntil = useUIStore((s) => s.notificationSnoozedUntil)
  const markRead = useUIStore((s) => s.markNotificationRead)
  const snooze = useUIStore((s) => s.snoozeNotification)
  const allNotifications = useNotifications()
  const [activeGroup, setActiveGroup] = useState<string>('all')

  const notifications = useMemo(() => {
    const now = Date.now()
    return allNotifications.filter((n) => {
      if (readIds.includes(n.id)) return false
      const until = snoozedUntil[n.id]
      if (until && Date.parse(until) > now) return false
      if (activeGroup !== 'all' && n.group !== activeGroup) return false
      return true
    })
  }, [allNotifications, readIds, snoozedUntil, activeGroup])

  const summary = useMemo(() => {
    const counts = { shortage: 0, qc: 0, approval: 0, delay: 0, wo: 0 }
    for (const n of notifications) {
      if (n.type in counts) counts[n.type as keyof typeof counts] += 1
    }
    return counts
  }, [notifications])

  function snoozeOne(id: string) {
    const until = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    snooze(id, until)
  }

  return (
    <>
      <div className="erp-detail-scrim fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <aside className="erp-detail-panel fixed right-0 top-0 z-50 flex h-screen w-full max-w-[400px] flex-col border-l border-erp-border bg-erp-surface shadow-erp-lg">
        <div className="flex items-center justify-between gap-3 border-b border-erp-border px-4 py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-erp-primary-soft text-erp-primary">
              <Bell className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold leading-tight text-erp-text">Notifications</h2>
              <p className="text-[11px] text-erp-muted">
                {notifications.length === 0
                  ? 'You are all caught up'
                  : `${notifications.length} open`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-erp-muted transition-colors hover:bg-erp-surface-alt hover:text-erp-text"
            aria-label="Close notifications"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-1 border-b border-erp-border px-3 py-2">
          {GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setActiveGroup(g.id)}
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors',
                activeGroup === g.id
                  ? 'bg-erp-primary text-white'
                  : 'bg-erp-surface-alt text-erp-muted hover:text-erp-text',
              )}
            >
              {g.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 border-b border-erp-border bg-erp-surface-alt/40 p-3">
          {SUMMARY_GROUPS.map((group) => {
            const Icon = group.icon
            const count = summary[group.key]
            return (
              <div
                key={group.key}
                className={cn(
                  'flex items-center gap-2 rounded-lg border border-transparent px-3 py-2',
                  group.softClass,
                  count === 0 && 'opacity-60',
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0', group.labelClass)} />
                <div className="min-w-0">
                  <p className={cn('truncate text-[10px] font-bold uppercase tracking-wide', group.labelClass)}>
                    {group.label}
                  </p>
                  <p className={cn('text-[18px] font-bold tabular-nums leading-none', group.labelClass)}>{count}</p>
                </div>
              </div>
            )
          })}
        </div>

        <ul className="flex-1 overflow-y-auto divide-y divide-erp-border/80">
          {notifications.length === 0 && (
            <li className="flex flex-col items-center px-6 py-14 text-center">
              <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-erp-success-soft text-erp-success-fg">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <p className="text-[13px] font-semibold text-erp-text">All clear</p>
              <p className="mt-1 text-[12px] text-erp-muted">Nothing needs attention right now.</p>
            </li>
          )}
          {notifications.map((n) => (
            <li key={n.id}>
              <div className="flex gap-3 px-4 py-3.5 hover:bg-erp-surface-alt/80">
                <div className="pt-1.5">
                  <TrafficLight status={n.severity} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold leading-snug text-erp-text">{n.title}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-erp-muted">{n.description}</p>
                  <p className="mt-2 flex items-center gap-1 text-[11px] text-erp-muted">
                    <Clock className="h-3 w-3 opacity-70" />
                    {formatRelativeTime(n.createdAt)}
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1 border-t border-erp-border/60 pt-2">
                    {n.href && (
                      <Link
                        to={n.href}
                        onClick={() => {
                          markRead(n.id)
                          onClose()
                        }}
                        className="inline-flex h-7 items-center gap-1 rounded-md bg-erp-primary px-2.5 text-[11px] font-semibold text-white"
                      >
                        <ExternalLink className="h-3 w-3 opacity-90" />
                        {n.actionLabel ?? 'Open'}
                      </Link>
                    )}
                    <ActionGhostBtn icon={Check} onClick={() => markRead(n.id)}>
                      Read
                    </ActionGhostBtn>
                    <ActionGhostBtn icon={Timer} onClick={() => snoozeOne(n.id)}>
                      Snooze
                    </ActionGhostBtn>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </aside>
    </>
  )
}

export function NotificationPanel() {
  const open = useUIStore((s) => s.notificationsOpen)
  const setOpen = useUIStore((s) => s.setNotificationsOpen)
  const apiMode = useApiMode()
  if (!open) return null
  if (apiMode) return <ApiNotificationPanel onClose={() => setOpen(false)} />
  return <DemoNotificationPanel onClose={() => setOpen(false)} />
}

export function NotificationBell({ className }: { className?: string }) {
  const setOpen = useUIStore((s) => s.setNotificationsOpen)
  const apiMode = useApiMode()
  const app = useAppNotifications({ enabled: apiMode })
  const readIds = useUIStore((s) => s.notificationReadIds)
  const snoozedUntil = useUIStore((s) => s.notificationSnoozedUntil)
  const demoNotifications = useNotifications()

  const count = useMemo(() => {
    if (apiMode) return app.counts.unread
    const now = Date.now()
    return demoNotifications.filter((n) => {
      if (readIds.includes(n.id)) return false
      const until = snoozedUntil[n.id]
      if (until && Date.parse(until) > now) return false
      return true
    }).length
  }, [apiMode, app.counts.unread, demoNotifications, readIds, snoozedUntil])

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        'relative flex h-9 w-9 items-center justify-center rounded-lg border border-erp-border bg-erp-surface text-erp-muted shadow-sm transition-all hover:border-erp-primary/30 hover:bg-erp-primary-soft hover:text-erp-primary hover:shadow-erp',
        className,
      )}
      aria-label="Notifications"
    >
      <Bell className="h-4 w-4" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-erp-danger px-1 text-[10px] font-bold text-white">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  )
}
