/**
 * Gate & Security frontend domain types.
 *
 * Business boundaries (enforced across the module):
 * - Material inward records physical arrival only — no inventory posting, no GRN creation.
 * - Material outward verifies an approved source document and records physical release only.
 * - Visitor entry/exit never creates attendance.
 * - Gate passes track physical item movement only — no accounting vouchers.
 */

/** Common audit envelope shared by all primary gate records */
export interface GateRecordBase {
  id: string
  tenantId: string
  entryNumber: string
  status: string
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
}

// ─── Gate locations & settings ───────────────────────────────────────────────

export type GateEntryType =
  | 'visitor'
  | 'vehicle'
  | 'material_inward'
  | 'material_outward'
  | 'contractor'
  | 'courier'

export interface GateLocation {
  id: string
  name: string
  plant: string
  entryTypesAllowed: GateEntryType[]
  isActive: boolean
}

export interface GateSettings {
  visitor: {
    hostApprovalRequired: boolean
    photoCaptureRequired: boolean
    maskedIdEnabled: boolean
    qrEnabled: boolean
    defaultVisitDurationMinutes: number
    overstayThresholdMinutes: number
  }
  material: {
    allowInwardWithoutPo: boolean
    vehicleNumberRequired: boolean
    documentPhotoRequired: boolean
    outwardApprovalRequired: boolean
    releaseChecklistRequired: boolean
  }
  pass: {
    numberFormat: string
    returnReminderDays: number
    approvalRequired: boolean
    partialReturnAllowed: boolean
  }
  masters: {
    visitorTypes: string[]
    visitPurposes: string[]
    vehicleTypes: string[]
    materialMovementTypes: string[]
    passTypes: string[]
    courierCompanies: string[]
    rejectionReasons: string[]
    blacklistReasons: string[]
  }
}

// ─── Dashboard / register / activity ────────────────────────────────────────

export interface GateDashboardSummary {
  visitorsInside: number
  vehiclesInside: number
  expectedVisitorsToday: number
  expectedVisitorsArrived: number
  materialInwardWaiting: number
  outwardAwaitingRelease: number
  overdueReturnables: number
  contractorsInside: number
  couriersPendingHandover: number
  pendingApprovals: number
  vehiclesWaitingOver30Min: number
  pulse: string[]
}

export type GateActivityEvent =
  | 'visitor_arrived'
  | 'visitor_approved'
  | 'visitor_entered'
  | 'visitor_exited'
  | 'vehicle_arrived'
  | 'vehicle_exited'
  | 'material_inward_registered'
  | 'outward_released'
  | 'gate_pass_returned'
  | 'contractor_entered'
  | 'contractor_exited'
  | 'courier_received'
  | 'courier_handed_over'
  | 'approval_actioned'

export interface GateActivity {
  id: string
  time: string
  event: GateActivityEvent
  recordType: GateEntryType | 'gate_pass' | 'approval'
  recordId: string
  recordLabel: string
  company?: string
  gate: string
  operator: string
  status: string
}

/** Unified row for the Today's Register */
export interface GateEntry extends GateRecordBase {
  entryType: GateEntryType
  time: string
  /** Name / vehicle number / document reference depending on type */
  subject: string
  company?: string
  purpose?: string
  relatedDocument?: string
  gate: string
  entryBy: string
  entryTime?: string | null
  exitTime?: string | null
  isInside: boolean
}

// ─── Visitors ────────────────────────────────────────────────────────────────

export type VisitorStatus =
  | 'expected'
  | 'arrived'
  | 'waiting_approval'
  | 'approved'
  | 'inside'
  | 'exited'
  | 'rejected'
  | 'cancelled'
  | 'no_show'
  | 'overstayed'
  | 'blacklisted'

export type VisitorType =
  | 'customer'
  | 'vendor'
  | 'consultant'
  | 'service_engineer'
  | 'interview_candidate'
  | 'auditor'
  | 'government_official'
  | 'contractor'
  | 'delivery_person'
  | 'personal_visitor'
  | 'other'

/** Repeat-visitor profile keyed by mobile number */
export interface Visitor {
  id: string
  tenantId: string
  name: string
  mobile: string
  company?: string
  email?: string
  photoUrl?: string | null
  idType?: string
  /** Masked reference only — never a complete government ID */
  idReferenceMasked?: string
  lastHost?: string
  lastVehicleNumber?: string
  lastVisitAt?: string | null
  totalVisits: number
  isBlacklisted: boolean
  blacklistReason?: string
}

