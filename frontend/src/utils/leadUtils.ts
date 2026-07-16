import type {
  Lead,
  LeadLifecycleStatus,
  LeadPriority,
  LeadStage,
} from '../types/sales'
import { LEAD_STAGE_LABELS } from '../types/sales'
import type { Customer } from '../types/master'
import type { ErpSmartSelectOption } from '../components/erp/ErpSmartSelect'
import { getCrmMasterEntries, getCrmMasterLabel } from '../store/crmMasterStore'
import { getLeadUser } from '../data/crm/leadUsers'
import { getSessionUser } from './permissions'

const LEGACY_STAGE_MAP: Record<string, LeadStage> = {
  disqualified: 'not_qualified',
  converted: 'converted_to_opportunity',
}

export function migrateLeadStage(stage: string): LeadStage {
  return LEGACY_STAGE_MAP[stage] ?? (stage as LeadStage)
}

export function leadStageLabel(stage: LeadStage): string {
  const m = migrateLeadStage(stage)
  const fromMaster = getCrmMasterLabel('lead-stages', m)
  if (fromMaster && fromMaster !== m) return fromMaster
  return LEAD_STAGE_LABELS[m] ?? stage
}

export function deriveLifecycleFromStage(stage: LeadStage): LeadLifecycleStatus {
  const s = migrateLeadStage(stage)
  if (s === 'qualified') return 'qualified'
  if (s === 'converted_to_opportunity') return 'converted'
  if (s === 'closed') return 'closed'
  return 'open'
}

export function mapStageToLifecycle(stage: LeadStage): LeadLifecycleStatus {
  return deriveLifecycleFromStage(stage)
}

export function mapLifecycleToStage(lifecycle: LeadLifecycleStatus, current: LeadStage): LeadStage {
  const cur = migrateLeadStage(current)
  if (lifecycle === 'qualified') return 'qualified'
  if (lifecycle === 'converted') return 'converted_to_opportunity'
  if (lifecycle === 'closed') return 'closed'
  if (cur === 'converted_to_opportunity' || cur === 'closed') return cur
  if (cur === 'qualified') return 'qualified'
  if (cur === 'requirement_collected') return 'requirement_collected'
  if (cur === 'contacted') return 'contacted'
  return 'new'
}

export function isLeadStageLocked(stage: LeadStage): boolean {
  const s = migrateLeadStage(stage)
  return s === 'converted_to_opportunity' || s === 'closed'
}

export type LeadConvertToOpportunityInput = Pick<
  Lead,
  'stage' | 'customerId' | 'opportunityId' | 'lifecycleStatus'
>

/** Resolve company for Lead → Opportunity: reuse link or exact prospect-name match. */
export function resolveLeadCustomerIdForConvert(
  lead: Pick<Lead, 'customerId' | 'prospectName'>,
  customers: Customer[],
): { customerId: string | null; autoLinked: boolean } {
  if (lead.customerId?.trim()) {
    return { customerId: lead.customerId, autoLinked: false }
  }
  const prospect = lead.prospectName?.trim().toLowerCase()
  if (!prospect) return { customerId: null, autoLinked: false }
  const match = customers.find((c) => c.customerName.trim().toLowerCase() === prospect)
  if (!match) return { customerId: null, autoLinked: false }
  return { customerId: match.id, autoLinked: true }
}

/** Shared Lead → Opportunity gate (customer + Qualified; not already converted). */
export function resolveLeadConvertToOpportunityGate(
  lead: LeadConvertToOpportunityInput | null | undefined,
): { ok: true } | { ok: false; reason: string } {
  if (!lead) return { ok: false, reason: 'Lead not found' }
  if (
    lead.opportunityId
    || migrateLeadStage(lead.stage) === 'converted_to_opportunity'
    || lead.lifecycleStatus === 'converted'
  ) {
    return { ok: false, reason: 'Lead is already converted to an opportunity' }
  }
  if (!lead.customerId?.trim()) {
    return { ok: false, reason: 'Link a company before converting to an opportunity.' }
  }
  if (migrateLeadStage(lead.stage) !== 'qualified') {
    return { ok: false, reason: 'Qualify the lead before converting to an opportunity.' }
  }
  return { ok: true }
}

export function canConvertLeadToOpportunity(
  lead: LeadConvertToOpportunityInput | null | undefined,
): boolean {
  return resolveLeadConvertToOpportunityGate(lead).ok
}

export function leadStageChipTone(
  stage: LeadStage,
): 'info' | 'live' | 'pending' | 'success' | 'warning' | 'neutral' {
  const s = migrateLeadStage(stage)
  if (s === 'new') return 'info'
  if (s === 'contacted') return 'live'
  if (s === 'requirement_collected') return 'pending'
  if (s === 'qualified') return 'success'
  if (s === 'not_qualified') return 'warning'
  if (s === 'converted_to_opportunity') return 'success'
  return 'neutral'
}

export const LEAD_STAGE_OPTIONS: LeadStage[] = [
  'new',
  'contacted',
  'requirement_collected',
  'qualified',
  'not_qualified',
  'converted_to_opportunity',
  'closed',
]

/** Active lead stages from CRM Master Setup (falls back to defaults) */
export function resolveLeadStageOptions(): LeadStage[] {
  const entries = getCrmMasterEntries('lead-stages', true)
  if (entries.length > 0) return entries.map((e) => e.code as LeadStage)
  return LEAD_STAGE_OPTIONS
}

