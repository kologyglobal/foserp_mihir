import type { CrmDashboardMetricsDto } from '../services/api/crmApi'
import type { CrmActivity, FollowUp, Opportunity } from '../types/crm'
import type { CrmDashboardMetrics } from './crmMetrics'
import type { StuckOpportunityInsight } from './crmStuckAnalysis'

type PanelOpp = NonNullable<CrmDashboardMetricsDto['panels']>['hotOpportunities'][number]
type PanelFollowUp = NonNullable<CrmDashboardMetricsDto['panels']>['todaysFollowUps'][number]

const AUDIT_STUB = {
  createdAt: new Date(0).toISOString(),
  updatedAt: null,
  createdById: '',
  createdByName: '',
  modifiedById: null,
  modifiedByName: null,
  modifiedAt: null,
  approvedById: null,
  approvedByName: null,
  approvedAt: null,
}

function mapPanelOpportunity(row: PanelOpp, status: Opportunity['status'] = 'open'): Opportunity {
  return {
    ...AUDIT_STUB,
    id: row.id,
    opportunityNo: row.opportunityCode,
    customerId: row.companyId,
    contactId: null,
    productId: null,
    opportunityName: row.name,
    productRequirement: '',
    lines: [],
    stage: 'qualified',
    value: row.amount,
    probability: row.probability ?? 0,
    expectedCloseDate: row.expectedCloseDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    ownerId: row.ownerId ?? '',
    ownerName: row.ownerId ?? '',
    priority: (row.priority as Opportunity['priority']) ?? 'medium',
    status,
    lostReason: null,
    healthScore: row.healthScore ?? 60,
    inquiryId: null,
    quotationId: null,
    salesOrderId: null,
    leadId: null,
    lastActivityAt: null,
    nextFollowUpDate: row.nextFollowUpAt?.slice(0, 10) ?? null,
    locationId: null,
  }
}

function mapPanelFollowUp(row: PanelFollowUp): FollowUp {
  const dueDateRaw = row.dueDate
  const dueDate =
    typeof dueDateRaw === 'string'
      ? dueDateRaw.slice(0, 10)
      : dueDateRaw instanceof Date
        ? dueDateRaw.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10)
  return {
    ...AUDIT_STUB,
    id: String(row.id ?? ''),
    followUpType: String(row.followUpType ?? 'call') as FollowUp['followUpType'],
    customerId: row.companyId ? String(row.companyId) : null,
    contactId: row.contactId ? String(row.contactId) : null,
    opportunityId: row.opportunityId ? String(row.opportunityId) : null,
    quotationId: null,
    leadId: row.leadId ? String(row.leadId) : null,
    assignedTo: row.assignedTo ? String(row.assignedTo) : '',
    assignedToName: row.assignedTo ? String(row.assignedTo) : '',
    dueDate,
    dueTime: String(row.dueTime ?? '10:00'),
    priority: String(row.priority ?? 'medium') as FollowUp['priority'],
    status: String(row.status ?? 'pending') as FollowUp['status'],
    outcome: row.outcome ? String(row.outcome) : null,
    notes: String(row.notes ?? ''),
    reminder: Boolean(row.reminder),
  }
}

function mapRecentActivity(row: Record<string, unknown>): CrmActivity {
  return {
    ...AUDIT_STUB,
    id: String(row.id ?? ''),
    type: String(row.activityType ?? 'call').toLowerCase() as CrmActivity['type'],
    subject: String(row.subject ?? ''),
    description: '',
    customerId: row.companyId ? String(row.companyId) : null,
    contactId: null,
    opportunityId: row.leadId ? null : null,
    quotationId: null,
    leadId: row.leadId ? String(row.leadId) : null,
    ownerId: '',
    ownerName: '',
    outcome: null,
    activityDate: row.scheduledAt ? String(row.scheduledAt).slice(0, 10) : new Date().toISOString().slice(0, 10),
    attachmentNames: [],
  }
}

/** Overlay backend dashboard panel rows onto locally computed metrics in API mode. */
export function applyApiDashboardPanelOverlay(
  metrics: CrmDashboardMetrics,
  api: CrmDashboardMetricsDto | null,
): CrmDashboardMetrics {
  if (!api?.panels) return metrics

  const hotOpportunities = api.panels.hotOpportunities.map((row) => mapPanelOpportunity(row))
  const stuckInsights: StuckOpportunityInsight[] = api.panels.stuckOpportunities.map((row) => ({
    opportunity: mapPanelOpportunity({
      id: row.id,
      opportunityCode: row.opportunityCode,
      name: row.name,
      amount: row.amount,
      stageId: row.stageId,
      companyId: row.companyId,
      ownerId: row.ownerId,
      probability: 0,
      expectedCloseDate: null,
      healthScore: 45,
      priority: 'medium',
      nextFollowUpAt: null,
    }),
    daysStuck: row.idleDays,
    riskReason: row.reason,
    riskTone: row.idleDays >= 21 ? 'critical' : 'warning',
  }))
  const recentlyWonDeals = api.panels.recentlyWon.map((row) =>
    mapPanelOpportunity(
      {
        id: row.id,
        opportunityCode: row.opportunityCode,
        name: row.name,
        amount: row.amount,
        stageId: '',
        companyId: row.companyId,
        ownerId: row.ownerId,
        probability: 100,
        expectedCloseDate: null,
        healthScore: 100,
        priority: 'medium',
        nextFollowUpAt: null,
      },
      'won',
    ),
  )
  const todaysFollowUps = api.panels.todaysFollowUps.map(mapPanelFollowUp)
  const recentActivities = (api.activities.recent ?? []).map(mapRecentActivity)

  return {
    ...metrics,
    hotOpportunities,
    stuckOpportunities: stuckInsights.map((s) => s.opportunity),
    stuckInsights,
    recentlyWonDeals,
    todaysFollowUps,
    sortedFollowUps: todaysFollowUps,
    recentActivities,
    hotDealValue: hotOpportunities.reduce((sum, o) => sum + o.value, 0),
    stuckDealValue: stuckInsights.reduce((sum, s) => sum + s.opportunity.value, 0),
  }
}
