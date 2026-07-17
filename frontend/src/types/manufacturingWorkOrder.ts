/** Simplified Manufacturing — Work Order types (Phases 2–3, demo FE). */

import type { ProductionMethod } from './manufacturing'

export type WorkOrderStatus =
  | 'draft'
  | 'in_progress'
  | 'on_hold'
  | 'completed'
  | 'closed'
  | 'cancelled'

/** Board/list production status (derived from WO + QC/material flags). */
export type WorkOrderListStatus =
  | 'draft'
  | 'ready'
  | 'in_progress'
  | 'on_hold'
  | 'completed'
  | 'qc_pending'
  | 'qc_hold'
  | 'closed'
  | 'cancelled'

export type WorkOrderQcStatus =
  | 'not_required'
  | 'required'
  | 'pending'
  | 'hold'
  | 'cleared'

export type WorkOrderSource =
  | 'sales_order'
  | 'production_plan'
  | 'stock_requirement'
  | 'forecast'
  | 'manual'

export type WorkOrderPriority = 'low' | 'normal' | 'high' | 'urgent'

export type WorkOrderMaterialStatus =
  | 'available'
  | 'partial'
  | 'shortage'
  | 'reserved'
  | 'consumed'

export type MaterialConsumptionMode = 'automatic' | 'manual_issue'

export type HoldReason =
  | 'material_shortage'
  | 'machine_breakdown'
  | 'labour_issue'
  | 'quality_issue'
  | 'management_hold'
  | 'other'

export type ScrapReason =
  | 'material_defect'
  | 'machine_problem'
  | 'process_loss'
  | 'quality_rejection'
  | 'operator_error'
  | 'setup_loss'
  | 'trial_production'
  | 'other'

export type ReworkStatus = 'open' | 'in_progress' | 'completed' | 'rejected' | 'cancelled'

export type QualityInspectionResult =
  | 'pending'
  | 'accepted'
  | 'partially_accepted'
  | 'rejected'
  | 'rework'
  | 'accepted_under_deviation'

export interface WorkOrderMaterial {
  id: string
  workOrderId: string
  componentItemId: string
  componentItemCode: string
  componentItemName: string
  requiredQty: number
  availableQty: number
  reservedQty: number
  issuedQty: number
  consumedQty: number
  returnedQty: number
  shortageQty: number
  warehouseId: string
  warehouseName: string
  uom: string
  tracking: 'none' | 'batch' | 'serial'
  status: WorkOrderMaterialStatus
}

export interface WorkOrderActivity {
  id: string
  workOrderId: string
  at: string
  action: string
  userName: string
  quantity?: number
  comment?: string
  relatedDocument?: string
}

export interface ProductionOutputEntry {
  id: string
  workOrderId: string
  at: string
  goodQty: number
  rejectedQty: number
  scrapQty: number
  reworkQty: number
  productionDate: string
  batchNo?: string
  serialNumbers?: string[]
  userName: string
  remark?: string
}

export interface ProductionScrap {
  id: string
  workOrderId: string
  scrapQty: number
  reason: ScrapReason
  recoverableQty: number
  scrapItemCode?: string
  scrapWarehouseName?: string
  scrapPercent: number
  estimatedValue: number
  remarks?: string
  at: string
  userName: string
}

export interface ProductionRework {
  id: string
  workOrderId: string
  reworkNo: string
  reworkQty: number
  reason: string
  expectedCompletionDate: string
  workstation?: string
  responsiblePerson?: string
  status: ReworkStatus
  remarks?: string
  at: string
  userName: string
}

export interface ProductionQualityReview {
  id: string
  workOrderId: string
  outputEntryId: string
  finishedItemCode: string
  finishedItemName: string
  batchNo?: string
  serialNumbers?: string[]
  producedQty: number
  acceptedQty: number
  rejectedQty: number
  reworkQty: number
  result: QualityInspectionResult
  inspector?: string
  qualityReference?: string
  remarks?: string
  at: string
}

export interface MaterialIssueLine {
  id: string
  componentItemId: string
  componentItemCode: string
  componentItemName: string
  requiredQty: number
  previouslyIssued: number
  pendingQty: number
  availableQty: number
  issueQty: number
  batchOrSerial?: string
  status: string
  uom: string
}

export interface MaterialReturnLine {
  id: string
  componentItemId: string
  componentItemCode: string
  componentItemName: string
  issuedQty: number
  consumedQty: number
  returnableQty: number
  returnQty: number
  batchOrSerial?: string
  warehouseName: string
  reason?: string
  uom: string
}

export interface MaterialConsumptionPreview {
  lines: Array<{
    componentItemCode: string
    componentItemName: string
    requiredForOutput: number
    available: number
    batchMethod: 'fifo' | 'fefo' | 'manual'
    selectedBatches: string[]
    shortage: number
    uom: string
  }>
  totalShortage: number
  warnings: string[]
}

export interface MaterialReservationPreview {
  workOrderId: string
  lines: Array<{
    componentItemCode: string
    required: number
    available: number
    reservable: number
    shortage: number
  }>
  canReserveAll: boolean
  warnings: string[]
}

