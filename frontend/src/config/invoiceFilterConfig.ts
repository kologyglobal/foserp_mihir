import type { CrmFilterField, CrmFilterValues } from '../types/crmListFilters'
import {
  INVOICE_MATCHING_RESULT_STATUS_LABELS,
  PURCHASE_INVOICE_ORIGIN_LABELS,
  PURCHASE_INVOICE_STATUS_LABELS,
} from '../services/purchase'
import type {
  InvoiceMatchingResultStatus,
  PurchaseInvoiceOrigin,
  PurchaseInvoiceStatus,
} from '../types/purchaseDomain'

export interface InvoiceListFilters {
  search: string
  status: string
  vendorName: string
  origin: string
  matchingResultStatus: string
  matchStatus: string
  documentDateFrom: string
  documentDateTo: string
  dueDateFrom: string
  dueDateTo: string
}

export const DEFAULT_INVOICE_LIST_FILTERS: InvoiceListFilters = {
  search: '',
  status: '',
  vendorName: '',
  origin: '',
  matchingResultStatus: '',
  matchStatus: '',
  documentDateFrom: '',
  documentDateTo: '',
  dueDateFrom: '',
  dueDateTo: '',
}

export type InvoiceSortKey =
  | 'documentDate'
  | 'documentNumber'
  | 'vendorName'
  | 'totalAmount'
  | 'status'
  | 'matchingResultStatus'
  | 'dueDate'

export const INVOICE_SORT_OPTIONS: { value: InvoiceSortKey; label: string }[] = [
  { value: 'documentDate', label: 'Sort: Invoice Date' },
  { value: 'documentNumber', label: 'Sort: Invoice Number' },
  { value: 'vendorName', label: 'Sort: Vendor' },
  { value: 'totalAmount', label: 'Sort: Total Amount' },
  { value: 'status', label: 'Sort: Status' },
  { value: 'matchingResultStatus', label: 'Sort: Matching' },
  { value: 'dueDate', label: 'Sort: Due Date' },
]

/** Composite / KPI deep-link statuses (not domain enums). */
export const INVOICE_COMPOSITE_STATUS_OPTIONS = [
  { value: 'needs_attention', label: 'Needs Attention' },
  { value: 'mismatch_or_hold', label: 'Mismatch / On Hold' },
  { value: 'ready_to_post', label: 'Ready to Post' },
] as const

export const INVOICE_MATCH_STATUS_OPTIONS = [
  { value: 'unmatched', label: 'Unmatched' },
  { value: 'matched', label: 'Matched' },
  { value: 'mismatch', label: 'Mismatch' },
] as const

export function buildInvoiceFilterFields(input: {
  vendorOptions: string[]
}): CrmFilterField[] {
  return [
    {
      type: 'select',
      key: 'status',
      label: 'Invoice Status',
      options: [
        ...Object.entries(PURCHASE_INVOICE_STATUS_LABELS).map(([value, label]) => ({
          value,
          label,
        })),
        ...INVOICE_COMPOSITE_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
      ],
    },
    {
      type: 'search-select',
      key: 'vendorName',
      label: 'Vendor',
      options: input.vendorOptions.map((v) => ({ value: v, label: v })),
      placeholder: 'Search vendor…',
    },
    {
      type: 'select',
      key: 'origin',
      label: 'Origin',
      options: Object.entries(PURCHASE_INVOICE_ORIGIN_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    },
    {
      type: 'select',
      key: 'matchingResultStatus',
      label: 'Matching Result',
      options: Object.entries(INVOICE_MATCHING_RESULT_STATUS_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    },
    {
      type: 'select',
      key: 'matchStatus',
      label: 'Match Status',
      options: INVOICE_MATCH_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    },
    {
      type: 'date-range',
      label: 'Invoice Date',
      fromKey: 'documentDateFrom',
      toKey: 'documentDateTo',
      presets: true,
    },
    {
      type: 'date-range',
      label: 'Due Date',
      fromKey: 'dueDateFrom',
      toKey: 'dueDateTo',
    },
  ]
}

export function invoiceFiltersToCrmValues(filters: InvoiceListFilters): CrmFilterValues {
  return { ...filters }
}

export function crmValuesToInvoiceFilters(values: CrmFilterValues): InvoiceListFilters {
  const str = (key: keyof InvoiceListFilters) => {
    const v = values[key]
    return typeof v === 'string' ? v : ''
  }
  return {
    search: str('search'),
    status: str('status'),
    vendorName: str('vendorName'),
    origin: str('origin'),
    matchingResultStatus: str('matchingResultStatus'),
    matchStatus: str('matchStatus'),
    documentDateFrom: str('documentDateFrom'),
    documentDateTo: str('documentDateTo'),
    dueDateFrom: str('dueDateFrom'),
    dueDateTo: str('dueDateTo'),
  }
}

export function serializeInvoiceFilters(filters: InvoiceListFilters): Record<string, string> {
  return { ...filters }
}

export function hasActiveInvoiceFilters(filters: InvoiceListFilters): boolean {
  return (
    Object.entries(filters).some(([key, value]) => key !== 'search' && Boolean(value)) ||
    Boolean(filters.search.trim())
  )
}

export function invoiceFilterChipLabelResolver(key: string, value: string): string | undefined {
  if (key === 'status') {
    const composite = INVOICE_COMPOSITE_STATUS_OPTIONS.find((o) => o.value === value)
    if (composite) return composite.label
    return PURCHASE_INVOICE_STATUS_LABELS[value as PurchaseInvoiceStatus] ?? value
  }
  if (key === 'origin') {
    return PURCHASE_INVOICE_ORIGIN_LABELS[value as PurchaseInvoiceOrigin] ?? value
  }
  if (key === 'matchingResultStatus') {
    return INVOICE_MATCHING_RESULT_STATUS_LABELS[value as InvoiceMatchingResultStatus] ?? value
  }
  if (key === 'matchStatus') {
    return INVOICE_MATCH_STATUS_OPTIONS.find((o) => o.value === value)?.label ?? value
  }
  return undefined
}
