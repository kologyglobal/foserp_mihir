import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'

export const DEFAULT_GATE_SETTINGS = {
  visitor: {
    hostApprovalRequired: true,
    photoCaptureRequired: false,
    maskedIdEnabled: true,
    qrEnabled: true,
    defaultVisitDurationMinutes: 120,
    overstayThresholdMinutes: 240,
  },
  material: {
    allowInwardWithoutPo: true,
    vehicleNumberRequired: true,
    documentPhotoRequired: false,
    outwardApprovalRequired: true,
    releaseChecklistRequired: true,
  },
  pass: {
    numberFormat: 'GP-{YYYY}-{seq5}',
    returnReminderDays: 3,
    approvalRequired: true,
    partialReturnAllowed: true,
  },
  masters: {
    visitorTypes: [
      'customer', 'vendor', 'consultant', 'service_engineer', 'interview_candidate',
      'auditor', 'government_official', 'contractor', 'delivery_person', 'personal_visitor', 'other',
    ],
    visitPurposes: [
      'Business Meeting', 'Machine Service', 'Quality Audit', 'Interview', 'Material Delivery',
      'Statutory Inspection', 'Vendor Development', 'Project Discussion', 'Training', 'Personal',
    ],
    vehicleTypes: ['Truck', 'Trailer', 'LCV', 'Tempo', 'Container', 'Car', 'Two Wheeler', 'Tanker'],
    materialMovementTypes: [
      'Purchase Order', 'Job Work', 'Subcontract', 'Repair', 'Sample', 'Asset', 'Scrap', 'Stock Transfer',
    ],
    passTypes: ['Returnable', 'Non-Returnable'],
    courierCompanies: ['Blue Dart', 'DTDC', 'Delhivery', 'Professional Couriers', 'India Post', 'FedEx'],
    rejectionReasons: [
      'Document mismatch', 'Vehicle condition unsafe', 'No prior approval', 'Blacklisted party',
      'Wrong gate', 'Outside permitted hours',
    ],
    blacklistReasons: ['Security incident', 'Theft attempt', 'Repeated violations', 'Management instruction'],
  },
} as const

export const DEFAULT_OUTWARD_CHECKLIST = {
  sourceApproved: false,
  vehicleMatches: false,
  driverVerified: false,
  packageCountMatches: false,
  materialMatches: false,
  documentAvailable: false,
  sealRecorded: false,
  securityCheckDone: false,
}

export const DEFAULT_GATE_LOCATIONS = [
  {
    name: 'Main Gate',
    plant: 'Plant 1',
    entryTypesAllowed: ['visitor', 'vehicle', 'material_inward', 'material_outward', 'contractor', 'courier'],
  },
  {
    name: 'Material Gate',
    plant: 'Plant 1',
    entryTypesAllowed: ['vehicle', 'material_inward', 'material_outward'],
  },
  {
    name: 'Gate 2',
    plant: 'Plant 2',
    entryTypesAllowed: ['visitor', 'vehicle', 'contractor'],
  },
]

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export function iso(value?: Date | string | null): string | null {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

export function asJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback
  return value as T
}

/** Prisma Json write helper */
export function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

export function digitsOnly(mobile: string): string {
  return mobile.replace(/\D/g, '')
}

export async function nextGateNumber(
  tenantId: string,
  prefix: string,
  countFn: (tenantId: string) => Promise<number>,
): Promise<string> {
  const ymd = todayIsoDate().replace(/-/g, '')
  const seq = (await countFn(tenantId)) + 1
  return `${prefix}-${ymd}-${String(seq).padStart(3, '0')}`
}

export async function pushGateActivity(
  tenantId: string,
  operator: string,
  activity: {
    event: string
    recordType: string
    recordId: string
    recordLabel: string
    company?: string | null
    gate: string
    status: string
  },
  tx: Prisma.TransactionClient = prisma,
) {
  await tx.gateActivity.create({
    data: {
      tenantId,
      event: activity.event,
      recordType: activity.recordType,
      recordId: activity.recordId,
      recordLabel: activity.recordLabel,
      company: activity.company ?? null,
      gate: activity.gate,
      operator,
      status: activity.status,
    },
  })
}

export type GateListFilter = {
  search?: string
  status?: string
  gate?: string
  company?: string
  date?: string
  dateFrom?: string
  dateTo?: string
  entryType?: string
  insideOnly?: boolean
  missingExitOnly?: boolean
  limit?: number
}

export function matchesSearch(term: string | undefined, ...values: Array<string | number | null | undefined>): boolean {
  if (!term?.trim()) return true
  const t = term.trim().toLowerCase()
  return values.some((v) => v != null && String(v).toLowerCase().includes(t))
}

export function minutesBetween(fromIso: string, toIso?: string | null): number {
  const from = new Date(fromIso).getTime()
  const to = toIso ? new Date(toIso).getTime() : Date.now()
  return Math.max(0, Math.round((to - from) / 60000))
}

export function gatePassPendingQty(items: Array<{ quantity: number; returnedQuantity: number }>): number {
  return items.reduce((sum, item) => sum + Math.max(0, item.quantity - item.returnedQuantity), 0)
}

export function isGatePassOverdue(pass: {
  passKind: string
  expectedReturnDate: Date | string | null
  status: string
  items: Array<{ quantity: number; returnedQuantity: number }>
}): boolean {
  if (pass.passKind !== 'returnable') return false
  if (['returned', 'closed', 'cancelled', 'written_off', 'rejected', 'draft'].includes(pass.status)) return false
  if (!pass.expectedReturnDate) return false
  if (gatePassPendingQty(pass.items) <= 0) return false
  const due = new Date(pass.expectedReturnDate)
  due.setHours(23, 59, 59, 999)
  return due.getTime() < Date.now()
}
