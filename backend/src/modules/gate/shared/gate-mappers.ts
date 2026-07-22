import type {
  GateApproval,
  GateContractorEntry,
  GateCourierEntry,
  GateExpectedVisitor,
  GateLocation,
  GateMaterialInward,
  GateMaterialOutward,
  GatePass,
  GatePassItem,
  GateSettings,
  GateVehicle,
  GateVisitorProfile,
  GateVisitorVisit,
} from '@prisma/client'
import { asJson, iso, isGatePassOverdue } from './gate-shared.js'

type PassWithItems = GatePass & { items: GatePassItem[] }

function audit(row: { id: string; tenantId: string; createdAt: Date; updatedAt: Date; createdBy: string; updatedBy: string }, entryNumber: string, status: string) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    entryNumber,
    status,
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
  }
}

export function mapSettings(payload: unknown) {
  return payload as Record<string, unknown>
}

export function mapLocation(row: GateLocation) {
  return {
    id: row.id,
    name: row.name,
    plant: row.plant,
    entryTypesAllowed: asJson<string[]>(row.entryTypesAllowed, []),
    isActive: row.isActive,
  }
}

export function mapVisitorProfile(row: GateVisitorProfile) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    mobile: row.mobile,
    company: row.company ?? undefined,
    email: row.email ?? undefined,
    photoUrl: row.photoUrl,
    idType: row.idType ?? undefined,
    idReferenceMasked: row.idReferenceMasked ?? undefined,
    lastHost: row.lastHost ?? undefined,
    lastVehicleNumber: row.lastVehicleNumber ?? undefined,
    lastVisitAt: iso(row.lastVisitAt),
    totalVisits: row.totalVisits,
    isBlacklisted: row.isBlacklisted,
    blacklistReason: row.blacklistReason ?? undefined,
  }
}

export function mapVisit(row: GateVisitorVisit) {
  return {
    ...audit(row, row.entryNumber, row.status),
    visitorId: row.visitorProfileId ?? undefined,
    visitorName: row.visitorName,
    mobile: row.mobile,
    company: row.company ?? undefined,
    email: row.email ?? undefined,
    visitorType: row.visitorType,
    visitorCount: row.visitorCount,
    photoUrl: row.photoUrl,
    idType: row.idType ?? undefined,
    idReferenceMasked: row.idReferenceMasked ?? undefined,
    hostName: row.hostName,
    department: row.department,
    purpose: row.purpose,
    expectedDurationMinutes: row.expectedDurationMinutes ?? undefined,
    meetingLocation: row.meetingLocation ?? undefined,
    remarks: row.remarks ?? undefined,
    vehicleNumber: row.vehicleNumber ?? undefined,
    vehicleType: row.vehicleType ?? undefined,
    laptopCarried: row.laptopCarried,
    equipmentCarried: row.equipmentCarried,
    bagCount: row.bagCount,
    belongingsDescription: row.belongingsDescription ?? undefined,
    safetyDeclarationAccepted: row.safetyDeclarationAccepted,
    ppeRequired: row.ppeRequired,
    ndaRequired: row.ndaRequired,
    hostApprovalRequired: row.hostApprovalRequired,
    approvalStatus: row.approvalStatus,
    approvalRemarks: row.approvalRemarks ?? undefined,
    approvedBy: row.approvedBy ?? undefined,
    approvedAt: iso(row.approvedAt),
    gate: row.gate,
    visitDate: row.visitDate,
    expectedArrival: row.expectedArrival ?? undefined,
    entryTime: iso(row.entryTime),
    exitTime: iso(row.exitTime),
    exitRemarks: row.exitRemarks ?? undefined,
    badgeReturned: row.badgeReturned ?? undefined,
    instructions: row.instructions ?? undefined,
    approvalHistory: asJson(row.approvalHistoryJson, [] as Array<{ at: string; by: string; action: string; remarks?: string }>),
  }
}

