import { Link } from 'react-router-dom'
import { Radio } from 'lucide-react'
import { useLiveFactoryPulse } from '../../hooks/useLiveFactoryPulse'

export function SaaSActivityFeed({ minEvents = 10 }: { minEvents?: number }) {
  const { events, lastUpdated } = useLiveFactoryPulse(minEvents)
  const time = new Date(lastUpdated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

  return (
    <section className="saas-panel">
      <div className="saas-panel-header">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-[var(--saas-accent)]" />
          <h3 className="saas-panel-title">Factory pulse</h3>
        </div>
        <span className="text-[0.6875rem] text-[var(--saas-muted)]">Updated {time}</span>
      </div>
      <div className="max-h-80 overflow-y-auto py-1">
        {events.map((e) => (
          <div key={e.id} className="saas-activity-row">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--saas-live)] shadow-[0_0_6px_var(--saas-live)]" />
            <div className="min-w-0 flex-1">
              {e.href ? (
                <Link to={e.href} className="text-sm font-medium text-[var(--saas-text)] hover:text-[var(--saas-primary)]">
                  {e.action}
                </Link>
              ) : (
                <p className="text-sm font-medium text-[var(--saas-text)]">{e.action}</p>
              )}
              {e.documentRef && <p className="saas-doc-no mt-0.5">{e.documentRef}</p>}
            </div>
            <span className="shrink-0 text-[0.6875rem] tabular-nums text-[var(--saas-muted)]">
              {e.timestamp?.slice(11, 16)}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
