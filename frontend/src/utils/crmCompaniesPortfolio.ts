import type { Customer } from '../types/master'
import type { CrmActivity, CrmContact, FollowUp, Opportunity, QuotationDocument } from '../types/crm'
import { customerCrmSummary, formatCrmCurrency } from './crmMetrics'
import { resolveCrmCompanyStatus, type CrmCompanyStatus } from './crmCompanyStatus'

export type CompanySortKey =
  | 'pipeline'
  | 'lastActivity'
  | 'followUp'
  | 'openOpportunities'
  | 'outstandingAr'
  | 'name'

export interface CompanyPortfolioFilters {
  search: string
  city: string
  territory: string
  customerType: string
  industry: string
  owner: string
  pipelineStatus: '' | 'active' | 'none'
  overdueFollowUp: boolean
  outstandingAr: boolean
  activeOpportunity: boolean
  sortBy: CompanySortKey
}

export const DEFAULT_COMPANY_FILTERS: CompanyPortfolioFilters = {
  search: '',
  city: '',
  territory: '',
  customerType: '',
  industry: '',
  owner: '',
  pipelineStatus: '',
  overdueFollowUp: false,
  outstandingAr: false,
  activeOpportunity: false,
  sortBy: 'pipeline',
}

export function hasActiveCompanyFilters(filters: CompanyPortfolioFilters): boolean {
  return (
    Boolean(filters.search.trim())
    || Boolean(filters.city)
    || Boolean(filters.territory)
    || Boolean(filters.customerType)
    || Boolean(filters.industry)
    || Boolean(filters.owner)
    || Boolean(filters.pipelineStatus)
    || filters.overdueFollowUp
    || filters.outstandingAr
    || filters.activeOpportunity
  )
}

export interface EnrichedCompanyRow {
  customer: Customer
  summary: ReturnType<typeof customerCrmSummary>
  openQuotations: number
  quotationValue: number
  openSO: number
  outstandingAr: number
  primaryContact: string
  ownerName: string
  status: CrmCompanyStatus
  daysSinceActivity: number | null
}

export interface CompanyPortfolioKpis {
  totalCompanies: number
  activePipelineCompanies: number
  pipelineValue: number
  overdueFollowUps: number
  openOpportunities: number
  quotationValue: number
  outstandingAr: number
}

export interface CompanyPortfolioInsight {
  id: string
  message: string
  filterPatch: Partial<CompanyPortfolioFilters>
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null
  const start = new Date(iso.slice(0, 10))
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.floor((today.getTime() - start.getTime()) / 86400000)
}

function resolveOwnerName(
  customer: Customer,
  opportunities: Opportunity[],
): string {
  if (customer.ownerName?.trim()) return customer.ownerName.trim()
  const open = opportunities.filter((o) => o.customerId === customer.id && o.status === 'open')
  const pick = open[0] ?? opportunities.find((o) => o.customerId === customer.id)
  return pick?.ownerName ?? 'Unassigned'
}

export function buildEnrichedCompanyRows(input: {
  customers: Customer[]
  contacts: CrmContact[]
  opportunities: Opportunity[]
  followUps: FollowUp[]
  activities: CrmActivity[]
  quotationDocuments: QuotationDocument[]
  salesOrders: Array<{ customerId: string; status: string }>
  receivables: Array<{ customerName: string; balanceDue: number }>
}): EnrichedCompanyRow[] {
  const {
    customers,
    contacts,
    opportunities,
    followUps,
    activities,
    quotationDocuments,
    salesOrders,
    receivables,
  } = input

  return customers.map((customer) => {
    const summary = customerCrmSummary(customer.id, opportunities, followUps, activities)
    const custOpps = opportunities.filter((o) => o.customerId === customer.id)
    const linkedQuotations = quotationDocuments.filter((d) =>
      custOpps.some((o) => o.quotationId === d.quotationId && d.status !== 'converted' && d.status !== 'rejected'),
    )
    const openSO = salesOrders.filter(
      (so) => so.customerId === customer.id && !['delivered', 'closed', 'cancelled'].includes(so.status),
    ).length
    const outstandingAr = receivables
      .filter((r) => r.customerName === customer.customerName)
      .reduce((s, r) => s + r.balanceDue, 0)
    const primary = contacts.find((c) => c.customerId === customer.id && c.isPrimary)

    return {
      customer,
      summary,
      openQuotations: linkedQuotations.length,
      quotationValue: linkedQuotations.reduce((s, q) => s + (q.totalAmount ?? 0), 0),
      openSO,
      outstandingAr,
      primaryContact: primary?.name ?? customer.contactPerson,
      ownerName: resolveOwnerName(customer, opportunities),
      status: resolveCrmCompanyStatus({
        customerId: customer.id,
        opportunities,
        followUps,
        activities,
        quotationDocuments,
        outstandingAr,
        openOpportunities: summary.openOpportunities,
        pipelineValue: summary.pipelineValue,
        wonOpportunities: summary.wonOpportunities,
        openSalesOrders: openSO,
        createdAt: customer.createdAt,
      }),
      daysSinceActivity: daysSince(summary.lastActivityAt),
    }
  })
}

