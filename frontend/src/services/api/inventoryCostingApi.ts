/**
 * Inventory costing API — valuation entries, FIFO layers, standard costs, recon, method change.
 * Base: /api/v1/t/:tenantSlug/inventory/costing/...
 */
import { apiRequest, tenantPath, type ApiResponse } from './client'

function buildQuery(params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  }
  const q = qs.toString()
  return q ? `?${q}` : ''
}

export type InventoryValuationMethodDto =
  | 'FIFO'
  | 'MOVING_WEIGHTED_AVERAGE'
  | 'STANDARD_COST'
  | 'SPECIFIC_IDENTIFICATION'

export type InventoryCostEntryTypeDto = 'RECEIPT' | 'ISSUE' | 'ADJUSTMENT' | 'OPENING'

export interface InventoryCostEntryDto {
  id: string
  itemId: string
  warehouseId: string
  inventoryMovementId: string
  entryType: InventoryCostEntryTypeDto | string
  valuationMethod: InventoryValuationMethodDto | string
  quantity: string
  unitCost: string
  totalCost: string
  postingDate: string
  sourceType: string
  sourceId: string | null
  workOrderId: string | null
  costLayerId: string | null
  lotId: string | null
  serialId: string | null
  isReversal: boolean
  status: string
  createdAt: string
  consumptions?: Array<{
    id: string
    layerId: string
    quantityConsumed: string
    unitCost: string
    totalCost: string
    createdAt: string
  }>
}

export interface InventoryCostLayerDto {
  id: string
  itemId: string
  warehouseId: string
  sourceMovementId: string
  receiptDate: string
  postingDate: string
  originalQuantity: string
  remainingQuantity: string
  unitCost: string
  originalValue: string
  remainingValue: string
  status: string
  lotId: string | null
  serialId: string | null
  createdAt: string
  consumptions?: Array<{
    id: string
    issueCostEntryId: string
    quantityConsumed: string
    unitCost: string
    totalCost: string
    createdAt: string
  }>
}

export interface ValuationReconciliationRowDto {
  itemId: string
  warehouseId: string
  item?: { id: string; code: string; name: string }
  warehouse?: { id: string; code: string; name: string }
  valuationMethod: InventoryValuationMethodDto | string
  onHandQty: string
  layerRemainingQty: string
  qtyDifference: string
  stockValue: string
  layerRemainingValue: string
  valueDifference: string
  status: 'MATCHED' | 'MISMATCHED' | string
}

export interface ValuationReconciliationDto {
  valuationMethod: InventoryValuationMethodDto | string
  total: number
  mismatched: number
  items: ValuationReconciliationRowDto[]
}

export interface InventoryCostVarianceDto {
  id: string
  itemId: string
  warehouseId: string | null
  inventoryMovementId: string | null
  varianceType: string
  quantity: string
  standardUnitCost: string
  actualUnitCost: string
  varianceAmount: string
  postingDate: string
  sourceType: string
  sourceId: string | null
  remarks: string | null
  createdAt: string
}

export interface StandardCostVersionDto {
  id: string
  itemId: string
  version: number
  unitCost: string
  effectiveFrom: string
  status: string
}

export interface MethodChangeResultDto {
  fromMethod: InventoryValuationMethodDto | string
  toMethod: InventoryValuationMethodDto | string
  effectiveDate: string
  openingMigrationRequired: boolean
  openingMigrationCompleted: boolean
  migration: {
    createdLayers: number
    skipped: number
    exceptions: number
  } | null
}

const BASE = '/inventory/costing'

export async function fetchInventoryCostEntries(params?: {
  page?: number
  limit?: number
  itemId?: string
  warehouseId?: string
  valuationMethod?: string
  entryType?: string
  workOrderId?: string
  inventoryMovementId?: string
  fromDate?: string
  toDate?: string
}): Promise<ApiResponse<InventoryCostEntryDto[]>> {
  return apiRequest<InventoryCostEntryDto[]>(
    `${tenantPath(`${BASE}/cost-entries`)}${buildQuery(params)}`,
  )
}

export async function fetchInventoryCostEntry(id: string): Promise<ApiResponse<InventoryCostEntryDto>> {
  return apiRequest<InventoryCostEntryDto>(tenantPath(`${BASE}/cost-entries/${id}`))
}

export async function fetchInventoryCostLayers(params?: {
  page?: number
  limit?: number
  itemId?: string
  warehouseId?: string
  status?: string
  openOnly?: boolean
  serialId?: string
  lotId?: string
}): Promise<ApiResponse<InventoryCostLayerDto[]>> {
  return apiRequest<InventoryCostLayerDto[]>(
    `${tenantPath(`${BASE}/cost-layers`)}${buildQuery(params)}`,
  )
}

export async function fetchInventoryCostLayer(id: string): Promise<ApiResponse<InventoryCostLayerDto>> {
  return apiRequest<InventoryCostLayerDto>(tenantPath(`${BASE}/cost-layers/${id}`))
}

export async function fetchValuationReconciliation(params?: {
  itemId?: string
  warehouseId?: string
  mismatchesOnly?: boolean
}): Promise<ApiResponse<ValuationReconciliationDto>> {
  return apiRequest<ValuationReconciliationDto>(
    `${tenantPath(`${BASE}/valuation-reconciliation`)}${buildQuery(params)}`,
  )
}

export async function fetchInventoryCostVariances(params?: {
  page?: number
  limit?: number
  itemId?: string
  fromDate?: string
  toDate?: string
  varianceType?: string
}): Promise<ApiResponse<InventoryCostVarianceDto[]>> {
  return apiRequest<InventoryCostVarianceDto[]>(
    `${tenantPath(`${BASE}/cost-variances`)}${buildQuery(params)}`,
  )
}

export async function postStandardCostVersion(body: {
  itemId: string
  unitCost: number
  effectiveFrom: string
  remarks?: string
  activate?: boolean
}): Promise<ApiResponse<StandardCostVersionDto>> {
  return apiRequest<StandardCostVersionDto>(tenantPath(`${BASE}/standard-costs`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function postValuationMethodChange(body: {
  toMethod: 'standard' | 'average' | 'fifo' | 'specific'
  effectiveDate?: string
  reason: string
  force?: boolean
  runOpeningMigration?: boolean
}): Promise<ApiResponse<MethodChangeResultDto>> {
  return apiRequest<MethodChangeResultDto>(tenantPath(`${BASE}/method-change`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