export interface ProductionCostPreview {
  materialCost: number
  labourCost: number
  machineCost: number
  jobWorkCost: number
  factoryOverhead: number
  reworkCost: number
  scrapRecovery: number
  totalProductionCost: number
  costPerGoodUnit: number
}

export interface ProductionVariancePreview {
  plannedMaterial: number
  consumedMaterial: number
  plannedOutput: number
  actualOutput: number
  materialUsageDiff: number
  scrapDiff: number
  yieldDiff: number
  reworkDiff: number
  costDiff: number
}

export interface WorkOrderClosingPreview {
  plannedQty: number
  goodQty: number
  rejectedQty: number
  scrapQty: number
  reworkQty: number
  materialConsumed: number
  materialReturned: number
  materialDifference: number
  qualityStatus: string
  openRework: number
  openJobWork: number
  cost: ProductionCostPreview
  variance: ProductionVariancePreview
  blockers: string[]
  warnings: string[]
}

export interface ProductionCompletionPreview {
  plannedQty: number
  previouslyProduced: number
  remainingQty: number
  currentOutput: number
  materialConsumption: MaterialConsumptionPreview
  fgWarehouseName: string
  qualityRequired: boolean
  estimatedCost: number
  warnings: string[]
  blockers: string[]
}

export interface WorkOrder {
  id: string
  woNumber: string
  status: WorkOrderStatus
  priority: WorkOrderPriority
  source: WorkOrderSource
  sourceDocumentId: string | null
  sourceDocumentNo: string
  finishedItemId: string
  finishedItemCode: string
  finishedItemName: string
  plannedQty: number
  producedQty: number
  rejectedQty: number
  scrapQty: number
  reworkQty: number
  remainingQty: number
  uom: string
  startDate: string
  dueDate: string
  productionMethod: ProductionMethod
  plantId: string
  plantName: string
  materialWarehouseId: string
  materialWarehouseName: string
  fgWarehouseId: string
  fgWarehouseName: string
  bomId: string | null
  bomNumber: string
  bomVersion: string
  customerId: string | null
  customerName: string
  salesOrderId: string | null
  salesOrderNo: string
  project?: string
  deliveryLocation?: string
  costCentre?: string
  qualityRequired: boolean
  batchRequired: boolean
  serialRequired: boolean
  materialStatus: WorkOrderMaterialStatus | 'not_checked'
  progressPercent: number
  consumptionMode: MaterialConsumptionMode
  supervisor?: string
  shift?: string
  workstation?: string
  holdReason?: HoldReason
  holdRemarks?: string
  holdAt?: string
  expectedResumeDate?: string
  differenceReason?: string
  qualityHold: boolean
  startedAt?: string
  completedAt?: string
  closedAt?: string
  createdAt: string
  updatedAt: string
  createdBy: string
  notes?: string
  /**
   * Route Master reference (template). Operations on the WO are a snapshot —
   * editing the master later does not change this Work Order.
   */
  routeId?: string | null
  routeNo?: string
  routeName?: string
  /** Version string copied from Route Master at create/attach time. */
  routeVersion?: string
  /** When route operations were snapshotted onto this WO. */
  routeSnapshotAt?: string
  /** Derived from operation stages for shopfloor. */
  currentOperationName?: string
  nextOperationName?: string
}

export interface WorkOrderFilter {
  search?: string
  woNumber?: string
  finishedItem?: string
  productionMethod?: ProductionMethod | ''
  source?: WorkOrderSource | ''
  salesOrder?: string
  customer?: string
  plant?: string
  startDateFrom?: string
  startDateTo?: string
  dueDateFrom?: string
  dueDateTo?: string
  materialStatus?: WorkOrderMaterialStatus | 'not_checked' | ''
  status?: WorkOrderStatus | ''
  listStatus?: WorkOrderListStatus | ''
  qcRequired?: boolean | ''
  ownerLine?: string
  priority?: WorkOrderPriority | ''
  tab?:
    | 'all'
    | 'draft'
    | 'ready'
    | 'in_progress'
    | 'on_hold'
    | 'completed'
    | 'qc_pending'
    | 'qc_hold'
    | 'closed'
    | 'cancelled'
    | 'material_shortage'
    | 'delayed'
    | 'job_work'
}

export interface WorkOrderSourceDocument {
  id: string
  source: WorkOrderSource
  documentNo: string
  label: string
  customerName?: string
  finishedItemId?: string
  finishedItemCode?: string
  finishedItemName?: string
  quantity?: number
  requiredDate?: string
  project?: string
  deliveryLocation?: string
  priority?: WorkOrderPriority
}

export interface WorkOrderSourceDetails {
  customerName: string
  finishedItemId: string
  finishedItemCode: string
  finishedItemName: string
  requiredQty: number
  requiredDate: string
  project?: string
  deliveryLocation?: string
  priority: WorkOrderPriority
  bomId?: string
  bomNumber?: string
  bomVersion?: string
  uom: string
  productionMethod: ProductionMethod
  materialWarehouseId: string
  materialWarehouseName: string
  fgWarehouseId: string
  fgWarehouseName: string
  plantId: string
  plantName: string
  costCentre?: string
  qualityRequired: boolean
  batchRequired: boolean
  serialRequired: boolean
}

