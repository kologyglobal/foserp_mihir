import type { CrmFilterField, CrmFilterValues } from '../types/crmListFilters'
import {
  PURCHASE_ORDER_APPROVAL_STATUS_LABELS,
  PURCHASE_ORDER_DOMAIN_STATUS_LABELS,
  PURCHASE_ORDER_INVOICE_STATUS_LABELS,
  PURCHASE_ORDER_ORIGIN_LABELS,
} from '../services/purchase'
import type {
  PurchaseOrderApprovalStatus,
  PurchaseOrderDomainStatus,
  PurchaseOrderInvoiceStatus,
  PurchaseOrderOrigin,
} from '../types/purchaseDomain'

export interface PoListFilters {
  search: string
  status: string
  vendorName: string
  locationName: string
  buyerName: string
  approvalStatus: string
  invoiceStatus: string
  origin: string
  documentDateFrom: string
  documentDateTo: string
  expectedDeliveryFrom: string
  expectedDeliveryTo: string
}

export const DEFAULT_PO_LIST_FILTERS: PoListFilters = {
  search: '',
  status: '',
  vendorName: '',
  locationName: '',
  buyerName: '',
  approvalStatus: '',
  invoiceStatus: '',
  origin: '',
  documentDateFrom: '',
  documentDateTo: '',
  expectedDeliveryFrom: '',
  expectedDeliveryTo: '',
}

export type PoSortKey =
  | 'documentDate'
  | 'documentNumber'
  | 'vendorName'
  | 'totalAmount'
  | 'expectedDeliveryDate'
  | 'status'
  | 'approvalStatus'
  | 'receivedPercentage'

export const PO_SORT_OPTIONS: { value: PoSortKey; label: string }[] = [
  { value: 'documentDate', label: 'Sort: PO Date' },
  { value: 'documentNumber', label: 'Sort: PO Number' },
  { value: 'vendorName', label: 'Sort: Vendor' },
  { value: 'totalAmount', label: 'Sort: Total Amount' },
  { value: 'expectedDeliveryDate', label: 'Sort: Expected Delivery' },
  { value: 'status', label: 'Sort: Status' },
  { value: 'approvalStatus', label: 'Sort: Approval' },
  { value: 'receivedPercentage', label: 'Sort: Received %' },
]

/** Composite / dashboard deep-link statuses (not domain enums). */
export const PO_COMPOSITE_STATUS_OPTIONS = [
  { value: 'released_or_later', label: 'Released or Later' },
  { value: 'overdue', label: 'Overdue Delivery' },
  { value: 'pending_delivery', label: 'Pending Delivery' },
] as const

export function buildPoFilterFields(input: {
  vendorOptions: string[]
  locationOptions: string[]
  buyerOptions: string[]
}): CrmFilterField[] {
  return [
    {
      type: 'select',
      key: 'status',
      label: 'PO Status',
      options: [
        ...Object.entries(PURCHASE_ORDER_DOMAIN_STATUS_LABELS).map(([value, label]) => ({
          value,
          label,
        })),
        ...PO_COMPOSITE_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
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
      type: 'search-select',
      key: 'locationName',
      label: 'Location',
      options: input.locationOptions.map((l) => ({ value: l, label: l })),
      placeholder: 'Search location…',
    },
    {
      type: 'search-select',
      key: 'buyerName',
      label: 'Buyer',
      options: input.buyerOptions.map((b) => ({ value: b, label: b })),
      placeholder: 'Search buyer…',
    },
    {
      type: 'select',
      key: 'approvalStatus',
      label: 'Approval Status',
      options: Object.entries(PURCHASE_ORDER_APPROVAL_STATUS_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    },
    {
      type: 'select',
      key: 'invoiceStatus',
      label: 'Invoice Status',
      options: Object.entries(PURCHASE_ORDER_INVOICE_STATUS_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    },
    {
      type: 'select',
      key: 'origin',
      label: 'Origin',
      options: Object.entries(PURCHASE_ORDER_ORIGIN_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    },
    {
      type: 'date-range',
      label: 'PO Date',
      fromKey: 'documentDateFrom',
      toKey: 'documentDateTo',
      presets: true,
    },
    {
      type: 'date-range',
      label: 'Expected Delivery',
      fromKey: 'expectedDeliveryFrom',
      toKey: 'expectedDeliveryTo',
    },
  ]
}

export function poFiltersToCrmValues(filters: PoListFilters): CrmFilterValues {
  return { ...filters }
}

export function crmValuesToPoFilters(values: CrmFilterValues): PoListFilters {
  const str = (key: keyof PoListFilters) => {
    const v = values[key]
    return typeof v === 'string' ? v : ''
  }
  return {
    search: str('search'),
    status: str('status'),
    vendorName: str('vendorName'),
    locationName: str('locationName'),
    buyerName: str('buyerName'),
    approvalStatus: str('approvalStatus'),
    invoiceStatus: str('invoiceStatus'),
    origin: str('origin'),
    documentDateFrom: str('documentDateFrom'),
    documentDateTo: str('documentDateTo'),
    expectedDeliveryFrom: str('expectedDeliveryFrom'),
    expectedDeliveryTo: str('expectedDeliveryTo'),
  }
}

export function serializePoFilters(filters: PoListFilters): Record<string, string> {
  return { ...filters }
}

export function hasActivePoFilters(filters: PoListFilters): boolean {
  return (
    Object.entries(filters).some(([key, value]) => key !== 'search' && Boolean(value)) ||
    Boolean(filters.search.trim())
  )
}

export function poFilterChipLabelResolver(key: string, value: string): string | undefined {
  if (key === 'status') {
    const composite = PO_COMPOSITE_STATUS_OPTIONS.find((o) => o.value === value)
    if (composite) return composite.label
    return PURCHASE_ORDER_DOMAIN_STATUS_LABELS[value as PurchaseOrderDomainStatus] ?? value
  }
  if (key === 'approvalStatus') {
    return PURCHASE_ORDER_APPROVAL_STATUS_LABELS[value as PurchaseOrderApprovalStatus] ?? value
  }
  if (key === 'invoiceStatus') {
    return PURCHASE_ORDER_INVOICE_STATUS_LABELS[value as PurchaseOrderInvoiceStatus] ?? value
  }
  if (key === 'origin') {
    return PURCHASE_ORDER_ORIGIN_LABELS[value as PurchaseOrderOrigin] ?? value
  }
  return undefined
}
