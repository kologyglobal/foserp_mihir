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
  entryNo?: string
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
  itemCode?: string | null
  itemName?: string | null
  warehouseCode?: string | null
  warehouseName?: string | null
  item?: { id: string; code: string; name: string } | null
  warehouse?: { id: string; code: string; name: string } | null
  movement?: {
    id: string
    movementNumber: string
    movementType: string
    referenceType: string
    quantity: string
    rate: string
    value: string
    movementDate: string
    referenceNo: string | null
  } | null
  consumptions?: Array<{
    id: string
    layerId: string
    quantityConsumed: string
    unitCost: string
    totalCost: string
    createdAt: string
    layer?: {
      id: string
      layerNo?: string
      receiptDate: string
      unitCost: string
      status: string
      lotId: string | null
      serialId: string | null
    } | null
  }>
  standardCost?: {
    id: string
    version: number
    unitCost: string
    effectiveFrom: string
    status: string
  } | null
  variances?: Array<{
    id: string
    varianceType: string
    standardUnitCost: string
    actualUnitCost: string
    varianceAmount: string
  }>
  accounting?: { postingEnabled: boolean; note: string }
}

export interface InventoryCostLayerDto {
  id: string
  layerNo?: string
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
  itemCode?: string | null
  itemName?: string | null
  warehouseCode?: string | null
  warehouseName?: string | null
  unidentified?: boolean
  identityType?: string
  attention?: string | null
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
  reasonCodes?: string[]
  costingStatus?: string
  accountingStatus?: string
}

export interface ValuationReconciliationDto {
  valuationMethod: InventoryValuationMethodDto | string
  total: number
  mismatched: number
  items: ValuationReconciliationRowDto[]
  summary?: {
    stockQuantity: number
    inventoryCostValue: number
    glInventoryValue: number | null
    difference: number | null
    uncostedMovements: number
    accountingEnabled: boolean
    note: string
  }
  ranAt?: string
}