export interface ProductionStartRequest {
  workOrderId: string
  startAt: string
  supervisor?: string
  shift?: string
  workstation?: string
  remarks?: string
}

export interface ProductionHoldRequest {
  workOrderId: string
  holdAt: string
  reason: HoldReason
  expectedResumeDate?: string
  remarks?: string
}

export interface CreateWorkOrderInput {
  source: WorkOrderSource
  sourceDocumentId?: string | null
  sourceDocumentNo?: string
  finishedItemId: string
  finishedItemCode: string
  finishedItemName: string
  plannedQty: number
  startDate: string
  dueDate: string
  plantId?: string
  plantName?: string
  productionMethod?: ProductionMethod
  priority?: WorkOrderPriority
  customerName?: string
  salesOrderNo?: string
  salesOrderId?: string | null
  project?: string
  deliveryLocation?: string
  bomId?: string | null
  bomNumber?: string
  bomVersion?: string
  uom?: string
  materialWarehouseId?: string
  materialWarehouseName?: string
  fgWarehouseId?: string
  fgWarehouseName?: string
  costCentre?: string
  qualityRequired?: boolean
  batchRequired?: boolean
  serialRequired?: boolean
  workstation?: string
  supervisor?: string
  notes?: string
  consumptionMode?: MaterialConsumptionMode
  routeId?: string | null
  /** Allow selecting a non-default route (permission-gated in UI). */
  overrideRoute?: boolean
}

export const WO_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  draft: 'Draft',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
  completed: 'Completed',
  closed: 'Closed',
  cancelled: 'Cancelled',
}

export const WO_LIST_STATUS_LABELS: Record<WorkOrderListStatus, string> = {
  draft: 'Draft',
  ready: 'Ready',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
  completed: 'Completed',
  qc_pending: 'QC Pending',
  qc_hold: 'QC Hold',
  closed: 'Closed',
  cancelled: 'Cancelled',
}

export const WO_QC_STATUS_LABELS: Record<WorkOrderQcStatus, string> = {
  not_required: 'Not Required',
  required: 'QC Required',
  pending: 'QC Pending',
  hold: 'QC Hold',
  cleared: 'QC Cleared',
}

/** Derive supervisor list status from lifecycle + QC/material flags. */
export function getWorkOrderListStatus(wo: WorkOrder): WorkOrderListStatus {
  if (wo.status === 'cancelled') return 'cancelled'
  if (wo.status === 'closed') return 'closed'
  if (wo.qualityHold) {
    if (wo.status === 'on_hold' || wo.holdReason === 'quality_issue') return 'qc_hold'
    return 'qc_pending'
  }
  if (wo.status === 'on_hold') return 'on_hold'
  if (wo.status === 'in_progress') return 'in_progress'
  if (wo.status === 'completed') return 'completed'
  if (wo.status === 'draft') {
    if (wo.materialStatus === 'available' || wo.materialStatus === 'reserved') return 'ready'
    return 'draft'
  }
  return 'draft'
}

export function getWorkOrderQcStatus(wo: WorkOrder): WorkOrderQcStatus {
  if (!wo.qualityRequired) return 'not_required'
  if (wo.qualityHold) {
    if (wo.status === 'on_hold' || wo.holdReason === 'quality_issue') return 'hold'
    return 'pending'
  }
  if (wo.status === 'closed' || wo.status === 'completed') return 'cleared'
  return 'required'
}

export function getWorkOrderOwnerLine(wo: WorkOrder): string {
  const parts = [wo.supervisor, wo.workstation].filter(Boolean)
  return parts.length ? parts.join(' · ') : wo.createdBy || '—'
}

export const WO_SOURCE_LABELS: Record<WorkOrderSource, string> = {
  sales_order: 'Sales Order',
  production_plan: 'Production Plan',
  stock_requirement: 'Stock Requirement',
  forecast: 'Forecast',
  manual: 'Manual',
}

export const WO_PRIORITY_LABELS: Record<WorkOrderPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
}

export const WO_MATERIAL_STATUS_LABELS: Record<WorkOrderMaterialStatus, string> = {
  available: 'Available',
  partial: 'Partial',
  shortage: 'Shortage',
  reserved: 'Reserved',
  consumed: 'Consumed',
}

export const HOLD_REASON_LABELS: Record<HoldReason, string> = {
  material_shortage: 'Material Shortage',
  machine_breakdown: 'Machine Breakdown',
  labour_issue: 'Labour Issue',
  quality_issue: 'Quality Issue',
  management_hold: 'Management Hold',
  other: 'Other',
}

export const SCRAP_REASON_LABELS: Record<ScrapReason, string> = {
  material_defect: 'Material Defect',
  machine_problem: 'Machine Problem',
  process_loss: 'Process Loss',
  quality_rejection: 'Quality Rejection',
  operator_error: 'Operator Error',
  setup_loss: 'Setup Loss',
  trial_production: 'Trial Production',
  other: 'Other',
}
