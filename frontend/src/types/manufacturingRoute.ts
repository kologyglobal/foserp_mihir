/** Manufacturing Route Master + Work Order operation stages (demo FE, folded into WO). */

export type ManufacturingRouteStatus = 'draft' | 'active' | 'inactive'

export type QtyBasis = 'wo_planned' | 'previous_output' | 'fixed'

export type WorkOrderOperationStatus =
  | 'pending'
  | 'ready'
  | 'in_progress'
  | 'on_hold'
  | 'completed'
  | 'qc_pending'
  | 'accepted'
  | 'rework'
  | 'rejected'
  | 'skipped'

export interface ManufacturingRouteOperationLine {
  id: string
  sequenceNo: number
  operationName: string
  workCenter: string
  plannedTimeMinutes: number
  qcRequired: boolean
  jobWorkRequired: boolean
  defaultVendorId?: string
  defaultVendorName?: string
  inputQtyBasis: QtyBasis
  outputQtyBasis: QtyBasis
  allowScrap: boolean
  allowRework: boolean
  allowReject: boolean
  remarks?: string
}

export interface ManufacturingRoute {
  id: string
  routeNo: string
  routeName: string
  finishedItemId: string
  finishedItemCode: string
  finishedItemName: string
  version: string
  status: ManufacturingRouteStatus
  defaultBomId: string | null
  defaultBomNumber: string
  remarks?: string
  operations: ManufacturingRouteOperationLine[]
  createdAt: string
  updatedAt: string
  createdBy: string
}

export interface CreateManufacturingRouteInput {
  routeName: string
  finishedItemId: string
  finishedItemCode: string
  finishedItemName: string
  version?: string
  defaultBomId?: string | null
  defaultBomNumber?: string
  remarks?: string
  operations: Array<Omit<ManufacturingRouteOperationLine, 'id'> & { id?: string }>
}

export interface WorkOrderOperation {
  id: string
  workOrderId: string
  /** Source Route Master id (reference only — ops are a WO-local snapshot). */
  routeId: string | null
  routeOperationId: string | null
  /** Route Master version at snapshot time. */
  routeVersion?: string
  sequenceNo: number
  operationName: string
  workCenter: string
  plannedQty: number
  completedQty: number
  pendingQty: number
  scrapQty: number
  reworkQty: number
  rejectedQty: number
  operator?: string
  startedAt?: string
  endedAt?: string
  qcRequired: boolean
  jobWorkRequired: boolean
  defaultVendorName?: string
  jobWorkOrderId?: string
  status: WorkOrderOperationStatus
  allowScrap: boolean
  allowRework: boolean
  allowReject: boolean
  plannedTimeMinutes: number
  remarks?: string
  holdReason?: string
}

export const ROUTE_STATUS_LABELS: Record<ManufacturingRouteStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  inactive: 'Inactive',
}

export const WO_OPERATION_STATUS_LABELS: Record<WorkOrderOperationStatus, string> = {
  pending: 'Pending',
  ready: 'Ready',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
  completed: 'Completed',
  qc_pending: 'QC Pending',
  accepted: 'Accepted',
  rework: 'Rework',
  rejected: 'Rejected',
  skipped: 'Skipped',
}

export const QTY_BASIS_LABELS: Record<QtyBasis, string> = {
  wo_planned: 'WO Planned Qty',
  previous_output: 'Previous Output',
  fixed: 'Fixed',
}
