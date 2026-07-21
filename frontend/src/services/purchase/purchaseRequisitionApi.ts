import { apiRequest, tenantPath } from '../api/client'
import type {
  ApiCreatePurchaseRequisitionPayload,
  ApiLifecycleRemarksPayload,
  ApiPurchaseRequisition,
  ApiPurchaseRequisitionListFilters,
  ApiRejectPurchaseRequisitionPayload,
  ApiUpdatePurchaseRequisitionPayload,
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

const base = () => tenantPath('/purchase/requisitions')

export async function listPurchaseRequisitionsApi(filters: ApiPurchaseRequisitionListFilters = {}) {
  return apiRequest<ApiPurchaseRequisition[]>(`${base()}${buildQuery(filters as never)}`)
}

export async function getPurchaseRequisitionApi(id: string) {
  return apiRequest<ApiPurchaseRequisition>(`${base()}/${id}`)
}

export async function previewNextPurchaseRequisitionNumberApi() {
  return apiRequest<{ requisitionNumber: string }>(`${base()}/next-number`)
}

export async function createPurchaseRequisitionApi(payload: ApiCreatePurchaseRequisitionPayload) {
  return apiRequest<ApiPurchaseRequisition>(base(), {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updatePurchaseRequisitionApi(
  id: string,
  payload: ApiUpdatePurchaseRequisitionPayload,
) {
  return apiRequest<ApiPurchaseRequisition>(`${base()}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function submitPurchaseRequisitionApi(
  id: string,
  payload: ApiLifecycleRemarksPayload = {},
) {
  return apiRequest<ApiPurchaseRequisition>(`${base()}/${id}/submit`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function approvePurchaseRequisitionApi(
  id: string,
  payload: ApiLifecycleRemarksPayload = {},
) {
  return apiRequest<ApiPurchaseRequisition>(`${base()}/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function rejectPurchaseRequisitionApi(
  id: string,
  payload: ApiRejectPurchaseRequisitionPayload,
) {
  return apiRequest<ApiPurchaseRequisition>(`${base()}/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function cancelPurchaseRequisitionApi(
  id: string,
  payload: ApiLifecycleRemarksPayload = {},
) {
  return apiRequest<ApiPurchaseRequisition>(`${base()}/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function reopenPurchaseRequisitionApi(
  id: string,
  payload: ApiLifecycleRemarksPayload = {},
) {
  return apiRequest<ApiPurchaseRequisition>(`${base()}/${id}/reopen`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function sendBackPurchaseRequisitionApi(
  id: string,
  payload: { reason?: string; remarks?: string } = {},
) {
  return apiRequest<ApiPurchaseRequisition>(`${base()}/${id}/send-back`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
