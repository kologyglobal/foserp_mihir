import { cn } from '../../utils/cn'

export function MetricTrendBadge({ trend, up = true }: { trend: string; up?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
        up ? 'bg-erp-success-soft text-erp-success' : 'bg-erp-danger-soft text-erp-danger',
      )}
    >
      {trend}
    </span>
  )
}
