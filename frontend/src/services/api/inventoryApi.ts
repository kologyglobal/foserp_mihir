/**
 * Inventory Phase 3A API — stock balances, ledger, movements, reservations.
 * Base: /api/v1/t/:tenantSlug/inventory/...
 * Physical stock SoT. No dual-mode store hydration yet (demo inventoryStore remains for VITE_USE_API=false).
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

export type InventoryMovementType = 'OPENING' | 'INWARD' | 'ISSUE' | 'ADJUSTMENT'
export type InventoryReferenceType =
  | 'OPN'
  | 'INW'
  | 'ISS'
  | 'ADJ'
  | 'GRN'
  | 'ISSUE_TO_WO'
  | 'RETURN_FROM_WO'
  | 'WIP_RECEIVE'
  | 'WIP_TRANSFER'
  | 'MOVE_TO_WIP'
  | 'MOVE_FROM_WIP'
  | 'SA_RECEIPT'
  | 'FG_RECEIPT'
  | 'DISPATCH'
  | 'FG_DISPATCH'
  | 'SUBCON_OUT'
  | 'SUBCON_IN'
  | 'QUALITY_RELEASE'
  | 'QUALITY_HOLD'
  | 'QUALITY_REJECT'

export type InventoryReservationDemandType = 'SO' | 'WO' | 'DISPATCH'
export type InventoryReservationStatus = 'ACTIVE' | 'FULFILLED' | 'CANCELLED'

export interface InventoryRefSummary {
  id: string
  code: string
  name: string
}

export interface InventoryStockBalance {
  id?: string
  itemId: string
  warehouseId: string
  onHandQty: string | number
  reservedQty: string | number
  freeQty: string | number
  item?: InventoryRefSummary
  warehouse?: InventoryRefSummary
  updatedAt?: string
}

export interface InventoryStockMovement {
  id: string
  movementNumber: string
  movementDate: string
  movementType: InventoryMovementType
  referenceType: InventoryReferenceType
  quantity: string | number
  rate: string | number
  value: string | number
  balanceAfter: string | number
  itemId: string
  warehouseId: string
  workOrderId: string | null
  reservationId: string | null
  referenceNo: string | null
  remarks: string | null
  idempotencyKey: string | null
  item?: InventoryRefSummary
  warehouse?: InventoryRefSummary
  createdAt: string
}

export interface InventoryStockReservation {
  id: string
  reservationNumber: string
  itemId: string
  warehouseId: string
  quantity: string | number
  fulfilledQty: string | number
  releasedQty: string | number
  remainingQty: string | number
  demandType: InventoryReservationDemandType
  demandId: string
  referenceNo: string | null
  status: InventoryReservationStatus
  remarks: string | null
  createdAt: string
  updatedAt: string
}

export interface InventoryBalanceReconciliationRow {
  itemId: string
  warehouseId: string
  item?: InventoryRefSummary
  warehouse?: InventoryRefSummary
  storedOnHandQty: string
  ledgerOnHandQty: string
  onHandDifference: string
  storedReservedQty: string
  activeReservedQty: string
  reservedDifference: string
  status: 'MATCHED' | 'MISMATCHED'
  updatedAt: string | null
}

export interface InventoryBalanceReconciliation {
  asOf: string
  authoritativeSource: 'INVENTORY_STOCK_MOVEMENTS'
  totalPositions: number
  matchedPositions: number
  mismatchedPositions: number
  rows: InventoryBalanceReconciliationRow[]
}

export interface PostMovementPayload {
  itemId: string
  warehouseId: string
  quantity: number
  rate?: number
  movementDate?: string
  referenceNo?: string
  remarks?: string
  idempotencyKey?: string
  workOrderId?: string
  reservationId?: string
  allowNegative?: boolean
}

export interface CreateReservationPayload {
  itemId: string
  warehouseId: string
  quantity: number
  demandType: InventoryReservationDemandType
  demandId: string
  referenceNo?: string
  remarks?: string
  idempotencyKey?: string
}

export type InventoryLotStatus = 'ACTIVE' | 'QUARANTINE' | 'EXPIRED' | 'CONSUMED' | 'CANCELLED'
export type InventorySerialMasterStatus =
  | 'AVAILABLE' | 'RESERVED' | 'QC_HOLD' | 'BLOCKED' | 'REJECTED' | 'ISSUED' | 'SCRAPPED' | 'RETURNED'

export interface InventoryLotMaster {
  id: string
  itemId: string
  warehouseId: string | null
  lotNumber: string
  heatNumber: string | null
  quantityOnHand: string | number
  status: InventoryLotStatus
  manufacturedAt: string | null
  expiryDate: string | null
}

export interface InventorySerialMaster {
  id: string
  itemId: string
  warehouseId: string | null
  lotId: string | null
  serialNumber: string
  status: InventorySerialMasterStatus
  sourceReferenceNo?: string | null
}

export async function listInventoryBalances(params?: Record<string, string | number | boolean | undefined>) {
  return apiRequest<InventoryStockBalance[]>(`${tenantPath('/inventory/balances')}${buildQuery(params)}`)
}

export async function getInventoryPosition(params: { itemId: string; warehouseId: string }) {
  return apiRequest<InventoryStockBalance>(`${tenantPath('/inventory/balances/position')}${buildQuery(params)}`)
}

export async function reconcileInventoryBalances(
  params?: { itemId?: string; warehouseId?: string; mismatchesOnly?: boolean },
) {
  return apiRequest<InventoryBalanceReconciliation>(
    `${tenantPath('/inventory/balances/reconciliation')}${buildQuery(params)}`,
  )
}

export async function listInventoryLedger(params?: Record<string, string | number | boolean | undefined>) {
  return apiRequest<InventoryStockMovement[]>(`${tenantPath('/inventory/ledger')}${buildQuery(params)}`)
}

export async function postOpeningStock(data: PostMovementPayload) {
  return apiRequest<InventoryStockMovement>(tenantPath('/inventory/movements/opening'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function postInwardStock(data: PostMovementPayload) {
  return apiRequest<InventoryStockMovement>(tenantPath('/inventory/movements/inward'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function postIssueStock(data: PostMovementPayload) {
  return apiRequest<InventoryStockMovement>(tenantPath('/inventory/movements/issue'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function postStockAdjustment(data: PostMovementPayload) {
  return apiRequest<InventoryStockMovement>(tenantPath('/inventory/movements/adjustment'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function postIssueToWorkOrder(data: PostMovementPayload & { workOrderId: string }) {
  return apiRequest<InventoryStockMovement>(tenantPath('/inventory/movements/issue-to-work-order'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function postReturnFromWorkOrder(data: PostMovementPayload & { workOrderId: string }) {
  return apiRequest<InventoryStockMovement>(tenantPath('/inventory/movements/return-from-work-order'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function postFgReceipt(data: PostMovementPayload & { workOrderId: string }) {
  return apiRequest<InventoryStockMovement>(tenantPath('/inventory/movements/fg-receipt'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function listInventoryReservations(params?: Record<string, string | number | boolean | undefined>) {
  return apiRequest<InventoryStockReservation[]>(`${tenantPath('/inventory/reservations')}${buildQuery(params)}`)
}

export async function createInventoryReservation(data: CreateReservationPayload) {
  return apiRequest<InventoryStockReservation>(tenantPath('/inventory/reservations'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function cancelInventoryReservation(id: string, data?: { remarks?: string }) {
  return apiRequest<InventoryStockReservation>(tenantPath(`/inventory/reservations/${id}/cancel`), {
    method: 'POST',
    body: JSON.stringify(data ?? {}),
  })
}

export async function listInventoryLots(params?: Record<string, string | number | boolean | undefined>) {
  return apiRequest<InventoryLotMaster[]>(`${tenantPath('/inventory/lots')}${buildQuery(params)}`)
}

export async function listInventorySerials(params?: Record<string, string | number | boolean | undefined>) {
  return apiRequest<InventorySerialMaster[]>(`${tenantPath('/inventory/serials')}${buildQuery(params)}`)
}
