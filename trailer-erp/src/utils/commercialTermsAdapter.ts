import { useCrmMasterStore } from '../store/crmMasterStore'
import type { CrmMasterKind } from '../types/crmMasters'
import type { CommercialTerm } from '../types/master'

/** Legacy SO / quick-create termType → CRM master kind. Tax has no CRM commercial kind (use GST masters). */
export type CommercialTermUiType = CommercialTerm['termType']

const TERM_TYPE_TO_KIND: Partial<Record<CommercialTermUiType, CrmMasterKind>> = {
  payment: 'payment-terms',
  delivery: 'delivery-terms',
}

export function crmKindForCommercialTermType(termType: CommercialTermUiType): CrmMasterKind | null {
  return TERM_TYPE_TO_KIND[termType] ?? null
}

export function commercialTermListPath(termType: CommercialTermUiType): string {
  const kind = crmKindForCommercialTermType(termType)
  if (kind === 'payment-terms') return '/masters/payment-terms'
  if (kind === 'delivery-terms') return '/crm/masters/delivery-terms'
  return '/masters/gst-rates'
}

/** Map CRM master entries into the CommercialTerm shape used by SO / quick-create selects. */
export function mapCrmEntryToCommercialTerm(
  entry: { id: string; code: string; name: string; description?: string; status: string; createdAt: string },
  termType: CommercialTermUiType,
): CommercialTerm {
  return {
    id: entry.id,
    termType,
    code: entry.code,
    name: entry.name,
    description: entry.description ?? entry.name,
    isActive: entry.status === 'active',
    createdAt: entry.createdAt,
  }
}

export function listCommercialTermsFromCrm(termType: CommercialTermUiType, activeOnly = true): CommercialTerm[] {
  const kind = crmKindForCommercialTermType(termType)
  if (!kind) return []
  return useCrmMasterStore
    .getState()
    .getByKind(kind, activeOnly)
    .map((e) => mapCrmEntryToCommercialTerm(e, termType))
}

export function getCommercialTermById(id: string): CommercialTerm | undefined {
  const entry = useCrmMasterStore.getState().getEntry(id)
  if (!entry) return undefined
  if (entry.kind === 'payment-terms') return mapCrmEntryToCommercialTerm(entry, 'payment')
  if (entry.kind === 'delivery-terms') return mapCrmEntryToCommercialTerm(entry, 'delivery')
  return undefined
}