export interface VisitorVisit extends GateRecordBase {
  status: VisitorStatus
  visitorId?: string
  visitorName: string
  mobile: string
  company?: string
  email?: string
  visitorType: VisitorType
  visitorCount: number
  photoUrl?: string | null
  idType?: string
  idReferenceMasked?: string
  hostName: string
  department: string
  purpose: string
  expectedDurationMinutes?: number
  meetingLocation?: string
  remarks?: string
  vehicleNumber?: string
  vehicleType?: string
  laptopCarried: boolean
  equipmentCarried: boolean
  bagCount: number
  belongingsDescription?: string
  safetyDeclarationAccepted: boolean
  ppeRequired: boolean
  ndaRequired: boolean
  hostApprovalRequired: boolean
  approvalStatus: 'not_required' | 'pending' | 'approved' | 'rejected'
  approvalRemarks?: string
  approvedBy?: string
  approvedAt?: string | null
  gate: string
  visitDate: string
  expectedArrival?: string
  entryTime?: string | null
  exitTime?: string | null
  exitRemarks?: string
  badgeReturned?: boolean
  instructions?: string
  approvalHistory: Array<{ at: string; by: string; action: string; remarks?: string }>
}

export interface ExpectedVisitor {
  id: string
  tenantId: string
  reference: string
  visitorName: string
  mobile: string
  company?: string
  visitDate: string
  expectedArrival: string
  hostName: string
  department: string
  purpose: string
  gate: string
  vehicleNumber?: string
  instructions?: string
  status: 'expected' | 'arrived' | 'cancelled' | 'no_show'
}

// ─── Vehicles ────────────────────────────────────────────────────────────────

export type GateVehicleStatus =
  | 'expected'
  | 'arrived'
  | 'waiting'
  | 'allowed_inside'
  | 'loading'
  | 'unloading'
  | 'ready_exit'
  | 'exited'
  | 'rejected'
  | 'cancelled'

export interface GateVehicle extends GateRecordBase {
  status: GateVehicleStatus
  vehicleNumber: string
  vehicleType: string
  purpose: string
  companyName?: string
  transporter?: string
  driverName: string
  driverMobile?: string
  licenceVerified: 'not_checked' | 'verified' | 'failed'
  relatedDocument?: string
  gate: string
  plannedLocation?: string
  currentLocation?: string
  sealNumber?: string
  remarks?: string
  entryTime?: string | null
  exitTime?: string | null
  exitRemarks?: string
  timeline: Array<{ at: string; status: GateVehicleStatus; by: string; note?: string }>
}

// ─── Material inward ─────────────────────────────────────────────────────────

export type MaterialInwardType =
  | 'purchase_order'
  | 'without_po'
  | 'customer_return'
  | 'job_work_return'
  | 'subcontract_return'
  | 'repair_return'
  | 'sample_received'
  | 'asset_received'
  | 'courier_material'
  | 'other'

export type MaterialInwardStatus =
  | 'draft'
  | 'vehicle_arrived'
  | 'documents_verified'
  | 'waiting_unloading'
  | 'waiting_store'
  | 'waiting_qc'
  | 'waiting_grn'
  | 'accepted'
  | 'rejected'
  | 'closed'
  | 'cancelled'

export interface MaterialInwardLine {
  id: string
  itemDescription: string
  expectedQty?: number
  uom?: string
  remarks?: string
}

export interface MaterialInwardEntry extends GateRecordBase {
  status: MaterialInwardStatus
  inwardType: MaterialInwardType
  vendorName?: string
  poNumber?: string
  challanNumber?: string
  invoiceNumber?: string
  lrNumber?: string
  vehicleNumber?: string
  vehicleType?: string
  transporter?: string
  driverName?: string
  driverMobile?: string
  sealNumber?: string
  materialSummary: string
  packages: number
  approxQty?: number
  uom?: string
  grossWeight?: string
  warehouse?: string
  unloadingLocation?: string
  documentPhotoUrl?: string | null
  materialPhotoUrl?: string | null
  remarks?: string
  gate: string
  arrivalTime?: string | null
  lines: MaterialInwardLine[]
  linkedGrnNumber?: string | null
  linkedQcNumber?: string | null
  timeline: Array<{ at: string; status: MaterialInwardStatus; by: string; note?: string }>
}

// ─── Material outward ────────────────────────────────────────────────────────

export type MaterialOutwardType =
  | 'finished_goods_dispatch'
  | 'delivery_challan'
  | 'vendor_return'
  | 'purchase_return'
  | 'job_work_send'
  | 'subcontract_send'
  | 'repair_send'
  | 'sample_send'
  | 'scrap_disposal'
  | 'asset_movement'
  | 'stock_transfer'
  | 'returnable'
  | 'non_returnable'
  | 'other'

export type MaterialOutwardStatus =
  | 'awaiting_vehicle'
  | 'pending_approval'
  | 'ready_for_gate'
  | 'vehicle_inside'
  | 'held'
  | 'mismatch'
  | 'released'
  | 'rejected'
  | 'cancelled'

export interface MaterialOutwardLine {
  id: string
  itemDescription: string
  expectedQty: number
  verifiedQty?: number
  uom?: string
  remarks?: string
}

export type OutwardChecklistKey =
  | 'sourceApproved'
  | 'vehicleMatches'
  | 'driverVerified'
  | 'packageCountMatches'
  | 'materialMatches'
  | 'documentAvailable'
  | 'sealRecorded'
  | 'securityCheckDone'

