import type { LeadStage } from '../../types/sales'
import { StageBadge } from '../../design-system/list-page'

/** Lead stage chip — same badge family as register StageBadge. */
export function LeadStageChip({ stage }: { stage: LeadStage | string }) {
  return <StageBadge stage={stage} />
}
