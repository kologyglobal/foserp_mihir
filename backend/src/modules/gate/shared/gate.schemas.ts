import { z } from 'zod'

export const gateListFilterSchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  gate: z.string().optional(),
  company: z.string().optional(),
  date: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  entryType: z.string().optional(),
  insideOnly: z.coerce.boolean().optional(),
  missingExitOnly: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  q: z.string().optional(),
  mobile: z.string().optional(),
})

export const remarksBodySchema = z.object({
  remarks: z.string().optional(),
})

export const requiredRemarksSchema = z.object({
  remarks: z.string().min(1),
})

export const createExpectedVisitorSchema = z.object({
  visitorName: z.string().min(1),
  mobile: z.string().min(5),
  company: z.string().optional(),
  visitDate: z.string().min(1),
  expectedArrival: z.string().min(1),
  hostName: z.string().min(1),
  department: z.string().min(1),
  purpose: z.string().min(1),
  gate: z.string().min(1),
  vehicleNumber: z.string().optional(),
  instructions: z.string().optional(),
})

export const createVisitorSchema = z.object({
  visitorName: z.string().min(1),
  mobile: z.string().min(5),
  company: z.string().optional(),
  email: z.string().optional(),
  visitorType: z.string().min(1),
  visitorCount: z.number().int().min(1).default(1),
  idType: z.string().optional(),
  idReferenceMasked: z.string().optional(),
  hostName: z.string().min(1),
  department: z.string().min(1),
  purpose: z.string().min(1),
  expectedDurationMinutes: z.number().int().optional(),
  meetingLocation: z.string().optional(),
  remarks: z.string().optional(),
  vehicleNumber: z.string().optional(),
  vehicleType: z.string().optional(),
  laptopCarried: z.boolean().default(false),
  equipmentCarried: z.boolean().default(false),
  bagCount: z.number().int().min(0).default(0),
  belongingsDescription: z.string().optional(),
  safetyDeclarationAccepted: z.boolean().default(false),
  ppeRequired: z.boolean().default(false),
  ndaRequired: z.boolean().default(false),
  hostApprovalRequired: z.boolean().default(false),
  gate: z.string().min(1),
  mode: z.enum(['walk_in', 'expected']).default('walk_in'),
  expectedVisitorId: z.string().uuid().optional(),
})

export const updateVisitorSchema = createVisitorSchema.partial()

export const visitorExitSchema = z.object({
  badgeReturned: z.boolean(),
  exitRemarks: z.string().optional(),
})

export const createVehicleSchema = z.object({
  vehicleNumber: z.string().min(1),
  vehicleType: z.string().min(1),
  purpose: z.string().min(1),
  companyName: z.string().optional(),
  transporter: z.string().optional(),
  driverName: z.string().min(1),
  driverMobile: z.string().optional(),
  licenceVerified: z.enum(['not_checked', 'verified', 'failed']).default('not_checked'),
  relatedDocument: z.string().optional(),
  gate: z.string().min(1),
  plannedLocation: z.string().optional(),
  sealNumber: z.string().optional(),
  remarks: z.string().optional(),
  markArrived: z.boolean().optional(),
})

export const vehicleLocationSchema = z.object({
  location: z.string().min(1),
  status: z.string().optional(),
})

export const createInwardSchema = z.object({
  inwardType: z.string().min(1),
  vendorName: z.string().optional(),
  poNumber: z.string().optional(),
  challanNumber: z.string().optional(),
  invoiceNumber: z.string().optional(),
  lrNumber: z.string().optional(),
  vehicleNumber: z.string().optional(),
  vehicleType: z.string().optional(),
  transporter: z.string().optional(),
  driverName: z.string().optional(),
  driverMobile: z.string().optional(),
  sealNumber: z.string().optional(),
  materialSummary: z.string().min(1),
  packages: z.number().int().min(0).default(0),
  approxQty: z.number().optional(),
  uom: z.string().optional(),
  grossWeight: z.string().optional(),
  warehouse: z.string().optional(),
  unloadingLocation: z.string().optional(),
  remarks: z.string().optional(),
  gate: z.string().min(1),
  saveAsDraft: z.boolean().optional(),
})

export const inwardStatusSchema = z.object({
  status: z.string().min(1),
  note: z.string().optional(),
})

export const verifyOutwardSchema = z.object({
  checklist: z.record(z.string(), z.boolean()).default({}),
  vehicleNumber: z.string().optional(),
  driverName: z.string().optional(),
  sealNumber: z.string().optional(),
  packagesVerified: z.number().int().optional(),
})

export const createPassItemSchema = z.object({
  itemDescription: z.string().min(1),
  serialNumber: z.string().optional(),
  quantity: z.number().positive(),
  uom: z.string().min(1),
  conditionOut: z.string().optional(),
  remarks: z.string().optional(),
})

export const createPassSchema = z.object({
  passKind: z.enum(['returnable', 'non_returnable']),
  movementType: z.string().min(1),
  department: z.string().min(1),
  responsibleEmployee: z.string().min(1),
  carriedBy: z.string().optional(),
  partyName: z.string().optional(),
  purpose: z.string().min(1),
  expectedReturnDate: z.string().nullable().optional(),
  approverName: z.string().optional(),
  gate: z.string().min(1),
  items: z.array(createPassItemSchema).min(1),
  submitForApproval: z.boolean().optional(),
})

export const passReturnSchema = z.object({
  itemId: z.string().uuid(),
  returnDate: z.string().min(1),
  returnedQuantity: z.number().positive(),
  conditionReturned: z.string().optional(),
  damage: z.string().optional(),
  remarks: z.string().optional(),
})

export const createContractorSchema = z.object({
  workerName: z.string().min(1),
  mobile: z.string().min(5),
  contractorCompany: z.string().min(1),
  workReference: z.string().optional(),
  department: z.string().min(1),
  supervisor: z.string().min(1),
  workLocation: z.string().min(1),
  validFrom: z.string().min(1),
  validUntil: z.string().min(1),
  safetyInductionDone: z.boolean().default(false),
  ppeIssued: z.boolean().default(false),
  toolsCarried: z.string().optional(),
  purpose: z.string().min(1),
  remarks: z.string().optional(),
  gate: z.string().min(1),
})

export const createCourierSchema = z.object({
  direction: z.enum(['incoming', 'outgoing']),
  courierCompany: z.string().min(1),
  trackingNumber: z.string().optional(),
  senderName: z.string().optional(),
  recipientEmployee: z.string().optional(),
  department: z.string().optional(),
  parcelType: z.string().optional(),
  parcelDescription: z.string().optional(),
  charges: z.number().optional(),
  remarks: z.string().optional(),
  gate: z.string().min(1),
})

export const courierHandoverSchema = z.object({
  handedOverTo: z.string().min(1),
})

export const gateSettingsSchema = z.object({
  visitor: z.record(z.string(), z.unknown()).optional(),
  material: z.record(z.string(), z.unknown()).optional(),
  pass: z.record(z.string(), z.unknown()).optional(),
  masters: z.record(z.string(), z.unknown()).optional(),
}).passthrough()
