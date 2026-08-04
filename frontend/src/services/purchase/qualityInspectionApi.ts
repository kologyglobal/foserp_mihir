import { apiRequest, tenantPath } from '../api/client'
import type { ApiQualityInspection } from './purchaseApiTypes'

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

const base = () => tenantPath('/purchase/quality-inspections')

export async function listQualityInspectionsApi(
  filters: Record<string, string | number | boolean | undefined> = {},
) {
  return apiRequest<ApiQualityInspection[]>(`${base()}${buildQuery(filters)}`)
}

export async function getQualityInspectionApi(id: string) {
  return apiRequest<ApiQualityInspection>(`${base()}/${id}`)
}

/** Prefill for Create Purchase Return from a completed QI (rejected remaining qty). */
export async function getQiPurchaseReturnPrefillApi(id: string) {
  return apiRequest<Record<string, unknown>>(`${base()}/${id}/purchase-return-prefill`)
}

export async function createQualityInspectionApi(payload: Record<string, unknown>) {
  return apiRequest<ApiQualityInspection>(base(), {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateQualityInspectionApi(id: string, payload: Record<string, unknown>) {
  return apiRequest<ApiQualityInspection>(`${base()}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function completeQualityInspectionApi(
  id: string,
  payload: Record<string, unknown> = {},
) {
  return apiRequest<ApiQualityInspection>(`${base()}/${id}/complete`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function acceptQualityInspectionApi(id: string, payload: Record<string, unknown> = {}) {
  return apiRequest<ApiQualityInspection>(`${base()}/${id}/accept`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function rejectQualityInspectionApi(id: string, payload: Record<string, unknown> = {}) {
  return apiRequest<ApiQualityInspection>(`${base()}/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function holdQualityInspectionApi(id: string, payload: Record<string, unknown> = {}) {
  return apiRequest<ApiQualityInspection>(`${base()}/${id}/hold`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function cancelQualityInspectionApi(id: string, payload: Record<string, unknown> = {}) {
  return apiRequest<ApiQualityInspection>(`${base()}/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
