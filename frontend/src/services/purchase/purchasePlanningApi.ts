import { apiRequest, tenantPath } from '../api/client'
import type {
  ApiBulkAssignBuyerPayload,
  ApiBulkSelectVendorPayload,
  ApiBulkStatusPayload,
  ApiPurchasePlanningListFilters,
  ApiPurchasePlanningRow,
  ApiRecalculatePlanningPayload,
  ApiUpdatePlanningRowPayload,
  PlanningSheetSummary,
} from './purchaseApiTypes'

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

const base = () => tenantPath('/purchase/planning-sheet')

export async function listPlanningSheetApi(filters: ApiPurchasePlanningListFilters = {}) {
  return apiRequest<ApiPurchasePlanningRow[]>(`${base()}${buildQuery(filters as never)}`)
}

export async function getPlanningSheetSummaryApi() {
  return apiRequest<PlanningSheetSummary>(`${base()}/summary`)
}

export async function getPlanningRowApi(id: string) {
  return apiRequest<ApiPurchasePlanningRow>(`${base()}/${id}`)
}

export async function updatePlanningRowApi(id: string, payload: ApiUpdatePlanningRowPayload) {
  return apiRequest<ApiPurchasePlanningRow>(`${base()}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function bulkAssignBuyerApi(payload: ApiBulkAssignBuyerPayload) {
  return apiRequest<ApiPurchasePlanningRow[]>(`${base()}/bulk-assign-buyer`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function bulkSelectVendorApi(payload: ApiBulkSelectVendorPayload) {
  return apiRequest<ApiPurchasePlanningRow[]>(`${base()}/bulk-select-vendor`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function bulkPlanningStatusApi(payload: ApiBulkStatusPayload) {
  return apiRequest<ApiPurchasePlanningRow[]>(`${base()}/bulk-status`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function recalculatePlanningApi(payload: ApiRecalculatePlanningPayload = {}) {
  return apiRequest<ApiPurchasePlanningRow[]>(`${base()}/recalculate`, {
    method: 'POST',
    body: JSON.stringify({ rowIds: payload.rowIds ?? [] }),
  })
}
