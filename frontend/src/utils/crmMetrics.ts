import type {
  CrmActivity,
  CrmContact,
  FollowUp,
  Opportunity,
  OpportunityStage,
  QuotationDocument,
} from '../types/crm'
import type { Lead } from '../types/sales'
import { formatCurrency } from './formatters/currency'
import { resolveOpportunityStages } from './opportunityUtils'
import { buildStuckOpportunityInsights, type StuckOpportunityInsight } from './crmStuckAnalysis'
import { isLeadActiveForPipeline, normalizeLead, buildLeadsByStage, buildLeadStageFunnel } from './leadUtils'

/** Dashboard approval-queue row (demo store docs or API panel payload). */
export type CrmQuotationApprovalRow = Pick<
  QuotationDocument,
  'id' | 'quotationId' | 'revisionNo' | 'totalAmount' | 'status' | 'salesOwnerName' | 'opportunityId' | 'createdAt'
> & {
  quotationCode?: string | null
  customerName?: string | null
  submittedAt?: string | null
}

export interface CrmDashboardMetrics {
  openOpportunities: number
  pipelineValue: number
  weightedForecast: number
  hotDealValue: number
  stuckDealValue: number
  quotationsPending: number
  followUpsDueToday: number
  dealsWon: number
  dealsLost: number
  averageDealAgeDays: number
  conversionRate: number
  todaysFollowUps: FollowUp[]
  sortedFollowUps: FollowUp[]
  hotOpportunities: Opportunity[]
  stuckOpportunities: Opportunity[]
  stuckInsights: StuckOpportunityInsight[]
  recentActivities: CrmActivity[]
  pendingApprovalQuotations: CrmQuotationApprovalRow[]
  recentlyWonDeals: Opportunity[]
  approvedQuotationsNotConverted: number
  convertedToSalesOrderThisMonth: number
  quotationToSoConversionRate: number
  activeLeads: number
  closedLeads: number
  highPriorityLeads: number
  criticalPriorityLeads: number
  leadsCreatedToday: number
  leadsClosedThisMonth: number
  leadsByOwner: { ownerName: string; count: number }[]
  leadsByStage: { stage: string; count: number }[]
  leadStageFunnel: { stage: string; label: string; count: number }[]
  newLeads: number
  contactedLeads: number
  qualifiedLeads: number
  notQualifiedLeads: number
  convertedLeads: number
}

const HOT_MIN_VALUE = 2000000

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

function daysBetween(from: string, to: Date): number {
  const start = new Date(from.slice(0, 10))
  return Math.floor((to.getTime() - start.getTime()) / 86400000)
}

function isToday(iso: string): boolean {
  const d = iso.slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)
  return d === today
}

/** Sort follow-ups: overdue → due now → high priority → later today */
export function sortFollowUpsByUrgency(followUps: FollowUp[]): FollowUp[] {
  const today = new Date().toISOString().slice(0, 10)
  return [...followUps].sort((a, b) => {
    const aOverdue = a.status === 'overdue' ? 0 : 1
    const bOverdue = b.status === 'overdue' ? 0 : 1
    if (aOverdue !== bOverdue) return aOverdue - bOverdue

    const aToday = a.dueDate.slice(0, 10) === today ? 0 : 1
    const bToday = b.dueDate.slice(0, 10) === today ? 0 : 1
    if (aToday !== bToday) return aToday - bToday

    const aPri = PRIORITY_ORDER[a.priority] ?? 3
    const bPri = PRIORITY_ORDER[b.priority] ?? 3
    if (aPri !== bPri) return aPri - bPri

    return (a.dueTime ?? '99:99').localeCompare(b.dueTime ?? '99:99')
  })
}

export function getWonDealNextErpStep(opp: Opportunity): string {
  if (opp.salesOrderId) return 'View Sales Order in Sales module'
  if (opp.quotationId) return 'Convert approved quotation to SO'
  if (opp.inquiryId) return 'Create quotation'
  return 'Link inquiry / quotation'
}


