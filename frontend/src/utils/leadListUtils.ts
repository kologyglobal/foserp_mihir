import type { Customer } from '../types/master'
import type { Lead, LeadStage } from '../types/sales'
import type { CrmActivity, FollowUp, Opportunity } from '../types/crm'
import { formatStatus } from '../components/ui/Badge'
import { normalizeLead, leadStageLabel, resolveLeadStageOptions, resolveLeadPriorityOptions } from './leadUtils'
import { leadSourceLabel } from './leadSourceOptions'

export type LeadDisplayStatus = 'active' | 'inactive' | 'open' | 'closed' | 'converted'

export interface EnrichedLeadRow {
  lead: Lead
  prospectDisplay: string
  sourceDisplay: string
  industryDisplay: string
  locationDisplay: string
  accountTypeDisplay: string
  displayStatus: LeadDisplayStatus
  lastModified: string
}

export interface LeadListFilters {
  search: string
  source: string
  industry: string
  owner: string
  status: string
  stage: string
  priority: string
  probMin: string
  probMax: string
  valueMin: string
  valueMax: string
  dateFrom: string
  dateTo: string
  modifiedFrom: string
  modifiedTo: string
}

export const DEFAULT_LEAD_LIST_FILTERS: LeadListFilters = {
  search: '',
  source: '',
  industry: '',
  owner: '',
  status: '',
  stage: '',
  priority: '',
  probMin: '',
  probMax: '',
  valueMin: '',
  valueMax: '',
  dateFrom: '',
  dateTo: '',
  modifiedFrom: '',
  modifiedTo: '',
}

const ADVANCED_FILTER_KEYS: (keyof LeadListFilters)[] = [
  'probMin', 'probMax', 'valueMin', 'valueMax', 'dateFrom', 'dateTo', 'modifiedFrom', 'modifiedTo',
]

export function countActiveLeadFilters(filters: LeadListFilters): number {
  return Object.entries(filters).filter(([, v]) => Boolean(v)).length
}

export function countAdvancedLeadFilters(filters: LeadListFilters): number {
  return ADVANCED_FILTER_KEYS.filter((key) => Boolean(filters[key])).length
}

export function hasActiveLeadFilters(filters: LeadListFilters): boolean {
  return countActiveLeadFilters(filters) > 0
}

export function clearAdvancedLeadFilters(filters: LeadListFilters): LeadListFilters {
  const next = { ...filters }
  for (const key of ADVANCED_FILTER_KEYS) next[key] = ''
  return next
}

export function serializeLeadFilters(filters: LeadListFilters): Record<string, string> {
  return Object.fromEntries(Object.entries(filters).map(([k, v]) => [k, v ?? '']))
}

export type LeadFilterChip = { id: keyof LeadListFilters; label: string }

export function buildLeadFilterChips(filters: LeadListFilters): LeadFilterChip[] {
  const chips: LeadFilterChip[] = []
  if (filters.search) chips.push({ id: 'search', label: `Search: ${filters.search}` })
  if (filters.stage) chips.push({ id: 'stage', label: leadStageLabel(filters.stage as LeadStage) })
  if (filters.status) chips.push({ id: 'status', label: leadDisplayStatusLabel(filters.status as LeadDisplayStatus) })
  if (filters.owner) chips.push({ id: 'owner', label: filters.owner })
  if (filters.source) chips.push({ id: 'source', label: filters.source })
  if (filters.industry) chips.push({ id: 'industry', label: filters.industry })
  if (filters.priority) {
    const label = leadPriorityFilterOptions().find((p) => p.id === filters.priority)?.label ?? filters.priority
    chips.push({ id: 'priority', label })
  }
  if (filters.probMin) chips.push({ id: 'probMin', label: `Prob ≥ ${filters.probMin}%` })
  if (filters.probMax) chips.push({ id: 'probMax', label: `Prob ≤ ${filters.probMax}%` })
  if (filters.valueMin) chips.push({ id: 'valueMin', label: `Value ≥ ₹${Number(filters.valueMin).toLocaleString('en-IN')}` })
  if (filters.valueMax) chips.push({ id: 'valueMax', label: `Value ≤ ₹${Number(filters.valueMax).toLocaleString('en-IN')}` })
  if (filters.dateFrom) chips.push({ id: 'dateFrom', label: `Created from ${filters.dateFrom}` })
  if (filters.dateTo) chips.push({ id: 'dateTo', label: `Created to ${filters.dateTo}` })
  if (filters.modifiedFrom) chips.push({ id: 'modifiedFrom', label: `Modified from ${filters.modifiedFrom}` })
  if (filters.modifiedTo) chips.push({ id: 'modifiedTo', label: `Modified to ${filters.modifiedTo}` })
  return chips
}

export function getLeadDisplayStatus(lead: Lead): LeadDisplayStatus {
  const n = normalizeLead(lead)
  if (n.lifecycleStatus === 'converted' || n.stage === 'converted_to_opportunity') return 'converted'
  if (n.lifecycleStatus === 'closed' || n.stage === 'closed') return 'closed'
  if (n.activityStatus === 'inactive') return 'inactive'
  if (n.lifecycleStatus === 'open') return 'open'
  return 'active'
}

