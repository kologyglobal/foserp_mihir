/**
 * Manufacturing Phase 2A — Production Demands + Work Orders API types.
 * Mirrors backend response shapes exactly — see docs/manufacturing/PRODUCTION_PHASE2A_README.md
 * and backend/src/modules/manufacturing/shared/manufacturing.mappers.ts.
 * Decimal fields are serialized as strings by the API (never leak float precision loss);
 * date fields are ISO 8601 strings or null.
 */

export const PRODUCTION_PRIORITY_VALUES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const
export type ProductionPriority = (typeof PRODUCTION_PRIORITY_VALUES)[number]

export const PRODUCTION_PRIORITY_LABELS: Record<ProductionPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
}

export const DEMAND_SOURCE_TYPE_VALUES = [
  'SALES_ORDER',
  'MANUAL',
  'STOCK_REPLENISHMENT',
  'PROJECT',
  'REWORK',
  'PRODUCTION_PLAN',
] as const
export type DemandSourceType = (typeof DEMAND_SOURCE_TYPE_VALUES)[number]

export const DEMAND_SOURCE_TYPE_LABELS: Record<DemandSourceType, string> = {
  SALES_ORDER: 'Sales Order',
  MANUAL: 'Manual',
  STOCK_REPLENISHMENT: 'Stock Replenishment',
  PROJECT: 'Project',
  REWORK: 'Rework',
  PRODUCTION_PLAN: 'Production Plan',
}

export const DEMAND_STATUS_VALUES = ['OPEN', 'PARTIALLY_CONVERTED', 'FULLY_CONVERTED', 'CANCELLED'] as const
export type DemandStatus = (typeof DEMAND_STATUS_VALUES)[number]

export const WORK_ORDER_STATUS_VALUES = [
  'DRAFT',
  'READY',
  'IN_PROGRESS',
  'ON_HOLD',
  'COMPLETED',
  'CLOSED',
  'CANCELLED',
] as const
export type WorkOrderStatus = (typeof WORK_ORDER_STATUS_VALUES)[number]

export const WORK_ORDER_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  DRAFT: 'Draft',
  READY: 'Ready',
  IN_PROGRESS: 'In Progress',
  ON_HOLD: 'On Hold',
  COMPLETED: 'Completed',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
}

export const WORK_ORDER_HEALTH_VALUES = ['ON_TRACK', 'ATTENTION', 'BLOCKED', 'DELAYED'] as const
export type WorkOrderHealth = (typeof WORK_ORDER_HEALTH_VALUES)[number]

export const WORK_ORDER_HEALTH_LABELS: Record<WorkOrderHealth, string> = {
  ON_TRACK: 'On Track',
  ATTENTION: 'Attention',
  BLOCKED: 'Blocked',
  DELAYED: 'Delayed',
}

export const HOLD_REASON_CATEGORY_VALUES = [
  'MATERIAL',
  'MACHINE',
  'QUALITY',
  'DRAWING',
  'CUSTOMER',
  'PLANNING',
  'OTHER',
] as const
export type HoldReasonCategory = (typeof HOLD_REASON_CATEGORY_VALUES)[number]

export const HOLD_REASON_CATEGORY_LABELS: Record<HoldReasonCategory, string> = {
  MATERIAL: 'Material',
  MACHINE: 'Machine',
  QUALITY: 'Quality',
  DRAWING: 'Drawing',
  CUSTOMER: 'Customer',
  PLANNING: 'Planning',
  OTHER: 'Other',
}

export const STAGE_STATUS_VALUES = [
  'NOT_STARTED',
  'READY',
  'IN_PROGRESS',
  'ON_HOLD',
  'BLOCKED',
  'QC_PENDING',
  'COMPLETED',
  'SKIPPED',
  'CANCELLED',
] as const
export type StageStatus = (typeof STAGE_STATUS_VALUES)[number]

export const STAGE_STATUS_LABELS: Record<StageStatus, string> = {
  NOT_STARTED: 'Not Started',
  READY: 'Ready',
  IN_PROGRESS: 'In Progress',
  ON_HOLD: 'On Hold',
  BLOCKED: 'Blocked',
  QC_PENDING: 'QC Pending',
  COMPLETED: 'Completed',
  SKIPPED: 'Skipped',
  CANCELLED: 'Cancelled',
}

