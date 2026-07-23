/**
 * Shared Gate service contract implemented by both the demo service and the
 * live API service. Pages import `gateService` from ./gateService — never an
 * implementation directly — so demo and API data are never mixed.
 */

import type {
  ContractorEntry,
  CourierEntry,
  ExpectedVisitor,
  GateActivity,
  GateApproval,
  GateDashboardSummary,
  GateEntry,
  GateListFilter,
  GateLocation,
  GatePass,
  GatePassItem,
  GateSettings,
  GateVehicle,
  MaterialInwardEntry,
  MaterialOutwardEntry,
  OutwardChecklistKey,
  Visitor,
  VisitorVisit,
} from '../types/gate.types'

export class GateServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GateServiceError'
  }
}

// ─── Input contracts ─────────────────────────────────────────────────────────

export interface CreateExpectedVisitorInput {
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
}

export interface CreateVisitorEntryInput {
  visitorName: string
  mobile: string
  company?: string
  email?: string
  visitorType: VisitorVisit['visitorType']
  visitorCount: number
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
  gate: string
  /** expected | walk_in — walk-ins may go straight to approval / entry */
  mode: 'walk_in' | 'expected'
  expectedVisitorId?: string
}

export interface RecordVisitorExitInput {
  badgeReturned: boolean
  exitRemarks?: string
}

export interface CreateVehicleEntryInput {
  vehicleNumber: string
  vehicleType: string
  purpose: string
  companyName?: string
  transporter?: string
  driverName: string
  driverMobile?: string
  licenceVerified: GateVehicle['licenceVerified']
  relatedDocument?: string
  gate: string
  plannedLocation?: string
  sealNumber?: string
  remarks?: string
  /** When true the vehicle is registered as already at the gate */
  markArrived?: boolean
}

export interface CreateMaterialInwardInput {
  inwardType: MaterialInwardEntry['inwardType']
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
  remarks?: string
  gate: string
  saveAsDraft?: boolean
}

export interface CreateGatePassInput {
  passKind: GatePass['passKind']
  movementType: string
  department: string
  responsibleEmployee: string
  carriedBy?: string
  partyName?: string
  purpose: string
  expectedReturnDate?: string | null
  approverName?: string
  gate: string
  items: Array<Omit<GatePassItem, 'id' | 'returnedQuantity'>>
  submitForApproval?: boolean
}

export interface RecordGatePassReturnInput {
  itemId: string
  returnDate: string
  returnedQuantity: number
  conditionReturned?: string
  damage?: string
  remarks?: string
}

export interface CreateContractorEntryInput {
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
  purpose: string
  remarks?: string
  gate: string
}

export interface CreateCourierEntryInput {
  direction: CourierEntry['direction']
  courierCompany: string
  trackingNumber?: string
  senderName?: string
  recipientEmployee?: string
  department?: string
  parcelType?: string
  parcelDescription?: string
  charges?: number
  remarks?: string
  gate: string
}

export interface OutwardDocumentSearchResult {
  documentType: string
  documentNumber: string
  partyName?: string
  materialSummary: string
  packagesExpected: number
  approved: boolean
  outwardType: MaterialOutwardEntry['outwardType']
  existingOutwardId?: string
}

export interface VerifyMaterialOutwardInput {
  checklist: Partial<Record<OutwardChecklistKey, boolean>>
  vehicleNumber?: string
  driverName?: string
  sealNumber?: string
  packagesVerified?: number
}

// ─── Service interface ───────────────────────────────────────────────────────

export interface GateService {
  // Dashboard & register
  getGateDashboard(): Promise<GateDashboardSummary>
  getGateRegister(filter?: GateListFilter): Promise<GateEntry[]>
  getGateActivities(limit?: number): Promise<GateActivity[]>
  getGateLocations(): Promise<GateLocation[]>

  // Settings
  getGateSettings(): Promise<GateSettings>
  updateGateSettings(settings: GateSettings): Promise<GateSettings>

