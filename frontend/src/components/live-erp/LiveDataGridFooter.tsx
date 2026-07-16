import { RefreshCw } from 'lucide-react'
import { formatRelativeTime } from '../../utils/dates/format'
type Props = {
  lastRefreshedAt: Date | number
  onRefresh?: () => void
  recordCount?: number
}

export function LiveDataGridFooter({ lastRefreshedAt, onRefresh, recordCount }: Props) {
  const ts = typeof lastRefreshedAt === 'number' ? lastRefreshedAt : lastRefreshedAt.getTime()
  return (
    <span className="inline-flex items-center gap-2 text-xs text-erp-muted">
      {recordCount != null && <span>{recordCount} records</span>}
      <span>Last updated {formatRelativeTime(new Date(ts).toISOString())}</span>
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-erp-surface-alt hover:text-erp-text"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      )}
    </span>
  )
}
