import type { LeadStage } from '../types/sales'
import type { OpportunityStage } from '../types/crm'

/**
 * Mirrors the Leads section's open stages ("New" / "Qualified") into the
 * Opportunity pipeline stage vocabulary. Stages not listed here (not
 * qualified / closed / converted) are owned by their own dedicated flows and
 * are intentionally left out of the auto-sync.
 */
export const LEAD_STAGE_TO_OPPORTUNITY_STAGE: Partial<Record<LeadStage, OpportunityStage>> = {
  new: 'new_lead',
  contacted: 'new_lead',
  requirement_collected: 'new_lead',
  qualified: 'qualified',
}