  // Visitors
  getVisitors(filter?: GateListFilter): Promise<VisitorVisit[]>
  getVisitorById(id: string): Promise<VisitorVisit>
  searchVisitorByMobile(mobile: string): Promise<Visitor | null>
  getExpectedVisitors(filter?: GateListFilter): Promise<ExpectedVisitor[]>
  createExpectedVisitor(input: CreateExpectedVisitorInput): Promise<ExpectedVisitor>
  cancelExpectedVisitor(id: string): Promise<ExpectedVisitor>
  createVisitorEntry(input: CreateVisitorEntryInput): Promise<VisitorVisit>
  updateVisitorEntry(id: string, input: Partial<CreateVisitorEntryInput>): Promise<VisitorVisit>
  requestVisitorApproval(id: string): Promise<VisitorVisit>
  approveVisitor(id: string, remarks?: string): Promise<VisitorVisit>
  rejectVisitor(id: string, remarks: string): Promise<VisitorVisit>
  recordVisitorEntry(id: string): Promise<VisitorVisit>
  recordVisitorExit(id: string, input: RecordVisitorExitInput): Promise<VisitorVisit>
  cancelVisitor(id: string, remarks?: string): Promise<VisitorVisit>

  // Vehicles
  getVehicles(filter?: GateListFilter): Promise<GateVehicle[]>
  getVehicleById(id: string): Promise<GateVehicle>
  createVehicleEntry(input: CreateVehicleEntryInput): Promise<GateVehicle>
  markVehicleArrived(id: string): Promise<GateVehicle>
  allowVehicleInside(id: string): Promise<GateVehicle>
  updateVehicleLocation(id: string, location: string, status?: GateVehicle['status']): Promise<GateVehicle>
  markVehicleReadyForExit(id: string): Promise<GateVehicle>
  recordVehicleExit(id: string, remarks?: string): Promise<GateVehicle>

  // Material inward
  getMaterialInwardEntries(filter?: GateListFilter): Promise<MaterialInwardEntry[]>
  getMaterialInwardById(id: string): Promise<MaterialInwardEntry>
  createMaterialInward(input: CreateMaterialInwardInput): Promise<MaterialInwardEntry>
  updateMaterialInwardStatus(id: string, status: MaterialInwardEntry['status'], note?: string): Promise<MaterialInwardEntry>
  cancelMaterialInward(id: string, remarks: string): Promise<MaterialInwardEntry>

  // Material outward
  getMaterialOutwardEntries(filter?: GateListFilter): Promise<MaterialOutwardEntry[]>
  getMaterialOutwardById(id: string): Promise<MaterialOutwardEntry>
  searchOutwardDocuments(query: string): Promise<OutwardDocumentSearchResult[]>
  verifyMaterialOutward(id: string, input: VerifyMaterialOutwardInput): Promise<MaterialOutwardEntry>
  holdMaterialOutward(id: string, remarks: string): Promise<MaterialOutwardEntry>
  reportMaterialMismatch(id: string, remarks: string): Promise<MaterialOutwardEntry>
  releaseMaterialOutward(id: string): Promise<MaterialOutwardEntry>
  rejectMaterialOutward(id: string, remarks: string): Promise<MaterialOutwardEntry>

  // Gate passes
  getGatePasses(filter?: GateListFilter): Promise<GatePass[]>
  getGatePassById(id: string): Promise<GatePass>
  createGatePass(input: CreateGatePassInput): Promise<GatePass>
  submitGatePass(id: string): Promise<GatePass>
  approveGatePass(id: string, remarks?: string): Promise<GatePass>
  rejectGatePass(id: string, remarks: string): Promise<GatePass>
  markGatePassSentOut(id: string): Promise<GatePass>
  recordGatePassReturn(id: string, input: RecordGatePassReturnInput): Promise<GatePass>
  closeGatePass(id: string, remarks?: string): Promise<GatePass>

  // Contractors
  getContractors(filter?: GateListFilter): Promise<ContractorEntry[]>
  getContractorById(id: string): Promise<ContractorEntry>
  createContractorEntry(input: CreateContractorEntryInput): Promise<ContractorEntry>
  recordContractorExit(id: string, remarks?: string): Promise<ContractorEntry>

  // Couriers
  getCouriers(filter?: GateListFilter): Promise<CourierEntry[]>
  getCourierById(id: string): Promise<CourierEntry>
  createCourierEntry(input: CreateCourierEntryInput): Promise<CourierEntry>
  markCourierHandedOver(id: string, handedOverTo: string): Promise<CourierEntry>

  // Approvals
  getGateApprovals(filter?: GateListFilter): Promise<GateApproval[]>
  getGateApprovalById(id: string): Promise<GateApproval>
  approveGateRequest(id: string, remarks?: string): Promise<GateApproval>
  rejectGateRequest(id: string, remarks: string): Promise<GateApproval>
  sendBackGateRequest(id: string, remarks: string): Promise<GateApproval>
}
