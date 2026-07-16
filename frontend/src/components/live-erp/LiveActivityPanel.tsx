import { useNavigate } from 'react-router-dom'
import {
  Activity,
  CheckCircle2,
  Package,
  QrCode,
  RefreshCw,
  ShieldAlert,
  Truck,
} from 'lucide-react'
import { formatDate } from '../../utils/dates/format'
import { cn } from '../../utils/cn'
import type { LiveActivityEvent } from './types'

const ICONS = {
  material: Package,
  qc: ShieldAlert,
  rework: RefreshCw,
  approval: CheckCircle2,
  qr: QrCode,
  dispatch: Truck,
  payment: CheckCircle2,
  general: Activity,
}

type Props = {
  events: LiveActivityEvent[]
  title?: string
  maxItems?: number
  className?: string
  onItemClick?: (event: LiveActivityEvent) => void
}

export function LiveActivityPanel({ events, title = 'Recent Activity', maxItems = 8, className, onItemClick }: Props) {
  const navigate = useNavigate()

  if (events.length === 0) return null

  const handleClick = (ev: LiveActivityEvent) => {
    if (onItemClick) {
      onItemClick(ev)
      return
    }
    if (ev.href) navigate(ev.href)
  }

  return (
    <div className={cn('rounded-lg border border-erp-border bg-white', className)}>
      {title ? (
        <div className="border-b border-erp-border px-4 py-2.5">
          <h3 className="text-sm font-semibold text-erp-text">{title}</h3>
        </div>
      ) : null}
      <ul className="divide-y divide-erp-border">
        {events.slice(0, maxItems).map((ev) => {
          const Icon = ICONS[ev.icon ?? 'general']
          const inner = (
            <div className="flex gap-3 px-4 py-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-erp-surface-alt">
                <Icon className="h-4 w-4 text-erp-muted" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-erp-text">
                  {ev.action}
                  {ev.simulated && (
                    <span className="ml-2 rounded bg-erp-surface-alt px-1.5 py-0.5 text-[10px] font-medium text-erp-muted">
                      Live
                    </span>
                  )}
                </p>
                <p className="text-xs text-erp-muted">
                  {ev.user ? `${ev.user} · ` : ''}
                  {formatDate(ev.timestamp.slice(0, 10))}
                  {ev.documentRef ? ` · ${ev.documentRef}` : ''}
                </p>
              </div>
            </div>
          )
          const clickable = ev.href || ev.quickView || onItemClick
          return (
            <li key={ev.id}>
              {clickable ? (
                <button
                  type="button"
                  className="block w-full text-left transition-colors hover:bg-erp-surface-alt/60"
                  onClick={() => handleClick(ev)}
                >
                  {inner}
                </button>
              ) : (
                inner
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
