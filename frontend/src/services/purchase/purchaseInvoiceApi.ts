import { apiRequest, tenantPath } from '../api/client'
import type { ApiPurchaseInvoice } from './purchaseApiTypes'

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

const base = () => tenantPath('/purchase/invoices')

export async function listPurchaseInvoicesApi(
  filters: Record<string, string | number | boolean | undefined> = {},
) {
  return apiRequest<ApiPurchaseInvoice[]>(`${base()}${buildQuery(filters)}`)
}

export async function getPurchaseInvoiceApi(id: string) {
  return apiRequest<ApiPurchaseInvoice>(`${base()}/${id}`)
}

export async function createPurchaseInvoiceApi(payload: Record<string, unknown>) {
  return apiRequest<ApiPurchaseInvoice>(base(), {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updatePurchaseInvoiceApi(id: string, payload: Record<string, unknown>) {
  return apiRequest<ApiPurchaseInvoice>(`${base()}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function submitPurchaseInvoiceApi(id: string, payload: Record<string, unknown> = {}) {
  return apiRequest<ApiPurchaseInvoice>(`${base()}/${id}/submit`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function approvePurchaseInvoiceApi(id: string, payload: Record<string, unknown> = {}) {
  return apiRequest<ApiPurchaseInvoice>(`${base()}/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function rejectPurchaseInvoiceApi(id: string, payload: Record<string, unknown> = {}) {
  return apiRequest<ApiPurchaseInvoice>(`${base()}/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function postPurchaseInvoiceApi(id: string, payload: Record<string, unknown> = {}) {
  return apiRequest<ApiPurchaseInvoice>(`${base()}/${id}/post`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function cancelPurchaseInvoiceApi(id: string, payload: Record<string, unknown> = {}) {
  return apiRequest<ApiPurchaseInvoice>(`${base()}/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
