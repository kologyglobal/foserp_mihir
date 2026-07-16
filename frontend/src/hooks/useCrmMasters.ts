import { useMemo } from 'react'
import type { CrmMasterKind } from '../types/crmMasters'
import { useCrmMasterStore } from '../store/crmMasterStore'
import { getLeadReasonCategoryEntries } from '../utils/crmMasterUtils'
import { resolveFollowUpTypeOptions, resolveManualActivityTypeOptions } from '../utils/engagementTypeUtils'
import { buildLeadSourceSelectOptions } from '../utils/leadSourceOptions'
import { resolveOpportunityStagesFromEntries } from '../utils/opportunityUtils'
import { isApiMode } from '../config/apiConfig'
import { getSessionUser } from '../utils/permissions'
import { getActiveLeadUsers } from '../data/crm/leadUsers'
import type {
  LeadStage,
  LeadPriority,
  LeadInactiveReason,
  LeadClosedReason,
  LeadNotQualifiedReason,
} from '../types/sales'

export interface MasterOption {
  value: string
  label: string
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function useCrmMasterEntriesByKind(kind: CrmMasterKind, activeOnly: boolean) {
  const entries = useCrmMasterStore((s) => s.entries)
  return useMemo(() => useCrmMasterStore.getState().getByKind(kind, activeOnly), [entries, kind, activeOnly])
}

export function useCrmMasterOptions(kind: CrmMasterKind, activeOnly = true) {
  const entries = useCrmMasterEntriesByKind(kind, activeOnly)
  return useMemo<MasterOption[]>(
    () => entries.map((e) => ({ value: e.code, label: e.name })),
    [entries],
  )
}

export function useLeadStageOptions() {
  const entries = useCrmMasterEntriesByKind('lead-stages', true)
  return useMemo(
    () => entries.map((e) => ({ value: e.code as LeadStage, label: e.name })),
    [entries],
  )
}

export function useLeadPriorityOptions() {
  return useCrmMasterOptions('lead-priorities', true) as MasterOption[] & { value: LeadPriority }[]
}

export function useLeadReasonOptions(category: 'inactive' | 'closed' | 'not_qualified') {
  const entries = useCrmMasterStore((s) => s.entries)
  return useMemo(() => {
    return getLeadReasonCategoryEntries(entries, category, true).map((e) => ({
      value: e.code as LeadInactiveReason | LeadClosedReason | LeadNotQualifiedReason,
      label: e.name,
    }))
  }, [entries, category])
}

export function useFollowUpTypeOptions() {
  const entries = useCrmMasterStore((s) => s.entries)
  return useMemo(() => resolveFollowUpTypeOptions(), [entries])
}

export function useCrmOwnerOptions() {
  const entries = useCrmMasterEntriesByKind('owners', true)
  const session = getSessionUser()
  return useMemo(() => {
    const fromMasters = entries.map((e) => ({
      value: e.code,
      label: e.name,
      role: String(e.attributes.role ?? ''),
      department: String(e.attributes.department ?? ''),
    }))

    if (isApiMode()) {
      // Opportunity/lead assign APIs require real tenant user UUIDs
      const uuidOwners = fromMasters.filter((o) => isUuid(o.value))
      const sessionOpt = {
        value: session.id,
        label: session.name,
        role: String(session.role ?? ''),
        department: '',
      }
      if (isUuid(session.id) && !uuidOwners.some((o) => o.value === session.id)) {
        return [sessionOpt, ...uuidOwners]
      }
      if (uuidOwners.length > 0) return uuidOwners
      return isUuid(session.id) ? [sessionOpt] : []
    }

    if (fromMasters.length > 0) return fromMasters
    return getActiveLeadUsers().map((u) => ({
      value: u.id,
      label: u.name,
      role: u.role,
      department: u.department,
    }))
  }, [entries, session.id, session.name, session.role])
}

export function useIndustryOptions() {
  return useCrmMasterOptions('industries', true)
}

/** Contact/purchase forms store designation name as free text historically — options use name as value. */
export function useDesignationOptions() {
  const entries = useCrmMasterEntriesByKind('designations', true)
  return useMemo<MasterOption[]>(
    () => entries.map((e) => ({ value: e.name, label: e.name })),
    [entries],
  )
}

/** Department options use name as value for compatibility with existing contact/PR records. */
export function useDepartmentOptions() {
  const entries = useCrmMasterEntriesByKind('departments', true)
  return useMemo<MasterOption[]>(
    () => entries.map((e) => ({ value: e.name, label: e.name })),
    [entries],
  )
}

export function useLeadSourceOptions() {
  const fromMaster = useCrmMasterOptions('lead-sources', true)
  return useMemo(
    () => buildLeadSourceSelectOptions(fromMaster).map((o) => ({ value: o.value, label: o.label })),
    [fromMaster],
  )
}

export function useTerritoryOptions() {
  return useCrmMasterOptions('territories', true)
}

export function useOpportunityPriorityOptions() {
  const entries = useCrmMasterEntriesByKind('opportunity-priorities', true)
  return useMemo(
    () => entries.map((e) => ({ value: e.code, label: e.name })),
    [entries],
  )
}

export function useOpportunityStageOptions() {
  return useCrmMasterOptions('opportunity-stages', true)
}

/** Reactive opportunity stages from master store (with static fallback). Prefer over one-shot resolveOpportunityStages() in components. */
export function useResolvedOpportunityStages() {
  const entries = useCrmMasterEntriesByKind('opportunity-stages', true)
  return useMemo(() => resolveOpportunityStagesFromEntries(entries), [entries])
}

export function usePaymentTermOptions() {
  return useCrmMasterOptions('payment-terms', true)
}

export function useDeliveryTermOptions() {
  return useCrmMasterOptions('delivery-terms', true)
}

export function useWarrantyTermOptions() {
  return useCrmMasterOptions('warranty-terms', true)
}

export function useProductInterestOptions() {
  return useCrmMasterOptions('product-interests', true)
}

export function useLostReasonOptions() {
  return useCrmMasterOptions('lost-reasons', true)
}

export function useActivityTypeOptions() {
  const entries = useCrmMasterStore((s) => s.entries)
  return useMemo(() => resolveManualActivityTypeOptions(), [entries])
}

export function useDocumentTypeOptions(activeOnly = true) {
  return useCrmMasterOptions('document-types', activeOnly)
}
