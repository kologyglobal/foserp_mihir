import { DynamicsKpiRow, DynamicsKpiTile } from '../dynamics/DynamicsKpiTile'
import type { SaaSKpiCardProps } from './SaaSKpiCard'

/** Dynamics-style horizontal KPI metric strip */
export function DynamicsMetricStrip({ metrics }: { metrics: SaaSKpiCardProps[] }) {
  return (
    <DynamicsKpiRow>
      {metrics.map((m) => (
        <DynamicsKpiTile
          key={m.label}
          label={m.label}
          value={m.value}
          helper={m.helper}
          href={m.href}
        />
      ))}
    </DynamicsKpiRow>
  )
}
