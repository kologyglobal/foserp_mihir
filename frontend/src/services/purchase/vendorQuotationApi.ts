import { apiRequest, tenantPath } from '../api/client'
import type { ApiVendorQuotation } from './purchaseApiTypes'

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

const base = () => tenantPath('/purchase/vendor-quotations')

export async function listVendorQuotationsApi(
  filters: Record<string, string | number | boolean | undefined> = {},
) {
  return apiRequest<ApiVendorQuotation[]>(`${base()}${buildQuery(filters)}`)
}

export async function getVendorQuotationApi(id: string) {
  return apiRequest<ApiVendorQuotation>(`${base()}/${id}`)
}

export async function createVendorQuotationApi(payload: Record<string, unknown>) {
  return apiRequest<ApiVendorQuotation>(base(), {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateVendorQuotationApi(id: string, payload: Record<string, unknown>) {
  return apiRequest<ApiVendorQuotation>(`${base()}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function submitVendorQuotationApi(id: string, payload: Record<string, unknown> = {}) {
  return apiRequest<ApiVendorQuotation>(`${base()}/${id}/submit`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
