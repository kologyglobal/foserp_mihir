import { cn } from '../../utils/cn'
import { EnterpriseKpiCard } from './EnterpriseKpiCard'
import type { EnterpriseKpiItem } from './enterpriseKpiTypes'

export type { EnterpriseKpiItem, EnterpriseKpiTrend, EnterpriseKpiTrendInfo } from './enterpriseKpiTypes'

export function EnterpriseKpiStrip({
  items,
  columns,
  className,
  animateValues = true,
}: {
  items: EnterpriseKpiItem[]
  columns?: number
  className?: string
  animateValues?: boolean
}) {
  if (items.length === 0) return null
  return (
    <div
      className={cn('ent-kpi-strip', className)}
      style={columns ? { '--ent-kpi-columns': columns } as React.CSSProperties : undefined}
      role="group"
      aria-label="Summary metrics"
    >
      {items.map((item) => (
        <EnterpriseKpiCard key={item.id} item={item} animateValue={animateValues} />
      ))}
    </div>
  )
}
