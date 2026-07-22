import { prisma } from '../../../config/database.js'
import {
  type GateListFilter,
  isGatePassOverdue,
  matchesSearch,
  minutesBetween,
  todayIsoDate,
} from '../shared/gate-shared.js'
import { mapActivity } from '../shared/gate-mappers.js'
import { ensureGateDefaults } from '../settings/settings.service.js'

export async function getGateDashboard(tenantId: string) {
  await ensureGateDefaults(tenantId)
  const today = todayIsoDate()

  const [
    visitorsInside,
    vehicles,
    expectedToday,
    expectedArrived,
    inwardWaiting,
    outwardAwaiting,
    gatePasses,
    contractorsInside,
    couriersPending,
    pendingApprovals,
  ] = await Promise.all([
    prisma.gateVisitorVisit.count({ where: { tenantId, deletedAt: null, status: 'inside' } }),
    prisma.gateVehicle.findMany({
      where: { tenantId, deletedAt: null },
      select: { status: true, entryTime: true },
    }),
    prisma.gateExpectedVisitor.count({
      where: { tenantId, deletedAt: null, visitDate: today, status: 'expected' },
    }),
    prisma.gateExpectedVisitor.count({
      where: { tenantId, deletedAt: null, visitDate: today, status: 'arrived' },
    }),
    prisma.gateMaterialInward.count({
      where: {
        tenantId,
        deletedAt: null,
        status: {
          in: [
            'vehicle_arrived',
            'documents_verified',
            'waiting_unloading',
            'waiting_store',
            'waiting_qc',
            'waiting_grn',
          ],
        },
      },
    }),
    prisma.gateMaterialOutward.count({
      where: {
        tenantId,
        deletedAt: null,
        status: {
          in: ['awaiting_vehicle', 'pending_approval', 'ready_for_gate', 'vehicle_inside', 'held'],
        },
      },
    }),
    prisma.gatePass.findMany({
      where: { tenantId, deletedAt: null },
      include: { items: true },
    }),
    prisma.gateContractorEntry.count({ where: { tenantId, deletedAt: null, status: 'inside' } }),
    prisma.gateCourierEntry.count({
      where: { tenantId, deletedAt: null, status: 'pending_handover' },
    }),
    prisma.gateApproval.count({ where: { tenantId, deletedAt: null, status: 'pending' } }),
  ])

  const vehiclesInside = vehicles.filter((v) =>
    ['allowed_inside', 'loading', 'unloading', 'ready_exit'].includes(v.status),
  ).length
  const waitingVehicles = vehicles.filter(
    (v) => v.status === 'waiting' && v.entryTime && minutesBetween(v.entryTime.toISOString()) > 30,
  )
  const overduePasses = gatePasses.filter((p) => isGatePassOverdue(p))
  const missingInduction = await prisma.gateContractorEntry.count({
    where: { tenantId, deletedAt: null, status: 'inside', safetyInductionDone: false },
  })

  const pulse: string[] = []
  if (visitorsInside > 0) {
    pulse.push(`${visitorsInside} visitor${visitorsInside === 1 ? ' is' : 's are'} currently inside.`)
  }
  if (waitingVehicles.length > 0) {
    pulse.push(
      `${waitingVehicles.length} vehicle${waitingVehicles.length === 1 ? ' has' : 's have'} been waiting for more than 30 minutes.`,
    )
  }
  if (overduePasses.length > 0) {
    pulse.push(
      `${overduePasses.length} returnable gate pass${overduePasses.length === 1 ? ' is' : 'es are'} overdue.`,
    )
  }
  if (expectedToday > 0) {
    pulse.push(
      `${expectedToday} expected visitor${expectedToday === 1 ? ' has' : 's have'} not arrived.`,
    )
  }
  if (couriersPending > 0) {
    pulse.push(
      `${couriersPending} courier parcel${couriersPending === 1 ? ' is' : 's are'} waiting for handover.`,
    )
  }
  if (pendingApprovals > 0) {
    pulse.push(
      `${pendingApprovals} gate approval${pendingApprovals === 1 ? ' is' : 's are'} pending action.`,
    )
  }
  if (missingInduction > 0) {
    pulse.push(
      `${missingInduction} contractor${missingInduction === 1 ? '' : 's'} inside without safety induction.`,
    )
  }

  return {
    visitorsInside,
    vehiclesInside,
    expectedVisitorsToday: expectedToday,
    expectedVisitorsArrived: expectedArrived,
    materialInwardWaiting: inwardWaiting,
    outwardAwaitingRelease: outwardAwaiting,
    overdueReturnables: overduePasses.length,
    contractorsInside,
    couriersPendingHandover: couriersPending,
    pendingApprovals,
    vehiclesWaitingOver30Min: waitingVehicles.length,
    pulse,
  }
}

