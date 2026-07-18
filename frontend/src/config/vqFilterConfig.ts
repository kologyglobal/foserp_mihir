import type { CrmFilterField, CrmFilterValues } from '../types/crmListFilters'
import {
  VENDOR_QUOTATION_DOMAIN_STATUS_LABELS,
  type VendorQuotationListRow,
} from '../types/purchaseDomain'

export interface VqListFilters {
  search: string
  status: string
  vendorName: string
}

export const DEFAULT_VQ_LIST_FILTERS: VqListFilters = {
  search: '',
  status: '',
  vendorName: '',
}

export type VqSortKey = 'documentDate' | 'documentNumber' | 'vendorName' | 'totalAmount' | 'status'

export const VQ_SORT_OPTIONS: { value: VqSortKey; label: string }[] = [
  { value: 'documentDate', label: 'Sort: Date' },
  { value: 'documentNumber', label: 'Sort: VQ Number' },
  { value: 'vendorName', label: 'Sort: Vendor' },
  { value: 'totalAmount', label: 'Sort: Amount' },
  { value: 'status', label: 'Sort: Status' },
]

export function buildVqFilterFields(input: { vendorOptions: string[] }): CrmFilterField[] {
  return [
    { type: 'section', label: 'Status & vendor' },
    {
      type: 'select',
      key: 'status',
      label: 'Status',
      options: Object.entries(VENDOR_QUOTATION_DOMAIN_STATUS_LABELS).map(([value, label]) => ({
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

export function vqFiltersToCrmValues(filters: VqListFilters): CrmFilterValues {
  return { ...filters }
}

export function crmValuesToVqFilters(values: CrmFilterValues): VqListFilters {
  return {
    search: String(values.search ?? ''),
    status: String(values.status ?? ''),
    vendorName: String(values.vendorName ?? ''),
  }
}

export function vqFilterChipLabelResolver(key: string, value: string): string | undefined {
  if (key === 'status') {
    return (
      VENDOR_QUOTATION_DOMAIN_STATUS_LABELS[value as keyof typeof VENDOR_QUOTATION_DOMAIN_STATUS_LABELS] ??
      value
    )
  }
  if (key === 'vendorName') return `Vendor: ${value}`
  return undefined
}

export function hasActiveVqFilters(filters: VqListFilters): boolean {
  return Boolean(filters.status || filters.vendorName || filters.search.trim())
}

export function filterVqRows(rows: VendorQuotationListRow[], filters: VqListFilters): VendorQuotationListRow[] {
  let list = [...rows]
  if (filters.status) list = list.filter((r) => r.status === filters.status)
  if (filters.vendorName) list = list.filter((r) => r.vendorName === filters.vendorName)
  if (filters.search.trim()) {
    const q = filters.search.trim().toLowerCase()
    list = list.filter(
      (r) =>
        r.documentNumber.toLowerCase().includes(q) ||
        r.rfqNumber.toLowerCase().includes(q) ||
        r.vendorName.toLowerCase().includes(q) ||
        r.vendorCode.toLowerCase().includes(q) ||
        r.vendorReferenceNumber.toLowerCase().includes(q),
    )
  }
  return list
}

export function sortVqRows(rows: VendorQuotationListRow[], sortBy: VqSortKey): VendorQuotationListRow[] {
  const list = [...rows]
  list.sort((a, b) => {
    switch (sortBy) {
      case 'documentNumber':
        return a.documentNumber.localeCompare(b.documentNumber)
      case 'vendorName':
        return a.vendorName.localeCompare(b.vendorName)
      case 'totalAmount':
        return b.totalAmount - a.totalAmount
      case 'status':
        return a.statusLabel.localeCompare(b.statusLabel)
      case 'documentDate':
      default:
        return b.documentDate.localeCompare(a.documentDate)
    }
  })
  return list
}
