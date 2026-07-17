import type { CrmFilterField, CrmFilterValues } from '../types/crmListFilters'
import {
  PURCHASE_REQUISITION_PRIORITY_LABELS,
  PURCHASE_REQUISITION_SOURCE_LABELS,
  PURCHASE_REQUISITION_STATUS_LABELS,
} from '../services/purchase'
import type {
  PurchaseRequisitionPriority,
  PurchaseRequisitionSource,
  PurchaseRequisitionStatus,
} from '../types/purchaseDomain'

export interface PrListFilters {
  search: string
  status: string
  documentDateFrom: string
  documentDateTo: string
  requiredByFrom: string
  requiredByTo: string
  department: string
  locationId: string
  requesterId: string
  priority: string
  source: string
}

export const DEFAULT_PR_LIST_FILTERS: PrListFilters = {
  search: '',
  status: '',
  documentDateFrom: '',
  documentDateTo: '',
  requiredByFrom: '',
  requiredByTo: '',
  department: '',
  locationId: '',
  requesterId: '',
  priority: '',
  source: '',
}

export type PrSortKey =
  | 'documentDate'
  | 'documentNumber'
  | 'estimatedValue'
  | 'requiredBy'
  | 'status'
  | 'priority'
  | 'department'
  | 'requester'

export const PR_SORT_OPTIONS: { value: PrSortKey; label: string }[] = [
  { value: 'documentDate', label: 'Sort: PR Date' },
  { value: 'documentNumber', label: 'Sort: PR Number' },
  { value: 'estimatedValue', label: 'Sort: Est. Value' },
  { value: 'requiredBy', label: 'Sort: Required By' },
  { value: 'status', label: 'Sort: Status' },
  { value: 'priority', label: 'Sort: Priority' },
  { value: 'department', label: 'Sort: Department' },
  { value: 'requester', label: 'Sort: Requester' },
]

export function buildPrFilterFields(input: {
  departmentOptions: string[]
  locationOptions: { id: string; name: string }[]
  requesterOptions: { id: string; name: string }[]
}): CrmFilterField[] {
  return [
    {
      type: 'select',
      key: 'status',
      label: 'Status',
      options: [
        ...Object.entries(PURCHASE_REQUISITION_STATUS_LABELS).map(([value, label]) => ({
          value,
          label,
        })),
        { value: 'converted', label: 'Converted (RFQ / PO)' },
        { value: 'pending_po', label: 'Pending PO (approved, no RFQ)' },
        { value: 'pending_rfq', label: 'Pending RFQ (approved, RFQ required)' },
      ],
    },
    {
      type: 'search-select',
      key: 'department',
      label: 'Department',
      options: input.departmentOptions.map((d) => ({ value: d, label: d })),
      placeholder: 'Search department…',
    },
    {
      type: 'search-select',
      key: 'locationId',
      label: 'Location',
      options: input.locationOptions.map((l) => ({ value: l.id, label: l.name })),
      placeholder: 'Search location…',
    },
    {
      type: 'search-select',
      key: 'requesterId',
      label: 'Requested By',
      options: input.requesterOptions.map((r) => ({ value: r.id, label: r.name })),
      placeholder: 'Search requester…',
    },
    {
      type: 'select',
      key: 'priority',
      label: 'Priority',
      options: Object.entries(PURCHASE_REQUISITION_PRIORITY_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    },
    {
      type: 'select',
      key: 'source',
      label: 'Source',
      options: Object.entries(PURCHASE_REQUISITION_SOURCE_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    },
    {
      type: 'date-range',
      label: 'PR Date',
      fromKey: 'documentDateFrom',
      toKey: 'documentDateTo',
      presets: true,
    },
    {
      type: 'date-range',
      label: 'Required By',
      fromKey: 'requiredByFrom',
      toKey: 'requiredByTo',
    },
  ]
}

export function prFiltersToCrmValues(filters: PrListFilters): CrmFilterValues {
  return { ...filters }
}

export function crmValuesToPrFilters(values: CrmFilterValues): PrListFilters {
  const str = (key: keyof PrListFilters) => {
    const v = values[key]
    return typeof v === 'string' ? v : ''
  }
  return {
    search: str('search'),
    status: str('status'),
    documentDateFrom: str('documentDateFrom'),
    documentDateTo: str('documentDateTo'),
    requiredByFrom: str('requiredByFrom'),
    requiredByTo: str('requiredByTo'),
    department: str('department'),
    locationId: str('locationId'),
    requesterId: str('requesterId'),
    priority: str('priority'),
    source: str('source'),
  }
}

export function serializePrFilters(filters: PrListFilters): Record<string, string> {
  return { ...filters }
}

export function hasActivePrFilters(filters: PrListFilters): boolean {
  return Object.entries(filters).some(([key, value]) => key !== 'search' && Boolean(value))
    || Boolean(filters.search.trim())
}

export function prFilterChipLabelResolver(
  key: string,
  value: string,
  lookups?: {
    locations?: { id: string; name: string }[]
    requesters?: { id: string; name: string }[]
  },
): string | undefined {
  if (key === 'status') {
    if (value === 'converted') return 'Converted'
    return (
      PURCHASE_REQUISITION_STATUS_LABELS[value as PurchaseRequisitionStatus] ?? value
    )
  }
  if (key === 'priority') {
    return PURCHASE_REQUISITION_PRIORITY_LABELS[value as PurchaseRequisitionPriority] ?? value
  }
  if (key === 'source') {
    return PURCHASE_REQUISITION_SOURCE_LABELS[value as PurchaseRequisitionSource] ?? value
  }
  if (key === 'locationId') {
    return lookups?.locations?.find((l) => l.id === value)?.name ?? value
  }
  if (key === 'requesterId') {
    return lookups?.requesters?.find((r) => r.id === value)?.name ?? value
  }
  return undefined
}
