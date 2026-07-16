/** Serial Number Master — trailer and component genealogy */

export type SerialType =
  | 'finished_trailer'
  | 'chassis'
  | 'tank'
  | 'axle'
  | 'abs_ebs_kit'
  | 'tyre'
  | 'compressor'
  | 'valve'
  | 'sub_assembly'

export type SerialStatus =
  | 'created'
  | 'in_stock'
  | 'issued'
  | 'in_wip'
  | 'installed'
  | 'qc_hold'
  | 'rejected'
  | 'dispatched'
  | 'warranty'
  | 'closed'
  // Legacy values (persisted data)
  | 'registered'
  | 'assigned'
  | 'in_production'
  | 'ready'
  | 'retired'

export const SERIAL_TYPE_LABELS: Record<SerialType, string> = {
  finished_trailer: 'Finished Trailer',
  chassis: 'Chassis',
  tank: 'Tank',
  axle: 'Axle',
  abs_ebs_kit: 'ABS/EBS Kit',
  tyre: 'Tyre',
  compressor: 'Compressor',
  valve: 'Valve',
  sub_assembly: 'Sub Assembly',
}

export const SERIAL_STATUS_LABELS: Record<SerialStatus, string> = {
  created: 'Created',
  in_stock: 'In Stock',
  issued: 'Issued',
  in_wip: 'In WIP',
  installed: 'Installed',
  qc_hold: 'QC Hold',
  rejected: 'Rejected',
  dispatched: 'Dispatched',
  warranty: 'Warranty',
  closed: 'Closed',
  registered: 'Created',
  assigned: 'Issued',
  in_production: 'In WIP',
  ready: 'In Stock',
  retired: 'Closed',
}

export interface SerialNumberRecord {
  id: string
  serialNo: string
  serialType: SerialType
  itemId: string | null
  itemCode: string | null
  productId: string | null
  productCode: string | null
  qrCode: string | null
  workOrderId: string | null
  woNo: string | null
  salesOrderId: string | null
  salesOrderNo: string | null
  customerId: string | null
  customerName: string | null
  vendorId: string | null
  vendorName: string | null
  grnId: string | null
  grnNo: string | null
  batchLot: string | null
  parentSerialId: string | null
  installedTrailerNo: string | null
  status: SerialStatus
  createdAt: string
  createdBy: string | null
  updatedAt: string
}

export interface TrailerGenealogyNode {
  kind: 'grn' | 'qc' | 'ncr' | 'rework' | 'wo' | 'dispatch' | 'invoice' | 'component' | 'vendor' | 'serial'
  label: string
  refId: string
  refNo: string
  date: string
  details: string
}

export interface TrailerGenealogyResult {
  serial: SerialNumberRecord | null
  trailerNo: string | null
  chassisNo: string | null
  qrCode: string | null
  woNo: string | null
  salesOrderNo: string | null
  customerName: string | null
  components: SerialNumberRecord[]
  timeline: TrailerGenealogyNode[]
}

export interface ComponentGenealogyResult {
  serial: SerialNumberRecord
  timeline: TrailerGenealogyNode[]
  installedTrailerNo: string | null
  customerName: string | null
}

export interface WarrantyInvestigationResult {
  trailerNo: string
  chassisNo: string | null
  customerName: string | null
  dispatchDate: string | null
  invoiceNo: string | null
  components: SerialNumberRecord[]
  qcRecords: TrailerGenealogyNode[]
  reworkRecords: TrailerGenealogyNode[]
  ncrRecords: TrailerGenealogyNode[]
  vendorSources: TrailerGenealogyNode[]
}

/** Item category codes that auto-register component serials on GRN */
export const SERIALIZED_ITEM_PREFIXES: Array<{ match: RegExp; serialType: SerialType }> = [
  { match: /axle/i, serialType: 'axle' },
  { match: /abs|ebs/i, serialType: 'abs_ebs_kit' },
  { match: /compressor/i, serialType: 'compressor' },
  { match: /valve/i, serialType: 'valve' },
  { match: /tyre|tire/i, serialType: 'tyre' },
]
