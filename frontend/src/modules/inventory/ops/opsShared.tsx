import type { StockHealthStatus } from '@/types/operationalStockViews'
import { cn } from '@/utils/cn'

export function stockStatusLabel(status: StockHealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'Healthy'
    case 'low':
      return 'Low'
    case 'out':
      return 'Out'
    case 'negative':
      return 'Negative'
    case 'overstock':
      return 'Overstock'
    default:
      return status
  }
}

export function stockStatusClass(status: StockHealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'ops-status ops-status--healthy'
    case 'low':
      return 'ops-status ops-status--low'
    case 'out':
      return 'ops-status ops-status--out'
    case 'negative':
      return 'ops-status ops-status--negative'
    case 'overstock':
      return 'ops-status ops-status--overstock'
    default:
      return 'ops-status'
  }
}

export function StockStatusBadge({ status }: { status: StockHealthStatus }) {
  return (
    <span className={cn(stockStatusClass(status))}>
      {stockStatusLabel(status)}
    </span>
  )
}

export function OpsMetric({ label, value, mono }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="ops-summary-card__metric">
      <span className="ops-summary-card__metric-label">{label}</span>
      <span className={cn('ops-summary-card__metric-value', mono && 'font-mono tabular-nums')}>{value}</span>
    </div>
  )
}
