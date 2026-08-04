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

/** Live remaining-returnable + header suggestions for return create wizard. */
export type ApiReturnWizardPrefillLine = {
  goodsReceiptLineId: string | null
  purchaseOrderLineId: string | null
  itemId: string | null
  itemCode: string
  itemName: string
  returnQuantity: number
  rate: number
  batchNumber: string | null
  serialNumber: string | null
  remainingReturnableQuantity: number
}

export type ApiReturnWizardPrefill = {
  lines: Array<{
    goodsReceiptLineId: string | null
    purchaseOrderLineId: string | null
    itemId: string | null
    itemCode: string
    itemName: string
    batchNumber: string | null
    serialNumber: string | null
    rejectedQuantity: number
    alreadyReturnedQuantity: number
    remainingReturnableQuantity: number
    rate: number
  }>
  linesPrefill: ApiReturnWizardPrefillLine[]
  totalRejected: number
  totalReturned: number
  totalRemaining: number
  goodsReceiptId: string | null
  qualityInspectionId: string | null
  vendorId: string | null
  purchaseOrderId: string | null
  warehouseId: string | null
  grnStatus: string | null
  closedForReturn: boolean
  suggestedReturnType: 'CREDIT' | 'REPLACEMENT' | string
  reason: string
  qualityInspectionNumber: string | null
}

export async function listPurchaseReturnsApi(
  filters: Record<string, string | number | boolean | undefined> = {},
) {
  return apiRequest<ApiPurchaseReturn[]>(`${base()}${buildQuery(filters)}`)
}

export async function getReturnWizardPrefillApi(params: {
  qualityInspectionId?: string
  goodsReceiptId?: string
}) {
  return apiRequest<ApiReturnWizardPrefill>(`${base()}/wizard-prefill${buildQuery(params)}`)
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

export async function approvePurchaseReturnApi(id: string, payload: Record<string, unknown> = {}) {
  return apiRequest<ApiPurchaseReturn>(`${base()}/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function shipPurchaseReturnApi(id: string, payload: Record<string, unknown> = {}) {
  return apiRequest<ApiPurchaseReturn>(`${base()}/${id}/ship`, {
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

export async function linkReplacementGrnApi(
  id: string,
  payload: { goodsReceiptId: string },
) {
  return apiRequest<ApiPurchaseReturn>(`${base()}/${id}/link-replacement-grn`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
