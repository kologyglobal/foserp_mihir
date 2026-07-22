import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import type { IssueSeverity } from '@/types/manufacturingPhase2b'
import { issueSeverityMeta } from './productionStatus'

export function IssueSeverityBadge({ severity }: { severity: IssueSeverity }) {
  const meta = issueSeverityMeta(severity)
  return <DynamicsStatusChip label={meta.label} tone={meta.tone} />
}
