import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  PackageX,
  Settings,
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

function priorityTone(p: string): 'red' | 'amber' | 'green' | 'grey' {
  if (p === 'CRITICAL') return 'red'
  if (p === 'HIGH') return 'amber'
  if (p === 'POSITIVE') return 'green'
  return 'grey'
}

function metaStr(m: Record<string, unknown> | null | undefined, key: string): string | null {
  if (!m) return null
  const v = m[key]
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function NotificationDetail({ n }: { n: AppNotification }) {
  const meta = n.metadata
  const contact = metaStr(meta, 'contactName')
  const company = metaStr(meta, 'companyName')
  const dueTime = metaStr(meta, 'dueTime')
  const notes = metaStr(meta, 'notesSnippet')
  const recordCode = metaStr(meta, 'recordCode') ?? n.entityCode
  const recordName = n.entityName ?? company

  const chips = [
    recordCode && recordName && recordName !== recordCode
      ? `${recordCode} · ${recordName}`
      : recordCode || recordName,
    contact && contact !== recordName ? `Contact: ${contact}` : null,
    dueTime ? `Time: ${dueTime}` : null,
  ].filter(Boolean) as string[]

  // Message already includes rich context; avoid duplicating the full chips block when empty.
  return (
    <div className="min-w-0">
      <p className="text-[12px] leading-snug text-erp-muted">{n.message}</p>
      {notes && !n.message.includes(notes) ? (
        <p className="mt-0.5 line-clamp-2 text-[11px] italic text-erp-muted">{notes}</p>
      ) : null}
      {chips.length > 0 && !n.message.includes(String(chips[0])) ? (
        <p className="mt-1 text-[11px] font-medium text-erp-text">{chips.join(' · ')}</p>
      ) : null}
    </div>
  )
}

function ApiNotificationPanel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const { recent, counts, loading, error, markRead, markAllRead, resolve, snooze, refresh } =
    useAppNotifications()
  const [section, setSection] = useState<'critical' | 'today' | 'earlier'>('today')

  const grouped = useMemo(() => {
    const now = Date.now()
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

  return (
    <>
      <div className="erp-detail-scrim fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <aside className="erp-detail-panel fixed right-0 top-0 z-50 flex h-screen w-full max-w-md flex-col border-l border-erp-border bg-erp-surface shadow-erp-lg">
        <div className="flex items-center justify-between border-b border-erp-border bg-gradient-to-r from-erp-surface-alt/80 to-erp-surface px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-erp-primary" />
            <h2 className="text-[15px] font-semibold">Notifications</h2>
            <span className="rounded-full bg-erp-primary-soft px-2 py-0.5 text-[11px] font-semibold text-erp-primary">
              {counts.unread > 99 ? '99+' : counts.unread}
            </span>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-erp-surface-alt">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 border-b border-erp-border p-3">
          {(
            [
              { id: 'critical' as const, label: 'Critical', count: counts.critical },
              { id: 'today' as const, label: 'Today', count: grouped.today.length },
              { id: 'earlier' as const, label: 'Earlier', count: grouped.earlier.length },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSection(tab.id)}
              className={cn(
                'rounded-lg border px-2 py-2 text-center transition-colors',
                section === tab.id
                  ? 'border-erp-primary bg-erp-primary-soft text-erp-primary'
                  : 'border-erp-border bg-erp-surface-alt text-erp-muted',
              )}
            >
              <p className="text-[10px] font-bold uppercase tracking-wide">{tab.label}</p>
              <p className="text-[16px] font-bold tabular-nums">{tab.count}</p>
            </button>
          ))}
        </div>

        <ul className="flex-1 overflow-y-auto divide-y divide-erp-border">
          {loading && (
            <li className="px-4 py-8 text-center text-[13px] text-erp-muted">Loading…</li>
          )}
          {error && !loading && (
            <li className="px-4 py-8 text-center text-[13px] text-erp-danger-fg">
              {error}
              <button type="button" className="mt-2 block w-full text-erp-primary underline" onClick={() => void refresh()}>
                Retry
              </button>
            </li>
          )}
          {!loading && !error && list.length === 0 && (
            <li className="px-4 py-12 text-center text-[13px] text-erp-muted">
              All clear — nothing needs attention
            </li>
          )}
          {list.slice(0, 10).map((n) => (
            <li key={n.id}>
              <div className="flex gap-3 px-4 py-3 hover:bg-erp-surface-alt">
                <TrafficLight status={priorityTone(n.priority)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] font-semibold text-erp-text">{n.title}</p>
                    <span className="shrink-0 text-[10px] font-bold uppercase text-erp-muted">
                      {n.priority}
                    </span>
                  </div>
                  <div className="mt-0.5">
                    <NotificationDetail n={n} />
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-[10px] text-erp-muted">
                    <Clock className="h-3 w-3" />
                    {formatRelativeTime(n.createdAt)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {n.actionUrl && (
                      <button
                        type="button"
                        className="rounded-md bg-erp-primary px-2 py-1 text-[11px] font-semibold text-white hover:opacity-90"
                        onClick={() => {
                          void markRead(n.id)
                          onClose()
                          navigate(n.actionUrl!)
                        }}
                      >
                        {n.primaryAction === 'REVIEW' ? 'Review' : 'Open'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void markRead(n.id)}
                      className="text-[11px] font-medium text-erp-muted hover:text-erp-text"
                    >
                      Mark read
                    </button>
                    <button
                      type="button"
                      onClick={() => void snooze(n.id, 60)}
                      className="text-[11px] font-medium text-erp-muted hover:text-erp-text"
                    >
                      Snooze 1h
                    </button>
                    <button
                      type="button"
                      onClick={() => void resolve(n.id)}
                      className="text-[11px] font-medium text-erp-muted hover:text-erp-text"
                    >
                      Resolve
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-erp-border px-4 py-3">
          <button
            type="button"
            className="text-[12px] font-semibold text-erp-primary hover:underline"
            onClick={() => void markAllRead()}
          >
            Mark all as read
          </button>
          <div className="flex items-center gap-3">
            <Link
              to="/notifications/settings"
              onClick={onClose}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-erp-muted hover:text-erp-text"
            >
              <Settings className="h-3.5 w-3.5" />
              Settings
            </Link>
            <Link
              to="/notifications"
              onClick={onClose}
              className="text-[12px] font-semibold text-erp-primary hover:underline"
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
      <aside className="erp-detail-panel fixed right-0 top-0 z-50 flex h-screen w-full max-w-md flex-col border-l border-erp-border bg-erp-surface shadow-erp-lg">
        <div className="flex items-center justify-between border-b border-erp-border bg-gradient-to-r from-erp-surface-alt/80 to-erp-surface px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-erp-primary" />
            <h2 className="text-[15px] font-semibold">Notification Center</h2>
            <span className="rounded-full bg-erp-primary-soft px-2 py-0.5 text-[11px] font-semibold text-erp-primary">
              {notifications.length}
            </span>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-erp-surface-alt">
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
                activeGroup === g.id ? 'bg-erp-primary text-white' : 'bg-erp-surface-alt text-erp-muted hover:text-erp-text',
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

        <ul className="flex-1 overflow-y-auto divide-y divide-erp-border">
          {notifications.length === 0 && (
            <li className="px-4 py-12 text-center text-[13px] text-erp-muted">All clear — nothing needs attention</li>
          )}
          {notifications.map((n) => (
            <li key={n.id}>
              <div className="flex gap-3 px-4 py-3 hover:bg-erp-surface-alt">
                <TrafficLight status={n.severity} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-erp-text">{n.title}</p>
                  <p className="text-[12px] text-erp-muted">{n.description}</p>
                  <p className="mt-1 flex items-center gap-1 text-[10px] text-erp-muted">
                    <Clock className="h-3 w-3" />
                    {formatRelativeTime(n.createdAt)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {n.href && (
                      <Link
                        to={n.href}
                        onClick={() => {
                          markRead(n.id)
                          onClose()
                        }}
                        className="rounded-md bg-erp-primary px-2 py-1 text-[11px] font-semibold text-white"
                      >
                        {n.actionLabel ?? 'Open'}
                      </Link>
                    )}
                    <button type="button" onClick={() => markRead(n.id)} className="text-[11px] font-medium text-erp-muted">
                      Mark read
                    </button>
                    <button type="button" onClick={() => snoozeOne(n.id)} className="text-[11px] font-medium text-erp-muted">
                      Snooze 1h
                    </button>
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
