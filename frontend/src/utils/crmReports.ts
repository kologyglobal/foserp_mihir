import { useCrmStore } from '../store/crmStore'
import { useMasterStore } from '../store/masterStore'
import { useSalesStore } from '../store/salesStore'
import { type OpportunityStage } from '../types/crm'
import { opportunityStageLabel } from './opportunityUtils'
import { normalizeLead, leadPriorityLabel, leadStageLabel } from './leadUtils'

function customers() {
  return useMasterStore.getState().customers
}

function customerName(id: string) {
  return customers().find((c) => c.id === id)?.customerName ?? id
}

export function getOpportunityPipelineReport() {
  const opps = useCrmStore.getState().opportunities
  return opps.map((o) => ({
    opportunityNo: o.opportunityNo,
    opportunityName: o.opportunityName,
    customerName: customerName(o.customerId),
    stage: opportunityStageLabel(o.stage),
    value: o.value,
    probability: o.probability,
    ownerName: o.ownerName,
    expectedCloseDate: o.expectedCloseDate,
    status: o.status,
  }))
}

export function getStageWiseOpportunityReport() {
  const opps = useCrmStore.getState().opportunities
  const map = new Map<string, { stage: string; count: number; value: number }>()
  for (const o of opps) {
    const label = opportunityStageLabel(o.stage)
    const cur = map.get(label) ?? { stage: label, count: 0, value: 0 }
    cur.count += 1
    cur.value += o.value
    map.set(label, cur)
  }
  return [...map.values()]
}

export function getFollowUpDueReport() {
  return useCrmStore.getState().followUps.map((f) => ({
    followUpType: f.followUpType,
    customerName: f.customerId ? customerName(f.customerId) : '—',
    dueDate: f.dueDate,
    dueTime: f.dueTime,
    assignedToName: f.assignedToName,
    status: f.status,
    priority: f.priority,
    notes: f.notes,
  }))
}

export function getSalesActivityReport() {
  return useCrmStore.getState().activities.map((a) => ({
    type: a.type,
    subject: a.subject,
    customerName: a.customerId ? customerName(a.customerId) : '—',
    ownerName: a.ownerName,
    activityDate: a.activityDate,
    outcome: a.outcome ?? '—',
  }))
}

export function getQuotationRevisionReport() {
  const docs = useCrmStore.getState().quotationDocuments
  const sales = useSalesStore.getState().quotations
  return docs.map((d) => {
    const q = sales.find((x) => x.id === d.quotationId)
    return {
      quotationNo: q?.quotationNo ?? d.quotationId,
      revisionNo: d.revisionNo,
      status: d.status,
      totalAmount: d.totalAmount,
      createdByName: d.createdByName,
      createdAt: d.createdAt,
      revisionReason: d.revisionReason ?? '—',
      locked: d.locked ? 'Yes' : 'No',
    }
  })
}

export function getQuotationApprovalReport() {
  const docs = useCrmStore.getState().quotationDocuments
  const rows: {
    quotationId: string
    revisionNo: number
    action: string
    byName: string
    at: string
    remarks: string
  }[] = []
  for (const d of docs) {
    for (const h of d.approvalHistory ?? []) {
      rows.push({
        quotationId: d.quotationId,
        revisionNo: d.revisionNo,
        action: h.action,
        byName: h.byName,
        at: h.at,
        remarks: h.remarks ?? '—',
      })
    }
  }
  return rows
}

export function getWonLostReport() {
  return useCrmStore.getState().opportunities
    .filter((o) => o.status === 'won' || o.status === 'lost')
    .map((o) => ({
      opportunityNo: o.opportunityNo,
      customerName: customerName(o.customerId),
      status: o.status,
      value: o.value,
      stage: opportunityStageLabel(o.stage),
      lostReason: o.lostReason ?? '—',
      salesOrderId: o.salesOrderId ?? '—',
    }))
}