export function filterCompanyRows(rows: EnrichedCompanyRow[], filters: CompanyPortfolioFilters): EnrichedCompanyRow[] {
  const q = filters.search.trim().toLowerCase()
  return rows.filter(({ customer, summary, primaryContact, outstandingAr, ownerName }) => {
    if (q) {
      const hay = [customer.customerName, customer.city, primaryContact, customer.contactPerson]
        .join(' ')
        .toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (filters.city && customer.city !== filters.city) return false
    if (filters.territory && customer.salesTerritory !== filters.territory) return false
    if (filters.customerType && customer.customerType !== filters.customerType) return false
    if (filters.industry && (customer.industry ?? '') !== filters.industry) return false
    if (filters.owner && ownerName !== filters.owner) return false
    if (filters.pipelineStatus === 'active' && summary.openOpportunities === 0) return false
    if (filters.pipelineStatus === 'none' && summary.openOpportunities > 0) return false
    if (filters.overdueFollowUp && !summary.hasOverdueFollowUp) return false
    if (filters.outstandingAr && outstandingAr <= 0) return false
    if (filters.activeOpportunity && summary.openOpportunities === 0) return false
    return true
  })
}

export function sortCompanyRows(rows: EnrichedCompanyRow[], sortBy: CompanySortKey): EnrichedCompanyRow[] {
  const list = [...rows]
  switch (sortBy) {
    case 'name':
      list.sort((a, b) => a.customer.customerName.localeCompare(b.customer.customerName))
      break
    case 'lastActivity':
      list.sort((a, b) => (b.summary.lastActivityAt ?? '').localeCompare(a.summary.lastActivityAt ?? ''))
      break
    case 'followUp':
      list.sort((a, b) => {
        if (a.summary.hasOverdueFollowUp && !b.summary.hasOverdueFollowUp) return -1
        if (!a.summary.hasOverdueFollowUp && b.summary.hasOverdueFollowUp) return 1
        return (a.summary.nextFollowUpDate ?? '9999').localeCompare(b.summary.nextFollowUpDate ?? '9999')
      })
      break
    case 'openOpportunities':
      list.sort((a, b) => b.summary.openOpportunities - a.summary.openOpportunities)
      break
    case 'outstandingAr':
      list.sort((a, b) => b.outstandingAr - a.outstandingAr)
      break
    default:
      list.sort((a, b) => b.summary.pipelineValue - a.summary.pipelineValue)
  }
  return list
}

export function buildCompanyPortfolioKpis(rows: EnrichedCompanyRow[]): CompanyPortfolioKpis {
  return {
    totalCompanies: rows.length,
    activePipelineCompanies: rows.filter((r) => r.summary.openOpportunities > 0).length,
    pipelineValue: rows.reduce((s, r) => s + r.summary.pipelineValue, 0),
    overdueFollowUps: rows.filter((r) => r.summary.hasOverdueFollowUp).length,
    openOpportunities: rows.reduce((s, r) => s + r.summary.openOpportunities, 0),
    quotationValue: rows.reduce((s, r) => s + r.quotationValue, 0),
    outstandingAr: rows.reduce((s, r) => s + r.outstandingAr, 0),
  }
}

export function buildCompanyPortfolioInsights(
  rows: EnrichedCompanyRow[],
  quotationDocuments: QuotationDocument[],
  opportunities: Opportunity[],
): CompanyPortfolioInsight[] {
  const insights: CompanyPortfolioInsight[] = []

  const overdueCount = rows.filter((r) => r.summary.hasOverdueFollowUp).length
  if (overdueCount > 0) {
    insights.push({
      id: 'overdue',
      message: `${overdueCount} companies have overdue follow-ups.`,
      filterPatch: { overdueFollowUp: true, pipelineStatus: '', activeOpportunity: false },
    })
  }

  const hotPipeline = rows.filter((r) => r.summary.pipelineValue >= 1_000_000 && r.summary.openOpportunities > 0)
  const hotValue = hotPipeline.reduce((s, r) => s + r.summary.pipelineValue, 0)
  if (hotValue > 0) {
    insights.push({
      id: 'pipeline-attention',
      message: `${formatCrmCurrency(hotValue)} pipeline needs attention.`,
      filterPatch: { pipelineStatus: 'active', activeOpportunity: true },
    })
  }

  const inactive = rows.filter((r) => r.daysSinceActivity != null && r.daysSinceActivity >= 14).length
  if (inactive > 0) {
    insights.push({
      id: 'inactive',
      message: `${inactive} companies have no activity in last 14 days.`,
      filterPatch: { pipelineStatus: 'none' },
    })
  }

  const approvedNotConverted = quotationDocuments.filter((q) => {
    if (q.status !== 'approved') return false
    const opp = opportunities.find((o) => o.quotationId === q.quotationId)
    return opp && !opp.salesOrderId
  }).length
  if (approvedNotConverted > 0) {
    insights.push({
      id: 'approved-quotations',
      message: `${approvedNotConverted} approved quotations are not converted to sales order.`,
      filterPatch: { pipelineStatus: 'active' },
    })
  }

  return insights.slice(0, 4)
}

export function filtersToRecord(filters: CompanyPortfolioFilters): Record<string, string> {
  return Object.fromEntries(Object.entries(filters).map(([k, v]) => [k, String(v)]))
}

export function recordToFilters(record: Record<string, string>): CompanyPortfolioFilters {
  return {
    ...DEFAULT_COMPANY_FILTERS,
    search: record.search ?? '',
    city: record.city ?? '',
    territory: record.territory ?? '',
    customerType: record.customerType ?? '',
    industry: record.industry ?? '',
    owner: record.owner ?? '',
    pipelineStatus: (record.pipelineStatus as CompanyPortfolioFilters['pipelineStatus']) ?? '',
    overdueFollowUp: record.overdueFollowUp === 'true',
    outstandingAr: record.outstandingAr === 'true',
    activeOpportunity: record.activeOpportunity === 'true',
    sortBy: (record.sortBy as CompanySortKey) ?? 'pipeline',
  }
}
