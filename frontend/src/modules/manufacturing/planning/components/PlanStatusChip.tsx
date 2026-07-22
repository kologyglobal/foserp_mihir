import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import type { ProductionPlanStatus } from '../types'
import { planStatusMeta } from '../utils/labels'

export function PlanStatusChip({ status }: { status: ProductionPlanStatus }) {
  const meta = planStatusMeta(status)
  return <DynamicsStatusChip label={meta.label} tone={meta.tone} />
}
