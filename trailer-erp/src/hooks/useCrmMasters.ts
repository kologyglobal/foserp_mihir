import { useMemo } from 'react'
import type { CrmMasterKind } from '../types/crmMasters'
import { useCrmMasterStore } from '../store/crmMasterStore'
import { getLeadReasonCategoryEntries } from '../utils/crmMasterUtils'
import { resolveFollowUpTypeOptions, resolveManualActivityTypeOptions } from '../utils/engagementTypeUtils'
import { buildLeadSourceSelectOptions } from '../utils/leadSourceOptions'
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
  return useMemo(
    () => entries.map((e) => ({
      value: e.code,
      label: e.name,
      role: String(e.attributes.role ?? ''),
      department: String(e.attributes.department ?? ''),
    })),
    [entries],
  )
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
