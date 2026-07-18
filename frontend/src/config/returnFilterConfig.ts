import type { CrmFilterField, CrmFilterValues } from '../types/crmListFilters'
import {
  PURCHASE_RETURN_DOMAIN_STATUS_LABELS,
  type PurchaseReturnListRow,
} from '../types/purchaseDomain'

export interface ReturnListFilters {
  search: string
  status: string
  vendorName: string
}

export const DEFAULT_RETURN_LIST_FILTERS: ReturnListFilters = {
  search: '',
  status: '',
  vendorName: '',
}

export type ReturnSortKey = 'documentDate' | 'documentNumber' | 'vendorName' | 'status'

export const RETURN_SORT_OPTIONS: { value: ReturnSortKey; label: string }[] = [
  { value: 'documentDate', label: 'Sort: Date' },
  { value: 'documentNumber', label: 'Sort: Return No' },
  { value: 'vendorName', label: 'Sort: Vendor' },
  { value: 'status', label: 'Sort: Status' },
]

export function buildReturnFilterFields(input: { vendorOptions: string[] }): CrmFilterField[] {
  return [
    { type: 'section', label: 'Status & parties' },
    {
      type: 'select',
      key: 'status',
      label: 'Status',
      options: Object.entries(PURCHASE_RETURN_DOMAIN_STATUS_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    },
    {
      type: 'select',
      key: 'vendorName',
      label: 'Vendor',
      options: input.vendorOptions.map((name) => ({ value: name, label: name })),
    },
  ]
}

export function returnFiltersToCrmValues(filters: ReturnListFilters): CrmFilterValues {
  return { ...filters }
}

export function crmValuesToReturnFilters(values: CrmFilterValues): ReturnListFilters {
  return {
    search: String(values.search ?? ''),
    status: String(values.status ?? ''),
    vendorName: String(values.vendorName ?? ''),
  }
}

export function returnFilterChipLabelResolver(key: string, value: string): string | undefined {
  if (key === 'status') {
    return PURCHASE_RETURN_DOMAIN_STATUS_LABELS[value as keyof typeof PURCHASE_RETURN_DOMAIN_STATUS_LABELS] ?? value
  }
  if (key === 'vendorName') return `Vendor: ${value}`
  return undefined
}

export function hasActiveReturnFilters(filters: ReturnListFilters): boolean {
  return Boolean(filters.status || filters.vendorName || filters.search.trim())
}

export function filterReturnRows(
  rows: PurchaseReturnListRow[],
  filters: ReturnListFilters,
): PurchaseReturnListRow[] {
  let list = [...rows]
  if (filters.status) list = list.filter((r) => r.status === filters.status)
  if (filters.vendorName) list = list.filter((r) => r.vendorName === filters.vendorName)
  if (filters.search.trim()) {
    const q = filters.search.trim().toLowerCase()
    list = list.filter(
      (r) =>
        r.documentNumber.toLowerCase().includes(q) ||
        r.vendorName.toLowerCase().includes(q) ||
        (r.purchaseOrderNumber ?? '').toLowerCase().includes(q) ||
        (r.goodsReceiptNumber ?? '').toLowerCase().includes(q) ||
        r.returnReasonLabel.toLowerCase().includes(q),
    )
  }
  return list
}

export function sortReturnRows(
  rows: PurchaseReturnListRow[],
  sortBy: ReturnSortKey,
): PurchaseReturnListRow[] {
  const list = [...rows]
  list.sort((a, b) => {
    if (sortBy === 'documentNumber') return b.documentNumber.localeCompare(a.documentNumber)
    if (sortBy === 'vendorName') return a.vendorName.localeCompare(b.vendorName)
    if (sortBy === 'status') return a.status.localeCompare(b.status)
    return b.documentDate.localeCompare(a.documentDate)
  })
  return list
}
