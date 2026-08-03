import type { Lead, LeadStage } from '../types/sales'
import type { OpportunityStage } from '../types/crm'
import { normalizeLead } from './leadUtils'

/**
 * Mirrors Leads open sections into the Opportunity pipeline:
 * - New (new / contacted) → new_lead
 * - Qualified (qualified / requirement_collected, matching Leads KPI) → qualified
 */
export const LEAD_STAGE_TO_OPPORTUNITY_STAGE: Partial<Record<LeadStage, OpportunityStage>> = {
  new: 'new_lead',
  contacted: 'new_lead',
  requirement_collected: 'qualified',
  qualified: 'qualified',
}

/** Whether deleting this opportunity should reopen the lead (Convert undo). */
export function shouldReopenLeadAfterOpportunityDelete(
  lead: Pick<Lead, 'id' | 'stage' | 'lifecycleStatus' | 'opportunityId'>,
  opportunityId: string,
  opportunityLeadId?: string | null,
): boolean {
  if (lead.opportunityId === opportunityId) return true
  const converted =
    lead.stage === 'converted_to_opportunity' || lead.lifecycleStatus === 'converted'
  return Boolean(
    converted
    && opportunityLeadId === lead.id
    && (!lead.opportunityId || lead.opportunityId === opportunityId),
  )
}

/** Clear convert lock and reopen as Qualified after the linked opportunity is deleted. */
export function reopenLeadAfterOpportunityDelete(lead: Lead): Lead {
  return normalizeLead({
    ...lead,
    stage: 'qualified',
    lifecycleStatus: 'qualified',
    opportunityId: null,
  })
}
