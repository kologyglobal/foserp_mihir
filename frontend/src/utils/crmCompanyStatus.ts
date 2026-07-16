import type { CrmActivity, FollowUp, Opportunity, QuotationDocument } from '../types/crm'

export type CrmCompanyStatusId =
  | 'active_pipeline'
  | 'overdue_followup'
  | 'hot_customer'
  | 'dormant'
  | 'quotation_pending'
  | 'ar_risk'
  | 'new_customer'
  | 'repeat_customer'

export interface CrmCompanyStatus {
  id: CrmCompanyStatusId
  label: string
  tone: 'success' | 'warning' | 'critical' | 'info' | 'neutral' | 'live' | 'pending'
}

const HOT_PIPELINE_MIN = 2_000_000
const HOT_PROBABILITY_MIN = 70
const AR_RISK_THRESHOLD = 500_000
const DORMANT_DAYS = 30

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null
  const start = new Date(iso.slice(0, 10))
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.floor((today.getTime() - start.getTime()) / 86400000)
}

export function resolveCrmCompanyStatus(input: {
  customerId: string
  opportunities: Opportunity[]
  followUps: FollowUp[]
  activities: CrmActivity[]
  quotationDocuments: QuotationDocument[]
  outstandingAr: number
  openOpportunities: number
  pipelineValue: number
  wonOpportunities: number
  openSalesOrders: number
  createdAt?: string
}): CrmCompanyStatus {
  const {
    customerId,
    opportunities,
    followUps,
    activities,
    quotationDocuments,
    outstandingAr,
    openOpportunities,
    pipelineValue,
    wonOpportunities,
    openSalesOrders,
    createdAt,
  } = input

  const hasOverdue = followUps.some((f) => f.customerId === customerId && f.status === 'overdue')
  if (hasOverdue) {
    return { id: 'overdue_followup', label: 'Overdue Follow-up', tone: 'critical' }
  }

  if (outstandingAr >= AR_RISK_THRESHOLD) {
    return { id: 'ar_risk', label: 'AR Risk', tone: 'warning' }
  }

  const custOpps = opportunities.filter((o) => o.customerId === customerId)
  const pendingQuotations = quotationDocuments.filter(
    (q) =>
      custOpps.some((o) => o.quotationId === q.quotationId) &&
      (q.status === 'pending_approval' || q.status === 'sent'),
  )
  if (pendingQuotations.length > 0) {
    return { id: 'quotation_pending', label: 'Quotation Pending', tone: 'pending' }
  }

  const maxProbability = Math.max(0, ...custOpps.filter((o) => o.status === 'open').map((o) => o.probability ?? 0))
  if (pipelineValue >= HOT_PIPELINE_MIN || maxProbability >= HOT_PROBABILITY_MIN) {
    return { id: 'hot_customer', label: 'Hot Customer', tone: 'live' }
  }

  if (openOpportunities > 0) {
    return { id: 'active_pipeline', label: 'Active Pipeline', tone: 'success' }
  }

  const lastActivity = activities
    .filter((a) => a.customerId === customerId)
    .sort((a, b) => b.activityDate.localeCompare(a.activityDate))[0]
  const idleDays = daysSince(lastActivity?.activityDate ?? createdAt ?? null)
  if (idleDays != null && idleDays >= DORMANT_DAYS) {
    return { id: 'dormant', label: 'Dormant', tone: 'neutral' }
  }

  if (wonOpportunities > 0 || openSalesOrders > 0) {
    return { id: 'repeat_customer', label: 'Repeat Customer', tone: 'info' }
  }

  return { id: 'new_customer', label: 'New Customer', tone: 'info' }
}
