import { cn } from '../../utils/cn'

export function RiskMeter({
  label,
  value,
  max = 100,
  level,
}: {
  label: string
  value: number
  max?: number
  level?: 'low' | 'medium' | 'high'
}) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  const inferred: 'low' | 'medium' | 'high' =
    level ?? (pct >= 70 ? 'high' : pct >= 40 ? 'medium' : 'low')
  const barColor =
    inferred === 'high' ? 'bg-erp-danger' : inferred === 'medium' ? 'bg-erp-warning' : 'bg-erp-success'

  return (
    <div className="rounded-md border border-erp-border bg-erp-surface p-3">
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-medium text-erp-text">{label}</span>
        <span className="tabular-nums text-erp-muted">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-erp-border">
        <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
