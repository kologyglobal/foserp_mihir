import { apiRequest, tenantPath } from '../api/client'
import type { ApiPurchaseOrder } from './purchaseApiTypes'

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

const base = () => tenantPath('/purchase/orders')

export async function listPurchaseOrdersApi(
  filters: Record<string, string | number | boolean | undefined> = {},
) {
  return apiRequest<ApiPurchaseOrder[]>(`${base()}${buildQuery(filters)}`)
}

export async function getPurchaseOrderApi(id: string) {
  return apiRequest<ApiPurchaseOrder>(`${base()}/${id}`)
}

export async function previewNextPurchaseOrderNumberApi() {
  return apiRequest<{ orderNumber: string }>(`${base()}/next-number`)
}

export async function createPurchaseOrderApi(payload: Record<string, unknown>) {
  return apiRequest<ApiPurchaseOrder>(base(), {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updatePurchaseOrderApi(id: string, payload: Record<string, unknown>) {
  return apiRequest<ApiPurchaseOrder>(`${base()}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function submitPurchaseOrderApi(id: string, payload: Record<string, unknown> = {}) {
  return apiRequest<ApiPurchaseOrder>(`${base()}/${id}/submit`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function approvePurchaseOrderApi(id: string, payload: Record<string, unknown> = {}) {
  return apiRequest<ApiPurchaseOrder>(`${base()}/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function cancelPurchaseOrderApi(id: string, payload: Record<string, unknown> = {}) {
  return apiRequest<ApiPurchaseOrder>(`${base()}/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function rejectPurchaseOrderApi(id: string, payload: Record<string, unknown> = {}) {
  return apiRequest<ApiPurchaseOrder>(`${base()}/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function sendBackPurchaseOrderApi(id: string, payload: Record<string, unknown> = {}) {
  return apiRequest<ApiPurchaseOrder>(`${base()}/${id}/send-back`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function sendPurchaseOrderToVendorApi(
  id: string,
  payload: Record<string, unknown> = {},
) {
  return apiRequest<ApiPurchaseOrder>(`${base()}/${id}/send-to-vendor`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function closePurchaseOrderApi(id: string, payload: Record<string, unknown> = {}) {
  return apiRequest<ApiPurchaseOrder>(`${base()}/${id}/close`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function reopenPurchaseOrderApi(id: string, payload: Record<string, unknown> = {}) {
  return apiRequest<ApiPurchaseOrder>(`${base()}/${id}/reopen`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/** Create PO(s) from Planning Sheet Action Message selection — server-side grouping. */
export async function createPurchaseOrdersFromPlanningApi(payload: {
  rowIds: string[]
}) {
  return apiRequest<{
    orders: ApiPurchaseOrder[]
    orderCount: number
    vendorCount: number
  }>(`${tenantPath('/purchase/planning-sheet')}/create-po`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function createPurchaseOrderFromRequisitionApi(
  purchaseRequisitionId: string,
  payload: Record<string, unknown> = {},
) {
  return apiRequest<ApiPurchaseOrder>(
    `${tenantPath('/purchase/requisitions')}/${purchaseRequisitionId}/convert-to-po`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )
}