export function leadDisplayStatusLabel(status: LeadDisplayStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function leadDisplayStatusTone(
  status: LeadDisplayStatus,
): 'success' | 'warning' | 'critical' | 'info' | 'neutral' | 'live' {
  if (status === 'converted') return 'success'
  if (status === 'closed') return 'neutral'
  if (status === 'inactive') return 'warning'
  if (status === 'open') return 'info'
  return 'live'
}

export function resolveLeadSourceIndustry(
  lead: Lead,
  customer?: Customer | null,
): { source: string; industry: string } {
  const n = normalizeLead(lead)
  return {
    source: leadSourceLabel(n.source) || formatStatus(n.source),
    industry: customer?.industry?.trim() || n.industry || '—',
  }
}

export function enrichLeadRow(lead: Lead, customer?: Customer | null): EnrichedLeadRow {
  const n = normalizeLead(lead)
  const { source, industry } = resolveLeadSourceIndustry(n, customer)
  const prospectDisplay = customer?.customerName?.trim() || n.prospectName
  const lastModified = n.modifiedAt ?? n.createdAt
  const locationDisplay = customer?.city?.trim() || '—'
  const accountTypeDisplay = customer
    ? customer.isCustomer
      ? 'Customer'
      : 'Prospect'
    : 'Prospect'
  return {
    lead: n,
    prospectDisplay,
    sourceDisplay: source,
    industryDisplay: industry,
    locationDisplay,
    accountTypeDisplay,
    displayStatus: getLeadDisplayStatus(n),
    lastModified,
  }
}

export function sortLeadsByLastModified(rows: EnrichedLeadRow[]): EnrichedLeadRow[] {
  return sortLeadRows(rows, 'lastModified')
}

export type LeadSortKey =
  | 'lastModified'
  | 'prospect'
  | 'expectedValue'
  | 'probability'
  | 'createdDate'
  | 'owner'
  | 'stage'

export function sortLeadRows(rows: EnrichedLeadRow[], sortBy: LeadSortKey): EnrichedLeadRow[] {
  const sorted = [...rows]
  switch (sortBy) {
    case 'prospect':
      sorted.sort((a, b) => a.prospectDisplay.localeCompare(b.prospectDisplay))
      break
    case 'expectedValue':
      sorted.sort((a, b) => b.lead.expectedValue - a.lead.expectedValue)
      break
    case 'probability':
      sorted.sort((a, b) => b.lead.probability - a.lead.probability)
      break
    case 'createdDate':
      sorted.sort((a, b) => b.lead.createdDate.localeCompare(a.lead.createdDate))
      break
    case 'owner':
      sorted.sort((a, b) => a.lead.leadOwnerName.localeCompare(b.lead.leadOwnerName))
      break
    case 'stage': {
      const stageOrder = resolveLeadStageOptions()
      const rank = (stage: LeadStage) => {
        const i = stageOrder.indexOf(stage)
        return i >= 0 ? i : stageOrder.length
      }
      sorted.sort((a, b) => rank(a.lead.stage) - rank(b.lead.stage))
      break
    }
    case 'lastModified':
    default:
      sorted.sort((a, b) => b.lastModified.localeCompare(a.lastModified))
      break
  }
  return sorted
}

export function filterLeadRows(rows: EnrichedLeadRow[], filters: LeadListFilters): EnrichedLeadRow[] {
  return rows.filter((row) => {
    const n = row.lead
    if (filters.search) {
      const s = filters.search.toLowerCase()
      const hit =
        n.leadNo.toLowerCase().includes(s) ||
        row.prospectDisplay.toLowerCase().includes(s) ||
        n.leadOwnerName.toLowerCase().includes(s)
      if (!hit) return false
    }
    if (filters.source && row.sourceDisplay !== filters.source) return false
    if (filters.industry && row.industryDisplay !== filters.industry) return false
    if (filters.owner && n.leadOwnerName !== filters.owner) return false
    if (filters.status && row.displayStatus !== filters.status) return false
    if (filters.stage && n.stage !== filters.stage) return false
    if (filters.priority && n.priority !== filters.priority) return false
    if (filters.probMin && n.probability < Number(filters.probMin)) return false
    if (filters.probMax && n.probability > Number(filters.probMax)) return false
    if (filters.valueMin && n.expectedValue < Number(filters.valueMin)) return false
    if (filters.valueMax && n.expectedValue > Number(filters.valueMax)) return false
    if (filters.dateFrom && n.createdDate < filters.dateFrom) return false
    if (filters.dateTo && n.createdDate > filters.dateTo) return false
    const mod = row.lastModified.slice(0, 10)
    if (filters.modifiedFrom && mod < filters.modifiedFrom) return false
    if (filters.modifiedTo && mod > filters.modifiedTo) return false
    return true
  })
}

export function canDeleteLead(input: {
  lead: Lead
  opportunities: Opportunity[]
  activities: CrmActivity[]
  followUps: FollowUp[]
  inquiryCount: number
  quotationCount?: number
}): { ok: boolean; reason?: string } {
  const blockMsg = 'This lead cannot be deleted because it has linked CRM records. Mark it inactive or closed instead.'
  const n = normalizeLead(input.lead)
  if (n.isArchived) return { ok: false, reason: 'Lead is already archived.' }
  if (n.stage === 'converted_to_opportunity' || n.lifecycleStatus === 'converted') {
    return { ok: false, reason: blockMsg }
  }
  if (n.opportunityId || input.opportunities.some((o) => o.customerId === n.customerId && o.status === 'open')) {
    return { ok: false, reason: blockMsg }
  }
  if (input.inquiryCount > 0) {
    return { ok: false, reason: blockMsg }
  }
  if ((input.quotationCount ?? 0) > 0) {
    return { ok: false, reason: blockMsg }
  }
  if (input.activities.length > 0 || input.followUps.length > 0) {
    return { ok: false, reason: blockMsg }
  }
  return { ok: true }
}

export function leadStageFilterOptions(): { id: LeadStage; label: string }[] {
  return resolveLeadStageOptions().map((id) => ({ id, label: leadStageLabel(id) }))
}

export function leadPriorityFilterOptions(): { id: string; label: string }[] {
  return resolveLeadPriorityOptions().map((p) => ({ id: p.value, label: p.label }))
}
