import { Link } from 'react-router-dom'
import { getUnifiedInboxData } from '../../utils/controlTowerMetrics'

export function ApprovalMiniPanel({ limit = 4 }: { limit?: number }) {
  const { approvals } = getUnifiedInboxData()
  const items = approvals.slice(0, limit)
  if (items.length === 0) return null
  return (
    <div className="rounded-md border border-erp-border bg-erp-surface p-3">
      <p className="text-xs font-semibold text-erp-muted">Approvals ({approvals.length})</p>
      <ul className="mt-2 space-y-2">
        {items.map((a) => (
          <li key={a.id}>
            <Link to={a.href} className="text-sm font-medium text-erp-primary hover:underline">
              {a.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
