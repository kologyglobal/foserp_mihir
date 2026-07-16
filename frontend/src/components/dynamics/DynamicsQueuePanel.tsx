import { Link } from 'react-router-dom'
import { DynamicsDashboardPanel } from './DynamicsDashboardPanel'
import { DynamicsStatusChip } from './DynamicsStatusChip'

export function DynamicsQueuePanel({
  title,
  items,
  emptyMessage = 'Queue clear',
}: {
  title: string
  items: { id: string; label: string; meta?: string; severity?: 'success' | 'warning' | 'critical' | 'info' | 'neutral'; href?: string }[]
  emptyMessage?: string
}) {
  return (
    <DynamicsDashboardPanel title={title}>
      <ul className="dyn-queue-list">
        {items.length === 0 ? (
          <li className="dyn-queue-empty">{emptyMessage}</li>
        ) : (
          items.map((item) => (
            <li key={item.id} className="dyn-queue-item">
              <div className="min-w-0 flex-1">
                {item.href ? (
                  <Link to={item.href} className="dyn-queue-label">
                    {item.label}
                  </Link>
                ) : (
                  <span className="dyn-queue-label">{item.label}</span>
                )}
                {item.meta && <p className="dyn-queue-meta">{item.meta}</p>}
              </div>
              {item.severity && <DynamicsStatusChip label={item.severity} tone={item.severity} />}
            </li>
          ))
        )}
      </ul>
    </DynamicsDashboardPanel>
  )
}
