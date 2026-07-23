import { z } from 'zod'

const mobile = z
  .string()
  .min(1, 'Mobile number is required')
  .regex(/^\d{10}$/, 'Enter a valid 10-digit mobile number')

// ─── Visitor ────────────────────────────────────────────────────────────────

export const visitorEntrySchema = z.object({
  visitorName: z.string().trim().min(1, 'Visitor name is required'),
  mobile,
  company: z.string().optional(),
  email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  visitorType: z.string().min(1, 'Visitor type is required'),
  visitorCount: z.coerce.number().int().min(1, 'At least 1 visitor').max(50),
  idType: z.string().optional(),
  idReferenceMasked: z.string().optional(),
  hostName: z.string().min(1, 'Host is required'),
  department: z.string().min(1, 'Department is required'),
  purpose: z.string().trim().min(1, 'Purpose is required'),
  expectedDurationMinutes: z.coerce.number().int().min(0).optional(),
  meetingLocation: z.string().optional(),
  remarks: z.string().optional(),
  vehicleNumber: z.string().optional(),
  vehicleType: z.string().optional(),
  laptopCarried: z.boolean(),
  equipmentCarried: z.boolean(),
  bagCount: z.coerce.number().int().min(0),
  belongingsDescription: z.string().optional(),
  safetyDeclarationAccepted: z.boolean(),
  ppeRequired: z.boolean(),
  ndaRequired: z.boolean(),
  hostApprovalRequired: z.boolean(),
  gate: z.string().min(1, 'Gate is required'),
})

export type VisitorEntryFormValues = z.infer<typeof visitorEntrySchema>

export const expectedVisitorSchema = z.object({
  visitorName: z.string().trim().min(1, 'Visitor name is required'),
  mobile,
  company: z.string().optional(),
  visitDate: z.string().min(1, 'Visit date is required'),
  expectedArrival: z.string().min(1, 'Expected arrival time is required'),
  hostName: z.string().min(1, 'Host is required'),
  department: z.string().min(1, 'Department is required'),
  purpose: z.string().trim().min(1, 'Purpose is required'),
  gate: z.string().min(1, 'Gate is required'),
  vehicleNumber: z.string().optional(),
  instructions: z.string().optional(),
})

export type ExpectedVisitorFormValues = z.infer<typeof expectedVisitorSchema>

// ─── Vehicle ─────────────────────────────────────────────────────────────────

export const vehicleEntrySchema = z.object({
  vehicleNumber: z.string().trim().min(1, 'Vehicle number is required'),
  vehicleType: z.string().min(1, 'Vehicle type is required'),
  purpose: z.string().trim().min(1, 'Purpose is required'),
  companyName: z.string().optional(),
  transporter: z.string().optional(),
  driverName: z.string().trim().min(1, 'Driver name is required'),
  driverMobile: z.string().regex(/^\d{10}$/, 'Enter a valid 10-digit mobile number').optional().or(z.literal('')),
  licenceVerified: z.enum(['not_checked', 'verified', 'failed']),
  relatedDocument: z.string().optional(),
  gate: z.string().min(1, 'Gate is required'),
  plannedLocation: z.string().optional(),
  sealNumber: z.string().optional(),
  remarks: z.string().optional(),
  markArrived: z.boolean(),
})

export type VehicleEntryFormValues = z.infer<typeof vehicleEntrySchema>

// ─── Material inward ─────────────────────────────────────────────────────────

export function buildMaterialInwardSchema(options: { vehicleNumberRequired: boolean }) {
  return z
    .object({
      inwardType: z.string().min(1, 'Inward type is required'),
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
      materialSummary: z.string().trim().min(1, 'Material summary is required'),
      packages: z.coerce.number().int().min(0, 'Packages cannot be negative'),
      approxQty: z.coerce.number().min(0).optional(),
      uom: z.string().optional(),
      grossWeight: z.string().optional(),
      warehouse: z.string().optional(),
      unloadingLocation: z.string().optional(),
      remarks: z.string().optional(),
      gate: z.string().min(1, 'Gate is required'),
    })
    .superRefine((values, ctx) => {
      if (!values.vendorName?.trim() && values.inwardType !== 'other') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['vendorName'], message: 'Vendor or source is required' })
      }
      if (options.vehicleNumberRequired && !values.vehicleNumber?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['vehicleNumber'], message: 'Vehicle number is required by gate settings' })
      }
      if (values.inwardType === 'purchase_order' && !values.poNumber?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['poNumber'], message: 'Purchase order reference is required for PO inward' })
      }
    })
}