export function getCustomerPipelineReport() {
  const opps = useCrmStore.getState().opportunities
  const map = new Map<string, { customerName: string; openCount: number; pipelineValue: number; wonCount: number }>()
  for (const o of opps) {
    const name = customerName(o.customerId)
    const cur = map.get(o.customerId) ?? { customerName: name, openCount: 0, pipelineValue: 0, wonCount: 0 }
    if (o.status === 'open') {
      cur.openCount += 1
      cur.pipelineValue += o.value
    }
    if (o.status === 'won') cur.wonCount += 1
    map.set(o.customerId, cur)
  }
  return [...map.values()]
}

export function getConversionFunnelReport() {
  const stages: OpportunityStage[] = [
    'new_lead', 'qualified', 'requirement_discussion', 'technical_review',
    'quotation_prepared', 'quotation_sent', 'negotiation', 'won', 'lost',
  ]
  const opps = useCrmStore.getState().opportunities
  return stages.map((stage) => ({
    stage: opportunityStageLabel(stage),
    count: opps.filter((o) => o.stage === stage).length,
  }))
}

export function getLeadRegisterReport() {
  return useSalesStore.getState().leads.map((l) => {
    const n = normalizeLead(l)
    return {
      leadNo: n.leadNo,
      companyProspect: n.prospectName,
      contactPerson: n.contactPerson ?? '—',
      mobile: n.mobile ?? '—',
      leadOwner: n.leadOwnerName,
      priority: leadPriorityLabel(n.priority),
      leadStage: leadStageLabel(n.stage),
      productRequirement: n.productRequirement,
      expectedValue: n.expectedValue,
      createdDate: n.createdDate,
      activityStatus: n.activityStatus,
      lifecycleStatus: n.lifecycleStatus,
      closedDate: n.closedDate ?? '—',
      nextFollowUp: n.nextFollowUpDate ?? '—',
    }
  })
}

export function getLeadOwnerReport() {
  const map = new Map<string, { owner: string; active: number; closed: number; pipelineValue: number }>()
  for (const l of useSalesStore.getState().leads.map(normalizeLead)) {
    const cur = map.get(l.leadOwnerName) ?? { owner: l.leadOwnerName, active: 0, closed: 0, pipelineValue: 0 }
    if (l.lifecycleStatus === 'closed') cur.closed += 1
    else {
      cur.active += 1
      cur.pipelineValue += l.expectedValue
    }
    map.set(l.leadOwnerName, cur)
  }
  return [...map.values()]
}

export function getLeadPriorityReport() {
  const priorities = ['critical', 'high', 'medium', 'low'] as const
  const leads = useSalesStore.getState().leads.map(normalizeLead)
  return priorities.map((p) => ({
    priority: leadPriorityLabel(p),
    count: leads.filter((l) => l.priority === p).length,
    activeCount: leads.filter((l) => l.priority === p && l.lifecycleStatus !== 'closed').length,
    pipelineValue: leads.filter((l) => l.priority === p && l.lifecycleStatus !== 'closed').reduce((s, l) => s + l.expectedValue, 0),
  }))
}

export function getClosedLeadReport() {
  return useSalesStore.getState().leads
    .map(normalizeLead)
    .filter((l) => l.lifecycleStatus === 'closed')
    .map((l) => ({
      leadNo: l.leadNo,
      companyProspect: l.prospectName,
      leadOwner: l.leadOwnerName,
      closedDate: l.closedDate ?? '—',
      closedReason: l.closedReason ?? '—',
      expectedValue: l.expectedValue,
    }))
}

export function getLeadStageReport() {
  const leads = useSalesStore.getState().leads.map(normalizeLead)
  const stages = ['new', 'contacted', 'requirement_collected', 'qualified', 'not_qualified', 'converted_to_opportunity', 'closed'] as const
  return stages.map((stage) => ({
    leadStage: leadStageLabel(stage),
    count: leads.filter((l) => l.stage === stage).length,
    activeCount: leads.filter((l) => l.stage === stage && l.activityStatus === 'active').length,
    pipelineValue: leads.filter((l) => l.stage === stage).reduce((s, l) => s + l.expectedValue, 0),
  }))
}

