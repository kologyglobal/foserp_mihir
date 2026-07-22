import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import type { WorkOrderHealth } from '@/types/manufacturingProduction'
import { workOrderHealthMeta } from './productionStatus'

export function WorkOrderHealthBadge({ health }: { health: WorkOrderHealth }) {
  const meta = workOrderHealthMeta(health)
  return <DynamicsStatusChip label={meta.label} tone={meta.tone} />
}
