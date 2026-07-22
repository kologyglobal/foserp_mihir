/**
 * Manufacturing Phase 1 setup types — aligned with backend Prisma / manufacturing API shapes.
 * Decimal fields are serialized as strings by the API (never leak float precision loss).
 */

export type ManufacturingVersionStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'SUPERSEDED' | 'ARCHIVED'

export const MANUFACTURING_VERSION_STATUSES: ManufacturingVersionStatus[] = [
  'DRAFT',
  'ACTIVE',
  'INACTIVE',
  'SUPERSEDED',
  'ARCHIVED',
]

// ─── Work centres & machines ───────────────────────────────────────────────

export interface WorkCentre {
  id: string
  tenantId: string
  code: string
  name: string
  description: string | null
  plantCode: string | null
  departmentRef: string | null
  locationId: string | null
  capacityPerShift: string | null
  capacityUomId: string | null
  defaultShiftRef: string | null
  costRate: string | null
  isActive: boolean
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type MachineStatus = 'AVAILABLE' | 'IN_USE' | 'UNDER_MAINTENANCE' | 'OUT_OF_SERVICE'

export const MACHINE_STATUSES: MachineStatus[] = ['AVAILABLE', 'IN_USE', 'UNDER_MAINTENANCE', 'OUT_OF_SERVICE']

export const MACHINE_STATUS_LABELS: Record<MachineStatus, string> = {
  AVAILABLE: 'Available',
  IN_USE: 'In Use',
  UNDER_MAINTENANCE: 'Under Maintenance',
  OUT_OF_SERVICE: 'Out of Service',
}

export interface Machine {
  id: string
  tenantId: string
  code: string
  name: string
  workCentreId: string
  description: string | null
  manufacturer: string | null
  model: string | null
  serialNumber: string | null
  capacity: string | null
  capacityUomId: string | null
  status: MachineStatus
  isActive: boolean
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

// ─── BOMs ───────────────────────────────────────────────────────────────────

export type QuantityBasis = 'PER_UNIT' | 'FIXED_PER_ORDER' | 'PER_BATCH'
export type MakeOrBuy = 'MAKE' | 'BUY'
export type BomLineType =
  | 'RAW_MATERIAL'
  | 'BOUGHT_OUT'
  | 'CONSUMABLE'
  | 'SUBASSEMBLY'
  | 'MANUFACTURED_COMPONENT'
  | 'PACKAGING'
  | 'SERVICE'
export type ConsumptionMethod = 'BACKFLUSH' | 'ACTUAL' | 'MANUAL_ADJUSTED'

export const QUANTITY_BASIS_VALUES: QuantityBasis[] = ['PER_UNIT', 'FIXED_PER_ORDER', 'PER_BATCH']
export const MAKE_OR_BUY_VALUES: MakeOrBuy[] = ['MAKE', 'BUY']
export const BOM_LINE_TYPE_VALUES: BomLineType[] = [
  'RAW_MATERIAL',
  'BOUGHT_OUT',
  'CONSUMABLE',
  'SUBASSEMBLY',
  'MANUFACTURED_COMPONENT',
  'PACKAGING',
  'SERVICE',
]
export const CONSUMPTION_METHOD_VALUES: ConsumptionMethod[] = ['BACKFLUSH', 'ACTUAL', 'MANUAL_ADJUSTED']

export interface Bom {
  id: string
  tenantId: string
  code: string
  name: string
  productItemId: string
  description: string | null
  isActive: boolean
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  versions?: BomVersion[]
}

export interface BomVersion {
  id: string
  tenantId: string
  bomId: string
  versionNumber: number
  revisionCode: string
  status: ManufacturingVersionStatus
  effectiveFrom: string
  effectiveTo: string | null
  baseQuantity: string
  baseUomId: string
  expectedYieldPercent: string
  drawingRevision: string | null
  revisionNotes: string | null
  approvedBy: string | null
  approvedAt: string | null
  activatedBy: string | null
  activatedAt: string | null
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
  lines?: BomLine[]
}

export interface BomLine {
  id: string
  tenantId: string
  bomVersionId: string
  parentLineId: string | null
  sequence: number
  level: number
  itemId: string
  descriptionOverride: string | null
  quantity: string
  uomId: string
  quantityBasis: QuantityBasis
  fixedQuantity: string | null
  scrapPercent: string
  yieldPercent: string
  makeOrBuy: MakeOrBuy
  lineType: BomLineType
  issueStageGroupId: string | null
  issueOperationId: string | null
  consumptionMethod: ConsumptionMethod | null
  isOptional: boolean
  substituteAllowed: boolean
  qualityRequired: boolean
  certificateRequired: boolean
  childProductionOrderRequired: boolean
  stockedSemiFinished: boolean
  phantomAssembly: boolean
  drawingReference: string | null
  specification: string | null
  notes: string | null
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface BomTreeNode extends BomLine {
  children: BomTreeNode[]
}

// ─── Routings ───────────────────────────────────────────────────────────────

export type StageCompletionRule = 'ALL_OPERATIONS' | 'ANY_OPERATION' | 'MANUAL_CONFIRMATION' | 'QUANTITY_TARGET'
export type RunTimeBasis = 'PER_ORDER' | 'PER_UNIT' | 'PER_BATCH'
export type IoType = 'MATERIAL' | 'SEMI_FINISHED' | 'FINISHED_GOOD' | 'NONE'
export type DependencyType = 'FINISH_TO_START' | 'START_TO_START' | 'FINISH_TO_FINISH'

export const STAGE_COMPLETION_RULE_VALUES: StageCompletionRule[] = [
  'ALL_OPERATIONS',
  'ANY_OPERATION',
  'MANUAL_CONFIRMATION',
  'QUANTITY_TARGET',
]
export const RUN_TIME_BASIS_VALUES: RunTimeBasis[] = ['PER_ORDER', 'PER_UNIT', 'PER_BATCH']
export const IO_TYPE_VALUES: IoType[] = ['MATERIAL', 'SEMI_FINISHED', 'FINISHED_GOOD', 'NONE']
export const DEPENDENCY_TYPE_VALUES: DependencyType[] = ['FINISH_TO_START', 'START_TO_START', 'FINISH_TO_FINISH']

export interface Routing {
  id: string
  tenantId: string
  code: string
  name: string
  productItemId: string | null
  description: string | null
  isActive: boolean
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  versions?: RoutingVersion[]
}

export interface RoutingVersion {
  id: string
  tenantId: string
  routingId: string
  versionNumber: number
  revisionCode: string
  status: ManufacturingVersionStatus
  effectiveFrom: string
  effectiveTo: string | null
  revisionNotes: string | null
  approvedBy: string | null
  approvedAt: string | null
  activatedBy: string | null
  activatedAt: string | null
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
  stageGroups?: StageGroup[]
  operations?: Operation[]
  dependencies?: Dependency[]
}

export interface StageGroup {
  id: string
  tenantId: string
  routingVersionId: string
  code: string
  name: string
  description: string | null
  displayOrder: number
  defaultWorkCentreId: string | null
  isOptional: boolean
  parallelAllowed: boolean
  qualityRequired: boolean
  completionRule: StageCompletionRule
  isActive: boolean
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface Operation {
  id: string
  tenantId: string
  routingVersionId: string
  stageGroupId: string
  code: string
  name: string
  sequence: number
  description: string | null
  workCentreId: string | null
  defaultMachineId: string | null
  setupTimeMinutes: string
  runTimeValue: string
  runTimeBasis: RunTimeBasis
  workInstructions: string | null
  drawingReference: string | null
  inputType: IoType
  outputType: IoType
  outputItemId: string | null
  qualityRequired: boolean
  qualityPlanRef: string | null
  outsourced: boolean
  defaultVendorId: string | null
  isOptional: boolean
  isConditional: boolean
  conditionExpression: string | null
  reworkAllowed: boolean
  isActive: boolean
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface Dependency {
  id: string
  tenantId: string
  routingVersionId: string
  predecessorOperationId: string
  successorOperationId: string
  dependencyType: DependencyType
  minimumCompletionPercent: string
  isMandatory: boolean
  allowParallel: boolean
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

// ─── Manufacturing profiles ─────────────────────────────────────────────────

export type ProductionType =
  | 'ASSEMBLY'
  | 'FABRICATION'
  | 'MACHINING'
  | 'JOB_SHOP'
  | 'REPETITIVE'
  | 'PROJECT'
  | 'ENGINEER_TO_ORDER'
  | 'SUBCONTRACT'
export type ExecutionMode = 'SIMPLE' | 'DETAILED'
export type PlanningMethod = 'MANUAL' | 'SALES_ORDER' | 'STOCK_REPLENISHMENT' | 'PRODUCTION_PLAN'
export type WipTrackingMethod = 'LOGICAL_WIP' | 'STOCKED_SEMI_FINISHED' | 'BOTH'
export type OutputTrackingMethod = 'QUANTITY' | 'LOT' | 'BATCH' | 'SERIAL' | 'JOB' | 'PROJECT' | 'HEAT' | 'PIECE'

export const PRODUCTION_TYPE_VALUES: ProductionType[] = [
  'ASSEMBLY',
  'FABRICATION',
  'MACHINING',
  'JOB_SHOP',
  'REPETITIVE',
  'PROJECT',
  'ENGINEER_TO_ORDER',
  'SUBCONTRACT',
]
export const EXECUTION_MODE_VALUES: ExecutionMode[] = ['SIMPLE', 'DETAILED']
export const PLANNING_METHOD_VALUES: PlanningMethod[] = [
  'MANUAL',
  'SALES_ORDER',
  'STOCK_REPLENISHMENT',
  'PRODUCTION_PLAN',
]
export const WIP_TRACKING_METHOD_VALUES: WipTrackingMethod[] = ['LOGICAL_WIP', 'STOCKED_SEMI_FINISHED', 'BOTH']
export const OUTPUT_TRACKING_METHOD_VALUES: OutputTrackingMethod[] = [
  'QUANTITY',
  'LOT',
  'BATCH',
  'SERIAL',
  'JOB',
  'PROJECT',
  'HEAT',
  'PIECE',
]

export interface Profile {
  id: string
  tenantId: string
  code: string
  name: string
  productItemId: string
  productionType: ProductionType
  executionMode: ExecutionMode
  defaultBomVersionId: string | null
  defaultRoutingVersionId: string | null
  defaultQualityPlanRef: string | null
  planningMethod: PlanningMethod
  materialConsumptionMethod: ConsumptionMethod
  wipTrackingMethod: WipTrackingMethod
  outputTrackingMethod: OutputTrackingMethod
  plantCode: string | null
  productionWarehouseId: string | null
  wipWarehouseId: string | null
  finishedGoodsWarehouseId: string | null
  scrapWarehouseId: string | null
  directProductionOrderAllowed: boolean
  partialCompletionAllowed: boolean
  overproductionTolerancePercent: string
  underproductionTolerancePercent: string
  serialTrackingRequired: boolean
  batchTrackingRequired: boolean
  jobTrackingRequired: boolean
  heatTrackingRequired: boolean
  subcontractingAllowed: boolean
  childProductionOrdersEnabled: boolean
  approvalRuleRef: string | null
  isActive: boolean
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface ProfileReadiness {
  ready: boolean
  checks: {
    hasDefaultBomVersion: boolean
    defaultBomVersionActive: boolean
    hasDefaultRoutingVersion: boolean
    defaultRoutingVersionActive: boolean
    hasProductionWarehouse: boolean
    hasWipWarehouse: boolean
    hasFinishedGoodsWarehouse: boolean
    hasScrapWarehouse: boolean
  }
  missing: string[]
}

// ─── Validation & comparison ────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean
  errors: string[]
  lineCount?: number
  operationCount?: number
  stageGroupCount?: number
}

export interface VersionRef {
  id: string
  versionNumber: number
  status: ManufacturingVersionStatus
}

export interface BomLineDiffSnapshot {
  quantity: string
  uomId: string
  sequence: number
}

export interface BomLineDiffEntry {
  itemId: string
  from: BomLineDiffSnapshot | null
  to: BomLineDiffSnapshot | null
  changed: boolean
  summary?: string
}

export interface BomCompareResult {
  from: VersionRef
  to: VersionRef
  added: BomLineDiffEntry[]
  removed: BomLineDiffEntry[]
  changed: BomLineDiffEntry[]
  unchanged: number
  summaries?: string[]
}

export interface RoutingCompareResult {
  from: VersionRef
  to: VersionRef
  addedOperations: string[]
  removedOperations: string[]
  changedOperations: string[]
  summaries?: string[]
}

export type CompareResult = BomCompareResult | RoutingCompareResult

// ─── List query filter shapes (frontend-side) ──────────────────────────────

export interface PagedResult<T> {
  items: T[]
  total: number
  page: number
  totalPages: number
}