export const MATERIAL_CONTROL_STATUS_VALUES = ['NOT_CONNECTED', 'PENDING_INVENTORY', 'ACTIVE'] as const
export type MaterialControlStatus = (typeof MATERIAL_CONTROL_STATUS_VALUES)[number]

export const MATERIAL_LINE_STATUS_VALUES = ['OPEN', 'RESERVED', 'PARTIAL', 'ISSUED', 'SHORT', 'CLOSED', 'CANCELLED'] as const
export type MaterialLineStatus = (typeof MATERIAL_LINE_STATUS_VALUES)[number]

export interface ProductionOrderMaterial {
  id: string
  productionOrderId: string
  bomLineId: string
  itemId: string
  item: {
    id: string
    code: string
    name: string
    isStockable: boolean
    batchTracked?: boolean
    serialTracked?: boolean
  }
  uomId: string
  uom: { id: string; code: string; name: string }
  warehouseId: string | null
  warehouse: { id: string; code: string; name: string } | null
  requiredQty: string
  reservedQty: string
  issuedQty: string
  returnedQty: string
  shortageQty: string
  status: MaterialLineStatus
  reservationId: string | null
  reservation: {
    id: string
    reservationNumber: string
    status: string
    quantity: string
    fulfilledQty: string
  } | null
  purchaseRequisitionId: string | null
  purchaseRequisition: { id: string; prNumber?: string; requisitionNumber?: string; status: string } | null
  issueStageGroupId: string | null
  issueOperationId: string | null
  remarks: string | null
  freeQty: string | null
  hasShortage: boolean
  createdAt: string
  updatedAt: string
}

export interface MaterialsReadiness {
  materials: ProductionOrderMaterial[]
  summary: { totalLines: number; shortageLines: number }
}

export interface SyncMaterialsResult {
  createdCount: number
  skippedCount: number
  materials: ProductionOrderMaterial[]
}

export interface ReserveMaterialsResult {
  results: Array<{ materialId: string; reservedQty: string; shortageQty: string; status: string; error?: string }>
  materials: ProductionOrderMaterial[]
}

export interface ShortageRequisitionResult {
  requisition: {
    id: string
    prNumber?: string
    requisitionNumber?: string
    source: string
    lines: Array<{ id: string; quantity: string | number }>
  }
  linkedMaterialIds: string[]
  materials: ProductionOrderMaterial[]
}

export const QUALITY_STATUS_VALUES = [
  'NOT_APPLICABLE',
  'PENDING_INTEGRATION',
  'PENDING_QC',
  'IN_QC',
  'PASSED',
  'FAILED',
  'HOLD',
] as const
export type ProductionQualityStatus = (typeof QUALITY_STATUS_VALUES)[number]

export const PRODUCTION_ACTIVITY_TYPE_VALUES = [
  'CREATED',
  'DEMAND_CREATED',
  'DEMAND_CONVERTED',
  'RELEASED',
  'STARTED',
  'HELD',
  'RESUMED',
  'STAGE_READY',
  'STAGE_STARTED',
  'PROGRESS_RECORDED',
  'STAGE_COMPLETED',
  'COMPLETED',
  'CANCELLED',
  'CORRECTION',
  'ASSIGNED',
  'DUE_DATE_CHANGED',
  'PRIORITY_CHANGED',
] as const
export type ProductionActivityType = (typeof PRODUCTION_ACTIVITY_TYPE_VALUES)[number]

export const STAGE_LEDGER_TXN_TYPE_VALUES = [
  'STAGE_STARTED',
  'PROGRESS_RECORDED',
  'STAGE_COMPLETED',
  'STAGE_HELD',
  'STAGE_RESUMED',
  'CORRECTION',
  'REVERSAL',
] as const
export type StageLedgerTxnType = (typeof STAGE_LEDGER_TXN_TYPE_VALUES)[number]

// ─── Production demands ─────────────────────────────────────────────────────