export async function getGateRegister(tenantId: string, filter: GateListFilter = {}) {
  await ensureGateDefaults(tenantId)
  const [visits, vehicles, inwards, outwards, contractors, couriers] = await Promise.all([
    prisma.gateVisitorVisit.findMany({ where: { tenantId, deletedAt: null } }),
    prisma.gateVehicle.findMany({ where: { tenantId, deletedAt: null } }),
    prisma.gateMaterialInward.findMany({ where: { tenantId, deletedAt: null } }),
    prisma.gateMaterialOutward.findMany({ where: { tenantId, deletedAt: null } }),
    prisma.gateContractorEntry.findMany({ where: { tenantId, deletedAt: null } }),
    prisma.gateCourierEntry.findMany({ where: { tenantId, deletedAt: null } }),
  ])

  type Row = {
    id: string
    tenantId: string
    entryNumber: string
    status: string
    createdAt: string
    createdBy: string
    updatedAt: string
    updatedBy: string
    entryType: string
    time: string
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

  const rows: Row[] = []

  for (const v of visits) {
    rows.push({
      id: v.id,
      tenantId: v.tenantId,
      entryNumber: v.entryNumber,
      status: v.status,
      createdAt: v.createdAt.toISOString(),
      createdBy: v.createdBy,
      updatedAt: v.updatedAt.toISOString(),
      updatedBy: v.updatedBy,
      entryType: 'visitor',
      time: (v.entryTime ?? v.createdAt).toISOString(),
      subject: v.visitorName,
      company: v.company ?? undefined,
      purpose: v.purpose,
      gate: v.gate,
      entryBy: v.createdBy,
      entryTime: v.entryTime?.toISOString() ?? null,
      exitTime: v.exitTime?.toISOString() ?? null,
      isInside: v.status === 'inside',
    })
  }
  for (const v of vehicles) {
    rows.push({
      id: v.id,
      tenantId: v.tenantId,
      entryNumber: v.entryNumber,
      status: v.status,
      createdAt: v.createdAt.toISOString(),
      createdBy: v.createdBy,
      updatedAt: v.updatedAt.toISOString(),
      updatedBy: v.updatedBy,
      entryType: 'vehicle',
      time: (v.entryTime ?? v.createdAt).toISOString(),
      subject: v.vehicleNumber,
      company: v.companyName ?? undefined,
      purpose: v.purpose,
      relatedDocument: v.relatedDocument ?? undefined,
      gate: v.gate,
      entryBy: v.createdBy,
      entryTime: v.entryTime?.toISOString() ?? null,
      exitTime: v.exitTime?.toISOString() ?? null,
      isInside: ['allowed_inside', 'loading', 'unloading', 'ready_exit'].includes(v.status),
    })
  }
  for (const e of inwards) {
    rows.push({
      id: e.id,
      tenantId: e.tenantId,
      entryNumber: e.entryNumber,
      status: e.status,
      createdAt: e.createdAt.toISOString(),
      createdBy: e.createdBy,
      updatedAt: e.updatedAt.toISOString(),
      updatedBy: e.updatedBy,
      entryType: 'material_inward',
      time: (e.arrivalTime ?? e.createdAt).toISOString(),
      subject: e.materialSummary,
      company: e.vendorName ?? undefined,
      purpose: e.inwardType.replace(/_/g, ' '),
      relatedDocument: e.poNumber ?? e.challanNumber ?? undefined,
      gate: e.gate,
      entryBy: e.createdBy,
      entryTime: e.arrivalTime?.toISOString() ?? null,
      exitTime: null,
      isInside: !['accepted', 'rejected', 'closed', 'cancelled'].includes(e.status),
    })
  }
  for (const e of outwards) {
    rows.push({
      id: e.id,
      tenantId: e.tenantId,
      entryNumber: e.entryNumber,
      status: e.status,
      createdAt: e.createdAt.toISOString(),
      createdBy: e.createdBy,
      updatedAt: e.updatedAt.toISOString(),
      updatedBy: e.updatedBy,
      entryType: 'material_outward',
      time: (e.plannedTime ?? e.createdAt).toISOString(),
      subject: e.materialSummary,
      company: e.partyName ?? undefined,
      purpose: e.outwardType.replace(/_/g, ' '),
      relatedDocument: e.documentNumber,
      gate: e.gate,
      entryBy: e.createdBy,
      entryTime: null,
      exitTime: e.releasedAt?.toISOString() ?? null,
      isInside: e.status === 'vehicle_inside',
    })
  }
  for (const c of contractors) {
    rows.push({
      id: c.id,
      tenantId: c.tenantId,
      entryNumber: c.entryNumber,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
      createdBy: c.createdBy,
      updatedAt: c.updatedAt.toISOString(),
      updatedBy: c.updatedBy,
      entryType: 'contractor',
      time: (c.entryTime ?? c.createdAt).toISOString(),
      subject: c.workerName,
      company: c.contractorCompany,
      purpose: c.purpose,
      relatedDocument: c.workReference ?? undefined,
      gate: c.gate,
      entryBy: c.createdBy,
      entryTime: c.entryTime?.toISOString() ?? null,
      exitTime: c.exitTime?.toISOString() ?? null,
      isInside: c.status === 'inside',
    })
  }
  for (const c of couriers) {
    rows.push({
      id: c.id,
      tenantId: c.tenantId,
      entryNumber: c.entryNumber,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
      createdBy: c.createdBy,
      updatedAt: c.updatedAt.toISOString(),
      updatedBy: c.updatedBy,
      entryType: 'courier',
      time: (c.receivedTime ?? c.dispatchTime ?? c.createdAt).toISOString(),
      subject: `${c.courierCompany}${c.trackingNumber ? ` — ${c.trackingNumber}` : ''}`,
      company: c.senderName ?? undefined,
      purpose: c.direction === 'incoming' ? 'Incoming parcel' : 'Outgoing parcel',
      relatedDocument: c.trackingNumber ?? undefined,
      gate: c.gate,
      entryBy: c.createdBy,
      entryTime: c.receivedTime?.toISOString() ?? null,
      exitTime: (c.handoverTime ?? c.dispatchTime)?.toISOString() ?? null,
      isInside: c.status === 'pending_handover',
    })
  }

  let filtered = rows
  if (filter.entryType) filtered = filtered.filter((r) => r.entryType === filter.entryType)
  if (filter.status) filtered = filtered.filter((r) => r.status === filter.status)
  if (filter.gate) filtered = filtered.filter((r) => r.gate === filter.gate)
  if (filter.company) filtered = filtered.filter((r) => matchesSearch(filter.company, r.company))
  if (filter.date) filtered = filtered.filter((r) => r.time.slice(0, 10) === filter.date)
  if (filter.insideOnly) filtered = filtered.filter((r) => r.isInside)
  if (filter.missingExitOnly) {
    filtered = filtered.filter((r) => r.entryTime && !r.exitTime && r.isInside)
  }
  if (filter.search) {
    filtered = filtered.filter((r) =>
      matchesSearch(filter.search, r.entryNumber, r.subject, r.company, r.purpose, r.relatedDocument),
    )
  }
  return filtered.sort((a, b) => b.time.localeCompare(a.time))
}

export async function getGateActivities(tenantId: string, limit = 20) {
  await ensureGateDefaults(tenantId)
  const rows = await prisma.gateActivity.findMany({
    where: { tenantId },
    orderBy: { time: 'desc' },
    take: limit,
  })
  return rows.map(mapActivity)
}
