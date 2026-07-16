/** Barcode & QR traceability — entity labels and event history */

export type BarcodeEntityType =
  | 'item'
  | 'batch'
  | 'grn'
  | 'sub_assembly'
  | 'work_order'
  | 'finished_goods'
  | 'trailer'

export type BarcodeStatus = 'active' | 'consumed' | 'void'

export type BarcodeEventType =
  | 'created'
  | 'received'
  | 'issued'
  | 'consumed'
  | 'moved'
  | 'subcontracted'
  | 'dispatched'

export const BARCODE_ENTITY_LABELS: Record<BarcodeEntityType, string> = {
  item: 'Item',
  batch: 'Batch',
  grn: 'GRN',
  sub_assembly: 'Sub Assembly',
  work_order: 'Work Order',
  finished_goods: 'Finished Goods',
  trailer: 'Trailer',
}

export const BARCODE_EVENT_LABELS: Record<BarcodeEventType, string> = {
  created: 'Created',
  received: 'Received',
  issued: 'Issued',
  consumed: 'Consumed',
  moved: 'Moved',
  subcontracted: 'Subcontracted',
  dispatched: 'Dispatched',
}

export interface BarcodeRecord {
  barcodeId: string
  entityType: BarcodeEntityType
  entityId: string
  entityLabel: string
  barcodeValue: string
  qrValue: string
  status: BarcodeStatus
  createdDate: string
  batchNo?: string
  trailerNo?: string
  chassisNo?: string
}

export interface BarcodeHistoryEntry {
  id: string
  barcodeId: string
  barcodeValue: string
  eventType: BarcodeEventType
  entityType: BarcodeEntityType
  entityId: string
  referenceNo: string
  details: string
  eventDate: string
  userName: string
}

export interface BarcodeTraceResult {
  barcode: BarcodeRecord | null
  history: BarcodeHistoryEntry[]
  related: BarcodeRecord[]
}
