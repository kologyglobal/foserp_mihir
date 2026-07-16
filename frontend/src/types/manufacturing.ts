/** Simplified Manufacturing & Production — Phase 1 planning types (demo FE). */

export type BomStatus = 'draft' | 'active' | 'inactive'

export type ProductionMethod = 'in_house' | 'job_work' | 'mixed'

export type ComponentSupplyMethod = 'inventory' | 'purchase' | 'production' | 'vendor_supplied'

export type ProductionRequirementSource =
  | 'sales_order'
  | 'minimum_stock'
  | 'inventory_planning'
  | 'forecast'
  | 'manual'

export type MaterialAvailabilityStatus = 'available' | 'partial' | 'shortage' | 'not_checked'

export interface ManufacturingAuditEntry {
  id: string
  entityType: 'bom' | 'production_plan' | 'work_order_draft'
  entityId: string
  action: string
  userName: string
  at: string
  remarks?: string
}

export interface BomLine {
  id: string
  lineNo: number
  componentItemId: string
  componentItemCode: string
  componentItemName: string
  requiredQuantity: number
  uom: string
  warehouseId: string
  warehouseName: string
  scrapPercent: number
  availableStock: number
  estimatedCost: number
  supplyMethod: ComponentSupplyMethod
}

export interface BomVersion {
  version: string
  bomId: string
  status: BomStatus
  effectiveFrom: string
  effectiveTo: string | null
}

export interface BillOfMaterial {
  id: string
  bomNumber: string
  finishedItemId: string
  finishedItemCode: string
  finishedItemName: string
  itemCategory: string
  productionQuantity: number
  baseUom: string
  version: string
  effectiveFrom: string
  effectiveTo: string | null
  productionMethod: ProductionMethod
  defaultMaterialWarehouseId: string
  defaultMaterialWarehouseName: string
  defaultFgWarehouseId: string
  defaultFgWarehouseName: string
  status: BomStatus
  componentCount: number
  estimatedCost: number
  standardCost: number
  qualityRequired: boolean
  batchRequired: boolean
  serialRequired: boolean
  lines: BomLine[]
  previousVersionId: string | null
  createdAt: string
  updatedAt: string
  createdBy: string
}

export interface BomCostPreview {
  materialCost: number
  estimatedLabourCost: number
  estimatedMachineCost: number
  jobWorkCost: number
  overhead: number
  scrapRecovery: number
  totalEstimatedCost: number
  estimatedCostPerUnit: number
}

export interface ProductionPlanLine {
  id: string
  finishedItemId: string
  finishedItemCode: string
  finishedItemName: string
  source: ProductionRequirementSource
  sourceDocumentId: string | null
  sourceDocumentNo: string
  demandQuantity: number
  safetyStock: number
  availableFinishedStock: number
  openWorkOrderQuantity: number
  requiredProductionQuantity: number
  materialStatus: MaterialAvailabilityStatus
  requiredDate: string
  productionMethod: ProductionMethod
  ignored: boolean
}

export interface ManufacturingDashboardKpi {
  id: string
  label: string
  value: number | string
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'neutral'
  href: string
}

export interface ManufacturingDashboardRow {
  id: string
  title: string
  subtitle: string
  status: string
  dueDate?: string
  href: string
}

export interface ManufacturingDashboard {
  kpis: ManufacturingDashboardKpi[]
  attentionWorkOrders: ManufacturingDashboardRow[]
  materialShortages: ManufacturingDashboardRow[]
  recentProduction: ManufacturingDashboardRow[]
  dueToday: ManufacturingDashboardRow[]
  jobWorkDue: ManufacturingDashboardRow[]
  delayedOrders: ManufacturingDashboardRow[]
}

export interface ManufacturingFilter {
  search?: string
  bomNumber?: string
  finishedItem?: string
  itemCategory?: string
  version?: string
  productionMethod?: ProductionMethod | ''
  status?: BomStatus | ''
  effectiveFrom?: string
  effectiveTo?: string
  tab?: 'all' | 'draft' | 'active' | 'inactive' | 'in_house' | 'job_work' | 'mixed'
}

export const PRODUCTION_METHOD_LABELS: Record<ProductionMethod, string> = {
  in_house: 'In-House',
  job_work: 'Job Work',
  mixed: 'Mixed',
}

export const BOM_STATUS_LABELS: Record<BomStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  inactive: 'Inactive',
}

export const SUPPLY_METHOD_LABELS: Record<ComponentSupplyMethod, string> = {
  inventory: 'Inventory',
  purchase: 'Purchase',
  production: 'Production',
  vendor_supplied: 'Vendor Supplied',
}

export const REQUIREMENT_SOURCE_LABELS: Record<ProductionRequirementSource, string> = {
  sales_order: 'Sales Order',
  minimum_stock: 'Minimum Stock',
  inventory_planning: 'Inventory Planning',
  forecast: 'Forecast',
  manual: 'Manual Requirement',
}

export const MATERIAL_STATUS_LABELS: Record<MaterialAvailabilityStatus, string> = {
  available: 'Available',
  partial: 'Partial',
  shortage: 'Shortage',
  not_checked: 'Not Checked',
}