export function buildCrmDashboardMetrics(input: {
  opportunities: Opportunity[]
  followUps: FollowUp[]
  activities: CrmActivity[]
  quotationDocuments: QuotationDocument[]
  leads?: Lead[]
}): CrmDashboardMetrics {
  const opportunities = input.opportunities ?? []
  const followUps = input.followUps ?? []
  const activities = input.activities ?? []
  const quotationDocuments = input.quotationDocuments ?? []
  const now = new Date()
  const open = opportunities.filter((o) => o.status === 'open')
  const won = opportunities.filter((o) => o.status === 'won')
  const lost = opportunities.filter((o) => o.status === 'lost')
  const closed = won.length + lost.length
  const pipelineValue = open.reduce((s, o) => s + o.value, 0)
  const weightedForecast = open.reduce((s, o) => s + o.value * (o.probability / 100), 0)
  const pendingDocs = quotationDocuments.filter(
    (d) => d.status === 'pending_approval' || d.status === 'sent',
  )
  const approvalOnly = quotationDocuments.filter((d) => d.status === 'pending_approval')
  const dueToday = followUps.filter(
    (f) => (f.status === 'pending' || f.status === 'overdue') && isToday(f.dueDate),
  )
  const actionFollowUps = sortFollowUpsByUrgency(
    followUps.filter((f) => {
      if (f.status !== 'pending' && f.status !== 'overdue') return false
      return f.status === 'overdue' || isToday(f.dueDate)
    }),
  )
  const sortedFollowUps = sortFollowUpsByUrgency(
    followUps.filter((f) => f.status === 'pending' || f.status === 'overdue'),
  )
  const ages = open.map((o) => daysBetween(o.createdAt, now))
  const avgAge = ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0
  const conversionRate = closed > 0 ? Math.round((won.length / closed) * 100) : 0

  const stuckInsights = buildStuckOpportunityInsights(open)
  const stuck = stuckInsights.map((s) => s.opportunity)
  const stuckDealValue = stuck.reduce((s, o) => s + o.value, 0)

  const hot = [...open]
    .filter((o) => o.value >= HOT_MIN_VALUE || o.priority === 'critical' || o.priority === 'high')
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
  const hotDealValue = hot.reduce((s, o) => s + o.value, 0)

  const recentActivities = [...activities]
    .sort((a, b) => b.activityDate.localeCompare(a.activityDate))
    .slice(0, 10)

  const recentlyWon = [...won]
    .sort((a, b) => (b.modifiedAt ?? b.createdAt).localeCompare(a.modifiedAt ?? a.createdAt))
    .slice(0, 5)

  const monthStart = new Date()
  monthStart.setDate(1)
  const monthStartIso = monthStart.toISOString().slice(0, 10)
  const latestDocsByQuotation = new Map<string, QuotationDocument>()
  for (const d of quotationDocuments) {
    const prev = latestDocsByQuotation.get(d.quotationId)
    if (!prev || d.revisionNo > prev.revisionNo) latestDocsByQuotation.set(d.quotationId, d)
  }
  const approvedNotConverted = [...latestDocsByQuotation.values()].filter(
    (d) => d.status === 'approved',
  ).length
  const convertedThisMonth = quotationDocuments.filter(
    (d) => d.status === 'converted' && (d.modifiedAt ?? d.createdAt).slice(0, 10) >= monthStartIso,
  ).length
  const approvedTotal = quotationDocuments.filter((d) => d.status === 'approved' || d.status === 'converted').length
  const convertedTotal = quotationDocuments.filter((d) => d.status === 'converted').length
  const quotationToSoConversionRate = approvedTotal > 0
    ? Math.round((convertedTotal / approvedTotal) * 100)
    : 0

  const normalizedLeads = (input.leads ?? []).map((l) => normalizeLead(l))
  const todayIso = now.toISOString().slice(0, 10)
  const activeLeads = normalizedLeads.filter((l) => isLeadActiveForPipeline(l))
  const closedLeads = normalizedLeads.filter((l) => l.lifecycleStatus === 'closed')
  const highPriorityLeads = normalizedLeads.filter((l) => l.priority === 'high' && isLeadActiveForPipeline(l))
  const criticalPriorityLeads = normalizedLeads.filter((l) => l.priority === 'critical' && isLeadActiveForPipeline(l))
  const leadsCreatedToday = normalizedLeads.filter((l) => l.createdDate === todayIso).length
  const leadsClosedThisMonth = closedLeads.filter(
    (l) => l.closedDate && l.closedDate >= monthStartIso,
  ).length
  const ownerMap = new Map<string, number>()
  for (const l of activeLeads) {
    ownerMap.set(l.leadOwnerName, (ownerMap.get(l.leadOwnerName) ?? 0) + 1)
  }
  const leadsByOwner = [...ownerMap.entries()]
    .map(([ownerName, count]) => ({ ownerName, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
  const leadsByStage = buildLeadsByStage(normalizedLeads).map((r) => ({ stage: r.label, count: r.count }))
  const leadStageFunnel = buildLeadStageFunnel(normalizedLeads)
  const countStage = (s: string) => normalizedLeads.filter((l) => l.stage === s).length

  return {
    openOpportunities: open.length,
    pipelineValue,
    weightedForecast,
    hotDealValue,
    stuckDealValue,
    quotationsPending: pendingDocs.length,
    followUpsDueToday: dueToday.length,
    dealsWon: won.length,
    dealsLost: lost.length,
    averageDealAgeDays: avgAge,
    conversionRate,
    todaysFollowUps: actionFollowUps,
    sortedFollowUps,
    hotOpportunities: hot,
    stuckOpportunities: stuck,
    stuckInsights,
    recentActivities,
    pendingApprovalQuotations: approvalOnly.slice(0, 8),
    recentlyWonDeals: recentlyWon,
    approvedQuotationsNotConverted: approvedNotConverted,
    convertedToSalesOrderThisMonth: convertedThisMonth,
    quotationToSoConversionRate,
    activeLeads: activeLeads.length,
    closedLeads: closedLeads.length,
    highPriorityLeads: highPriorityLeads.length,
    criticalPriorityLeads: criticalPriorityLeads.length,
    leadsCreatedToday,
    leadsClosedThisMonth,
    leadsByOwner,
    leadsByStage,
    leadStageFunnel,
    newLeads: countStage('new'),
    contactedLeads: countStage('contacted'),
    qualifiedLeads: countStage('qualified'),
    notQualifiedLeads: countStage('not_qualified'),
    convertedLeads: countStage('converted_to_opportunity'),
  }
}

export function enrichFollowUpStatus(followUps: FollowUp[]): FollowUp[] {
  const today = new Date().toISOString().slice(0, 10)
  return followUps.map((f) => {
    if (f.status !== 'pending' && f.status !== 'snoozed') return f
    if (f.dueDate.slice(0, 10) < today) return { ...f, status: 'overdue' as const }
    return f
  })
}

export function customerCrmSummary(
  customerId: string,
  opportunities: Opportunity[],
  followUps: FollowUp[],
  activities: CrmActivity[],
) {
  const custOpps = opportunities.filter((o) => o.customerId === customerId)
  const openOpps = custOpps.filter((o) => o.status === 'open')
  const wonOpps = custOpps.filter((o) => o.status === 'won')
  const lostOpps = custOpps.filter((o) => o.status === 'lost')
  const pipelineValue = openOpps.reduce((s, o) => s + o.value, 0)
  const wonValue = wonOpps.reduce((s, o) => s + o.value, 0)
  const lastActivity = activities
    .filter((a) => a.customerId === customerId)
    .sort((a, b) => b.activityDate.localeCompare(a.activityDate))[0]
  const nextFollowUp = followUps
    .filter((f) => f.customerId === customerId && (f.status === 'pending' || f.status === 'overdue'))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
  return {
    openOpportunities: openOpps.length,
    wonOpportunities: wonOpps.length,
    lostOpportunities: lostOpps.length,
    pipelineValue,
    wonValue,
    lastActivityAt: lastActivity?.activityDate ?? null,
    nextFollowUpDate: nextFollowUp?.dueDate ?? null,
    hasOverdueFollowUp: followUps.some(
      (f) => f.customerId === customerId && f.status === 'overdue',
    ),
  }
}

export function stageIndex(stage: OpportunityStage): number {
  const stages = resolveOpportunityStages()
  return stages.findIndex((s) => s.id === stage)
}

export interface PipelineFunnelStage {
  id: OpportunityStage
  label: string
  count: number
  value: number
  weightedValue: number
  conversionFromPrev: number | null
}

export function buildPipelineFunnelData(
  opportunities: Opportunity[],
  options?: { includeClosed?: boolean; includeOnHold?: boolean },
): {
  stages: PipelineFunnelStage[]
  openPipeline: number
  weightedPipeline: number
  wonValue: number
  lostCount: number
  wonCount: number
} {
  const includeClosed = options?.includeClosed ?? false
  const includeOnHold = options?.includeOnHold ?? false
  const closedStages = new Set<OpportunityStage>(['won', 'lost'])
  const excluded = new Set<OpportunityStage>(['on_hold'])
  if (!includeOnHold) excluded.add('on_hold')
  if (!includeClosed) {
    closedStages.forEach((s) => excluded.add(s))
  }

  const visibleStages = resolveOpportunityStages().filter((s) => !excluded.has(s.id))
  const allStages = resolveOpportunityStages()
  const byStage = new Map<OpportunityStage, Opportunity[]>()
  for (const stage of allStages) byStage.set(stage.id, [])

  for (const opp of opportunities) {
    if (opp.status === 'open' || opp.stage === 'won' || opp.stage === 'lost' || opp.stage === 'on_hold') {
      const list = byStage.get(opp.stage) ?? []
      list.push(opp)
      byStage.set(opp.stage, list)
    }
  }

  let prevCount: number | null = null
  const stages: PipelineFunnelStage[] = visibleStages.map((stage) => {
    const cards = byStage.get(stage.id) ?? []
    const count = cards.length
    const value = cards.reduce((s, c) => s + c.value, 0)
    const weightedValue = cards.reduce((s, c) => s + c.value * (c.probability / 100), 0)
    const conversionFromPrev =
      prevCount !== null && prevCount > 0 ? Math.round((count / prevCount) * 100) : null
    if (!closedStages.has(stage.id)) prevCount = count
    return { id: stage.id, label: stage.label, count, value, weightedValue, conversionFromPrev }
  })

  const openStages = stages.filter((s) => !closedStages.has(s.id) && s.id !== 'on_hold')
  const openPipeline = openStages.reduce((s, f) => s + f.value, 0)
  const weightedPipeline = openStages.reduce((s, f) => s + f.weightedValue, 0)
  const wonCards = byStage.get('won') ?? []
  const lostCards = byStage.get('lost') ?? []

  return {
    stages,
    openPipeline,
    weightedPipeline,
    wonValue: wonCards.reduce((s, c) => s + c.value, 0),
    wonCount: wonCards.length,
    lostCount: lostCards.length,
  }
}

export function formatCrmCurrency(n: number): string {
  return formatCurrency(n)
}

export type { CrmContact }
