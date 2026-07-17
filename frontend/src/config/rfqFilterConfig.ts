import type { CrmFilterField, CrmFilterValues } from '../types/crmListFilters'
import { RFQ_DOMAIN_STATUS_LABELS } from '../types/purchaseDomain'
import type { RfqListRow } from '../types/purchaseDomain'

export interface RfqListFilters {
  search: string
  status: string
  buyerName: string
  locationName: string
}

export const DEFAULT_RFQ_LIST_FILTERS: RfqListFilters = {
  search: '',
  status: '',
  buyerName: '',
  locationName: '',
}

export type RfqSortKey = 'documentDate' | 'documentNumber' | 'bidDueDate' | 'estimatedValue' | 'status'

export const RFQ_SORT_OPTIONS: { value: RfqSortKey; label: string }[] = [
  { value: 'documentDate', label: 'Sort: RFQ Date' },
  { value: 'documentNumber', label: 'Sort: RFQ Number' },
  { value: 'bidDueDate', label: 'Sort: Bid Due' },
  { value: 'estimatedValue', label: 'Sort: Value' },
  { value: 'status', label: 'Sort: Status' },
]

export function buildRfqFilterFields(input: {
  buyerOptions: string[]
  locationOptions: string[]
}): CrmFilterField[] {
  return [
    { type: 'section', label: 'Status & parties' },
    {
      type: 'select',
      key: 'status',
      label: 'Status',
      options: Object.entries(RFQ_DOMAIN_STATUS_LABELS).map(([value, label]) => ({ value, label })),
    },
    {
      type: 'select',
      key: 'buyerName',
      label: 'Buyer',
      options: input.buyerOptions.map((name) => ({ value: name, label: name })),
    },
    {
      type: 'select',
      key: 'locationName',
      label: 'Location',
      options: input.locationOptions.map((name) => ({ value: name, label: name })),
    },
  ]
}

export function rfqFiltersToCrmValues(filters: RfqListFilters): CrmFilterValues {
  return { ...filters }
}

export function crmValuesToRfqFilters(values: CrmFilterValues): RfqListFilters {
  return {
    search: String(values.search ?? ''),
    status: String(values.status ?? ''),
    buyerName: String(values.buyerName ?? ''),
    locationName: String(values.locationName ?? ''),
  }
}

export function rfqFilterChipLabelResolver(key: string, value: string): string | undefined {
  if (key === 'status') return RFQ_DOMAIN_STATUS_LABELS[value as keyof typeof RFQ_DOMAIN_STATUS_LABELS] ?? value
  if (key === 'buyerName') return `Buyer: ${value}`
  if (key === 'locationName') return `Location: ${value}`
  return undefined
}

export function hasActiveRfqFilters(filters: RfqListFilters): boolean {
  return Boolean(filters.status || filters.buyerName || filters.locationName || filters.search.trim())
}

export function filterRfqRows(rows: RfqListRow[], filters: RfqListFilters): RfqListRow[] {
  let list = [...rows]
  if (filters.status) list = list.filter((r) => r.status === filters.status)
  if (filters.buyerName) list = list.filter((r) => r.buyerName === filters.buyerName)
  if (filters.locationName) list = list.filter((r) => r.locationName === filters.locationName)
  if (filters.search.trim()) {
    const q = filters.search.trim().toLowerCase()
    list = list.filter(
      (r) =>
        r.documentNumber.toLowerCase().includes(q) ||
        r.buyerName.toLowerCase().includes(q) ||
        r.locationName.toLowerCase().includes(q) ||
        r.purchaseRequisitionNumbers.some((n) => n.toLowerCase().includes(q)),
    )
  }
  return list
}

export function sortRfqRows(rows: RfqListRow[], sortBy: RfqSortKey): RfqListRow[] {
  const list = [...rows]
  list.sort((a, b) => {
    switch (sortBy) {
      case 'documentNumber':
        return a.documentNumber.localeCompare(b.documentNumber)
      case 'bidDueDate':
        return a.bidDueDate.localeCompare(b.bidDueDate)
      case 'estimatedValue':
        return b.estimatedValue - a.estimatedValue
      case 'status':
        return a.statusLabel.localeCompare(b.statusLabel)
      case 'documentDate':
      default:
        return b.documentDate.localeCompare(a.documentDate)
    }
  })
  return list
}
