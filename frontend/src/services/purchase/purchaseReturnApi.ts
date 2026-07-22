import { apiRequest, tenantPath } from '../api/client'
import type { ApiPurchaseReturn } from './purchaseApiTypes'

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

const base = () => tenantPath('/purchase/returns')

export async function listPurchaseReturnsApi(
  filters: Record<string, string | number | boolean | undefined> = {},
) {
  return apiRequest<ApiPurchaseReturn[]>(`${base()}${buildQuery(filters)}`)
}

export async function getPurchaseReturnApi(id: string) {
  return apiRequest<ApiPurchaseReturn>(`${base()}/${id}`)
}

export async function createPurchaseReturnApi(payload: Record<string, unknown>) {
  return apiRequest<ApiPurchaseReturn>(base(), {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updatePurchaseReturnApi(id: string, payload: Record<string, unknown>) {
  return apiRequest<ApiPurchaseReturn>(`${base()}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function submitPurchaseReturnApi(id: string, payload: Record<string, unknown> = {}) {
  return apiRequest<ApiPurchaseReturn>(`${base()}/${id}/submit`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function completePurchaseReturnApi(id: string, payload: Record<string, unknown> = {}) {
  return apiRequest<ApiPurchaseReturn>(`${base()}/${id}/complete`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function cancelPurchaseReturnApi(id: string, payload: Record<string, unknown> = {}) {
  return apiRequest<ApiPurchaseReturn>(`${base()}/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
