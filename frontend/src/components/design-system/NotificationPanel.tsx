import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Bell, CheckCircle2, Clock, PackageX, Truck, X } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { useNotifications } from '../../utils/workspaceMetrics'
import { TrafficLight } from './TrafficLight'
import { cn } from '../../utils/cn'
import { formatRelativeTime } from '../../utils/dates/format'
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

export function NotificationPanel() {
  const open = useUIStore((s) => s.notificationsOpen)
  const setOpen = useUIStore((s) => s.setNotificationsOpen)
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

  if (!open) return null

  function snoozeOne(id: string) {
    const until = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    snooze(id, until)
  }

  return (
    <>
      <div className="erp-detail-scrim fixed inset-0 z-40 bg-black/20" onClick={() => setOpen(false)} />
      <aside className="erp-detail-panel fixed right-0 top-0 z-50 flex h-screen w-full max-w-md flex-col border-l border-erp-border bg-erp-surface shadow-erp-lg">
        <div className="flex items-center justify-between border-b border-erp-border bg-gradient-to-r from-erp-surface-alt/80 to-erp-surface px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-erp-primary" />
            <h2 className="text-[15px] font-semibold">Notification Center</h2>
            <span className="rounded-full bg-erp-primary-soft px-2 py-0.5 text-[11px] font-semibold text-erp-primary transition-all">
              {notifications.length}
            </span>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="rounded p-1 hover:bg-erp-surface-alt">
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
                  'flex items-center gap-2 rounded-lg border border-transparent px-3 py-2 transition-shadow hover:shadow-erp',
                  group.softClass,
                  count === 0 && 'opacity-60',
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0', group.labelClass)} />
                <div className="min-w-0">
                  <p className={cn('truncate text-[10px] font-bold uppercase tracking-wide opacity-90', group.labelClass)}>{group.label}</p>
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
            <li key={n.id} className="group">
              <div className="flex gap-3 px-4 py-3 transition-colors hover:bg-erp-surface-alt">
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
                        onClick={() => { markRead(n.id); setOpen(false) }}
                        className="rounded-md bg-erp-primary px-2 py-1 text-[11px] font-semibold text-white hover:opacity-90"
                      >
                        {n.actionLabel ?? 'Open'}
                      </Link>
                    )}
                    <button type="button" onClick={() => markRead(n.id)} className="text-[11px] font-medium text-erp-muted hover:text-erp-text">
                      Mark read
                    </button>
                    <button type="button" onClick={() => snoozeOne(n.id)} className="text-[11px] font-medium text-erp-muted hover:text-erp-text">
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

export function NotificationBell({ className }: { className?: string }) {
  const setOpen = useUIStore((s) => s.setNotificationsOpen)
  const readIds = useUIStore((s) => s.notificationReadIds)
  const snoozedUntil = useUIStore((s) => s.notificationSnoozedUntil)
  const notifications = useNotifications()
  const count = useMemo(() => {
    const now = Date.now()
    return notifications.filter((n) => {
      if (readIds.includes(n.id)) return false
      const until = snoozedUntil[n.id]
      if (until && Date.parse(until) > now) return false
      return true
    }).length
  }, [notifications, readIds, snoozedUntil])

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
        <span className={cn(
          'absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-erp-danger px-1 text-[10px] font-bold text-white transition-transform',
        )}>
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  )
}
