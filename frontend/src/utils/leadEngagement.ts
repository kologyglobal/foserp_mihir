import type { CrmActivity, FollowUp, Opportunity } from '../types/crm'
import type { Lead } from '../types/sales'

const CRM_OWNERS: Record<string, { id: string; name: string }> = {
  'Rajesh Kumar': { id: 'user-rajesh', name: 'Rajesh Kumar' },
  'Priya Deshmukh': { id: 'user-priya', name: 'Priya Deshmukh' },
  'Amit Sharma': { id: 'user-amit', name: 'Amit Sharma' },
}

export function leadOwnerFromName(salesOwner: string) {
  return CRM_OWNERS[salesOwner] ?? { id: 'user-rajesh', name: salesOwner }
}

export function leadEngagementContext(lead: Lead) {
  const owner = lead.leadOwnerId
    ? { id: lead.leadOwnerId, name: lead.leadOwnerName || lead.salesOwner }
    : leadOwnerFromName(lead.leadOwnerName || lead.salesOwner)
  return {
    leadId: lead.id,
    leadName: `${lead.leadNo} · ${lead.prospectName}`,
    customerId: lead.customerId,
    assignedTo: owner.id,
    assignedToName: owner.name,
  }
}

/** Opportunity IDs created from / linked to this lead (includes lead.opportunityId). */
export function linkedOpportunityIdsForLead(
  lead: Lead,
  opportunities: Pick<Opportunity, 'id' | 'leadId'>[],
): string[] {
  const ids = new Set<string>()
  if (lead.opportunityId) ids.add(lead.opportunityId)
  for (const o of opportunities) {
    if (o.leadId === lead.id) ids.add(o.id)
  }
  return [...ids]
}

/** Prefer `lead.opportunityId`, else first opportunity with matching `leadId`. */
export function primaryLinkedOpportunityIdForLead(
  lead: Pick<Lead, 'id' | 'opportunityId'>,
  opportunities: Pick<Opportunity, 'id' | 'leadId'>[],
): string | null {
  if (lead.opportunityId) return lead.opportunityId
  return opportunities.find((o) => o.leadId === lead.id)?.id ?? null
}

export function filterActivitiesForLead(
  lead: Lead,
  activities: CrmActivity[],
  linkedOpportunityIds: Iterable<string> = [],
) {
  const oppIds = new Set(linkedOpportunityIds)
  if (lead.opportunityId) oppIds.add(lead.opportunityId)
  return activities
    .filter(
      (a) =>
        a.leadId === lead.id ||
        (a.opportunityId != null && oppIds.has(a.opportunityId)) ||
        (!a.opportunityId && !a.leadId && lead.customerId && a.customerId === lead.customerId),
    )
    .sort((a, b) => b.activityDate.localeCompare(a.activityDate))
}

export function filterFollowUpsForLead(
  lead: Lead,
  followUps: FollowUp[],
  linkedOpportunityIds: Iterable<string> = [],
) {
  const oppIds = new Set(linkedOpportunityIds)
  if (lead.opportunityId) oppIds.add(lead.opportunityId)
  return followUps
    .filter(
      (f) =>
        f.leadId === lead.id ||
        (f.opportunityId != null && oppIds.has(f.opportunityId)) ||
        (!f.opportunityId && !f.leadId && lead.customerId && f.customerId === lead.customerId),
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

/**
 * Activities for an opportunity: direct opp link, or engagement logged on the source lead
 * (mirror / pre-convert logs stay on lead until converted-linked).
 */
export function filterActivitiesForOpportunity(
  opportunity: Pick<Opportunity, 'id' | 'leadId' | 'customerId'>,
  activities: CrmActivity[],
) {
  const leadId = opportunity.leadId
  return activities
    .filter(
      (a) =>
        a.opportunityId === opportunity.id ||
        Boolean(leadId && a.leadId === leadId) ||
        (!a.opportunityId && !a.leadId && opportunity.customerId && a.customerId === opportunity.customerId),
    )
    .sort((a, b) => b.activityDate.localeCompare(a.activityDate))
}

/** Follow-ups for an opportunity including those still keyed only to the source lead. */
export function filterFollowUpsForOpportunity(
  opportunity: Pick<Opportunity, 'id' | 'leadId' | 'customerId'>,
  followUps: FollowUp[],
) {
  const leadId = opportunity.leadId
  return followUps
    .filter(
      (f) =>
        f.opportunityId === opportunity.id ||
        Boolean(leadId && f.leadId === leadId) ||
        (!f.opportunityId && !f.leadId && opportunity.customerId && f.customerId === opportunity.customerId),
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}
