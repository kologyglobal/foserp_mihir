import type { AuditTrail } from './audit'

export type DispatchStatus =
  | 'ready'
  | 'planned'
  | 'loading'
  | 'dispatched'
  | 'in_transit'
  | 'delivered'
  | 'pod_received'
  | 'closed'
  | 'cancelled'

export const DISPATCH_STATUS_FLOW: Record<DispatchStatus, DispatchStatus[]> = {
  ready: ['planned', 'cancelled'],
  planned: ['loading', 'dispatched', 'cancelled'],
  loading: ['dispatched', 'cancelled'],
  dispatched: ['in_transit', 'delivered', 'pod_received'],
  in_transit: ['delivered', 'pod_received'],
  delivered: ['pod_received', 'closed'],
  pod_received: ['closed'],
  closed: [],
  cancelled: [],
}

export interface DispatchChecklistItem {
  id: string
  label: string
  sortOrder: number
  passed: boolean
  mandatory: boolean
  notes: string
  /** System gate — cannot be toggled manually if auto-checked */
  systemGate?: boolean
}

export interface DispatchPhoto {
  id: string
  label: string
  dataUrl: string
  capturedAt: string
  category: 'loading' | 'trailer' | 'document' | 'pod'
}

export interface CustomerAcknowledgement {
  acknowledgedBy: string
  designation: string
  ackDate: string
  remarks: string
  signatureDataUrl: string | null
  photoDataUrl: string | null
  recordedAt: string
  recordedByName: string
}

export interface GatePassInfo {
  gatePassNo: string
  vehicleNo: string
  driverName: string
  driverPhone: string
  transporter: string
  lrNo: string
  securityApprovedBy: string | null
  securityApprovedAt: string | null
}

export interface DispatchLine {
  id: string
  itemId: string
  itemCode: string
  warehouseId: string
  warehouseCode: string
  qty: number
  workOrderId: string | null
  workOrderNo: string | null
  trailerNo: string
  chassisNo: string
  serialNo: string
}

export interface DispatchPlan extends AuditTrail {
  id: string
  dispatchNo: string
  salesOrderId: string
  salesOrderNo: string
  customerId: string
  customerName: string
  productId: string
  productCode: string
  productName: string
  destination: string
  locationId?: string | null
  plannedDate: string
  dispatchDate: string | null
  status: DispatchStatus
  vehicleNo: string
  lrNo: string
  transporter: string
  driverName: string
  driverPhone: string
  ewayBillNo: string
  invoiceId: string | null
  invoiceNo: string | null
  finalQcInspectionId: string | null
  gatePass: GatePassInfo | null
  lines: DispatchLine[]
  checklist: DispatchChecklistItem[]
  photos: DispatchPhoto[]
  customerAck: CustomerAcknowledgement | null
  dispatchedAt: string | null
  movementNo: string | null
  remarks: string
}

export interface DispatchReadyCandidate {
  salesOrderId: string
  salesOrderNo: string
  customerId: string
  customerName: string
  productId: string
  productCode: string
  productName: string
  fgItemId: string
  fgItemCode: string
  workOrderId: string
  workOrderNo: string
  woQty: number
  fgOnHand: number
  destination: string
  locationId?: string | null
  requiredDate: string
  finalQcPassed: boolean
  trailerSerial: string
  chassisNo: string
}

export function allMandatoryChecklistPassed(items: DispatchChecklistItem[]): boolean {
  const mandatory = items.filter((c) => c.mandatory)
  return mandatory.length > 0 && mandatory.every((c) => c.passed)
}

export function allChecklistPassed(items: DispatchChecklistItem[]): boolean {
  return items.length > 0 && items.every((c) => c.passed)
}

export function dispatchStatusLabel(status: DispatchStatus): string {
  const labels: Record<DispatchStatus, string> = {
    ready: 'Ready',
    planned: 'Planned',
    loading: 'Loading',
    dispatched: 'Dispatched',
    in_transit: 'In Transit',
    delivered: 'Delivered',
    pod_received: 'POD Received',
    closed: 'Closed',
    cancelled: 'Cancelled',
  }
  return labels[status]
}

export interface DispatchReportRow {
  dispatchId: string
  dispatchNo: string
  salesOrderNo: string
  customerName: string
  status: DispatchStatus
  plannedDate: string
  trailerNo: string
  chassisNo: string
}
