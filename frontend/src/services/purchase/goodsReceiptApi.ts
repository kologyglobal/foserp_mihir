import { apiRequest, tenantPath } from '../api/client'
import type { ApiGoodsReceipt, ApiReceivableLinesResponse } from './purchaseApiTypes'

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

const base = () => tenantPath('/purchase/grns')

export async function listGoodsReceiptsApi(
  filters: Record<string, string | number | boolean | undefined> = {},
) {
  return apiRequest<ApiGoodsReceipt[]>(`${base()}${buildQuery(filters)}`)
}

export async function getGoodsReceiptApi(id: string) {
  return apiRequest<ApiGoodsReceipt>(`${base()}/${id}`)
}

export async function previewNextGoodsReceiptNumberApi() {
  return apiRequest<{ grnNumber: string }>(`${base()}/next-number`)
}

export async function createGoodsReceiptApi(payload: Record<string, unknown>) {
  return apiRequest<ApiGoodsReceipt>(base(), {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateGoodsReceiptApi(id: string, payload: Record<string, unknown>) {
  return apiRequest<ApiGoodsReceipt>(`${base()}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function submitGoodsReceiptApi(id: string, payload: Record<string, unknown> = {}) {
  return apiRequest<ApiGoodsReceipt>(`${base()}/${id}/submit`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function cancelGoodsReceiptApi(id: string, payload: Record<string, unknown> = {}) {
  return apiRequest<ApiGoodsReceipt>(`${base()}/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function reverseGoodsReceiptApi(id: string, payload: Record<string, unknown> = {}) {
  return apiRequest<ApiGoodsReceipt>(`${base()}/${id}/reverse`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function postInventoryGoodsReceiptApi(id: string, payload: Record<string, unknown> = {}) {
  return apiRequest<ApiGoodsReceipt>(`${base()}/${id}/post-inventory`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getReceivableLinesApi(purchaseOrderId: string) {
  return apiRequest<ApiReceivableLinesResponse>(
    `${tenantPath('/purchase/orders')}/${purchaseOrderId}/receivable-lines`,
  )
}
