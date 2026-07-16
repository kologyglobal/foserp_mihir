import type { LucideIcon } from 'lucide-react'
import { PremiumKpiCard } from './PremiumKpiCard'
import type { PremiumKpiProps } from './types'

/** KPI card with emphasized trend sparkline label */
export function MetricTrendCard(props: PremiumKpiProps & { sparkLabel?: string; icon?: LucideIcon }) {
  return (
    <PremiumKpiCard
      {...props}
      helper={props.sparkLabel ? `${props.helper ?? ''} · ${props.sparkLabel}`.trim().replace(/^·\s*/, '') : props.helper}
    />
  )
}
