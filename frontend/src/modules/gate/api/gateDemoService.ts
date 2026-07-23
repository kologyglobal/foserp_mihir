/**
 * Gate & Security demo service (demo mode only — VITE_USE_API=false).
 * In-memory stores seeded from gateDemoData, following the bankCashService
 * pattern. Implements the same GateService contract as the live API service,
 * including all frontend lifecycle guards.
 */

import {
  seedContractors,
  seedCouriers,
  seedExpectedVisitors,
  seedGateActivities,
  seedGateApprovals,
  seedGateLocations,
  seedGatePasses,
  seedGateSettings,
  seedMaterialInward,
  seedMaterialOutward,
  seedVehicles,
  seedVisitorProfiles,
  seedVisitorVisits,
} from '../data/gateDemoData'
import type {
  ContractorEntry,
  CourierEntry,
  ExpectedVisitor,
  GateActivity,
  GateDashboardSummary,
  GateEntry,
  GateListFilter,
  GatePass,
  GateVehicle,
  MaterialInwardEntry,
  VisitorVisit,
} from '../types/gate.types'
import {
  gatePassPendingQty,
  isGatePassOverdue,
  minutesBetween,
  todayIsoDate,
} from '../utils/gateStatus'
import {
  GateServiceError,
  type CreateContractorEntryInput,
  type CreateCourierEntryInput,
  type CreateExpectedVisitorInput,
  type CreateGatePassInput,
  type CreateMaterialInwardInput,
  type CreateVehicleEntryInput,
  type CreateVisitorEntryInput,
  type GateService,
  type OutwardDocumentSearchResult,
  type RecordGatePassReturnInput,
  type RecordVisitorExitInput,
  type VerifyMaterialOutwardInput,
} from './gateServiceContract'

const TENANT = 'demo-tenant'
const OPERATOR = 'Gate Operator (You)'

// ─── Stores ──────────────────────────────────────────────────────────────────

let locations = seedGateLocations()
let settings = seedGateSettings()
let visitorProfiles = seedVisitorProfiles()
let visits = seedVisitorVisits()
let expectedVisitors = seedExpectedVisitors()
let vehicles = seedVehicles()
let inwardEntries = seedMaterialInward()
let outwardEntries = seedMaterialOutward()
let gatePasses = seedGatePasses()
let contractors = seedContractors()
let couriers = seedCouriers()
let approvals = seedGateApprovals()
let activities = seedGateActivities()