export interface CostingOverviewDto {
  valuationMethod: InventoryValuationMethodDto | string
  methodSource: string
  methodDescription: string
  effectiveDate: string
  summary: {
    inventoryValue: number
    stockQuantity: number
    uncostedMovements: number
    unreconciledValue: number
    glDifference: number | null
    openLayers: number
    openLayerValue: number
    costEntryCount: number
    reconMismatches: number
  }
  policy: {
    scope: string
    effectiveFrom: string
    lastChangedBy: string | null
    lastChangedAt: string | null
    lastFrom: string | null
    lastTo: string | null
  }
  attention: Array<{ code: string; message: string }>
  accounting: { enabled: boolean; note: string }
  manufacturing: { note: string; openPath: string }
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

export async function fetchEffectiveValuationMethod(params?: {
  itemId?: string
  legalEntityId?: string
  warehouseId?: string
  postingDate?: string
}): Promise<
  ApiResponse<{
    method: InventoryValuationMethodDto | string
    source: string
    policyId: null
    effectiveDate: string
    defaultCostingMethodKey: string | null
  }>
> {
  return apiRequest(`${tenantPath(`${BASE}/effective-method`)}${buildQuery(params)}`)
}

export async function fetchItemCostingSummary(itemId: string): Promise<
  ApiResponse<{
    itemId: string
    itemCode: string
    itemName: string
    valuationMethod: InventoryValuationMethodDto | string
    methodSource: string
    stockQty: number
    stockValue: number
    currentCost: number
    lastReceiptCost: number | null
    lastIssueCost: number | null
    costStatus: string
    methodSpecific: Record<string, unknown>
  }>
> {
  return apiRequest(tenantPath(`${BASE}/items/${itemId}/summary`))
}

export async function fetchCostingOverview(): Promise<ApiResponse<CostingOverviewDto>> {
  return apiRequest(tenantPath(`${BASE}/overview`))
}

export async function fetchValuationItems(params?: {
  page?: number
  limit?: number
  warehouseId?: string
  itemId?: string
  search?: string
}): Promise<
  ApiResponse<
    Array<{
      itemId: string
      warehouseId: string
      itemCode: string
      itemName: string
      category: string | null
      uom: string | null
      warehouseCode: string
      warehouseName: string
      valuationMethod: string
      onHandQty: number
      inventoryValue: number
      currentUnitCost: number
      unitCostLabel: string
      costStatus: string
      lastCostMovement: { postingDate: string; entryType: string } | null
    }>
  >
> {
  return apiRequest(`${tenantPath(`${BASE}/items`)}${buildQuery(params)}`)
}

export async function fetchMovingAverageState(params?: {
  page?: number
  limit?: number
  warehouseId?: string
  itemId?: string
}): Promise<
  ApiResponse<
    Array<{
      itemId: string
      warehouseId: string
      itemCode: string
      itemName: string
      warehouseCode: string
      warehouseName: string
      quantity: string
      inventoryValue: string
      currentAverageCost: string
      lastReceipt: { postingDate: string; unitCost: string } | null
      lastIssue: { postingDate: string; unitCost: string } | null
      lastRecalculated: string
    }>
  >
> {
  return apiRequest(`${tenantPath(`${BASE}/moving-average`)}${buildQuery(params)}`)
}

export async function fetchMovingAverageHistory(params: {
  itemId: string
  warehouseId?: string
  limit?: number
}): Promise<
  ApiResponse<{
    itemId: string
    warehouseId: string | null
    reconstructed: boolean
    note: string
    items: Array<{
      costEntryId: string
      postingDate: string
      sourceType: string
      sourceDocument: string | null
      movementId: string
      entryType: string
      qtyBefore: string
      valueBefore: string
      averageBefore: string
      movementQty: string
      movementValue: string
      qtyAfter: string
      valueAfter: string
      averageAfter: string
    }>
    total: number
  }>
> {
  return apiRequest(`${tenantPath(`${BASE}/moving-average/history`)}${buildQuery(params)}`)
}

export async function fetchMethodChangePreview(params: {
  toMethod: 'standard' | 'average' | 'fifo' | 'specific'
  effectiveDate?: string
}): Promise<
  ApiResponse<{
    fromMethod: string
    toMethod: string
    effectiveDate: string
    readiness: 'PASS' | 'WARNING' | 'BLOCKED'
    checks: Array<{ code: string; severity: string; message: string }>
    preview: {
      affectedItems: number
      onHandQty: number
      currentInventoryValue: number
      proposedOpeningValue: number
      expectedDifference: number
      note: string
      methodEvidence: Record<string, unknown>
    }
    financialDifference: {
      inventoryValueDelta: number
      glImpact: string
      glImpactReason: string
    }
    permissions: Record<string, string>
  }>
> {
  return apiRequest(`${tenantPath(`${BASE}/method-change/preview`)}${buildQuery(params)}`)
}

export async function fetchStandardCostVersions(params?: {
  page?: number
  limit?: number
  itemId?: string
  status?: string
}): Promise<
  ApiResponse<
    Array<{
      id: string
      itemId: string
      itemCode: string
      itemName: string
      unitCost: string
      currencyCode: string
      effectiveFrom: string
      effectiveTo: string | null
      version: number
      status: string
      masterStandardRate: string
      difference: string
    }>
  >
> {
  return apiRequest(`${tenantPath(`${BASE}/standard-costs`)}${buildQuery(params)}`)
}

export async function fetchSpecificIdentification(params?: {
  page?: number
  limit?: number
  itemId?: string
  unidentifiedOnly?: boolean
}): Promise<ApiResponse<InventoryCostLayerDto[]>> {
  return apiRequest(`${tenantPath(`${BASE}/specific`)}${buildQuery(params)}`)
}

export async function runValuationReconciliation(body?: {
  itemId?: string
  warehouseId?: string
  mismatchesOnly?: boolean
}): Promise<ApiResponse<ValuationReconciliationDto>> {
  return apiRequest(tenantPath(`${BASE}/reconciliation/run`), {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  })
}
