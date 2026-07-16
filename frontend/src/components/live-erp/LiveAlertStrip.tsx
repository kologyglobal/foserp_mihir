import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Bell, ChevronRight, X } from 'lucide-react'
import { cn } from '../../utils/cn'
import type { LiveAlert, LiveAlertSeverity } from './types'

const SEVERITY_STYLES: Record<LiveAlertSeverity, string> = {
  critical: 'border-erp-danger/40 bg-erp-danger/5 text-erp-danger',
  high: 'border-erp-warning/40 bg-erp-warning/5 text-erp-warning',
  medium: 'border-erp-primary/30 bg-erp-primary-soft/50 text-erp-primary',
  low: 'border-erp-border bg-erp-surface-alt text-erp-muted',
}

type Props = {
  alerts: LiveAlert[]
  className?: string
}

export function LiveAlertStrip({ alerts, className }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [snoozed, setSnoozed] = useState<Set<string>>(new Set())

  const visible = alerts.filter((a) => !dismissed.has(a.id) && !snoozed.has(a.id))
  if (visible.length === 0) return null

  return (
    <div className={cn('space-y-2', className)}>
      {visible.slice(0, 4).map((alert) => (
        <div
          key={alert.id}
          className={cn(
            'flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-shadow hover:shadow-erp',
            SEVERITY_STYLES[alert.severity],
          )}
        >
          <AlertTriangle className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-medium leading-snug">{alert.message}</p>
            {alert.documentRef && (
              <p className="text-xs opacity-80">{alert.documentRef}</p>
            )}
          </div>
          {alert.href && alert.actionLabel && (
            <Link
              to={alert.href}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-current/20 bg-white/60 px-2 py-1 text-xs font-semibold hover:bg-white"
            >
              {alert.actionLabel}
              <ChevronRight className="h-3 w-3" />
            </Link>
          )}
          <button
            type="button"
            title="Snooze"
            className="rounded p-1 opacity-60 hover:opacity-100"
            onClick={() => setSnoozed((s) => new Set(s).add(alert.id))}
          >
            <Bell className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Dismiss"
            className="rounded p-1 opacity-60 hover:opacity-100"
            onClick={() => setDismissed((s) => new Set(s).add(alert.id))}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      {visible.length > 4 && (
        <p className="text-xs text-erp-muted">+{visible.length - 4} more alerts</p>
      )}
    </div>
  )
}
