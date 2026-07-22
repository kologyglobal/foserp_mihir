import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import type { WorkOrderStatus } from '@/types/manufacturingProduction'
import { workOrderStatusMeta } from './productionStatus'

export function WorkOrderStatusBadge({ status }: { status: WorkOrderStatus }) {
  const meta = workOrderStatusMeta(status)
  return <DynamicsStatusChip label={meta.label} tone={meta.tone} />
}
