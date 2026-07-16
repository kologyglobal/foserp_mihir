import { Link } from 'react-router-dom'
import { Radio } from 'lucide-react'
import { useLiveActivityMock } from '../../hooks/useLiveActivityMock'

/** Subtle live ticker — simulated events only, no store mutations */
export function LiveActivityTicker() {
  const events = useLiveActivityMock(true, 1)
  const event = events[0]
  if (!event) return null

  return (
    <div className="border-b border-erp-border bg-erp-surface-alt/60 px-4 py-1.5">
      <div className="mx-auto flex max-w-[1600px] items-center gap-2 text-xs text-erp-muted">
        <Radio className="h-3 w-3 shrink-0 animate-pulse text-erp-primary" aria-hidden />
        <span className="font-semibold uppercase tracking-wide text-erp-primary">Live</span>
        {event.href ? (
          <Link to={event.href} className="truncate hover:text-erp-text hover:underline">
            {event.action}
          </Link>
        ) : (
          <span className="truncate">{event.action}</span>
        )}
      </div>
    </div>
  )
}
