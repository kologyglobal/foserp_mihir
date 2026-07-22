/**
 * Purchase Phase 3B — Purchase Requisition API client.
 * Base: /api/v1/t/:tenantSlug/purchase/...
 * No RFQ/PO/GRN. Demo purchaseStore remains for VITE_USE_API=false.
 */
import { apiRequest, tenantPath } from './client'

function buildQuery(params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  }
  const q = qs.toString()
  return q ? `?${q}` : ''
}

export type PurchaseRequisitionStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
export type PurchaseRequisitionSource = 'MANUAL' | 'PRODUCTION_SHORTAGE' | 'MRP' | 'SALES_ORDER'
export type PurchaseRequisitionPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export interface PurchaseRequisitionLine {
  id: string
  lineNo: number
  itemId: string
  warehouseId: string | null
  uomId: string | null
  quantity: string | number
  requiredDate: string | null
  productionOrderId: string | null
  stageId: string | null
  operationId: string | null
  bomLineId: string | null
  salesOrderId: string | null
  salesOrderLineKey: string | null
  preferredVendorId: string | null
  remarks: string | null
}

export interface PurchaseRequisition {
  id: string
  prNumber: string
  source: PurchaseRequisitionSource
  status: PurchaseRequisitionStatus
  priority: PurchaseRequisitionPriority
  purpose: string | null
  warehouseId: string | null
  productionOrderId: string | null
  salesOrderId: string | null
  projectRef: string | null
  notes: string | null
  requiredByDate: string | null
  lines?: PurchaseRequisitionLine[]
  createdAt: string
  updatedAt: string
}

export interface PurchaseRequisitionLineInput {
  itemId: string
  quantity: number
  warehouseId?: string
  uomId?: string
  requiredDate?: string
  productionOrderId?: string
  stageId?: string
  operationId?: string
  bomLineId?: string
  salesOrderId?: string
  salesOrderLineKey?: string
  preferredVendorId?: string
  remarks?: string
}

export interface CreatePurchaseRequisitionPayload {
  source?: PurchaseRequisitionSource
  priority?: PurchaseRequisitionPriority
  purpose?: string
  warehouseId?: string
  productionOrderId?: string
  salesOrderId?: string
  projectRef?: string
  notes?: string
  requiredByDate?: string
  idempotencyKey?: string
  lines?: PurchaseRequisitionLineInput[]
}

export interface ProductionShortagePrPayload {
  productionOrderId: string
  salesOrderId?: string
  warehouseId?: string
  priority?: PurchaseRequisitionPriority
  purpose?: string
  projectRef?: string
  requiredByDate?: string
  submit?: boolean
  idempotencyKey?: string
  lines: PurchaseRequisitionLineInput[]
}

export async function listPurchaseRequisitions(params?: Record<string, string | number | boolean | undefined>) {
  return apiRequest<PurchaseRequisition[]>(`${tenantPath('/purchase/requisitions')}${buildQuery(params)}`)
}

export async function getPurchaseRequisition(id: string) {
  return apiRequest<PurchaseRequisition>(tenantPath(`/purchase/requisitions/${id}`))
}

export async function createPurchaseRequisition(data: CreatePurchaseRequisitionPayload) {
  return apiRequest<PurchaseRequisition>(tenantPath('/purchase/requisitions'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updatePurchaseRequisition(id: string, data: Partial<CreatePurchaseRequisitionPayload>) {
  return apiRequest<PurchaseRequisition>(tenantPath(`/purchase/requisitions/${id}`), {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function addPurchaseRequisitionLine(requisitionId: string, data: PurchaseRequisitionLineInput) {
  return apiRequest<PurchaseRequisition>(tenantPath(`/purchase/requisitions/${requisitionId}/lines`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updatePurchaseRequisitionLine(lineId: string, data: Partial<PurchaseRequisitionLineInput>) {
  return apiRequest<PurchaseRequisition>(tenantPath(`/purchase/requisitions/lines/${lineId}`), {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function removePurchaseRequisitionLine(lineId: string) {
  return apiRequest<PurchaseRequisition>(tenantPath(`/purchase/requisitions/lines/${lineId}`), {
    method: 'DELETE',
  })
}

export async function submitPurchaseRequisition(id: string) {
  return apiRequest<PurchaseRequisition>(tenantPath(`/purchase/requisitions/${id}/submit`), { method: 'POST' })
}

export async function approvePurchaseRequisition(id: string) {
  return apiRequest<PurchaseRequisition>(tenantPath(`/purchase/requisitions/${id}/approve`), { method: 'POST' })
}

export async function rejectPurchaseRequisition(id: string, data: { reason: string }) {
  return apiRequest<PurchaseRequisition>(tenantPath(`/purchase/requisitions/${id}/reject`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function cancelPurchaseRequisition(id: string, data?: { reason?: string }) {
  return apiRequest<PurchaseRequisition>(tenantPath(`/purchase/requisitions/${id}/cancel`), {
    method: 'POST',
    body: JSON.stringify(data ?? {}),
  })
}

export async function createPrFromProductionShortage(data: ProductionShortagePrPayload) {
  return apiRequest<PurchaseRequisition>(tenantPath('/purchase/requisitions/from-production-shortage'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function listPurchaseRequisitionsByProductionOrder(productionOrderId: string) {
  return apiRequest<PurchaseRequisition[]>(
    tenantPath(`/purchase/requisitions/by-production-order/${productionOrderId}`),
  )
}
