import { apiRequest, tenantPath } from '../api/client'
import type { ApiRequestForQuotation } from './purchaseApiTypes'

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

const base = () => tenantPath('/purchase/rfqs')

export async function listRfqsApi(filters: Record<string, string | number | boolean | undefined> = {}) {
  return apiRequest<ApiRequestForQuotation[]>(`${base()}${buildQuery(filters)}`)
}

export async function getRfqApi(id: string) {
  return apiRequest<ApiRequestForQuotation>(`${base()}/${id}`)
}

export async function createRfqApi(payload: Record<string, unknown>) {
  return apiRequest<ApiRequestForQuotation>(base(), {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateRfqApi(id: string, payload: Record<string, unknown>) {
  return apiRequest<ApiRequestForQuotation>(`${base()}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function sendRfqApi(id: string, payload: Record<string, unknown> = {}) {
  return apiRequest<ApiRequestForQuotation>(`${base()}/${id}/send`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function cancelRfqApi(id: string, payload: Record<string, unknown> = {}) {
  return apiRequest<ApiRequestForQuotation>(`${base()}/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function setRfqVendorsApi(id: string, vendorIds: string[]) {
  return apiRequest<ApiRequestForQuotation>(`${base()}/${id}/vendors`, {
    method: 'POST',
    body: JSON.stringify({ vendorIds }),
  })
}

export async function createRfqFromRequisitionApi(
  purchaseRequisitionId: string,
  payload: Record<string, unknown> = {},
) {
  return apiRequest<ApiRequestForQuotation>(
    `${tenantPath('/purchase/requisitions')}/${purchaseRequisitionId}/convert-to-rfq`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )
}