export interface MaterialOutwardEntry extends GateRecordBase {
  status: MaterialOutwardStatus
  outwardType: MaterialOutwardType
  documentType: string
  documentNumber: string
  documentApproved: boolean
  partyName?: string
  vehicleNumber?: string
  driverName?: string
  driverMobile?: string
  transporter?: string
  sealNumber?: string
  materialSummary: string
  packagesExpected: number
  packagesVerified?: number
  approvalStatus: 'not_required' | 'pending' | 'approved' | 'rejected'
  plannedTime?: string
  releasedAt?: string | null
  releasedBy?: string
  holdRemarks?: string
  mismatchRemarks?: string
  rejectRemarks?: string
  checklist: Record<OutwardChecklistKey, boolean>
  gate: string
  lines: MaterialOutwardLine[]
  timeline: Array<{ at: string; status: MaterialOutwardStatus; by: string; note?: string }>
}

// ─── Gate passes ─────────────────────────────────────────────────────────────

export type GatePassStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'sent_out'
  | 'partially_returned'
  | 'returned'
  | 'overdue'
  | 'written_off'
  | 'closed'
  | 'cancelled'

export type GatePassKind = 'returnable' | 'non_returnable'

export interface GatePassItem {
  id: string
  itemDescription: string
  serialNumber?: string
  quantity: number
  uom: string
  conditionOut?: string
  returnedQuantity: number
  remarks?: string
}

export interface GatePassReturn {
  id: string
  returnDate: string
  itemId: string
  returnedQuantity: number
  conditionReturned?: string
  damage?: string
  remarks?: string
  recordedBy: string
}

export interface GatePass extends GateRecordBase {
  status: GatePassStatus
  passKind: GatePassKind
  movementType: string
  department: string
  responsibleEmployee: string
  carriedBy: string
  partyName?: string
  purpose: string
  outwardDate: string
  expectedReturnDate?: string | null
  approverName?: string
  approvalStatus: 'not_required' | 'pending' | 'approved' | 'rejected'
  approvalRemarks?: string
  items: GatePassItem[]
  returns: GatePassReturn[]
  gate: string
}

// ─── Contractors ─────────────────────────────────────────────────────────────

export type ContractorStatus = 'inside' | 'exited' | 'expected' | 'cancelled'

export interface ContractorEntry extends GateRecordBase {
  status: ContractorStatus
  workerName: string
  mobile: string
  contractorCompany: string
  workReference?: string
  department: string
  supervisor: string
  workLocation: string
  validFrom: string
  validUntil: string
  safetyInductionDone: boolean
  ppeIssued: boolean
  toolsCarried?: string
  photoUrl?: string | null
  purpose: string
  remarks?: string
  gate: string
  entryTime?: string | null
  exitTime?: string | null
}

// ─── Couriers ────────────────────────────────────────────────────────────────

export type CourierDirection = 'incoming' | 'outgoing'
export type CourierStatus = 'received' | 'pending_handover' | 'handed_over' | 'dispatched' | 'delivered'

export interface CourierEntry extends GateRecordBase {
  status: CourierStatus
  direction: CourierDirection
  courierCompany: string
  trackingNumber?: string
  senderName?: string
  recipientEmployee?: string
  department?: string
  parcelType?: string
  parcelDescription?: string
  receivedTime?: string | null
  receivedBy?: string
  handoverTime?: string | null
  handedOverTo?: string
  dispatchTime?: string | null
  charges?: number
  remarks?: string
  gate: string
}

// ─── Approvals ───────────────────────────────────────────────────────────────

export type GateApprovalType =
  | 'walk_in_visitor'
  | 'inward_without_po'
  | 'material_outward'
  | 'returnable_gate_pass'
  | 'asset_movement'
  | 'scrap_outward'
  | 'contractor_after_hours'
  | 'blacklist_override'

export type GateApprovalStatus = 'pending' | 'approved' | 'rejected' | 'sent_back'

export interface GateApproval {
  id: string
  tenantId: string
  requestNumber: string
  requestType: GateApprovalType
  requestedBy: string
  subject: string
  reason: string
  requestedAt: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status: GateApprovalStatus
  /** Source record linkage so approval outcomes flow back */
  sourceType: 'visitor' | 'material_inward' | 'material_outward' | 'gate_pass' | 'contractor'
  sourceId: string
  actionedBy?: string
  actionedAt?: string | null
  actionRemarks?: string
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export interface GateReportDefinition {
  id: string
  category: 'visitor' | 'material' | 'vehicle' | 'gate_pass'
  title: string
  description: string
}

// ─── Query filters shared by services ────────────────────────────────────────

export interface GateListFilter {
  search?: string
  status?: string
  gate?: string
  company?: string
  date?: string
  dateFrom?: string
  dateTo?: string
  entryType?: GateEntryType | ''
  insideOnly?: boolean
  missingExitOnly?: boolean
  tab?: string
}
