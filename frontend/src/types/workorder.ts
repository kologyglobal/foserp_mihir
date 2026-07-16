import type { BomSourceType } from './bom'
import type { JobCardQcCheck, QcChecklistItem } from './qc'

export type WorkOrderType = 'finished_goods' | 'manufactured_sub_assembly' | 'subcontract'

export type WorkOrderStatus =
  | 'draft'
  | 'planned'
  | 'released'
  | 'material_reserved'
  | 'partially_issued'
  | 'fully_issued'
  | 'in_production'
  | 'completed'
  | 'fg_received'
  | 'closed'
  | 'cancelled'

export type WoMaterialLineStatus =
  | 'open'
  | 'partially_reserved'
  | 'reserved'
  | 'partially_issued'
  | 'issued'

export type WoCreationMode = 'one_per_trailer' | 'per_sub_assembly'

export interface WorkOrderConfig {
  creationMode: WoCreationMode
  createFinishedGoodsWo: boolean
  createManufacturedSubAssemblyWo: boolean
  createSubcontractWo: boolean
}

export interface WorkOrder {
  id: string
  woNo: string
  woType: WorkOrderType
  salesOrderId: string
  salesOrderNo: string
  productId: string
  fgItemId: string
  outputItemId: string
  outputItemCode: string
  qty: number
  plannedStartDate: string
  plannedFinishDate: string
  status: WorkOrderStatus
  bomHeaderId: string
  bomRevision: string
  routingHeaderId: string | null
  routingRevision: string | null
  mrpRunId: string | null
  parentWoId: string | null
  vendorId: string | null
  releasedAt: string | null
  completedAt: string | null
  fgReceivedAt: string | null
  closedAt: string | null
  remarks: string
  createdAt: string
  updatedAt: string
}

export interface WorkOrderMaterialLine {
  id: string
  workOrderId: string
  itemId: string
  itemCode: string
  warehouseId: string
  uomId: string
  requiredQty: number
  reservedQty: number
  issuedQty: number
  balanceQty: number
  sourceType: BomSourceType
  status: WoMaterialLineStatus
  pegBomLineId: string | null
  /** Child sub-assembly WO that produces this material (FG consumption lines). */
  sourceWoId: string | null
}

export interface SubcontractShipment {
  id: string
  workOrderId: string
  vendorId: string
  challanNo: string
  itemId: string
  warehouseId: string
  sentQty: number
  receivedQty: number
  rejectedQty: number
  reworkQty: number
  expectedReturnDate: string
  status: 'draft' | 'sent' | 'partial_received' | 'received' | 'closed'
  sentAt: string | null
  receivedAt: string | null
  createdAt: string
  vehicleNo?: string
  driver?: string
  qcRequired?: boolean
  qcInspectionId?: string | null
  ncrIds?: string[]
  remarks?: string
}

export interface FgReceipt {
  id: string
  workOrderId: string
  itemId: string
  warehouseId: string
  qty: number
  receiptDate: string
  movementNo: string | null
  createdAt: string
}

export type SaReceiptStatus = 'posted' | 'cancelled'

export interface SaReceipt {
  id: string
  sourceWoId: string
  sourceWoNo: string
  parentWoId: string | null
  parentWoNo: string | null
  itemId: string
  itemCode: string
  warehouseId: string
  warehouseCode: string
  qty: number
  receiptDate: string
  movementNo: string | null
  status: SaReceiptStatus
  createdAt: string
}

export interface WorkOrderActivity {
  id: string
  workOrderId: string
  action: string
  details: string
  createdAt: string
  createdBy: string
}

export type ProductionOperationStatus = 'pending' | 'in_progress' | 'completed' | 'qc_hold' | 'skipped'

export interface WorkOrderProductionOperation {
  id: string
  workOrderId: string
  routingOperationId: string
  operationCode: string
  sequenceNo: number
  operationName: string
  workCenterId: string
  workCenterCode: string
  standardHours: number
  setupTimeHours: number
  runTimeHours: number
  laborRequirement: number
  qcRequired: boolean
  outsourced: boolean
  qcChecklist: QcChecklistItem[]
  status: ProductionOperationStatus
  createdAt: string
}

export type JobCardStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'qc_hold'

export interface JobCard {
  id: string
  jobCardNo: string
  workOrderId: string
  woNo: string
  productionOperationId: string
  sequenceNo: number
  operationName: string
  workCenterCode: string
  assignedTeam: string | null
  plannedHours: number
  startTime: string | null
  endTime: string | null
  actualHours: number | null
  remarks: string
  status: JobCardStatus
  requiresQc: boolean
  qcChecks: JobCardQcCheck[]
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export const DEFAULT_WO_CONFIG: WorkOrderConfig = {
  creationMode: 'per_sub_assembly',
  createFinishedGoodsWo: true,
  createManufacturedSubAssemblyWo: true,
  createSubcontractWo: true,
}

export const WO_TERMINAL_STATUSES: WorkOrderStatus[] = ['closed', 'cancelled', 'fg_received']

export function isWoEditable(status: WorkOrderStatus): boolean {
  return status === 'draft' || status === 'planned'
}

export function computeMaterialLineStatus(line: Pick<WorkOrderMaterialLine, 'requiredQty' | 'reservedQty' | 'issuedQty'>): WoMaterialLineStatus {
  if (line.issuedQty >= line.requiredQty) return 'issued'
  if (line.issuedQty > 0) return 'partially_issued'
  if (line.reservedQty >= line.requiredQty) return 'reserved'
  if (line.reservedQty > 0) return 'partially_reserved'
  return 'open'
}
