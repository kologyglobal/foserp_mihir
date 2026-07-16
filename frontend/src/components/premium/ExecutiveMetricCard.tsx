import { PremiumKpiCard } from './PremiumKpiCard'
import type { PremiumKpiProps } from './types'

/** Executive-grade KPI tile — alias of PremiumKpiCard with executive defaults */
export function ExecutiveMetricCard(props: PremiumKpiProps) {
  return <PremiumKpiCard {...props} accent={props.accent ?? 'blue'} />
}
