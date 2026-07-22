import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import type { IssueStatus } from '@/types/manufacturingPhase2b'
import { issueStatusMeta } from '../ui/productionStatus'

export function IssueStatusBadge({ status }: { status: IssueStatus }) {
  const meta = issueStatusMeta(status)
  return <DynamicsStatusChip label={meta.label} tone={meta.tone} />
}