export type MaterialInwardFormValues = z.infer<ReturnType<typeof buildMaterialInwardSchema>>

// ─── Gate pass ───────────────────────────────────────────────────────────────

export const gatePassItemSchema = z.object({
  itemDescription: z.string().trim().min(1, 'Item description is required'),
  serialNumber: z.string().optional(),
  quantity: z.coerce.number().positive('Quantity must be greater than zero'),
  uom: z.string().min(1, 'UOM is required'),
  conditionOut: z.string().optional(),
  remarks: z.string().optional(),
})

export const gatePassSchema = z
  .object({
    passKind: z.enum(['returnable', 'non_returnable']),
    movementType: z.string().min(1, 'Movement type is required'),
    department: z.string().min(1, 'Department is required'),
    responsibleEmployee: z.string().trim().min(1, 'Responsible employee is required'),
    carriedBy: z.string().optional(),
    partyName: z.string().optional(),
    purpose: z.string().trim().min(1, 'Purpose is required'),
    expectedReturnDate: z.string().optional(),
    approverName: z.string().optional(),
    gate: z.string().min(1, 'Gate is required'),
    items: z.array(gatePassItemSchema).min(1, 'At least one item is required'),
  })
  .superRefine((values, ctx) => {
    if (values.passKind === 'returnable' && !values.expectedReturnDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['expectedReturnDate'],
        message: 'Expected return date is required for returnable passes',
      })
    }
  })

export type GatePassFormValues = z.infer<typeof gatePassSchema>

// ─── Contractor ──────────────────────────────────────────────────────────────

export const contractorEntrySchema = z
  .object({
    workerName: z.string().trim().min(1, 'Worker name is required'),
    mobile,
    contractorCompany: z.string().trim().min(1, 'Contractor company is required'),
    workReference: z.string().optional(),
    department: z.string().min(1, 'Department is required'),
    supervisor: z.string().min(1, 'Supervisor is required'),
    workLocation: z.string().trim().min(1, 'Work location is required'),
    validFrom: z.string().min(1, 'Valid from date is required'),
    validUntil: z.string().min(1, 'Valid until date is required'),
    safetyInductionDone: z.boolean(),
    ppeIssued: z.boolean(),
    toolsCarried: z.string().optional(),
    purpose: z.string().trim().min(1, 'Purpose is required'),
    remarks: z.string().optional(),
    gate: z.string().min(1, 'Gate is required'),
  })
  .superRefine((values, ctx) => {
    if (values.validFrom && values.validUntil && values.validUntil < values.validFrom) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['validUntil'], message: 'Valid until cannot be before valid from' })
    }
  })

export type ContractorEntryFormValues = z.infer<typeof contractorEntrySchema>

// ─── Courier ─────────────────────────────────────────────────────────────────

export const courierEntrySchema = z
  .object({
    direction: z.enum(['incoming', 'outgoing']),
    courierCompany: z.string().min(1, 'Courier company is required'),
    trackingNumber: z.string().optional(),
    senderName: z.string().optional(),
    recipientEmployee: z.string().optional(),
    department: z.string().optional(),
    parcelType: z.string().optional(),
    parcelDescription: z.string().optional(),
    charges: z.coerce.number().min(0).optional(),
    remarks: z.string().optional(),
    gate: z.string().min(1, 'Gate is required'),
  })
  .superRefine((values, ctx) => {
    if (values.direction === 'incoming' && !values.recipientEmployee?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['recipientEmployee'], message: 'Recipient employee is required for incoming parcels' })
    }
    if (values.direction === 'outgoing' && !values.senderName?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['senderName'], message: 'Sender employee is required for outgoing parcels' })
    }
    if (values.direction === 'outgoing' && !values.parcelDescription?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['parcelDescription'], message: 'Parcel description is required for outgoing parcels' })
    }
  })

export type CourierEntryFormValues = z.infer<typeof courierEntrySchema>

// ─── Gate pass return ────────────────────────────────────────────────────────

export function buildGatePassReturnSchema(pendingQuantity: number) {
  return z.object({
    returnDate: z.string().min(1, 'Return date is required'),
    returnedQuantity: z.coerce
      .number()
      .positive('Returned quantity must be greater than zero')
      .max(pendingQuantity, `Returned quantity cannot exceed pending quantity (${pendingQuantity})`),
    conditionReturned: z.string().optional(),
    damage: z.string().optional(),
    remarks: z.string().optional(),
  })
}
