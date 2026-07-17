/** Simplified Manufacturing & Production — Phase 1 planning types (demo FE). */

export type BomStatus = 'draft' | 'active' | 'inactive'

export type ProductionMethod = 'in_house' | 'job_work' | 'mixed'

export type ComponentSupplyMethod = 'inventory' | 'purchase' | 'production' | 'vendor_supplied'

/** Simple shopfloor issue mode (preferred over technical supplyMethod in UI). */
export type BomIssueMethod = 'auto' | 'manual'

export type ProductionRequirementSource =
  | 'sales_order'
  | 'stock_requirement'
  | 'forecast'
  | 'manual'
  | 'minimum_stock'
  | 'inventory_planning'

export type ProductionPlanSource =
  | 'sales_order'
  | 'stock_requirement'
  | 'forecast'
  | 'manual'

export type ProductionPlanStatus =
  | 'draft'
  | 'planned'
  | 'work_orders_created'
  | 'closed'
  | 'cancelled'

export type BomReadinessStatus = 'active' | 'inactive' | 'draft' | 'missing'

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
  issueMethod: BomIssueMethod
  remarks?: string
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
  autoConsumption: boolean
  batchRequired: boolean
  serialRequired: boolean
  lines: BomLine[]
  previousVersionId: string | null
  createdAt: string
  updatedAt: string
  createdBy: string
}

export interface BomWhereUsedRow {
  id: string
  documentType: 'Work Order' | 'Job Work' | 'BOM Version'
  documentNo: string
  status: string
  qty?: number
  href: string
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
  planId: string
  finishedItemId: string
  finishedItemCode: string
  finishedItemName: string
  source: ProductionRequirementSource
  sourceDocumentId: string | null
  sourceDocumentNo: string
  /** Required / demand qty */
  demandQuantity: number
  safetyStock: number
  availableFinishedStock: number
  openWorkOrderQuantity: number
  /** Suggested production qty (computed) */
  requiredProductionQuantity: number
  shortageQty: number
  materialStatus: MaterialAvailabilityStatus
  requiredDate: string
  productionMethod: ProductionMethod
  bomStatus: BomReadinessStatus
  woCreated: boolean
  workOrderNo?: string
  ignored: boolean
}

export interface ProductionPlan {
  id: string
  planNo: string
  planName: string
  planDate: string
  source: ProductionPlanSource
  warehouseId: string
  warehouseName: string
  planningPeriodFrom: string
  planningPeriodTo: string
  owner: string
  status: ProductionPlanStatus
  totalItems: number
  plannedQty: number
  wosCreated: number
  lines: ProductionPlanLine[]
  createdAt: string
  updatedAt: string
  createdBy: string
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

/** Manager production-control dashboard (/manufacturing/dashboard) */
export interface ManufacturingControlDashboardKpi {
  id: string
  label: string
  value: number | string
  helper?: string
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'neutral'
  href: string
}

export interface ManufacturingPlanRow {
  id: string
  woNumber: string
  finishedItemCode: string
  finishedItemName: string
  plannedQty: number
  dueDate: string
  status: string
  materialStatus: string
  href: string
}

export interface ManufacturingLiveStatusCard {
  id: 'running' | 'on_hold' | 'qc_pending' | 'completed'
  label: string
  count: number
  items: Array<{ id: string; woNumber: string; item: string; href: string }>
  href: string
}

export interface ManufacturingMaterialRiskRow {
  id: string
  itemCode: string
  itemName: string
  requiredQty: number
  availableQty: number
  shortageQty: number
  workOrderNo: string
  workOrderId: string
  suggestedAction: string
  href: string
}

export interface ManufacturingQcAttentionRow {
  id: string
  workOrderId: string
  woNumber: string
  finishedItem: string
  pendingQty: number
  href: string
}

export interface ManufacturingJobWorkSnapshot {
  materialSent: number
  partiallyReceived: number
  pendingReconciliation: number
  rows: Array<{ id: string; jwNumber: string; vendorName: string; status: string; href: string }>
}

export interface ManufacturingControlDashboard {
  asOfDate: string
  kpis: ManufacturingControlDashboardKpi[]
  todaysPlan: ManufacturingPlanRow[]
  /** Running / in-progress WOs for Control Room */
  runningOrders: ManufacturingPlanRow[]
  /** Delayed open WOs for Control Room */
  delayedOrders: ManufacturingPlanRow[]
  liveStatus: ManufacturingLiveStatusCard[]
  materialRisks: ManufacturingMaterialRiskRow[]
  qcAttention: ManufacturingQcAttentionRow[]
  jobWork: ManufacturingJobWorkSnapshot
  aiInsights: string[]
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

export const BOM_ISSUE_METHOD_LABELS: Record<BomIssueMethod, string> = {
  auto: 'Auto',
  manual: 'Manual',
}

export const REQUIREMENT_SOURCE_LABELS: Record<ProductionRequirementSource, string> = {
  sales_order: 'Sales Order',
  stock_requirement: 'Stock Requirement',
  forecast: 'Forecast',
  manual: 'Manual',
  minimum_stock: 'Stock Requirement',
  inventory_planning: 'Stock Requirement',
}

export const PRODUCTION_PLAN_SOURCE_LABELS: Record<ProductionPlanSource, string> = {
  sales_order: 'Sales Order',
  stock_requirement: 'Stock Requirement',
  forecast: 'Forecast',
  manual: 'Manual',
}

export const PRODUCTION_PLAN_STATUS_LABELS: Record<ProductionPlanStatus, string> = {
  draft: 'Draft',
  planned: 'Planned',
  work_orders_created: 'Work Orders Created',
  closed: 'Closed',
  cancelled: 'Cancelled',
}

export const BOM_READINESS_LABELS: Record<BomReadinessStatus, string> = {
  active: 'Active BOM',
  inactive: 'Inactive BOM',
  draft: 'Draft BOM',
  missing: 'No BOM',
}

export const MATERIAL_STATUS_LABELS: Record<MaterialAvailabilityStatus, string> = {
  available: 'Available',
  partial: 'Partial',
  shortage: 'Shortage',
  not_checked: 'Not Checked',
}