export function mapExpected(row: GateExpectedVisitor) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    reference: row.reference,
    visitorName: row.visitorName,
    mobile: row.mobile,
    company: row.company ?? undefined,
    visitDate: row.visitDate,
    expectedArrival: row.expectedArrival,
    hostName: row.hostName,
    department: row.department,
    purpose: row.purpose,
    gate: row.gate,
    vehicleNumber: row.vehicleNumber ?? undefined,
    instructions: row.instructions ?? undefined,
    status: row.status,
  }
}

export function mapVehicle(row: GateVehicle) {
  return {
    ...audit(row, row.entryNumber, row.status),
    vehicleNumber: row.vehicleNumber,
    vehicleType: row.vehicleType,
    purpose: row.purpose,
    companyName: row.companyName ?? undefined,
    transporter: row.transporter ?? undefined,
    driverName: row.driverName,
    driverMobile: row.driverMobile ?? undefined,
    licenceVerified: row.licenceVerified,
    relatedDocument: row.relatedDocument ?? undefined,
    gate: row.gate,
    plannedLocation: row.plannedLocation ?? undefined,
    currentLocation: row.currentLocation ?? undefined,
    sealNumber: row.sealNumber ?? undefined,
    remarks: row.remarks ?? undefined,
    entryTime: iso(row.entryTime),
    exitTime: iso(row.exitTime),
    exitRemarks: row.exitRemarks ?? undefined,
    timeline: asJson(row.timelineJson, [] as Array<{ at: string; status: string; by: string; note?: string }>),
  }
}

export function mapInward(row: GateMaterialInward) {
  return {
    ...audit(row, row.entryNumber, row.status),
    inwardType: row.inwardType,
    vendorName: row.vendorName ?? undefined,
    poNumber: row.poNumber ?? undefined,
    challanNumber: row.challanNumber ?? undefined,
    invoiceNumber: row.invoiceNumber ?? undefined,
    lrNumber: row.lrNumber ?? undefined,
    vehicleNumber: row.vehicleNumber ?? undefined,
    vehicleType: row.vehicleType ?? undefined,
    transporter: row.transporter ?? undefined,
    driverName: row.driverName ?? undefined,
    driverMobile: row.driverMobile ?? undefined,
    sealNumber: row.sealNumber ?? undefined,
    materialSummary: row.materialSummary,
    packages: row.packages,
    approxQty: row.approxQty ?? undefined,
    uom: row.uom ?? undefined,
    grossWeight: row.grossWeight ?? undefined,
    warehouse: row.warehouse ?? undefined,
    unloadingLocation: row.unloadingLocation ?? undefined,
    documentPhotoUrl: row.documentPhotoUrl,
    materialPhotoUrl: row.materialPhotoUrl,
    remarks: row.remarks ?? undefined,
    gate: row.gate,
    arrivalTime: iso(row.arrivalTime),
    lines: asJson(row.linesJson, [] as unknown[]),
    linkedGrnNumber: row.linkedGrnNumber,
    linkedQcNumber: row.linkedQcNumber,
    timeline: asJson(row.timelineJson, [] as Array<{ at: string; status: string; by: string; note?: string }>),
  }
}

export function mapOutward(row: GateMaterialOutward) {
  return {
    ...audit(row, row.entryNumber, row.status),
    outwardType: row.outwardType,
    documentType: row.documentType,
    documentNumber: row.documentNumber,
    documentApproved: row.documentApproved,
    partyName: row.partyName ?? undefined,
    vehicleNumber: row.vehicleNumber ?? undefined,
    driverName: row.driverName ?? undefined,
    driverMobile: row.driverMobile ?? undefined,
    transporter: row.transporter ?? undefined,
    sealNumber: row.sealNumber ?? undefined,
    materialSummary: row.materialSummary,
    packagesExpected: row.packagesExpected,
    packagesVerified: row.packagesVerified ?? undefined,
    approvalStatus: row.approvalStatus,
    plannedTime: iso(row.plannedTime) ?? undefined,
    releasedAt: iso(row.releasedAt),
    releasedBy: row.releasedBy ?? undefined,
    holdRemarks: row.holdRemarks ?? undefined,
    mismatchRemarks: row.mismatchRemarks ?? undefined,
    rejectRemarks: row.rejectRemarks ?? undefined,
    checklist: asJson(row.checklistJson, {}),
    gate: row.gate,
    lines: asJson(row.linesJson, [] as unknown[]),
    timeline: asJson(row.timelineJson, [] as Array<{ at: string; status: string; by: string; note?: string }>),
  }
}

