import { DynamicsStatusChip } from '../../components/dynamics/DynamicsStatusChip'
import { leadStageChipTone, leadStageLabel, migrateLeadStage } from '../../utils/leadUtils'
import type { LeadStage } from '../../types/sales'

const OPP_STAGE_TONE: Record<string, 'success' | 'warning' | 'critical' | 'info' | 'live' | 'pending' | 'neutral'> = {
  new_lead: 'info',
  qualified: 'success',
  requirement_discussion: 'pending',
  technical_review: 'live',
  quotation_prepared: 'pending',
  quotation_sent: 'info',
  negotiation: 'warning',
  won: 'success',
  lost: 'critical',
  on_hold: 'neutral',
}

/** Standard stage badge for lead + opportunity pipeline stages (Dynamics chip family). */
export function StageBadge({ stage, label }: { stage?: string; label?: string }) {
  if (!stage && !label) return <DynamicsStatusChip label="—" tone="neutral" />
  const oppTone = stage ? OPP_STAGE_TONE[stage] : undefined
  if (oppTone) {
    return <DynamicsStatusChip label={label ?? stage!} tone={oppTone} />
  }
  const leadStage = stage ? migrateLeadStage(stage as LeadStage) : undefined
  const text = label ?? (leadStage ? leadStageLabel(leadStage) : '—')
  const tone = leadStage ? leadStageChipTone(leadStage) : 'neutral'
  return <DynamicsStatusChip label={text} tone={tone} />
}