/** BC-style searchable options for lead stage picker */
export function buildLeadStageSmartSelectOptions(): ErpSmartSelectOption<LeadStage>[] {
  const entries = getCrmMasterEntries('lead-stages', true)
  if (entries.length > 0) {
    return entries.map((e) => ({
      value: e.code as LeadStage,
      label: e.name,
      searchText: [e.code, e.name, e.description].filter(Boolean).join(' ').toLowerCase(),
    }))
  }
  return LEAD_STAGE_OPTIONS.map((stage) => ({
    value: stage,
    label: leadStageLabel(stage),
    searchText: `${stage} ${leadStageLabel(stage)}`.toLowerCase(),
  }))
}

/** Active lead priorities from CRM Master Setup */
export function resolveLeadPriorityOptions(): { value: LeadPriority; label: string }[] {
  const entries = getCrmMasterEntries('lead-priorities', true)
  if (entries.length > 0) {
    return entries.map((e) => ({ value: e.code as LeadPriority, label: e.name }))
  }
  return [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' },
  ]
}

export function leadPriorityLabel(priority: LeadPriority): string {
  const fromMaster = getCrmMasterLabel('lead-priorities', priority)
  if (fromMaster && fromMaster !== priority) return fromMaster
  return priority.charAt(0).toUpperCase() + priority.slice(1)
}

export const LEAD_STAGE_FUNNEL: LeadStage[] = [
  'new',
  'contacted',
  'requirement_collected',
  'qualified',
  'converted_to_opportunity',
]

export function normalizeLead(lead: Lead): Lead {
  const today = new Date().toISOString().slice(0, 10)
  const resolvedOwnerName =
    lead.leadOwnerName?.trim()
    || lead.salesOwner?.trim()
    || (lead.leadOwnerId ? getLeadUser(lead.leadOwnerId)?.name : undefined)
    || getSessionUser().name
    || 'Unassigned'
  const stage = migrateLeadStage(lead.stage)
  const lifecycleStatus = lead.lifecycleStatus ?? deriveLifecycleFromStage(stage)
  return {
    ...lead,
    stage,
    salesOwner: resolvedOwnerName,
    leadOwnerId: lead.leadOwnerId?.trim() || getSessionUser().id || 'user-demo',
    leadOwnerName: resolvedOwnerName,
    priority: lead.priority ?? 'medium',
    createdDate: lead.createdDate ?? lead.createdAt?.slice(0, 10) ?? today,
    activityStatus: lead.activityStatus ?? 'active',
    inactiveReason: lead.inactiveReason ?? null,
    lifecycleStatus,
    closedDate: lead.closedDate ?? null,
    closedReason: lead.closedReason ?? null,
    notQualifiedReason: lead.notQualifiedReason ?? null,
    opportunityId: lead.opportunityId ?? null,
    productRequirement: lead.productRequirement ?? lead.remarks ?? '',
    expectedQty: lead.expectedQty ?? null,
    expectedCloseDate: lead.expectedCloseDate ?? null,
    contactPerson: lead.contactPerson ?? null,
    contactId: lead.contactId ?? null,
    mobile: lead.mobile ?? null,
    email: lead.email ?? null,
    nextFollowUpDate: lead.nextFollowUpDate ?? null,
    followUpType: lead.followUpType ?? null,
    followUpNotes: lead.followUpNotes ?? null,
    isArchived: lead.isArchived ?? false,
    locationId: lead.locationId ?? null,
  }
}

export function isLeadActiveForPipeline(lead: Lead): boolean {
  const n = normalizeLead(lead)
  return (
    n.activityStatus === 'active'
    && n.stage !== 'closed'
    && n.stage !== 'converted_to_opportunity'
    && n.lifecycleStatus !== 'closed'
  )
}

export function applyLeadStageDefaults(
  stage: LeadStage,
  current: Partial<Pick<Lead, 'activityStatus' | 'lifecycleStatus' | 'closedDate' | 'closedReason'>>,
): Partial<Pick<Lead, 'activityStatus' | 'lifecycleStatus' | 'closedDate' | 'closedReason'>> {
  const today = new Date().toISOString().slice(0, 10)
  const s = migrateLeadStage(stage)
  const patch: Partial<Pick<Lead, 'activityStatus' | 'lifecycleStatus' | 'closedDate' | 'closedReason'>> = {
    lifecycleStatus: deriveLifecycleFromStage(s),
  }
  if (s === 'new') {
    patch.activityStatus = 'active'
    patch.lifecycleStatus = 'open'
  }
  if (s === 'closed') {
    patch.lifecycleStatus = 'closed'
    patch.closedDate = current.closedDate || today
  }
  if (s === 'converted_to_opportunity') {
    patch.lifecycleStatus = 'converted'
  }
  return patch
}

export function leadPriorityTone(priority: LeadPriority): 'neutral' | 'blue' | 'amber' | 'red' {
  if (priority === 'critical') return 'red'
  if (priority === 'high') return 'amber'
  if (priority === 'medium') return 'blue'
  return 'neutral'
}

export function leadPriorityLiveTone(priority: LeadPriority): 'live' | 'healthy' | 'warning' | 'critical' {
  if (priority === 'critical') return 'critical'
  if (priority === 'high') return 'warning'
  if (priority === 'medium') return 'live'
  return 'healthy'
}

export function buildLeadsByStage(leads: Lead[]): { stage: LeadStage; label: string; count: number }[] {
  const normalized = leads.map(normalizeLead)
  const stages = resolveLeadStageOptions()
  return stages.map((stage) => ({
    stage,
    label: leadStageLabel(stage),
    count: normalized.filter((l) => l.stage === stage).length,
  }))
}

export function buildLeadStageFunnel(leads: Lead[]): { stage: LeadStage; label: string; count: number }[] {
  const normalized = leads.map(normalizeLead)
  return LEAD_STAGE_FUNNEL.map((stage) => ({
    stage,
    label: leadStageLabel(stage),
    count: normalized.filter((l) => l.stage === stage).length,
  }))
}