/** Test hook — restore all demo stores to their seed state */
export function __resetGateDemoStores() {
  locations = seedGateLocations()
  settings = seedGateSettings()
  visitorProfiles = seedVisitorProfiles()
  visits = seedVisitorVisits()
  expectedVisitors = seedExpectedVisitors()
  vehicles = seedVehicles()
  inwardEntries = seedMaterialInward()
  outwardEntries = seedMaterialOutward()
  gatePasses = seedGatePasses()
  contractors = seedContractors()
  couriers = seedCouriers()
  approvals = seedGateApprovals()
  activities = seedGateActivities()
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function delay(ms = 120): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

let seq = 100
function nextNumber(prefix: string): string {
  seq += 1
  return `${prefix}-${todayIsoDate().replace(/-/g, '')}-${String(seq).padStart(3, '0')}`
}

function nowIso(): string {
  return new Date().toISOString()
}

function stamp<T extends { updatedAt: string; updatedBy: string }>(record: T): T {
  record.updatedAt = nowIso()
  record.updatedBy = OPERATOR
  return record
}

function pushActivity(activity: Omit<GateActivity, 'id' | 'time' | 'operator'>) {
  activities = [
    { id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, time: nowIso(), operator: OPERATOR, ...activity },
    ...activities,
  ].slice(0, 100)
}

function matchesSearch(term: string | undefined, ...values: Array<string | number | null | undefined>): boolean {
  if (!term?.trim()) return true
  const t = term.trim().toLowerCase()
  return values.some((v) => v != null && String(v).toLowerCase().includes(t))
}

/** Derived pass status: sent-out/partially-returned passes past due show as overdue */
function withDerivedPassStatus(pass: GatePass): GatePass {
  if (isGatePassOverdue(pass) && pass.status !== 'overdue') {
    return { ...pass, status: 'overdue' }
  }
  return pass
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

// ─── Service implementation ──────────────────────────────────────────────────

export const gateDemoService: GateService = {
  // ── Dashboard & register ──────────────────────────────────────────────────

  async getGateDashboard(): Promise<GateDashboardSummary> {
    await delay()
    const visitorsInside = visits.filter((v) => v.status === 'inside').length
    const vehiclesInside = vehicles.filter((v) =>
      ['allowed_inside', 'loading', 'unloading', 'ready_exit'].includes(v.status),
    ).length
    const expectedToday = expectedVisitors.filter((e) => e.visitDate === todayIsoDate() && e.status === 'expected')
    const arrivedToday = expectedVisitors.filter((e) => e.visitDate === todayIsoDate() && e.status === 'arrived')
    const inwardWaiting = inwardEntries.filter((e) =>
      ['vehicle_arrived', 'documents_verified', 'waiting_unloading', 'waiting_store', 'waiting_qc', 'waiting_grn'].includes(e.status),
    ).length
    const outwardAwaiting = outwardEntries.filter((e) =>
      ['awaiting_vehicle', 'pending_approval', 'ready_for_gate', 'vehicle_inside', 'held'].includes(e.status),
    ).length
    const overduePasses = gatePasses.filter((p) => isGatePassOverdue(p))
    const contractorsInside = contractors.filter((c) => c.status === 'inside').length
    const couriersPending = couriers.filter((c) => c.status === 'pending_handover').length
    const pendingApprovals = approvals.filter((a) => a.status === 'pending').length
    const waitingVehicles = vehicles.filter(
      (v) => v.status === 'waiting' && v.entryTime && minutesBetween(v.entryTime) > 30,
    )

    const pulse: string[] = []
    if (visitorsInside > 0) pulse.push(`${visitorsInside} visitor${visitorsInside === 1 ? ' is' : 's are'} currently inside.`)
    if (waitingVehicles.length > 0) pulse.push(`${waitingVehicles.length} vehicle${waitingVehicles.length === 1 ? ' has' : 's have'} been waiting for more than 30 minutes.`)
    if (overduePasses.length > 0) pulse.push(`${overduePasses.length} returnable gate pass${overduePasses.length === 1 ? ' is' : 'es are'} overdue.`)
    if (expectedToday.length > 0) pulse.push(`${expectedToday.length} expected visitor${expectedToday.length === 1 ? ' has' : 's have'} not arrived.`)
    if (couriersPending > 0) pulse.push(`${couriersPending} courier parcel${couriersPending === 1 ? ' is' : 's are'} waiting for handover.`)
    if (pendingApprovals > 0) pulse.push(`${pendingApprovals} gate approval${pendingApprovals === 1 ? ' is' : 's are'} pending action.`)
    const missingInduction = contractors.filter((c) => c.status === 'inside' && !c.safetyInductionDone).length
    if (missingInduction > 0) pulse.push(`${missingInduction} contractor${missingInduction === 1 ? '' : 's'} inside without safety induction.`)

    return {
      visitorsInside,
      vehiclesInside,
      expectedVisitorsToday: expectedToday.length,
      expectedVisitorsArrived: arrivedToday.length,
      materialInwardWaiting: inwardWaiting,
      outwardAwaitingRelease: outwardAwaiting,
      overdueReturnables: overduePasses.length,
      contractorsInside,
      couriersPendingHandover: couriersPending,
      pendingApprovals,
      vehiclesWaitingOver30Min: waitingVehicles.length,
      pulse,
    }
  },

  async getGateRegister(filter?: GateListFilter): Promise<GateEntry[]> {
    await delay()
    const rows: GateEntry[] = []

    for (const v of visits) {
      rows.push({
        id: v.id, tenantId: TENANT, entryNumber: v.entryNumber, status: v.status,
        createdAt: v.createdAt, createdBy: v.createdBy, updatedAt: v.updatedAt, updatedBy: v.updatedBy,
        entryType: 'visitor', time: v.entryTime ?? v.createdAt, subject: v.visitorName, company: v.company,
        purpose: v.purpose, relatedDocument: undefined, gate: v.gate, entryBy: v.createdBy,
        entryTime: v.entryTime, exitTime: v.exitTime, isInside: v.status === 'inside',
      })
    }
    for (const v of vehicles) {
      rows.push({
        id: v.id, tenantId: TENANT, entryNumber: v.entryNumber, status: v.status,
        createdAt: v.createdAt, createdBy: v.createdBy, updatedAt: v.updatedAt, updatedBy: v.updatedBy,
        entryType: 'vehicle', time: v.entryTime ?? v.createdAt, subject: v.vehicleNumber, company: v.companyName,
        purpose: v.purpose, relatedDocument: v.relatedDocument, gate: v.gate, entryBy: v.createdBy,
        entryTime: v.entryTime, exitTime: v.exitTime,
        isInside: ['allowed_inside', 'loading', 'unloading', 'ready_exit'].includes(v.status),
      })
    }
    for (const e of inwardEntries) {
      rows.push({
        id: e.id, tenantId: TENANT, entryNumber: e.entryNumber, status: e.status,
        createdAt: e.createdAt, createdBy: e.createdBy, updatedAt: e.updatedAt, updatedBy: e.updatedBy,
        entryType: 'material_inward', time: e.arrivalTime ?? e.createdAt, subject: e.materialSummary,
        company: e.vendorName, purpose: e.inwardType.replace(/_/g, ' '), relatedDocument: e.poNumber ?? e.challanNumber,
        gate: e.gate, entryBy: e.createdBy, entryTime: e.arrivalTime, exitTime: null,
        isInside: !['accepted', 'rejected', 'closed', 'cancelled'].includes(e.status),
      })
    }
    for (const e of outwardEntries) {
      rows.push({
        id: e.id, tenantId: TENANT, entryNumber: e.entryNumber, status: e.status,
        createdAt: e.createdAt, createdBy: e.createdBy, updatedAt: e.updatedAt, updatedBy: e.updatedBy,
        entryType: 'material_outward', time: e.plannedTime ?? e.createdAt, subject: e.materialSummary,
        company: e.partyName, purpose: e.outwardType.replace(/_/g, ' '), relatedDocument: e.documentNumber,
        gate: e.gate, entryBy: e.createdBy, entryTime: null, exitTime: e.releasedAt,
        isInside: e.status === 'vehicle_inside',
      })
    }
    for (const c of contractors) {
      rows.push({
        id: c.id, tenantId: TENANT, entryNumber: c.entryNumber, status: c.status,
        createdAt: c.createdAt, createdBy: c.createdBy, updatedAt: c.updatedAt, updatedBy: c.updatedBy,
        entryType: 'contractor', time: c.entryTime ?? c.createdAt, subject: c.workerName,
        company: c.contractorCompany, purpose: c.purpose, relatedDocument: c.workReference, gate: c.gate,
        entryBy: c.createdBy, entryTime: c.entryTime, exitTime: c.exitTime, isInside: c.status === 'inside',
      })
    }
    for (const c of couriers) {
      rows.push({
        id: c.id, tenantId: TENANT, entryNumber: c.entryNumber, status: c.status,
        createdAt: c.createdAt, createdBy: c.createdBy, updatedAt: c.updatedAt, updatedBy: c.updatedBy,
        entryType: 'courier', time: c.receivedTime ?? c.dispatchTime ?? c.createdAt,
        subject: `${c.courierCompany}${c.trackingNumber ? ` — ${c.trackingNumber}` : ''}`,
        company: c.senderName, purpose: c.direction === 'incoming' ? 'Incoming parcel' : 'Outgoing parcel',
        relatedDocument: c.trackingNumber, gate: c.gate, entryBy: c.createdBy,
        entryTime: c.receivedTime, exitTime: c.handoverTime ?? c.dispatchTime,
        isInside: c.status === 'pending_handover',
      })
    }

    let filtered = rows
    if (filter?.entryType) filtered = filtered.filter((r) => r.entryType === filter.entryType)
    if (filter?.status) filtered = filtered.filter((r) => r.status === filter.status)
    if (filter?.gate) filtered = filtered.filter((r) => r.gate === filter.gate)
    if (filter?.company) filtered = filtered.filter((r) => matchesSearch(filter.company, r.company))
    if (filter?.date) filtered = filtered.filter((r) => r.time.slice(0, 10) === filter.date)
    if (filter?.insideOnly) filtered = filtered.filter((r) => r.isInside)
    if (filter?.missingExitOnly) filtered = filtered.filter((r) => r.entryTime && !r.exitTime && !r.isInside === false && r.isInside)
    if (filter?.search) {
      filtered = filtered.filter((r) =>
        matchesSearch(filter.search, r.entryNumber, r.subject, r.company, r.purpose, r.relatedDocument),
      )
    }
    return clone(filtered.sort((a, b) => b.time.localeCompare(a.time)))
  },

  async getGateActivities(limit = 20): Promise<GateActivity[]> {
    await delay(60)
    return clone(activities.slice(0, limit))
  },

  async getGateLocations() {
    await delay(40)
    return clone(locations.filter((l) => l.isActive))
  },

  // ── Settings ──────────────────────────────────────────────────────────────

  async getGateSettings() {
    await delay(60)
    return clone(settings)
  },

  async updateGateSettings(next) {
    await delay()
    settings = clone(next)
    return clone(settings)
  },

  // ── Visitors ──────────────────────────────────────────────────────────────

  async getVisitors(filter?: GateListFilter) {
    await delay()
    let rows = visits
    if (filter?.status) rows = rows.filter((v) => v.status === filter.status)
    if (filter?.gate) rows = rows.filter((v) => v.gate === filter.gate)
    if (filter?.date) rows = rows.filter((v) => v.visitDate === filter.date)
    if (filter?.search) {
      rows = rows.filter((v) =>
        matchesSearch(filter.search, v.entryNumber, v.visitorName, v.mobile, v.company, v.hostName, v.purpose),
      )
    }
    return clone([...rows].sort((a, b) => (b.entryTime ?? b.createdAt).localeCompare(a.entryTime ?? a.createdAt)))
  },

  async getVisitorById(id: string) {
    await delay(60)
    const visit = visits.find((v) => v.id === id)
    if (!visit) throw new GateServiceError('Visitor record not found')
    return clone(visit)
  },

  async searchVisitorByMobile(mobile: string) {
    await delay()
    const clean = mobile.replace(/\D/g, '')
    const profile = visitorProfiles.find((p) => p.mobile.replace(/\D/g, '') === clean)
    return profile ? clone(profile) : null
  },

  async getExpectedVisitors(filter?: GateListFilter) {
    await delay()
    let rows = expectedVisitors
    if (filter?.status) rows = rows.filter((e) => e.status === filter.status)
    if (filter?.date) rows = rows.filter((e) => e.visitDate === filter.date)
    if (filter?.search) {
      rows = rows.filter((e) => matchesSearch(filter.search, e.reference, e.visitorName, e.mobile, e.company, e.hostName))
    }
    return clone(rows)
  },

  async createExpectedVisitor(input: CreateExpectedVisitorInput) {
    await delay()
    const record: ExpectedVisitor = {
      id: `exp-${Date.now()}`,
      tenantId: TENANT,
      reference: nextNumber('EXP'),
      status: 'expected',
      ...input,
    }
    expectedVisitors = [record, ...expectedVisitors]
    return clone(record)
  },

  async cancelExpectedVisitor(id: string) {
    await delay()
    const record = expectedVisitors.find((e) => e.id === id)
    if (!record) throw new GateServiceError('Expected visitor not found')
    if (record.status !== 'expected') throw new GateServiceError('Only expected visits can be cancelled')
    record.status = 'cancelled'
    return clone(record)
  },

  async createVisitorEntry(input: CreateVisitorEntryInput) {
    await delay()
    const profile = visitorProfiles.find((p) => p.mobile.replace(/\D/g, '') === input.mobile.replace(/\D/g, ''))
    if (profile?.isBlacklisted) {
      throw new GateServiceError(
        `Visitor is blacklisted (${profile.blacklistReason ?? 'no reason recorded'}). Request a blacklist override approval.`,
      )
    }
    const needsApproval = input.hostApprovalRequired || settings.visitor.hostApprovalRequired
    const now = nowIso()
    const record: VisitorVisit = {
      id: `vis-${Date.now()}`,
      tenantId: TENANT,
      entryNumber: nextNumber('VIS'),
      status: needsApproval ? 'waiting_approval' : 'approved',
      approvalStatus: needsApproval ? 'pending' : 'not_required',
      visitDate: todayIsoDate(),
      entryTime: null,
      exitTime: null,
      approvalHistory: needsApproval ? [{ at: now, by: OPERATOR, action: 'approval_requested' }] : [],
      createdAt: now,
      createdBy: OPERATOR,
      updatedAt: now,
      updatedBy: OPERATOR,
      ...input,
    }
    visits = [record, ...visits]
    if (input.expectedVisitorId) {
      const expected = expectedVisitors.find((e) => e.id === input.expectedVisitorId)
      if (expected) expected.status = 'arrived'
    }
    if (profile) {
      profile.totalVisits += 1
      profile.lastVisitAt = now
      profile.lastHost = input.hostName
      if (input.vehicleNumber) profile.lastVehicleNumber = input.vehicleNumber
    } else {
      visitorProfiles = [
        {
          id: `vp-${Date.now()}`, tenantId: TENANT, name: input.visitorName, mobile: input.mobile,
          company: input.company, lastHost: input.hostName, lastVehicleNumber: input.vehicleNumber,
          lastVisitAt: now, totalVisits: 1, isBlacklisted: false,
        },
        ...visitorProfiles,
      ]
    }
    pushActivity({ event: 'visitor_arrived', recordType: 'visitor', recordId: record.id, recordLabel: record.visitorName, company: record.company, gate: record.gate, status: record.status })
    return clone(record)
  },

  async updateVisitorEntry(id, input) {
    await delay()
    const visit = visits.find((v) => v.id === id)
    if (!visit) throw new GateServiceError('Visitor record not found')
    if (['exited', 'cancelled', 'rejected'].includes(visit.status)) {
      throw new GateServiceError('Exited, cancelled or rejected visits are read-only')
    }
    Object.assign(visit, input)
    stamp(visit)
    return clone(visit)
  },

  async requestVisitorApproval(id) {
    await delay()
    const visit = visits.find((v) => v.id === id)
    if (!visit) throw new GateServiceError('Visitor record not found')
    if (!['arrived', 'expected'].includes(visit.status) && visit.approvalStatus !== 'not_required') {
      if (visit.status === 'waiting_approval') throw new GateServiceError('Approval is already pending')
    }
    visit.status = 'waiting_approval'
    visit.approvalStatus = 'pending'
    visit.approvalHistory.push({ at: nowIso(), by: OPERATOR, action: 'approval_requested' })
    stamp(visit)
    approvals = [
      {
        id: `apr-${Date.now()}`, tenantId: TENANT, requestNumber: nextNumber('GAR'),
        requestType: 'walk_in_visitor', requestedBy: OPERATOR,
        subject: `${visit.visitorName}${visit.company ? ` — ${visit.company}` : ''}`,
        reason: visit.purpose, requestedAt: nowIso(), priority: 'normal', status: 'pending',
        sourceType: 'visitor', sourceId: visit.id,
      },
      ...approvals,
    ]
    return clone(visit)
  },

  async approveVisitor(id, remarks) {
    await delay()
    const visit = visits.find((v) => v.id === id)
    if (!visit) throw new GateServiceError('Visitor record not found')
    if (!['waiting_approval', 'arrived', 'expected'].includes(visit.status)) {
      throw new GateServiceError(`Cannot approve a visit in status "${visit.status}"`)
    }
    visit.status = 'approved'
    visit.approvalStatus = 'approved'
    visit.approvedBy = OPERATOR
    visit.approvedAt = nowIso()
    if (remarks) visit.approvalRemarks = remarks
    visit.approvalHistory.push({ at: nowIso(), by: OPERATOR, action: 'approved', remarks })
    stamp(visit)
    pushActivity({ event: 'visitor_approved', recordType: 'visitor', recordId: visit.id, recordLabel: visit.visitorName, company: visit.company, gate: visit.gate, status: visit.status })
    return clone(visit)
  },

  async rejectVisitor(id, remarks) {
    await delay()
    if (!remarks?.trim()) throw new GateServiceError('Rejection remarks are required')
    const visit = visits.find((v) => v.id === id)
    if (!visit) throw new GateServiceError('Visitor record not found')
    if (['inside', 'exited', 'cancelled'].includes(visit.status)) {
      throw new GateServiceError(`Cannot reject a visit in status "${visit.status}"`)
    }
    visit.status = 'rejected'
    visit.approvalStatus = 'rejected'
    visit.approvalRemarks = remarks
    visit.approvalHistory.push({ at: nowIso(), by: OPERATOR, action: 'rejected', remarks })
    stamp(visit)
    return clone(visit)
  },

  async recordVisitorEntry(id) {
    await delay()
    const visit = visits.find((v) => v.id === id)
    if (!visit) throw new GateServiceError('Visitor record not found')
    if (visit.status === 'inside') throw new GateServiceError('Visitor is already inside')
    if (visit.status === 'rejected') {
      throw new GateServiceError('Rejected visitors require an approval override before entry')
    }
    if (['exited', 'cancelled'].includes(visit.status)) {
      throw new GateServiceError('This visit is closed — create a new entry instead')
    }
    if (visit.hostApprovalRequired && visit.approvalStatus !== 'approved') {
      throw new GateServiceError('Host approval is required before entry can be allowed')
    }
    visit.status = 'inside'
    visit.entryTime = nowIso()
    stamp(visit)
    pushActivity({ event: 'visitor_entered', recordType: 'visitor', recordId: visit.id, recordLabel: visit.visitorName, company: visit.company, gate: visit.gate, status: 'inside' })
    return clone(visit)
  },

  async recordVisitorExit(id, input: RecordVisitorExitInput) {
    await delay()
    const visit = visits.find((v) => v.id === id)
    if (!visit) throw new GateServiceError('Visitor record not found')
    if (visit.status === 'exited') throw new GateServiceError('Exit has already been recorded for this visit')
    if (!visit.entryTime || !['inside', 'overstayed'].includes(visit.status)) {
      throw new GateServiceError('Cannot record exit before entry')
    }
    visit.status = 'exited'
    visit.exitTime = nowIso()
    visit.badgeReturned = input.badgeReturned
    visit.exitRemarks = input.exitRemarks
    stamp(visit)
    pushActivity({ event: 'visitor_exited', recordType: 'visitor', recordId: visit.id, recordLabel: visit.visitorName, company: visit.company, gate: visit.gate, status: 'exited' })
    return clone(visit)
  },

  async cancelVisitor(id, remarks) {
    await delay()
    const visit = visits.find((v) => v.id === id)
    if (!visit) throw new GateServiceError('Visitor record not found')
    if (['inside', 'exited', 'cancelled'].includes(visit.status)) {
      throw new GateServiceError(`Cannot cancel a visit in status "${visit.status}"`)
    }
    visit.status = 'cancelled'
    visit.approvalHistory.push({ at: nowIso(), by: OPERATOR, action: 'cancelled', remarks })
    stamp(visit)
    return clone(visit)
  },

  // ── Vehicles ──────────────────────────────────────────────────────────────

  async getVehicles(filter?: GateListFilter) {
    await delay()
    let rows = vehicles
    if (filter?.status) rows = rows.filter((v) => v.status === filter.status)
    if (filter?.gate) rows = rows.filter((v) => v.gate === filter.gate)
    if (filter?.search) {
      rows = rows.filter((v) =>
        matchesSearch(filter.search, v.entryNumber, v.vehicleNumber, v.companyName, v.driverName, v.purpose, v.relatedDocument),
      )
    }
    return clone([...rows].sort((a, b) => (b.entryTime ?? b.createdAt).localeCompare(a.entryTime ?? a.createdAt)))
  },

  async getVehicleById(id) {
    await delay(60)
    const vehicle = vehicles.find((v) => v.id === id)
    if (!vehicle) throw new GateServiceError('Vehicle record not found')
    return clone(vehicle)
  },

  async createVehicleEntry(input: CreateVehicleEntryInput) {
    await delay()
    const now = nowIso()
    const { markArrived, ...rest } = input
    const record: GateVehicle = {
      id: `veh-${Date.now()}`,
      tenantId: TENANT,
      entryNumber: nextNumber('VEH'),
      status: markArrived ? 'arrived' : 'expected',
      currentLocation: markArrived ? 'Gate' : undefined,
      entryTime: null,
      exitTime: null,
      timeline: [{ at: now, status: markArrived ? 'arrived' : 'expected', by: OPERATOR }],
      createdAt: now,
      createdBy: OPERATOR,
      updatedAt: now,
      updatedBy: OPERATOR,
      ...rest,
    }
    vehicles = [record, ...vehicles]
    if (markArrived) {
      pushActivity({ event: 'vehicle_arrived', recordType: 'vehicle', recordId: record.id, recordLabel: record.vehicleNumber, company: record.companyName, gate: record.gate, status: record.status })
    }
    return clone(record)
  },

  async markVehicleArrived(id) {
    await delay()
    const vehicle = vehicles.find((v) => v.id === id)
    if (!vehicle) throw new GateServiceError('Vehicle record not found')
    if (vehicle.status !== 'expected') throw new GateServiceError(`Vehicle is already "${vehicle.status}"`)
    vehicle.status = 'arrived'
    vehicle.currentLocation = 'Gate'
    vehicle.timeline.push({ at: nowIso(), status: 'arrived', by: OPERATOR })
    stamp(vehicle)
    pushActivity({ event: 'vehicle_arrived', recordType: 'vehicle', recordId: vehicle.id, recordLabel: vehicle.vehicleNumber, company: vehicle.companyName, gate: vehicle.gate, status: 'arrived' })
    return clone(vehicle)
  },

  async allowVehicleInside(id) {
    await delay()
    const vehicle = vehicles.find((v) => v.id === id)
    if (!vehicle) throw new GateServiceError('Vehicle record not found')
    if (vehicle.status === 'rejected') {
      throw new GateServiceError('Rejected vehicles need an override approval before entry')
    }
    if (!['arrived', 'waiting'].includes(vehicle.status)) {
      throw new GateServiceError(`Cannot allow a vehicle inside from status "${vehicle.status}"`)
    }
    vehicle.status = 'allowed_inside'
    vehicle.entryTime = nowIso()
    vehicle.currentLocation = vehicle.plannedLocation ?? 'Inside plant'
    vehicle.timeline.push({ at: nowIso(), status: 'allowed_inside', by: OPERATOR })
    stamp(vehicle)
    return clone(vehicle)
  },

  async updateVehicleLocation(id, location, status) {
    await delay()
    const vehicle = vehicles.find((v) => v.id === id)
    if (!vehicle) throw new GateServiceError('Vehicle record not found')
    if (['exited', 'cancelled', 'rejected'].includes(vehicle.status)) {
      throw new GateServiceError('Exited, rejected or cancelled vehicles are read-only')
    }
    vehicle.currentLocation = location
    if (status) {
      vehicle.status = status
      vehicle.timeline.push({ at: nowIso(), status, by: OPERATOR, note: location })
    }
    stamp(vehicle)
    return clone(vehicle)
  },

  async markVehicleReadyForExit(id) {
    await delay()
    const vehicle = vehicles.find((v) => v.id === id)
    if (!vehicle) throw new GateServiceError('Vehicle record not found')
    if (!['allowed_inside', 'loading', 'unloading'].includes(vehicle.status)) {
      throw new GateServiceError(`Cannot mark ready-for-exit from status "${vehicle.status}"`)
    }
    vehicle.status = 'ready_exit'
    vehicle.timeline.push({ at: nowIso(), status: 'ready_exit', by: OPERATOR })
    stamp(vehicle)
    return clone(vehicle)
  },

  async recordVehicleExit(id, remarks) {
    await delay()
    const vehicle = vehicles.find((v) => v.id === id)
    if (!vehicle) throw new GateServiceError('Vehicle record not found')
    if (vehicle.status === 'exited') throw new GateServiceError('Exit has already been recorded for this vehicle')
    if (!vehicle.entryTime) throw new GateServiceError('Cannot record exit before the vehicle has entered')
    vehicle.status = 'exited'
    vehicle.exitTime = nowIso()
    vehicle.exitRemarks = remarks
    vehicle.timeline.push({ at: nowIso(), status: 'exited', by: OPERATOR, note: remarks })
    stamp(vehicle)
    pushActivity({ event: 'vehicle_exited', recordType: 'vehicle', recordId: vehicle.id, recordLabel: vehicle.vehicleNumber, company: vehicle.companyName, gate: vehicle.gate, status: 'exited' })
    return clone(vehicle)
  },

  // ── Material inward ───────────────────────────────────────────────────────

  async getMaterialInwardEntries(filter?: GateListFilter) {
    await delay()
    let rows = inwardEntries
    if (filter?.status) rows = rows.filter((e) => e.status === filter.status)
    if (filter?.gate) rows = rows.filter((e) => e.gate === filter.gate)
    if (filter?.search) {
      rows = rows.filter((e) =>
        matchesSearch(filter.search, e.entryNumber, e.vendorName, e.poNumber, e.challanNumber, e.vehicleNumber, e.materialSummary),
      )
    }
    return clone([...rows].sort((a, b) => (b.arrivalTime ?? b.createdAt).localeCompare(a.arrivalTime ?? a.createdAt)))
  },

  async getMaterialInwardById(id) {
    await delay(60)
    const entry = inwardEntries.find((e) => e.id === id)
    if (!entry) throw new GateServiceError('Material inward entry not found')
    return clone(entry)
  },

  async createMaterialInward(input: CreateMaterialInwardInput) {
    await delay()
    if (settings.material.vehicleNumberRequired && !input.vehicleNumber?.trim() && !input.saveAsDraft) {
      throw new GateServiceError('Vehicle number is required by gate settings')
    }
    if (input.inwardType === 'without_po' && !settings.material.allowInwardWithoutPo) {
      throw new GateServiceError('Inward without PO is disabled in gate settings')
    }
    const now = nowIso()
    const { saveAsDraft, ...rest } = input
    const status = saveAsDraft ? 'draft' : 'vehicle_arrived'
    const record: MaterialInwardEntry = {
      id: `min-${Date.now()}`,
      tenantId: TENANT,
      entryNumber: nextNumber('MIN'),
      status,
      arrivalTime: saveAsDraft ? null : now,
      lines: [],
      linkedGrnNumber: null,
      linkedQcNumber: null,
      timeline: [{ at: now, status, by: OPERATOR }],
      createdAt: now,
      createdBy: OPERATOR,
      updatedAt: now,
      updatedBy: OPERATOR,
      ...rest,
    }
    inwardEntries = [record, ...inwardEntries]
    if (!saveAsDraft) {
      pushActivity({ event: 'material_inward_registered', recordType: 'material_inward', recordId: record.id, recordLabel: record.materialSummary, company: record.vendorName, gate: record.gate, status })
    }
    if (input.inwardType === 'without_po' && !saveAsDraft) {
      approvals = [
        {
          id: `apr-${Date.now()}`, tenantId: TENANT, requestNumber: nextNumber('GAR'),
          requestType: 'inward_without_po', requestedBy: OPERATOR,
          subject: `${record.vendorName ?? 'Unknown vendor'} — ${record.materialSummary}`,
          reason: record.remarks ?? 'Material inward without purchase order', requestedAt: now,
          priority: 'high', status: 'pending', sourceType: 'material_inward', sourceId: record.id,
        },
        ...approvals,
      ]
    }
    return clone(record)
  },

  async updateMaterialInwardStatus(id, status, note) {
    await delay()
    const entry = inwardEntries.find((e) => e.id === id)
    if (!entry) throw new GateServiceError('Material inward entry not found')
    if (['closed', 'cancelled', 'rejected'].includes(entry.status)) {
      throw new GateServiceError('Closed, rejected or cancelled inward entries are read-only')
    }
    entry.status = status
    if (status === 'vehicle_arrived' && !entry.arrivalTime) entry.arrivalTime = nowIso()
    entry.timeline.push({ at: nowIso(), status, by: OPERATOR, note })
    stamp(entry)
    return clone(entry)
  },

  async cancelMaterialInward(id, remarks) {
    await delay()
    if (!remarks?.trim()) throw new GateServiceError('Cancellation remarks are required')
    const entry = inwardEntries.find((e) => e.id === id)
    if (!entry) throw new GateServiceError('Material inward entry not found')
    if (['closed', 'cancelled', 'accepted'].includes(entry.status)) {
      throw new GateServiceError(`Cannot cancel an entry in status "${entry.status}"`)
    }
    entry.status = 'cancelled'
    entry.timeline.push({ at: nowIso(), status: 'cancelled', by: OPERATOR, note: remarks })
    stamp(entry)
    return clone(entry)
  },

  // ── Material outward ──────────────────────────────────────────────────────

  async getMaterialOutwardEntries(filter?: GateListFilter) {
    await delay()
    let rows = outwardEntries
    if (filter?.status) rows = rows.filter((e) => e.status === filter.status)
    if (filter?.gate) rows = rows.filter((e) => e.gate === filter.gate)
    if (filter?.search) {
      rows = rows.filter((e) =>
        matchesSearch(filter.search, e.entryNumber, e.documentNumber, e.partyName, e.vehicleNumber, e.materialSummary),
      )
    }
    return clone([...rows].sort((a, b) => (b.plannedTime ?? b.createdAt).localeCompare(a.plannedTime ?? a.createdAt)))
  },

  async getMaterialOutwardById(id) {
    await delay(60)
    const entry = outwardEntries.find((e) => e.id === id)
    if (!entry) throw new GateServiceError('Material outward entry not found')
    return clone(entry)
  },

  async searchOutwardDocuments(query: string): Promise<OutwardDocumentSearchResult[]> {
    await delay()
    const term = query.trim().toLowerCase()
    if (!term) return []
    return outwardEntries
      .filter(
        (e) =>
          !['released', 'rejected', 'cancelled'].includes(e.status) &&
          [e.documentNumber, e.partyName, e.vehicleNumber, e.entryNumber, e.materialSummary].some((v) =>
            v?.toLowerCase().includes(term),
          ),
      )
      .map((e) => ({
        documentType: e.documentType,
        documentNumber: e.documentNumber,
        partyName: e.partyName,
        materialSummary: e.materialSummary,
        packagesExpected: e.packagesExpected,
        approved: e.documentApproved && e.approvalStatus === 'approved',
        outwardType: e.outwardType,
        existingOutwardId: e.id,
      }))
  },

  async verifyMaterialOutward(id, input: VerifyMaterialOutwardInput) {
    await delay()
    const entry = outwardEntries.find((e) => e.id === id)
    if (!entry) throw new GateServiceError('Material outward entry not found')
    if (['released', 'rejected', 'cancelled'].includes(entry.status)) {
      throw new GateServiceError('Released, rejected or cancelled outward entries are read-only')
    }
    entry.checklist = { ...entry.checklist, ...input.checklist }
    if (input.vehicleNumber !== undefined) entry.vehicleNumber = input.vehicleNumber
    if (input.driverName !== undefined) entry.driverName = input.driverName
    if (input.sealNumber !== undefined) entry.sealNumber = input.sealNumber
    if (input.packagesVerified !== undefined) entry.packagesVerified = input.packagesVerified
    stamp(entry)
    return clone(entry)
  },

  async holdMaterialOutward(id, remarks) {
    await delay()
    if (!remarks?.trim()) throw new GateServiceError('Hold remarks are required')
    const entry = outwardEntries.find((e) => e.id === id)
    if (!entry) throw new GateServiceError('Material outward entry not found')
    if (['released', 'rejected', 'cancelled'].includes(entry.status)) {
      throw new GateServiceError('Released, rejected or cancelled outward entries are read-only')
    }
    entry.status = 'held'
    entry.holdRemarks = remarks
    entry.timeline.push({ at: nowIso(), status: 'held', by: OPERATOR, note: remarks })
    stamp(entry)
    return clone(entry)
  },

  async reportMaterialMismatch(id, remarks) {
    await delay()
    if (!remarks?.trim()) throw new GateServiceError('Mismatch remarks are required')
    const entry = outwardEntries.find((e) => e.id === id)
    if (!entry) throw new GateServiceError('Material outward entry not found')
    if (['released', 'rejected', 'cancelled'].includes(entry.status)) {
      throw new GateServiceError('Released, rejected or cancelled outward entries are read-only')
    }
    entry.status = 'mismatch'
    entry.mismatchRemarks = remarks
    entry.timeline.push({ at: nowIso(), status: 'mismatch', by: OPERATOR, note: remarks })
    stamp(entry)
    return clone(entry)
  },

  async releaseMaterialOutward(id) {
    await delay()
    const entry = outwardEntries.find((e) => e.id === id)
    if (!entry) throw new GateServiceError('Material outward entry not found')
    if (entry.status === 'released') throw new GateServiceError('This outward entry has already been released')
    if (['rejected', 'cancelled'].includes(entry.status)) {
      throw new GateServiceError('Rejected or cancelled outward entries cannot be released')
    }
    if (!entry.documentApproved || entry.approvalStatus !== 'approved') {
      throw new GateServiceError('Cannot release without an approved source document')
    }
    if (settings.material.releaseChecklistRequired) {
      const incomplete = Object.entries(entry.checklist).filter(([, done]) => !done)
      if (incomplete.length > 0) {
        throw new GateServiceError(`Release checklist is incomplete (${incomplete.length} item${incomplete.length === 1 ? '' : 's'} pending)`)
      }
    }
    entry.status = 'released'
    entry.releasedAt = nowIso()
    entry.releasedBy = OPERATOR
    entry.timeline.push({ at: nowIso(), status: 'released', by: OPERATOR })
    stamp(entry)
    pushActivity({ event: 'outward_released', recordType: 'material_outward', recordId: entry.id, recordLabel: `${entry.documentNumber} — ${entry.materialSummary}`, company: entry.partyName, gate: entry.gate, status: 'released' })
    return clone(entry)
  },

  async rejectMaterialOutward(id, remarks) {
    await delay()
    if (!remarks?.trim()) throw new GateServiceError('Rejection remarks are required')
    const entry = outwardEntries.find((e) => e.id === id)
    if (!entry) throw new GateServiceError('Material outward entry not found')
    if (['released', 'rejected', 'cancelled'].includes(entry.status)) {
      throw new GateServiceError('Released, rejected or cancelled outward entries are read-only')
    }
    entry.status = 'rejected'
    entry.rejectRemarks = remarks
    entry.timeline.push({ at: nowIso(), status: 'rejected', by: OPERATOR, note: remarks })
    stamp(entry)
    return clone(entry)
  },

  // ── Gate passes ───────────────────────────────────────────────────────────

  async getGatePasses(filter?: GateListFilter) {
    await delay()
    let rows = gatePasses.map(withDerivedPassStatus)
    if (filter?.status) rows = rows.filter((p) => p.status === filter.status)
    if (filter?.search) {
      rows = rows.filter((p) =>
        matchesSearch(
          filter.search, p.entryNumber, p.responsibleEmployee, p.partyName, p.department, p.purpose,
          ...p.items.map((i) => i.itemDescription),
        ),
      )
    }
    return clone([...rows].sort((a, b) => b.outwardDate.localeCompare(a.outwardDate)))
  },

  async getGatePassById(id) {
    await delay(60)
    const pass = gatePasses.find((p) => p.id === id)
    if (!pass) throw new GateServiceError('Gate pass not found')
    return clone(withDerivedPassStatus(pass))
  },

  async createGatePass(input: CreateGatePassInput) {
    await delay()
    if (input.passKind === 'returnable' && !input.expectedReturnDate) {
      throw new GateServiceError('Returnable gate passes require an expected return date')
    }
    if (!input.items.length) throw new GateServiceError('At least one item is required')
    if (input.items.some((i) => i.quantity <= 0)) throw new GateServiceError('Item quantity must be greater than zero')
    const now = nowIso()
    const { submitForApproval, items, ...rest } = input
    const needsApproval = settings.pass.approvalRequired
    const record: GatePass = {
      id: `gp-${Date.now()}`,
      tenantId: TENANT,
      entryNumber: nextNumber('GP'),
      status: submitForApproval ? (needsApproval ? 'pending_approval' : 'approved') : 'draft',
      approvalStatus: submitForApproval ? (needsApproval ? 'pending' : 'not_required') : 'pending',
      carriedBy: input.carriedBy || input.responsibleEmployee,
      outwardDate: now,
      items: items.map((item, i) => ({ ...item, id: `gpi-${Date.now()}-${i}`, returnedQuantity: 0 })),
      returns: [],
      createdAt: now,
      createdBy: OPERATOR,
      updatedAt: now,
      updatedBy: OPERATOR,
      ...rest,
    }
    gatePasses = [record, ...gatePasses]
    if (record.status === 'pending_approval') {
      approvals = [
        {
          id: `apr-${Date.now()}`, tenantId: TENANT, requestNumber: nextNumber('GAR'),
          requestType: input.passKind === 'returnable' ? 'returnable_gate_pass' : 'material_outward',
          requestedBy: input.responsibleEmployee,
          subject: `${record.entryNumber} — ${items[0]?.itemDescription ?? record.purpose}`,
          reason: record.purpose, requestedAt: now, priority: 'normal', status: 'pending',
          sourceType: 'gate_pass', sourceId: record.id,
        },
        ...approvals,
      ]
    }
    return clone(record)
  },

  async submitGatePass(id) {
    await delay()
    const pass = gatePasses.find((p) => p.id === id)
    if (!pass) throw new GateServiceError('Gate pass not found')
    if (pass.status !== 'draft') throw new GateServiceError('Only draft passes can be submitted')
    pass.status = settings.pass.approvalRequired ? 'pending_approval' : 'approved'
    pass.approvalStatus = settings.pass.approvalRequired ? 'pending' : 'not_required'
    stamp(pass)
    return clone(pass)
  },

  async approveGatePass(id, remarks) {
    await delay()
    const pass = gatePasses.find((p) => p.id === id)
    if (!pass) throw new GateServiceError('Gate pass not found')
    if (pass.status !== 'pending_approval') throw new GateServiceError('Only passes awaiting approval can be approved')
    pass.status = 'approved'
    pass.approvalStatus = 'approved'
    pass.approvalRemarks = remarks
    pass.approverName = OPERATOR
    stamp(pass)
    return clone(pass)
  },

  async rejectGatePass(id, remarks) {
    await delay()
    if (!remarks?.trim()) throw new GateServiceError('Rejection remarks are required')
    const pass = gatePasses.find((p) => p.id === id)
    if (!pass) throw new GateServiceError('Gate pass not found')
    if (pass.status !== 'pending_approval') throw new GateServiceError('Only passes awaiting approval can be rejected')
    pass.status = 'rejected'
    pass.approvalStatus = 'rejected'
    pass.approvalRemarks = remarks
    stamp(pass)
    return clone(pass)
  },

  async markGatePassSentOut(id) {
    await delay()
    const pass = gatePasses.find((p) => p.id === id)
    if (!pass) throw new GateServiceError('Gate pass not found')
    if (pass.status !== 'approved') throw new GateServiceError('Only approved passes can be sent out')
    pass.status = 'sent_out'
    pass.outwardDate = nowIso()
    stamp(pass)
    return clone(pass)
  },

  async recordGatePassReturn(id, input: RecordGatePassReturnInput) {
    await delay()
    const pass = gatePasses.find((p) => p.id === id)
    if (!pass) throw new GateServiceError('Gate pass not found')
    if (['closed', 'cancelled', 'written_off', 'draft', 'rejected'].includes(pass.status)) {
      throw new GateServiceError(`Returns cannot be recorded on a ${pass.status.replace(/_/g, ' ')} pass`)
    }
    const item = pass.items.find((i) => i.id === input.itemId)
    if (!item) throw new GateServiceError('Gate pass item not found')
    const pending = item.quantity - item.returnedQuantity
    if (input.returnedQuantity <= 0) throw new GateServiceError('Returned quantity must be greater than zero')
    if (input.returnedQuantity > pending) {
      throw new GateServiceError(`Returned quantity (${input.returnedQuantity}) cannot exceed pending quantity (${pending})`)
    }
    if (!settings.pass.partialReturnAllowed && input.returnedQuantity < pending) {
      throw new GateServiceError('Partial returns are disabled in gate settings')
    }
    item.returnedQuantity += input.returnedQuantity
    pass.returns.push({
      id: `gpr-${Date.now()}`,
      returnDate: input.returnDate,
      itemId: input.itemId,
      returnedQuantity: input.returnedQuantity,
      conditionReturned: input.conditionReturned,
      damage: input.damage,
      remarks: input.remarks,
      recordedBy: OPERATOR,
    })
    pass.status = gatePassPendingQty(pass) === 0 ? 'returned' : 'partially_returned'
    stamp(pass)
    pushActivity({ event: 'gate_pass_returned', recordType: 'gate_pass', recordId: pass.id, recordLabel: `${pass.entryNumber} — ${item.itemDescription}`, company: pass.partyName, gate: pass.gate, status: pass.status })
    return clone(withDerivedPassStatus(pass))
  },

  async closeGatePass(id, remarks) {
    await delay()
    const pass = gatePasses.find((p) => p.id === id)
    if (!pass) throw new GateServiceError('Gate pass not found')
    if (['closed', 'cancelled'].includes(pass.status)) throw new GateServiceError('Pass is already closed')
    if (pass.passKind === 'returnable' && gatePassPendingQty(pass) > 0 && !remarks?.trim()) {
      throw new GateServiceError('Closing with pending quantity requires remarks (write-off justification)')
    }
    pass.status = pass.passKind === 'returnable' && gatePassPendingQty(pass) > 0 ? 'written_off' : 'closed'
    if (remarks) pass.approvalRemarks = remarks
    stamp(pass)
    return clone(pass)
  },

  // ── Contractors ───────────────────────────────────────────────────────────

  async getContractors(filter?: GateListFilter) {
    await delay()
    let rows = contractors
    if (filter?.status) rows = rows.filter((c) => c.status === filter.status)
    if (filter?.search) {
      rows = rows.filter((c) =>
        matchesSearch(filter.search, c.entryNumber, c.workerName, c.mobile, c.contractorCompany, c.department, c.supervisor),
      )
    }
    return clone([...rows].sort((a, b) => (b.entryTime ?? b.createdAt).localeCompare(a.entryTime ?? a.createdAt)))
  },

  async getContractorById(id) {
    await delay(60)
    const record = contractors.find((c) => c.id === id)
    if (!record) throw new GateServiceError('Contractor entry not found')
    return clone(record)
  },

  async createContractorEntry(input: CreateContractorEntryInput) {
    await delay()
    const now = nowIso()
    const record: ContractorEntry = {
      id: `con-${Date.now()}`,
      tenantId: TENANT,
      entryNumber: nextNumber('CON'),
      status: 'inside',
      entryTime: now,
      exitTime: null,
      createdAt: now,
      createdBy: OPERATOR,
      updatedAt: now,
      updatedBy: OPERATOR,
      ...input,
    }
    contractors = [record, ...contractors]
    pushActivity({ event: 'contractor_entered', recordType: 'contractor', recordId: record.id, recordLabel: record.workerName, company: record.contractorCompany, gate: record.gate, status: 'inside' })
    return clone(record)
  },

  async recordContractorExit(id, remarks) {
    await delay()
    const record = contractors.find((c) => c.id === id)
    if (!record) throw new GateServiceError('Contractor entry not found')
    if (record.status === 'exited') throw new GateServiceError('Exit has already been recorded for this contractor')
    if (record.status !== 'inside') throw new GateServiceError('Cannot record exit before entry')
    record.status = 'exited'
    record.exitTime = nowIso()
    if (remarks) record.remarks = remarks
    stamp(record)
    pushActivity({ event: 'contractor_exited', recordType: 'contractor', recordId: record.id, recordLabel: record.workerName, company: record.contractorCompany, gate: record.gate, status: 'exited' })
    return clone(record)
  },

  // ── Couriers ──────────────────────────────────────────────────────────────

  async getCouriers(filter?: GateListFilter) {
    await delay()
    let rows = couriers
    if (filter?.status) rows = rows.filter((c) => c.status === filter.status)
    if (filter?.search) {
      rows = rows.filter((c) =>
        matchesSearch(filter.search, c.entryNumber, c.courierCompany, c.trackingNumber, c.senderName, c.recipientEmployee, c.parcelDescription),
      )
    }
    return clone(rows)
  },

  async getCourierById(id) {
    await delay(60)
    const record = couriers.find((c) => c.id === id)
    if (!record) throw new GateServiceError('Courier entry not found')
    return clone(record)
  },

  async createCourierEntry(input: CreateCourierEntryInput) {
    await delay()
    const now = nowIso()
    const record: CourierEntry = {
      id: `cour-${Date.now()}`,
      tenantId: TENANT,
      entryNumber: nextNumber('COUR'),
      status: input.direction === 'incoming' ? 'pending_handover' : 'dispatched',
      receivedTime: input.direction === 'incoming' ? now : null,
      receivedBy: input.direction === 'incoming' ? OPERATOR : undefined,
      dispatchTime: input.direction === 'outgoing' ? now : null,
      handoverTime: null,
      createdAt: now,
      createdBy: OPERATOR,
      updatedAt: now,
      updatedBy: OPERATOR,
      ...input,
    }
    couriers = [record, ...couriers]
    pushActivity({
      event: input.direction === 'incoming' ? 'courier_received' : 'courier_handed_over',
      recordType: 'courier', recordId: record.id,
      recordLabel: `${record.courierCompany}${record.trackingNumber ? ` ${record.trackingNumber}` : ''}`,
      company: record.senderName, gate: record.gate, status: record.status,
    })
    return clone(record)
  },

  async markCourierHandedOver(id, handedOverTo) {
    await delay()
    const record = couriers.find((c) => c.id === id)
    if (!record) throw new GateServiceError('Courier entry not found')
    if (record.direction !== 'incoming') throw new GateServiceError('Handover applies to incoming parcels only')
    if (record.status === 'handed_over') throw new GateServiceError('Parcel has already been handed over')
    if (!handedOverTo.trim()) throw new GateServiceError('Receiver name is required for handover')
    record.status = 'handed_over'
    record.handoverTime = nowIso()
    record.handedOverTo = handedOverTo
    stamp(record)
    pushActivity({ event: 'courier_handed_over', recordType: 'courier', recordId: record.id, recordLabel: `${record.courierCompany}${record.trackingNumber ? ` ${record.trackingNumber}` : ''}`, company: record.senderName, gate: record.gate, status: 'handed_over' })
    return clone(record)
  },

  // ── Approvals ─────────────────────────────────────────────────────────────

  async getGateApprovals(filter?: GateListFilter) {
    await delay()
    let rows = approvals
    if (filter?.status) rows = rows.filter((a) => a.status === filter.status)
    if (filter?.search) {
      rows = rows.filter((a) => matchesSearch(filter.search, a.requestNumber, a.subject, a.requestedBy, a.reason))
    }
    return clone([...rows].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)))
  },

  async getGateApprovalById(id) {
    await delay(60)
    const record = approvals.find((a) => a.id === id)
    if (!record) throw new GateServiceError('Approval request not found')
    return clone(record)
  },

  async approveGateRequest(id, remarks) {
    await delay()
    const record = approvals.find((a) => a.id === id)
    if (!record) throw new GateServiceError('Approval request not found')
    if (record.status !== 'pending') throw new GateServiceError('Only pending requests can be actioned')
    if (record.requestType === 'blacklist_override' && !remarks?.trim()) {
      throw new GateServiceError('Override approvals require remarks')
    }
    record.status = 'approved'
    record.actionedBy = OPERATOR
    record.actionedAt = nowIso()
    record.actionRemarks = remarks

    // Reflect approval on the source record (demo mode)
    if (record.sourceType === 'visitor') {
      const visit = visits.find((v) => v.id === record.sourceId)
      if (visit && ['waiting_approval', 'arrived', 'rejected'].includes(visit.status)) {
        visit.status = 'approved'
        visit.approvalStatus = 'approved'
        visit.approvedBy = OPERATOR
        visit.approvedAt = nowIso()
        visit.approvalHistory.push({ at: nowIso(), by: OPERATOR, action: 'approved', remarks })
      }
    } else if (record.sourceType === 'material_outward') {
      const entry = outwardEntries.find((e) => e.id === record.sourceId)
      if (entry) {
        entry.documentApproved = true
        entry.approvalStatus = 'approved'
        if (entry.status === 'pending_approval') entry.status = 'ready_for_gate'
        entry.timeline.push({ at: nowIso(), status: entry.status, by: OPERATOR, note: 'Approval granted' })
      }
    } else if (record.sourceType === 'gate_pass') {
      const pass = gatePasses.find((p) => p.id === record.sourceId)
      if (pass && pass.status === 'pending_approval') {
        pass.status = 'approved'
        pass.approvalStatus = 'approved'
        pass.approverName = OPERATOR
        pass.approvalRemarks = remarks
      }
    } else if (record.sourceType === 'material_inward') {
      const entry = inwardEntries.find((e) => e.id === record.sourceId)
      if (entry && entry.status === 'vehicle_arrived') {
        entry.status = 'documents_verified'
        entry.timeline.push({ at: nowIso(), status: 'documents_verified', by: OPERATOR, note: 'Without-PO inward approved' })
      }
    }
    pushActivity({ event: 'approval_actioned', recordType: 'approval', recordId: record.id, recordLabel: `${record.requestNumber} approved`, gate: 'Main Gate', status: 'approved' })
    return clone(record)
  },

  async rejectGateRequest(id, remarks) {
    await delay()
    if (!remarks?.trim()) throw new GateServiceError('Rejection remarks are required')
    const record = approvals.find((a) => a.id === id)
    if (!record) throw new GateServiceError('Approval request not found')
    if (record.status !== 'pending') throw new GateServiceError('Only pending requests can be actioned')
    record.status = 'rejected'
    record.actionedBy = OPERATOR
    record.actionedAt = nowIso()
    record.actionRemarks = remarks

    if (record.sourceType === 'visitor') {
      const visit = visits.find((v) => v.id === record.sourceId)
      if (visit && visit.status === 'waiting_approval') {
        visit.status = 'rejected'
        visit.approvalStatus = 'rejected'
        visit.approvalRemarks = remarks
        visit.approvalHistory.push({ at: nowIso(), by: OPERATOR, action: 'rejected', remarks })
      }
    } else if (record.sourceType === 'gate_pass') {
      const pass = gatePasses.find((p) => p.id === record.sourceId)
      if (pass && pass.status === 'pending_approval') {
        pass.status = 'rejected'
        pass.approvalStatus = 'rejected'
        pass.approvalRemarks = remarks
      }
    } else if (record.sourceType === 'material_outward') {
      const entry = outwardEntries.find((e) => e.id === record.sourceId)
      if (entry && !['released', 'cancelled'].includes(entry.status)) {
        entry.status = 'rejected'
        entry.approvalStatus = 'rejected'
        entry.rejectRemarks = remarks
        entry.timeline.push({ at: nowIso(), status: 'rejected', by: OPERATOR, note: remarks })
      }
    }
    return clone(record)
  },

  async sendBackGateRequest(id, remarks) {
    await delay()
    if (!remarks?.trim()) throw new GateServiceError('Send-back remarks are required')
    const record = approvals.find((a) => a.id === id)
    if (!record) throw new GateServiceError('Approval request not found')
    if (record.status !== 'pending') throw new GateServiceError('Only pending requests can be actioned')
    record.status = 'sent_back'
    record.actionedBy = OPERATOR
    record.actionedAt = nowIso()
    record.actionRemarks = remarks
    return clone(record)
  },
}
