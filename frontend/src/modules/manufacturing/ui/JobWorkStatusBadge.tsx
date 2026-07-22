import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import type { JobWorkStatus } from '@/types/manufacturingJobWork'
import { jobWorkStatusMeta } from './productionStatus'

export function JobWorkStatusBadge({ status }: { status: JobWorkStatus }) {
  const meta = jobWorkStatusMeta(status)
  return <DynamicsStatusChip label={meta.label} tone={meta.tone} />
}
