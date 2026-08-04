import { apiRequest, tenantPath } from '../api/client'

function buildQuery(params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    qs.set(k, String(v))
  }
  const q = qs.toString()
  return q ? `?${q}` : ''
}

const base = () => tenantPath('/purchase/supplier-quality')

export type ApiSupplierQualityVendorReject = {
  vendorId: string
  rejectedQty: number
  acceptedQty: number
  inspectionCount: number
  rejectRatePct: number
  vendorName?: string | null
  vendorCode?: string | null
}

export type ApiSupplierQualityItemReject = {
  itemKey: string
  rejectedQty: number
  acceptedQty: number
  rejectRatePct: number
  itemCode?: string | null
  itemName?: string | null
}

export type ApiSupplierQualityDashboardWidgets = {
  pendingReturns: number
  rejectedStockQty: number
  replacementPending: number
  vendorAdjustmentsPending: number
  topRejectedVendors: ApiSupplierQualityVendorReject[]
  mostRejectedItems: ApiSupplierQualityItemReject[]
}

export type ApiVendorQualityScorecard = {
  vendorId: string
  vendorCode: string | null
  vendorName: string | null
  totalDeliveries: number
  totalGrnQty: number
  acceptedQty: number
  rejectedQty: number
  returnQty: number
  replacementReturnCount: number
  inspectionPassPct: number
  averageQualityScore: number
  qualityRating: 'A' | 'B' | 'C' | 'D'
  openQiCount: number
  openReturnCount: number
  openAdjustmentCount: number
  avgInspectionTurnaroundHours: number | null
  onTimeDeliveryPct: number | null
}

export type ApiSupplierQualityTimelineEvent = {
  at: string
  type: string
  number: string
  status: string
  href: string
  detail?: string
}

export type ApiItemSupplierQualityHistory = {
  itemId: string
  timeline: ApiSupplierQualityTimelineEvent[]
}

export async function getSupplierQualityDashboardWidgetsApi() {
  return apiRequest<ApiSupplierQualityDashboardWidgets>(`${base()}/dashboard-widgets`)
}

export async function getSupplierQualityReportsApi() {
  return apiRequest<unknown>(`${base()}/reports`)
}

export async function getVendorQualityScorecardApi(vendorId: string) {
  return apiRequest<ApiVendorQualityScorecard>(`${base()}/vendors/${vendorId}/scorecard`)
}

export async function getItemSupplierQualityHistoryApi(itemId: string) {
  return apiRequest<ApiItemSupplierQualityHistory>(`${base()}/items/${itemId}/history`)
}

export async function getSupplierQualityTraceApi(params: {
  purchaseReturnId?: string
  qualityInspectionId?: string
  goodsReceiptId?: string
}) {
  return apiRequest<unknown>(
    `${tenantPath('/purchase/returns')}/trace${buildQuery(params)}`,
  )
}