export interface ProductionDemand {
  id: string
  tenantId: string
  demandNumber: string
  sourceType: DemandSourceType
  sourceDocumentType: string | null
  sourceDocumentId: string | null
  sourceLineReference: string | null
  sourceLineKey: string | null
  salesOrderId: string | null
  customerId: string | null
  projectRef: string | null
  productItemId: string
  requestedQuantity: string
  convertedQuantity: string
  remainingQuantity: string
  cancelledQuantity: string
  uomId: string
  requiredDate: string | null
  priority: string
  plantCode: string | null
  status: DemandStatus
  idempotencyKey: string | null
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

// ─── Work orders (ProductionOrder) ─────────────────────────────────────────

export interface ProductionOrder {
  id: string
  tenantId: string
  orderNumber: string
  /** UI label alias of orderNumber. */
  workOrderNo: string
  demandId: string | null
  sourceType: DemandSourceType
  sourceDocumentId: string | null
  sourceLineReference: string | null
  salesOrderId: string | null
  customerId: string | null
  projectRef: string | null
  productItemId: string
  /** Present on list responses when API enriches the row. */
  productItemCode?: string | null
  productItemName?: string | null
  salesOrderNo?: string | null
  customerName?: string | null
  customerCode?: string | null
  currentStageName?: string | null
  currentStageCode?: string | null
  supervisorName?: string | null
  manufacturingProfileId: string
  bomVersionId: string
  routingVersionId: string | null
  plannedQuantity: string
  completedGoodQuantity: string
  reworkQuantity: string
  rejectedQuantity: string
  scrapQuantity: string
  uomId: string
  plantCode: string | null
  plannedStartDate: string | null
  requiredCompletionDate: string | null
  actualStartAt: string | null
  actualCompletedAt: string | null
  priority: string
  managerId: string | null
  supervisorId: string | null
  jobNumber: string | null
  outputTrackingType: string
  status: WorkOrderStatus
  healthStatus: WorkOrderHealth
  currentStageId: string | null
  completionPercent: string
  materialControlStatus: MaterialControlStatus
  qualityStatus: ProductionQualityStatus
  notes: string | null
  holdReasonCategory: HoldReasonCategory | null
  holdRemarks: string | null
  holdExpectedResumeAt: string | null
  previousStatusBeforeHold: WorkOrderStatus | null
  releasedAt: string | null
  releasedBy: string | null
  splitFromOrderId: string | null
  splitSequence: number | null
  idempotencyKey: string | null
  version: number
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface ProductionOrderStage {
  id: string
  tenantId: string
  productionOrderId: string
  sourceStageGroupId: string
  code: string
  name: string
  displayOrder: number
  workCentreId: string | null
  isOptional: boolean
  parallelAllowed: boolean
  qualityRequired: boolean
  completionRule: string
  status: StageStatus
  plannedQuantity: string
  goodQuantity: string
  reworkQuantity: string
  rejectedQuantity: string
  scrapQuantity: string
  startedAt: string | null
  completedAt: string | null
  holdReasonCategory: HoldReasonCategory | null
  holdRemarks: string | null
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface ProductionOrderOperation {
  id: string
  tenantId: string
  productionOrderId: string
  stageId: string
  sourceOperationId: string
  code: string
  name: string
  sequence: number
  workCentreId: string | null
  machineId: string | null
  setupTimeMinutes: string
  runTimeValue: string
  runTimeBasis: string
  qualityRequired: boolean
  isOptional: boolean
  status: StageStatus
  plannedQuantity: string
  goodQuantity: string
  reworkQuantity: string
  rejectedQuantity: string
  scrapQuantity: string
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ProductionOrderDependency {
  id: string
  tenantId: string
  productionOrderId: string
  predecessorOperationId: string
  successorOperationId: string
  dependencyType: string
  minimumCompletionPercent: string
  isMandatory: boolean
  createdAt: string
}

export interface ProductionOrderBomSnapshotLine {
  id: string
  tenantId: string
  bomSnapshotId: string
  sourceBomLineId: string | null
  parentLineId: string | null
  sequence: number
  level: number
  itemId: string
  descriptionOverride: string | null
  perUnitQuantity: string
  uomId: string
  scrapPercent: string
  requiredQuantity: string
  makeOrBuy: string
  lineType: string
  issueStageGroupId: string | null
  issueOperationId: string | null
  isOptional: boolean
  createdAt: string
}

export interface ProductionOrderBomSnapshot {
  id: string
  tenantId: string
  productionOrderId: string
  bomVersionId: string
  bomVersionNumber: number
  baseQuantity: string
  baseUomId: string
  snapshotAt: string
  createdBy: string | null
  createdAt: string
  lines: ProductionOrderBomSnapshotLine[]
}

export interface ProductionOrderRoutingSnapshot {
  id: string
  tenantId: string
  productionOrderId: string
  routingVersionId: string
  routingVersionNumber: number
  snapshotAt: string
  createdBy: string | null
  createdAt: string
}

/** GET /work-orders/:id/detail response — order + immutable snapshots + live stage/operation state. */
export interface WorkOrderRelatedSalesOrder {
  id: string
  salesOrderNo: string
  status: string
  customerId: string | null
  customerName: string | null
  customerCode: string | null
}

export interface WorkOrderDetail extends ProductionOrder {
  bomSnapshot: ProductionOrderBomSnapshot | null
  routingSnapshot: ProductionOrderRoutingSnapshot | null
  stages: ProductionOrderStage[]
  operations: ProductionOrderOperation[]
  dependencies: ProductionOrderDependency[]
  /** Enriched commercial context when WO is linked to a CRM sales order. */
  relatedSalesOrder?: WorkOrderRelatedSalesOrder | null
}

export interface WorkOrderFgReceiptSummary {
  id: string
  receiptNumber: string
  receiptQuantity: string
  acceptedQuantity: string
  status: string
  qualityStatus: string | null
  batchOrLotNumber: string | null
  receiptDate: string | null
  postedAt: string | null
  warehouse?: { id: string; code: string; name: string } | null
  item?: { id: string; code: string; name: string } | null
  uom?: { id: string; code: string; name: string } | null
  remarks: string | null
}

export interface ProductionStageLedgerEntry {
  id: string
  tenantId: string
  productionOrderId: string
  stageId: string
  operationId: string | null
  transactionType: StageLedgerTxnType
  goodQuantity: string
  reworkQuantity: string
  rejectedQuantity: string
  scrapQuantity: string
  remarks: string | null
  reversalOfId: string | null
  resultingBalanceJson: unknown
  idempotencyKey: string | null
  createdBy: string | null
  createdAt: string
}

export interface ProductionActivityEntry {
  id: string
  tenantId: string
  productionOrderId: string
  activityType: ProductionActivityType
  userId: string | null
  message: string
  oldValue: unknown
  newValue: unknown
  reason: string | null
  sourceTransactionId: string | null
  metadata: unknown
  createdAt: string
}

// ─── SO → demand conversion ─────────────────────────────────────────────────

export interface EligibleSalesOrder {
  id: string
  salesOrderNo: string
  customerId: string | null
  /** Company / customer display name from CRM */
  customerName: string | null
  /** Company code when available */
  customerCode: string | null
  status: string
  orderDate: string
  requiredDate: string | null
  lineCount: number
  /** Lines that still have convertible remaining qty. */
  remainingLineCount?: number
  /** Sum of remaining convertible qty across open lines. */
  remainingQuantity?: string
}

export interface SalesOrderLineEligibility {
  lineId: string
  productId: string | null
  productOrItem: string | null
  description: string | null
  qty: number
  uom: string | null
  resolvedItemId: string | null
  resolvedItemCode: string | null
  eligible: boolean
  reasons: string[]
  readiness: {
    hasProfile: boolean
    hasActiveBom: boolean
    hasActiveRouting: boolean
  }
  demandId: string | null
  demandStatus: DemandStatus | null
  requestedQuantity: string
  convertedQuantity: string
  remainingQuantity: string
}

export interface SalesOrderLineEligibilityResult {
  salesOrder: {
    id: string
    salesOrderNo: string
    customerId: string | null
    status: string
  }
  lines: SalesOrderLineEligibility[]
}

export interface ConvertSalesOrderLineResult {
  demand: ProductionDemand | null
  order: ProductionOrder
}

// ─── Dashboards ─────────────────────────────────────────────────────────────

export interface TodayOverview {
  counts: {
    running: number
    dueToday: number
    delayed: number
    onHold: number
    completedToday: number
    /** Phase 2B — present when dashboard service includes operator/issue aggregates. */
    openIssues?: number
    pausedTasks?: number
    unassignedReadyWork?: number
    myTeamRunning?: number
  }
  running: ProductionOrder[]
  dueToday: ProductionOrder[]
  delayed: ProductionOrder[]
  onHold: ProductionOrder[]
  completedToday: ProductionOrder[]
  /** Phase 2B — optional issue / assignment snapshots from today dashboard. */
  openIssues?: import('./manufacturingPhase2b').TodayIssueSummary[]
  pausedTasks?: import('./manufacturingPhase2b').ProductionAssignment[]
  myTeamRunning?: import('./manufacturingPhase2b').ProductionAssignment[]
}

export interface WorkOrdersSummary {
  total: number
  byStatus: Array<{ status: WorkOrderStatus; count: number }>
  byHealth: Array<{ healthStatus: WorkOrderHealth; count: number }>
}

export interface ControlRoomOverview {
  byStatus: Array<{ status: WorkOrderStatus; count: number }>
  byHealth: Array<{ healthStatus: WorkOrderHealth; count: number }>
  byWorkCentre: Array<{ workCentreId: string | null; workCentreName: string; orderCount: number }>
  byCurrentStage: Array<{ stageName: string; orderCount: number }>
  activeOrderCount: number
  /** Phase 2B — optional operator/issue aggregates. */
  openIssues?: import('./manufacturingPhase2b').TodayIssueSummary[]
  pausedTasks?: number
  unassignedReadyWork?: number
  myTeamRunning?: number
  activeAssignmentsInProgress?: number
}

// ─── Request payloads ───────────────────────────────────────────────────────

export interface ListWorkOrdersQuery {
  page?: number
  limit?: number
  search?: string
  sortOrder?: 'asc' | 'desc'
  status?: WorkOrderStatus
  healthStatus?: WorkOrderHealth
  productItemId?: string
  salesOrderId?: string
  supervisorId?: string
  managerId?: string
}

export interface ListDemandsQuery {
  page?: number
  limit?: number
  search?: string
  sortOrder?: 'asc' | 'desc'
  status?: DemandStatus
  sourceType?: DemandSourceType
  productItemId?: string
  salesOrderId?: string
}

export interface CreateManualDemandPayload {
  productItemId: string
  requestedQuantity: number
  uomId: string
  requiredDate?: string
  priority?: ProductionPriority
  plantCode?: string
  customerId?: string
  projectRef?: string
  idempotencyKey?: string
}

export interface ConvertSalesOrderLinePayload {
  quantity: number
  requiredDate?: string
  priority?: ProductionPriority
  plantCode?: string
  supervisorId?: string
  managerId?: string
  notes?: string
  manufacturingProfileId?: string
  bomVersionId?: string
  routingVersionId?: string
  idempotencyKey?: string
  generateChildOrders?: boolean
}

export interface CreateManualWorkOrderPayload {
  productItemId: string
  plannedQuantity: number
  requiredCompletionDate: string
  plannedStartDate?: string
  priority?: ProductionPriority
  plantCode?: string
  managerId?: string
  supervisorId?: string
  jobNumber?: string
  notes?: string
  manufacturingProfileId?: string
  bomVersionId?: string
  routingVersionId?: string
  idempotencyKey?: string
}

export interface HoldWorkOrderPayload {
  reasonCategory: HoldReasonCategory
  remarks?: string
  expectedResumeAt?: string
}

export interface RecordProgressPayload {
  stageId: string
  operationId?: string
  goodQuantity: number
  reworkQuantity: number
  rejectedQuantity: number
  scrapQuantity: number
  remarks?: string
  idempotencyKey: string
}

export interface CompleteStagePayload {
  stageId: string
  remarks?: string
  skipQcGate?: boolean
  requireQc?: boolean
  qcOverrideReason?: string
}

export interface CorrectProgressPayload {
  ledgerEntryId: string
  goodQuantity: number
  reworkQuantity: number
  rejectedQuantity: number
  scrapQuantity: number
  reason: string
}

// ─── Response payloads ──────────────────────────────────────────────────────

export interface RecordProgressResult {
  ledgerEntry: ProductionStageLedgerEntry
  stage: ProductionOrderStage | null
  order: ProductionOrder
  warnings?: string[]
}

export interface CompleteStageResult {
  stage: ProductionOrderStage
  promotedStages: ProductionOrderStage[]
  order: ProductionOrder
  awaitingQuality?: boolean
  inspection?: unknown
  warnings?: string[]
}

export interface CompleteWorkOrderResult {
  order: ProductionOrder
  warnings: string[]
}

export interface CorrectProgressResult {
  reversal: ProductionStageLedgerEntry
  correction: ProductionStageLedgerEntry
  stage: ProductionOrderStage
  order: ProductionOrder
}
