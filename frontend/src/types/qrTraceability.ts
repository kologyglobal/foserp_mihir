/** QR Code traceability — entity registry, status, events, genealogy */

export type QrEntityType =
  | 'ITEM_BATCH'
  | 'GRN_LINE'
  | 'MATERIAL_LOT'
  | 'SUB_ASSEMBLY'
  | 'WORK_ORDER'
  | 'JOB_CARD'
  | 'JOB_WORK_ORDER'
  | 'FINISHED_TRAILER'
  | 'DISPATCH'

export type QrStatus =
  | 'CREATED'
  | 'IN_STOCK'
  | 'ISSUED'
  | 'IN_WIP'
  | 'AT_VENDOR'
  | 'QC_HOLD'
  | 'QC_PASSED'
  | 'REJECTED'
  | 'CONSUMED'
  | 'DISPATCHED'
  | 'CLOSED'

export type QrEventType =
  | 'received'
  | 'stored'
  | 'issued'
  | 'moved'
  | 'inspected'
  | 'reworked'
  | 'subcontracted'
  | 'consumed'
  | 'dispatched'
  | 'closed'

export type QrMovementKind =
  | 'QR_ISSUE_TO_WO'
  | 'QR_TRANSFER'
  | 'QR_WIP_MOVE'
  | 'QR_SA_RECEIPT'
  | 'QR_SA_CONSUME'
  | 'QR_FG_DISPATCH'

export interface QrPayload {
  type: QrEntityType
  id: string
  wo?: string
  item?: string
  batch?: string
  grn?: string
  vendor?: string
  trailer?: string
  chassis?: string
}

export interface QrMetadata {
  itemId?: string
  itemCode?: string
  itemName?: string
  batchNo?: string
  lotNo?: string
  grnId?: string
  grnNo?: string
  grnLineId?: string
  qty?: number
  warehouseId?: string
  warehouseCode?: string
  woId?: string
  woNo?: string
  productId?: string
  productCode?: string
  jobCardId?: string
  jobCardNo?: string
  vendorId?: string
  vendorName?: string
  shipmentId?: string
  challanNo?: string
  trailerNo?: string
  chassisNo?: string
  customerId?: string
  customerName?: string
  dispatchId?: string
  dispatchNo?: string
  parentQrId?: string
  parentEntityId?: string
  stage?: string
}

export interface QrRecord {
  qrId: string
  qrCode: string
  entityType: QrEntityType
  entityId: string
  displayCode: string
  status: QrStatus
  createdAt: string
  createdBy: string
  lastScannedAt: string | null
  lastScannedBy: string | null
  metadata: QrMetadata
}

export interface QrHistoryEntry {
  id: string
  qrId: string
  eventType: QrEventType
  movementKind?: QrMovementKind
  referenceNo: string
  details: string
  eventAt: string
  userName: string
  linkedQrId?: string
}

export interface QrGenealogyNode {
  qrId: string
  entityType: QrEntityType
  displayCode: string
  status: QrStatus
  label: string
  metadata: QrMetadata
}

export interface QrGenealogyEdge {
  fromQrId: string
  toQrId: string
  relation: string
}

export interface QrTraceResult {
  qr: QrRecord | null
  history: QrHistoryEntry[]
  genealogy: { nodes: QrGenealogyNode[]; edges: QrGenealogyEdge[] }
  related: QrRecord[]
}

export const QR_ENTITY_LABELS: Record<QrEntityType, string> = {
  ITEM_BATCH: 'Item Batch',
  GRN_LINE: 'GRN Line',
  MATERIAL_LOT: 'Material Lot',
  SUB_ASSEMBLY: 'Sub Assembly',
  WORK_ORDER: 'Work Order',
  JOB_CARD: 'Job Card',
  JOB_WORK_ORDER: 'Job Work Order',
  FINISHED_TRAILER: 'Finished Trailer',
  DISPATCH: 'Dispatch',
}

export const QR_STATUS_LABELS: Record<QrStatus, string> = {
  CREATED: 'Created',
  IN_STOCK: 'In Stock',
  ISSUED: 'Issued',
  IN_WIP: 'In WIP',
  AT_VENDOR: 'At Vendor',
  QC_HOLD: 'QC Hold',
  QC_PASSED: 'QC Passed',
  REJECTED: 'Rejected',
  CONSUMED: 'Consumed',
  DISPATCHED: 'Dispatched',
  CLOSED: 'Closed',
}

export const QR_EVENT_LABELS: Record<QrEventType, string> = {
  received: 'Received',
  stored: 'Stored',
  issued: 'Issued',
  moved: 'Moved',
  inspected: 'Inspected',
  reworked: 'Reworked',
  subcontracted: 'Subcontracted',
  consumed: 'Consumed',
  dispatched: 'Dispatched',
  closed: 'Closed',
}