export function getLeadConversionReport() {
  const leads = useSalesStore.getState().leads.map(normalizeLead)
  const total = leads.length
  const converted = leads.filter((l) => l.stage === 'converted_to_opportunity').length
  const qualified = leads.filter((l) => l.stage === 'qualified' || l.stage === 'converted_to_opportunity').length
  const closed = leads.filter((l) => l.stage === 'closed').length
  return [
    { metric: 'Total Leads', value: total },
    { metric: 'Qualified + Converted', value: qualified },
    { metric: 'Converted to Opportunity', value: converted },
    { metric: 'Closed', value: closed },
    { metric: 'Conversion Rate %', value: total > 0 ? Math.round((converted / total) * 100) : 0 },
  ]
}

export function getLeadActiveInactiveReport() {
  return useSalesStore.getState().leads.map((l) => {
    const n = normalizeLead(l)
    return {
      leadNo: n.leadNo,
      companyProspect: n.prospectName,
      activityStatus: n.activityStatus,
      inactiveReason: n.inactiveReason ?? '—',
      lifecycleStatus: n.lifecycleStatus,
      leadOwner: n.leadOwnerName,
    }
  })
}

export type CrmReportId =
  | 'pipeline'
  | 'stage-wise'
  | 'follow-up-due'
  | 'sales-activity'
  | 'quotation-revision'
  | 'quotation-approval'
  | 'won-lost'
  | 'customer-pipeline'
  | 'conversion-funnel'
  | 'lead-register'
  | 'lead-owner'
  | 'lead-priority'
  | 'lead-stage'
  | 'lead-conversion'
  | 'closed-leads'
  | 'lead-active-inactive'

export const CRM_REPORT_GETTERS: Record<CrmReportId, () => Record<string, unknown>[]> = {
  pipeline: getOpportunityPipelineReport,
  'stage-wise': getStageWiseOpportunityReport,
  'follow-up-due': getFollowUpDueReport,
  'sales-activity': getSalesActivityReport,
  'quotation-revision': getQuotationRevisionReport,
  'quotation-approval': getQuotationApprovalReport,
  'won-lost': getWonLostReport,
  'customer-pipeline': getCustomerPipelineReport,
  'conversion-funnel': getConversionFunnelReport,
  'lead-register': getLeadRegisterReport,
  'lead-owner': getLeadOwnerReport,
  'lead-priority': getLeadPriorityReport,
  'lead-stage': getLeadStageReport,
  'lead-conversion': getLeadConversionReport,
  'closed-leads': getClosedLeadReport,
  'lead-active-inactive': getLeadActiveInactiveReport,
}

export const CRM_REPORT_LABELS: Record<CrmReportId, string> = {
  pipeline: 'Opportunity Pipeline Report',
  'stage-wise': 'Stage-wise Opportunity Report',
  'follow-up-due': 'Follow-up Due Report',
  'sales-activity': 'Sales Activity Report',
  'quotation-revision': 'Quotation Revision Report',
  'quotation-approval': 'Quotation Approval Report',
  'won-lost': 'Won / Lost Report',
  'customer-pipeline': 'Customer Pipeline Report',
  'conversion-funnel': 'Conversion Funnel Report',
  'lead-register': 'Lead Register Report',
  'lead-owner': 'Lead Owner Report',
  'lead-priority': 'Priority-wise Lead Report',
  'lead-stage': 'Lead Stage Report',
  'lead-conversion': 'Lead Conversion Report',
  'closed-leads': 'Closed Lead Report',
  'lead-active-inactive': 'Active / Inactive Lead Report',
}
