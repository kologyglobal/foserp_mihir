import { useCrmStore } from '../store/crmStore'
import { useSalesStore } from '../store/salesStore'
import { useMrpStore } from '../store/mrpStore'
import { useMasterStore } from '../store/masterStore'
import { normalizeLead, isLeadActiveForPipeline } from './leadUtils'
import { canAccessCrmShell } from './permissions/crm'

export type MobileCrmPipelineMetrics = {
  openLeads: number
  openOpportunities: number
  pipelineValue: number
  quotationsOpen: number
  quotationsPendingApproval: number
  pipelineSalesOrders: number
  followUpsDue: number
  activitiesThisWeek: number
}

export type MobileCrmPipelineStage = {
  id: string
  label: string
  path: string
  count: number
  hint: string
}

const today = () => new Date().toISOString().slice(0, 10)

export function buildMobileCrmPipelineMetrics(): MobileCrmPipelineMetrics {
  const leads = useSalesStore.getState().leads
  const opportunities = useCrmStore.getState().opportunities
  const docs = useCrmStore.getState().quotationDocuments
  const followUps = useCrmStore.getState().followUps
  const activities = useCrmStore.getState().activities
  const salesOrders = useMrpStore.getState().salesOrders

  const openLeads = leads
    .filter((l) => !l.isArchived)
    .map((l) => normalizeLead(l))
    .filter((l) => isLeadActiveForPipeline(l)).length

  const openOpps = opportunities.filter((o) => o.status === 'open')
  const pipelineValue = openOpps.reduce((s, o) => s + o.value, 0)

  const latestDocs = new Map<string, (typeof docs)[number]>()
  for (const d of docs) {
    const prev = latestDocs.get(d.quotationId)
    if (!prev || d.revisionNo > prev.revisionNo) latestDocs.set(d.quotationId, d)
  }
  const latest = [...latestDocs.values()]
  const quotationsOpen = latest.filter((d) => !['converted', 'rejected'].includes(d.status)).length
  const quotationsPendingApproval = latest.filter((d) => d.status === 'pending_approval').length

  const pipelineSalesOrders = salesOrders.filter((so) => so.opportunityId || so.quotationId).length

  const followUpsDue = followUps.filter(
    (f) =>
      (f.status === 'pending' || f.status === 'overdue') &&
      f.dueDate.slice(0, 10) <= today(),
  ).length

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekStart = weekAgo.toISOString().slice(0, 10)
  const activitiesThisWeek = activities.filter((a) => a.activityDate.slice(0, 10) >= weekStart).length

  return {
    openLeads,
    openOpportunities: openOpps.length,
    pipelineValue,
    quotationsOpen,
    quotationsPendingApproval,
    pipelineSalesOrders,
    followUpsDue,
    activitiesThisWeek,
  }
}

export function buildMobileCrmPipelineStages(metrics = buildMobileCrmPipelineMetrics()): MobileCrmPipelineStage[] {
  const customerCount = useMasterStore.getState().customers.length
  return [
    { id: 'leads', label: 'Leads', path: '/m/crm/leads', count: metrics.openLeads, hint: 'Prospects & qualification' },
    { id: 'opportunities', label: 'Opportunities', path: '/m/crm/opportunities', count: metrics.openOpportunities, hint: 'Open pipeline deals' },
    { id: 'quotations', label: 'Quotations', path: '/m/crm/quotations', count: metrics.quotationsOpen, hint: `${metrics.quotationsPendingApproval} pending approval` },
    { id: 'sales-orders', label: 'Sales Orders', path: '/m/crm/sales-orders', count: metrics.pipelineSalesOrders, hint: 'CRM-linked orders' },
    { id: 'follow-ups', label: 'Follow-ups', path: '/m/crm/follow-ups', count: metrics.followUpsDue, hint: 'Due today or overdue' },
    { id: 'customers', label: 'Companies', path: '/m/crm/customers', count: customerCount, hint: 'Accounts & contacts' },
    { id: 'activities', label: 'Activities', path: '/m/crm/activities', count: metrics.activitiesThisWeek, hint: 'Logged this week' },
  ]
}

export function mobileCrmEnabled(): boolean {
  return canAccessCrmShell()
}
