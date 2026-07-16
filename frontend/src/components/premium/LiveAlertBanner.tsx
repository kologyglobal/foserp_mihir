import { AlertTriangle } from 'lucide-react'
import { cn } from '../../utils/cn'
import type { LiveAlert } from '../live-erp/types'

export function LiveAlertBanner({
  alerts,
  className,
}: {
  alerts: LiveAlert[]
  className?: string
}) {
  if (alerts.length === 0) return null
  const top = alerts[0]
  const tone =
    top.severity === 'critical' || top.severity === 'high'
      ? 'border-erp-danger bg-erp-danger-soft'
      : top.severity === 'medium'
        ? 'border-erp-warning bg-erp-warning-soft'
        : 'border-erp-accent bg-erp-accent-soft'
  return (
    <div className={cn('flex items-center gap-3 rounded-md border px-4 py-2.5', tone, className)}>
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-erp-text">{top.message}</p>
        {top.documentRef && <p className="text-xs text-erp-muted">{top.documentRef}</p>}
      </div>
      {alerts.length > 1 && <span className="text-xs font-semibold text-erp-muted">+{alerts.length - 1}</span>}
    </div>
  )
}
