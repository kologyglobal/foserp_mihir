import { apiRequest, tenantPath } from './client'

type Query = Record<string, string | number | boolean | undefined | null>
const query = (params?: Query) => {
  const search = new URLSearchParams()
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  })
  return search.size ? `?${search.toString()}` : ''
}

export interface ApiInventoryDocumentLine {
  id: string
  itemId: string
  quantity?: string | number
  requestedQty?: string | number
  dispatchedQty?: string | number
  receivedQty?: string | number
  countedQty?: string | number | null
  varianceQty?: string | number
}

export interface ApiInventoryDocument {
  id: string
  transferNumber?: string
  countNumber?: string
  adjustmentNumber?: string
  status: string
  transferDate?: string
  countDate?: string
  adjustmentDate?: string
  fromWarehouseId?: string
  toWarehouseId?: string
  warehouseId?: string
  reason?: string
  lines?: ApiInventoryDocumentLine[]
  createdAt: string
}

export type InventoryDocumentListResponse = Awaited<ReturnType<typeof listInventoryTransfers>>

export function listInventoryTransfers(params?: Query) {
  return apiRequest<ApiInventoryDocument[]>(`${tenantPath('/inventory/transfers')}${query(params)}`)
}
export function getInventoryTransfer(id: string) {
  return apiRequest<ApiInventoryDocument>(tenantPath(`/inventory/transfers/${id}`))
}
export function createInventoryTransfer(data: {
  fromWarehouseId: string
  toWarehouseId: string
  transferDate?: string
  remarks?: string
  lines: Array<{ itemId: string; quantity: number; batchId?: string; serialId?: string }>
}) {
  return apiRequest<ApiInventoryDocument>(tenantPath('/inventory/transfers'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}
export function dispatchInventoryTransfer(id: string) {
  return apiRequest<ApiInventoryDocument>(tenantPath(`/inventory/transfers/${id}/dispatch`), {
    method: 'POST',
    body: JSON.stringify({ idempotencyKey: `spa-transfer-${id}` }),
  })
}

export function receiveInventoryTransfer(
  id: string,
  lines: Array<{ lineId: string; quantity: number }>,
) {
  return apiRequest<ApiInventoryDocument>(tenantPath(`/inventory/transfers/${id}/receive`), {
    method: 'POST',
    body: JSON.stringify({
      idempotencyKey: `spa-transfer-recv-${id}-${Date.now()}`,
      lines,
    }),
  })
}

export function submitInventoryTransfer(id: string) {
  return apiRequest<ApiInventoryDocument>(tenantPath(`/inventory/transfers/${id}/submit`), {
    method: 'POST', body: JSON.stringify({}),
  })
}
export function approveInventoryTransfer(id: string) {
  return apiRequest<ApiInventoryDocument>(tenantPath(`/inventory/transfers/${id}/approve`), {
    method: 'POST', body: JSON.stringify({}),
  })
}

export function listInventoryStockCounts(params?: Query) {
  return apiRequest<ApiInventoryDocument[]>(`${tenantPath('/inventory/stock-counts')}${query(params)}`)
}
export function getInventoryStockCount(id: string) {
  return apiRequest<ApiInventoryDocument>(tenantPath(`/inventory/stock-counts/${id}`))
}
export function createInventoryStockCount(data: {
  warehouseId: string
  countDate?: string
  itemIds?: string[]
  remarks?: string
}) {
  return apiRequest<ApiInventoryDocument>(tenantPath('/inventory/stock-counts'), {
    method: 'POST', body: JSON.stringify(data),
  })
}
export function snapshotInventoryStockCount(id: string) {
  return apiRequest<ApiInventoryDocument>(tenantPath(`/inventory/stock-counts/${id}/snapshot`), {
    method: 'POST', body: JSON.stringify({}),
  })
}
export function submitInventoryStockCount(id: string) {
  return apiRequest<ApiInventoryDocument>(tenantPath(`/inventory/stock-counts/${id}/submit`), {
    method: 'POST', body: JSON.stringify({}),
  })
}
export function approveInventoryStockCount(id: string) {
  return apiRequest<ApiInventoryDocument>(tenantPath(`/inventory/stock-counts/${id}/approve`), {
    method: 'POST', body: JSON.stringify({}),
  })
}
export function postInventoryStockCount(id: string) {
  return apiRequest<ApiInventoryDocument>(tenantPath(`/inventory/stock-counts/${id}/post`), {
    method: 'POST', body: JSON.stringify({ idempotencyKey: `spa-count-${id}` }),
  })
}

export function listInventoryAdjustments(params?: Query) {
  return apiRequest<ApiInventoryDocument[]>(`${tenantPath('/inventory/adjustments')}${query(params)}`)
}
export function getInventoryAdjustment(id: string) {
  return apiRequest<ApiInventoryDocument>(tenantPath(`/inventory/adjustments/${id}`))
}
export function createInventoryAdjustment(data: {
  warehouseId: string
  adjustmentDate?: string
  reason: string
  remarks?: string
  lines: Array<{ itemId: string; quantity: number; rate?: number; reason?: string }>
}) {
  return apiRequest<ApiInventoryDocument>(tenantPath('/inventory/adjustments'), {
    method: 'POST', body: JSON.stringify(data),
  })
}
export function submitInventoryAdjustment(id: string) {
  return apiRequest<ApiInventoryDocument>(tenantPath(`/inventory/adjustments/${id}/submit`), {
    method: 'POST', body: JSON.stringify({}),
  })
}
export function approveInventoryAdjustment(id: string) {
  return apiRequest<ApiInventoryDocument>(tenantPath(`/inventory/adjustments/${id}/approve`), {
    method: 'POST', body: JSON.stringify({}),
  })
}
export function postInventoryAdjustment(id: string) {
  return apiRequest<ApiInventoryDocument>(tenantPath(`/inventory/adjustments/${id}/post`), {
    method: 'POST', body: JSON.stringify({ idempotencyKey: `spa-adjustment-${id}` }),
  })
}