export function mapPass(row: PassWithItems) {
  const items = row.items.map((item) => ({
    id: item.id,
    itemDescription: item.itemDescription,
    serialNumber: item.serialNumber ?? undefined,
    quantity: item.quantity,
    uom: item.uom,
    conditionOut: item.conditionOut ?? undefined,
    returnedQuantity: item.returnedQuantity,
    remarks: item.remarks ?? undefined,
  }))
  let status = row.status
  if (isGatePassOverdue({ ...row, items }) && status !== 'overdue') status = 'overdue'
  return {
    ...audit(row, row.entryNumber, status),
    passKind: row.passKind,
    movementType: row.movementType,
    department: row.department,
    responsibleEmployee: row.responsibleEmployee,
    carriedBy: row.carriedBy,
    partyName: row.partyName ?? undefined,
    purpose: row.purpose,
    outwardDate: row.outwardDate.toISOString(),
    expectedReturnDate: iso(row.expectedReturnDate),
    approverName: row.approverName ?? undefined,
    approvalStatus: row.approvalStatus,
    approvalRemarks: row.approvalRemarks ?? undefined,
    items,
    returns: asJson(row.returnsJson, [] as unknown[]),
    gate: row.gate,
  }
}

export function mapContractor(row: GateContractorEntry) {
  return {
    ...audit(row, row.entryNumber, row.status),
    workerName: row.workerName,
    mobile: row.mobile,
    contractorCompany: row.contractorCompany,
    workReference: row.workReference ?? undefined,
    department: row.department,
    supervisor: row.supervisor,
    workLocation: row.workLocation,
    validFrom: row.validFrom,
    validUntil: row.validUntil,
    safetyInductionDone: row.safetyInductionDone,
    ppeIssued: row.ppeIssued,
    toolsCarried: row.toolsCarried ?? undefined,
    photoUrl: row.photoUrl,
    purpose: row.purpose,
    remarks: row.remarks ?? undefined,
    gate: row.gate,
    entryTime: iso(row.entryTime),
    exitTime: iso(row.exitTime),
  }
}

export function mapCourier(row: GateCourierEntry) {
  return {
    ...audit(row, row.entryNumber, row.status),
    direction: row.direction,
    courierCompany: row.courierCompany,
    trackingNumber: row.trackingNumber ?? undefined,
    senderName: row.senderName ?? undefined,
    recipientEmployee: row.recipientEmployee ?? undefined,
    department: row.department ?? undefined,
    parcelType: row.parcelType ?? undefined,
    parcelDescription: row.parcelDescription ?? undefined,
    receivedTime: iso(row.receivedTime),
    receivedBy: row.receivedBy ?? undefined,
    handoverTime: iso(row.handoverTime),
    handedOverTo: row.handedOverTo ?? undefined,
    dispatchTime: iso(row.dispatchTime),
    charges: row.charges ?? undefined,
    remarks: row.remarks ?? undefined,
    gate: row.gate,
  }
}

export function mapApproval(row: GateApproval) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    requestNumber: row.requestNumber,
    requestType: row.requestType,
    requestedBy: row.requestedBy,
    subject: row.subject,
    reason: row.reason,
    requestedAt: row.requestedAt.toISOString(),
    priority: row.priority,
    status: row.status,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    actionedBy: row.actionedBy ?? undefined,
    actionedAt: iso(row.actionedAt),
    actionRemarks: row.actionRemarks ?? undefined,
  }
}

export function mapActivity(row: {
  id: string
  time: Date
  event: string
  recordType: string
  recordId: string
  recordLabel: string
  company: string | null
  gate: string
  operator: string
  status: string
}) {
  return {
    id: row.id,
    time: row.time.toISOString(),
    event: row.event,
    recordType: row.recordType,
    recordId: row.recordId,
    recordLabel: row.recordLabel,
    company: row.company ?? undefined,
    gate: row.gate,
    operator: row.operator,
    status: row.status,
  }
}

export type { GateSettings }
