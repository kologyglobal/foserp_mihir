import type {
  ContractorStatus,
  CourierStatus,
  GateApprovalStatus,
  GateEntryType,
  GatePass,
  GatePassStatus,
  GateVehicleStatus,
  MaterialInwardStatus,
  MaterialOutwardStatus,
  VisitorStatus,
  VisitorType,
} from '../types/gate.types'

export type GateTone = 'success' | 'warning' | 'critical' | 'info' | 'neutral' | 'pending'

function meta<T extends string>(map: Record<T, { label: string; tone: GateTone }>) {
  return map
}

export const VISITOR_STATUS_META = meta<VisitorStatus>({
  expected: { label: 'Expected', tone: 'info' },
  arrived: { label: 'Arrived', tone: 'pending' },
  waiting_approval: { label: 'Waiting Approval', tone: 'warning' },
  approved: { label: 'Approved', tone: 'info' },
  inside: { label: 'Inside', tone: 'success' },
  exited: { label: 'Exited', tone: 'neutral' },
  rejected: { label: 'Rejected', tone: 'critical' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  no_show: { label: 'No Show', tone: 'warning' },
  overstayed: { label: 'Overstayed', tone: 'critical' },
  blacklisted: { label: 'Blacklisted', tone: 'critical' },
})

export const VISITOR_TYPE_LABELS: Record<VisitorType, string> = {
  customer: 'Customer',
  vendor: 'Vendor',
  consultant: 'Consultant',
  service_engineer: 'Service Engineer',
  interview_candidate: 'Interview Candidate',
  auditor: 'Auditor',
  government_official: 'Government Official',
  contractor: 'Contractor',
  delivery_person: 'Delivery Person',
  personal_visitor: 'Personal Visitor',
  other: 'Other',
}

export const VEHICLE_STATUS_META = meta<GateVehicleStatus>({
  expected: { label: 'Expected', tone: 'info' },
  arrived: { label: 'At Gate', tone: 'pending' },
  waiting: { label: 'Waiting', tone: 'warning' },
  allowed_inside: { label: 'Inside', tone: 'success' },
  loading: { label: 'Loading', tone: 'info' },
  unloading: { label: 'Unloading', tone: 'info' },
  ready_exit: { label: 'Ready for Exit', tone: 'pending' },
  exited: { label: 'Exited', tone: 'neutral' },
  rejected: { label: 'Rejected', tone: 'critical' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
})

export const INWARD_STATUS_META = meta<MaterialInwardStatus>({
  draft: { label: 'Draft', tone: 'neutral' },
  vehicle_arrived: { label: 'Vehicle Arrived', tone: 'pending' },
  documents_verified: { label: 'Documents Verified', tone: 'info' },
  waiting_unloading: { label: 'Waiting Unloading', tone: 'warning' },
  waiting_store: { label: 'Waiting for Store', tone: 'warning' },
  waiting_qc: { label: 'Waiting for QC', tone: 'warning' },
  waiting_grn: { label: 'Waiting for GRN', tone: 'warning' },
  accepted: { label: 'Accepted', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'critical' },
  closed: { label: 'Closed', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
})

export const OUTWARD_STATUS_META = meta<MaterialOutwardStatus>({
  awaiting_vehicle: { label: 'Awaiting Vehicle', tone: 'info' },
  pending_approval: { label: 'Pending Approval', tone: 'warning' },
  ready_for_gate: { label: 'Ready for Gate', tone: 'pending' },
  vehicle_inside: { label: 'Vehicle Inside', tone: 'info' },
  held: { label: 'Held', tone: 'warning' },
  mismatch: { label: 'Mismatch', tone: 'critical' },
  released: { label: 'Released', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'critical' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
})

export const PASS_STATUS_META = meta<GatePassStatus>({
  draft: { label: 'Draft', tone: 'neutral' },
  pending_approval: { label: 'Awaiting Approval', tone: 'warning' },
  approved: { label: 'Approved', tone: 'info' },
  rejected: { label: 'Rejected', tone: 'critical' },
  sent_out: { label: 'Sent Out', tone: 'pending' },
  partially_returned: { label: 'Partially Returned', tone: 'warning' },
  returned: { label: 'Returned', tone: 'success' },
  overdue: { label: 'Overdue', tone: 'critical' },
  written_off: { label: 'Written Off', tone: 'neutral' },
  closed: { label: 'Closed', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
})

export const CONTRACTOR_STATUS_META = meta<ContractorStatus>({
  expected: { label: 'Expected', tone: 'info' },
  inside: { label: 'Inside', tone: 'success' },
  exited: { label: 'Exited', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
})

export const COURIER_STATUS_META = meta<CourierStatus>({
  received: { label: 'Received', tone: 'info' },
  pending_handover: { label: 'Pending Handover', tone: 'warning' },
  handed_over: { label: 'Handed Over', tone: 'success' },
  dispatched: { label: 'Dispatched', tone: 'pending' },
  delivered: { label: 'Delivered', tone: 'success' },
})

export const APPROVAL_STATUS_META = meta<GateApprovalStatus>({
  pending: { label: 'Pending', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'critical' },
  sent_back: { label: 'Sent Back', tone: 'info' },
})

export const ENTRY_TYPE_LABELS: Record<GateEntryType, string> = {
  visitor: 'Visitor',
  vehicle: 'Vehicle',
  material_inward: 'Material Inward',
  material_outward: 'Material Outward',
  contractor: 'Contractor',
  courier: 'Courier',
}

/** Generic resolver used by GateStatusBadge */
export function resolveGateStatusMeta(status: string): { label: string; tone: GateTone } {
  const all: Record<string, { label: string; tone: GateTone }> = {
    ...VISITOR_STATUS_META,
    ...VEHICLE_STATUS_META,
    ...INWARD_STATUS_META,
    ...OUTWARD_STATUS_META,
    ...PASS_STATUS_META,
    ...CONTRACTOR_STATUS_META,
    ...COURIER_STATUS_META,
    ...APPROVAL_STATUS_META,
  }
  return (
    all[status] ?? {
      label: status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      tone: 'neutral',
    }
  )
}

// ─── Durations & overdue helpers ─────────────────────────────────────────────

export function minutesBetween(fromIso: string, toIso?: string | null): number {
  const from = new Date(fromIso).getTime()
  const to = toIso ? new Date(toIso).getTime() : Date.now()
  return Math.max(0, Math.round((to - from) / 60000))
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`
  const d = Math.floor(h / 24)
  return `${d}d ${h % 24}h`
}

export function durationSince(fromIso?: string | null, toIso?: string | null): string {
  if (!fromIso) return '—'
  return formatDuration(minutesBetween(fromIso, toIso))
}

/** A returnable pass is overdue when the expected return date has passed with pending quantity */
export function gatePassPendingQty(pass: Pick<GatePass, 'items'>): number {
  return pass.items.reduce((sum, item) => sum + Math.max(0, item.quantity - item.returnedQuantity), 0)
}

export function isGatePassOverdue(pass: Pick<GatePass, 'passKind' | 'expectedReturnDate' | 'items' | 'status'>): boolean {
  if (pass.passKind !== 'returnable') return false
  if (['returned', 'closed', 'cancelled', 'written_off', 'rejected', 'draft'].includes(pass.status)) return false
  if (!pass.expectedReturnDate) return false
  if (gatePassPendingQty(pass) <= 0) return false
  const due = new Date(pass.expectedReturnDate)
  due.setHours(23, 59, 59, 999)
  return due.getTime() < Date.now()
}

export function isContractorPassExpired(validUntil: string): boolean {
  const until = new Date(validUntil)
  until.setHours(23, 59, 59, 999)
  return until.getTime() < Date.now()
}

export function isContractorPassExpiringToday(validUntil: string): boolean {
  const until = new Date(validUntil)
  const today = new Date()
  return (
    until.getFullYear() === today.getFullYear() &&
    until.getMonth() === today.getMonth() &&
    until.getDate() === today.getDate()
  )
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}
