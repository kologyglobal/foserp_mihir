import type { CrmFilterField, CrmFilterValues } from '../types/crmListFilters'
import { GRN_DOMAIN_STATUS_LABELS, type GrnListRow } from '../types/purchaseDomain'

export interface GrnListFilters {
  search: string
  status: string
  vendorName: string
}

export const DEFAULT_GRN_LIST_FILTERS: GrnListFilters = {
  search: '',
  status: '',
  vendorName: '',
}

export type GrnSortKey = 'documentDate' | 'documentNumber' | 'vendorName' | 'status'

export const GRN_SORT_OPTIONS: { value: GrnSortKey; label: string }[] = [
  { value: 'documentDate', label: 'Sort: Date' },
  { value: 'documentNumber', label: 'Sort: GRN Number' },
  { value: 'vendorName', label: 'Sort: Vendor' },
  { value: 'status', label: 'Sort: Status' },
]

export function buildGrnFilterFields(input: { vendorOptions: string[] }): CrmFilterField[] {
  return [
    { type: 'section', label: 'Status & parties' },
    {
      type: 'select',
      key: 'status',
      label: 'Status',
      options: Object.entries(GRN_DOMAIN_STATUS_LABELS).map(([value, label]) => ({ value, label })),
    },
    {
      type: 'select',
      key: 'vendorName',
      label: 'Vendor',
      options: input.vendorOptions.map((name) => ({ value: name, label: name })),
    },
  ]
}

export function grnFiltersToCrmValues(filters: GrnListFilters): CrmFilterValues {
  return { ...filters }
}

export function crmValuesToGrnFilters(values: CrmFilterValues): GrnListFilters {
  return {
    search: String(values.search ?? ''),
    status: String(values.status ?? ''),
    vendorName: String(values.vendorName ?? ''),
  }
}

export function grnFilterChipLabelResolver(key: string, value: string): string | undefined {
  if (key === 'status') return GRN_DOMAIN_STATUS_LABELS[value as keyof typeof GRN_DOMAIN_STATUS_LABELS] ?? value
  if (key === 'vendorName') return `Vendor: ${value}`
  return undefined
}

export function hasActiveGrnFilters(filters: GrnListFilters): boolean {
  return Boolean(filters.status || filters.vendorName || filters.search.trim())
}

export function filterGrnRows(rows: GrnListRow[], filters: GrnListFilters): GrnListRow[] {
  let list = [...rows]
  if (filters.status) list = list.filter((r) => r.status === filters.status)
  if (filters.vendorName) list = list.filter((r) => r.vendorName === filters.vendorName)
  if (filters.search.trim()) {
    const q = filters.search.trim().toLowerCase()
    list = list.filter(
      (r) =>
        r.documentNumber.toLowerCase().includes(q) ||
        r.purchaseOrderNumber.toLowerCase().includes(q) ||
        r.vendorName.toLowerCase().includes(q) ||
        r.vendorCode.toLowerCase().includes(q) ||
        (r.gateEntryNo ?? '').toLowerCase().includes(q) ||
        (r.vehicleNo ?? '').toLowerCase().includes(q),
    )
  }
  return list
}

export function sortGrnRows(rows: GrnListRow[], sortBy: GrnSortKey): GrnListRow[] {
  const list = [...rows]
  list.sort((a, b) => {
    if (sortBy === 'documentNumber') return b.documentNumber.localeCompare(a.documentNumber)
    if (sortBy === 'vendorName') return a.vendorName.localeCompare(b.vendorName)
    if (sortBy === 'status') return a.status.localeCompare(b.status)
    return b.documentDate.localeCompare(a.documentDate)
  })
  return list
}
