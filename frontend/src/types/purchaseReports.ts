/**
 * Purchase Reports & Analytics — filter / catalog / result DTOs (demo mock).
 * Kept separate from purchaseDomain to avoid merge conflicts with operational entity work.
 */

import type { IsoDate, PurchaseItemCategory } from './purchaseDomain'

export type PurchaseReportCategoryId =
  | 'requisition'
  | 'rfq_quotation'
  | 'purchase_order'
  | 'receipt_quality'
  | 'invoice'
  | 'vendor'

export type PurchaseReportId =
  /* Requisition */
  | 'pr-register'
  | 'pr-pending'
  | 'pr-ageing'
  | 'pr-department-wise'
  | 'pr-to-po-conversion'
  /* RFQ / Quotation */
  | 'rfq-register'
  | 'rfq-vendor-response'
  | 'rfq-quotation-comparison'
  | 'rfq-price-comparison'
  | 'rfq-conversion'
  /* Purchase Order */
  | 'po-register'
  | 'po-open'
  | 'po-pending-delivery'
  | 'po-overdue'
  | 'po-amendment'
  | 'po-closure'
  | 'po-item-wise'
  | 'po-vendor-wise'
  /* Receipt / Quality */
  | 'grn-register'
  | 'grn-pending-inspection'
  | 'grn-rejection'
  | 'grn-shortage-excess'
  | 'grn-batch-receipt'
  | 'grn-quality-performance'
  /* Invoice */
  | 'inv-register'
  | 'inv-matching'
  | 'inv-pending-approval'
  | 'inv-vendor-outstanding'
  | 'inv-gst-register'
  | 'inv-itc'
  /* Vendor */
  | 'vendor-performance'
  | 'vendor-delivery'
  | 'vendor-quality'
  | 'vendor-price-variance'
  | 'vendor-purchase-history'
  | 'vendor-rejection'

export interface PurchaseReportFilters {
  dateFrom?: IsoDate
  dateTo?: IsoDate
  vendorId?: string
  itemId?: string
  category?: PurchaseItemCategory | ''
  locationId?: string
  department?: string
  status?: string
  search?: string
}

export interface PurchaseReportColumn {
  key: string
  label: string
  align?: 'left' | 'right' | 'center'
  format?: 'text' | 'number' | 'currency' | 'date'
  /** Row field holding a drill-down URL for this cell */
  hrefKey?: string
}

export type PurchaseReportCell = string | number | null | undefined

export type PurchaseReportRow = Record<string, PurchaseReportCell>

export interface PurchaseReportSummaryItem {
  label: string
  value: string | number
}

export interface PurchaseReportCatalogEntry {
  id: PurchaseReportId
  title: string
  description: string
  categoryId: PurchaseReportCategoryId
  categoryLabel: string
  /** Integration-pending report — runner shows placeholder empty state */
  isPlaceholder?: boolean
}

export interface PurchaseReportCategoryGroup {
  id: PurchaseReportCategoryId
  label: string
  description: string
  reports: PurchaseReportCatalogEntry[]
}

export interface PurchaseReportResult {
  reportId: PurchaseReportId
  title: string
  description: string
  categoryLabel: string
  isPlaceholder: boolean
  placeholderMessage?: string
  columns: PurchaseReportColumn[]
  rows: PurchaseReportRow[]
  summary: PurchaseReportSummaryItem[]
  filtersApplied: PurchaseReportFilters
  generatedAt: string
}

export interface PurchaseReportFilterOptions {
  vendors: Array<{ id: string; name: string }>
  items: Array<{ id: string; code: string; name: string; category: PurchaseItemCategory }>
  locations: Array<{ id: string; name: string }>
  departments: string[]
  categories: Array<{ id: PurchaseItemCategory; label: string }>
  statuses: Array<{ value: string; label: string }>
}
