import { prisma } from '../../../config/database.js'
import { InvalidStateError, NotFoundError } from '../../../utils/errors.js'
import {
  type GateListFilter,
  digitsOnly,
  matchesSearch,
  nextGateNumber,
  pushGateActivity,
  toJson,
  todayIsoDate,
} from '../shared/gate-shared.js'
import { mapExpected, mapVisit, mapVisitorProfile } from '../shared/gate-mappers.js'
import { getSettingsPayload } from '../settings/settings.service.js'

async function getVisitOrThrow(tenantId: string, id: string) {
  const visit = await prisma.gateVisitorVisit.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
  if (!visit) throw new NotFoundError('Visitor record not found')
  return visit
}

export async function listVisitors(tenantId: string, filter: GateListFilter = {}) {
  const rows = await prisma.gateVisitorVisit.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.gate ? { gate: filter.gate } : {}),
      ...(filter.date ? { visitDate: filter.date } : {}),
    },
    orderBy: [{ entryTime: 'desc' }, { createdAt: 'desc' }],
  })
  let mapped = rows.map(mapVisit)
  if (filter.search) {
    mapped = mapped.filter((v) =>
      matchesSearch(filter.search, v.entryNumber, v.visitorName, v.mobile, v.company, v.hostName, v.purpose),
    )
  }
  return mapped
}

export async function getVisitorById(tenantId: string, id: string) {
  return mapVisit(await getVisitOrThrow(tenantId, id))
}

export async function searchVisitorByMobile(tenantId: string, mobile: string) {
  const clean = digitsOnly(mobile)
  const profiles = await prisma.gateVisitorProfile.findMany({
    where: { tenantId, deletedAt: null },
  })
  const profile = profiles.find((p) => digitsOnly(p.mobile) === clean)
  return profile ? mapVisitorProfile(profile) : null
}

export async function listExpectedVisitors(tenantId: string, filter: GateListFilter = {}) {
  const rows = await prisma.gateExpectedVisitor.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.date ? { visitDate: filter.date } : {}),
    },
    orderBy: { visitDate: 'asc' },
  })
  let mapped = rows.map(mapExpected)
  if (filter.search) {
    mapped = mapped.filter((e) =>
      matchesSearch(filter.search, e.reference, e.visitorName, e.mobile, e.company, e.hostName),
    )
  }
  return mapped
}

export async function createExpectedVisitor(
  tenantId: string,
  input: {
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
  },
) {
  const reference = await nextGateNumber(tenantId, 'EXP', (t) =>
    prisma.gateExpectedVisitor.count({ where: { tenantId: t } }),
  )
  const row = await prisma.gateExpectedVisitor.create({
    data: {
      tenantId,
      reference,
      status: 'expected',
      ...input,
    },
  })
  return mapExpected(row)
}

export async function cancelExpectedVisitor(tenantId: string, id: string) {
  const record = await prisma.gateExpectedVisitor.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
  if (!record) throw new NotFoundError('Expected visitor not found')
  if (record.status !== 'expected') {
    throw new InvalidStateError('Only expected visits can be cancelled')
  }
  const updated = await prisma.gateExpectedVisitor.update({
    where: { id },
    data: { status: 'cancelled' },
  })
  return mapExpected(updated)
}

export async function createVisitorEntry(
  tenantId: string,
  actor: string,
  input: Record<string, unknown> & {
    visitorName: string
    mobile: string
    hostName: string
    department: string
    purpose: string
    gate: string
    visitorType: string
    visitorCount: number
    laptopCarried: boolean
    equipmentCarried: boolean
    bagCount: number
    safetyDeclarationAccepted: boolean
    ppeRequired: boolean
    ndaRequired: boolean
    hostApprovalRequired: boolean
    expectedVisitorId?: string
  },
) {
  const settings = await getSettingsPayload(tenantId)
  const clean = digitsOnly(input.mobile)
  const profiles = await prisma.gateVisitorProfile.findMany({
    where: { tenantId, deletedAt: null },
  })
  let profile = profiles.find((p) => digitsOnly(p.mobile) === clean) ?? null
  if (profile?.isBlacklisted) {
    throw new InvalidStateError(
      `Visitor is blacklisted (${profile.blacklistReason ?? 'no reason recorded'}). Request a blacklist override approval.`,
    )
  }

  const needsApproval = Boolean(input.hostApprovalRequired || settings.visitor.hostApprovalRequired)
  const now = new Date()
  const entryNumber = await nextGateNumber(tenantId, 'VIS', (t) =>
    prisma.gateVisitorVisit.count({ where: { tenantId: t } }),
  )

  const visit = await prisma.$transaction(async (tx) => {
    if (!profile) {
      profile = await tx.gateVisitorProfile.create({
        data: {
          tenantId,
          name: input.visitorName,
          mobile: input.mobile,
          company: (input.company as string | undefined) ?? null,
          lastHost: input.hostName,
          lastVehicleNumber: (input.vehicleNumber as string | undefined) ?? null,
          lastVisitAt: now,
          totalVisits: 1,
        },
      })
    } else {
      profile = await tx.gateVisitorProfile.update({
        where: { id: profile.id },
        data: {
          totalVisits: { increment: 1 },
          lastVisitAt: now,
          lastHost: input.hostName,
          lastVehicleNumber: (input.vehicleNumber as string | undefined) ?? profile.lastVehicleNumber,
          name: input.visitorName,
          company: (input.company as string | undefined) ?? profile.company,
        },
      })
    }

    if (input.expectedVisitorId) {
      await tx.gateExpectedVisitor.updateMany({
        where: { id: input.expectedVisitorId, tenantId, status: 'expected' },
        data: { status: 'arrived' },
      })
    }

    const row = await tx.gateVisitorVisit.create({
      data: {
        tenantId,
        entryNumber,
        status: needsApproval ? 'waiting_approval' : 'approved',
        visitorProfileId: profile.id,
        visitorName: input.visitorName,
        mobile: input.mobile,
        company: (input.company as string | undefined) ?? null,
        email: (input.email as string | undefined) ?? null,
        visitorType: input.visitorType,
        visitorCount: input.visitorCount,
        idType: (input.idType as string | undefined) ?? null,
        idReferenceMasked: (input.idReferenceMasked as string | undefined) ?? null,
        hostName: input.hostName,
        department: input.department,
        purpose: input.purpose,
        expectedDurationMinutes: (input.expectedDurationMinutes as number | undefined) ?? null,
        meetingLocation: (input.meetingLocation as string | undefined) ?? null,
        remarks: (input.remarks as string | undefined) ?? null,
        vehicleNumber: (input.vehicleNumber as string | undefined) ?? null,
        vehicleType: (input.vehicleType as string | undefined) ?? null,
        laptopCarried: input.laptopCarried,
        equipmentCarried: input.equipmentCarried,
        bagCount: input.bagCount,
        belongingsDescription: (input.belongingsDescription as string | undefined) ?? null,
        safetyDeclarationAccepted: input.safetyDeclarationAccepted,
        ppeRequired: input.ppeRequired,
        ndaRequired: input.ndaRequired,
        hostApprovalRequired: needsApproval,
        approvalStatus: needsApproval ? 'pending' : 'not_required',
        gate: input.gate,
        visitDate: todayIsoDate(),
        expectedArrival: ((input.expectedArrival as string | undefined) ?? '').trim() || 'ASAP',
        approvalHistoryJson: needsApproval
          ? [{ at: now.toISOString(), by: actor, action: 'approval_requested' }]
          : [],
        createdBy: actor,
        updatedBy: actor,
      },
    })

    if (needsApproval) {
      const requestNumber = await nextGateNumber(tenantId, 'GAR', (t) =>
        tx.gateApproval.count({ where: { tenantId: t } }),
      )
      await tx.gateApproval.create({
        data: {
          tenantId,
          requestNumber,
          requestType: 'walk_in_visitor',
          requestedBy: actor,
          subject: `${row.visitorName}${row.company ? ` — ${row.company}` : ''}`,
          reason: row.purpose,
          priority: 'normal',
          status: 'pending',
          sourceType: 'visitor',
          sourceId: row.id,
        },
      })
    }

    await pushGateActivity(tenantId, actor, {
      event: 'visitor_arrived',
      recordType: 'visitor',
      recordId: row.id,
      recordLabel: row.visitorName,
      company: row.company,
      gate: row.gate,
      status: row.status,
    }, tx)

    return row
  })

  return mapVisit(visit)
}

export async function updateVisitorEntry(
  tenantId: string,
  actor: string,
  id: string,
  input: Record<string, unknown>,
) {
  const visit = await getVisitOrThrow(tenantId, id)
  if (['exited', 'cancelled', 'rejected'].includes(visit.status)) {
    throw new InvalidStateError('Exited, cancelled or rejected visits are read-only')
  }
  const allowed = [
    'visitorName', 'mobile', 'company', 'email', 'visitorType', 'visitorCount',
    'idType', 'idReferenceMasked', 'hostName', 'department', 'purpose',
    'expectedDurationMinutes', 'meetingLocation', 'remarks', 'vehicleNumber',
    'vehicleType', 'laptopCarried', 'equipmentCarried', 'bagCount',
    'belongingsDescription', 'safetyDeclarationAccepted', 'ppeRequired',
    'ndaRequired', 'hostApprovalRequired', 'gate',
  ] as const
  const data: Record<string, unknown> = { updatedBy: actor }
  for (const key of allowed) {
    if (key in input) data[key] = input[key]
  }
  const updated = await prisma.gateVisitorVisit.update({
    where: { id },
    data,
  })
  return mapVisit(updated)
}

export async function requestVisitorApproval(tenantId: string, actor: string, id: string) {
  const visit = await getVisitOrThrow(tenantId, id)
  if (visit.status === 'waiting_approval') {
    throw new InvalidStateError('Approval is already pending')
  }
  const history = Array.isArray(visit.approvalHistoryJson) ? visit.approvalHistoryJson as unknown[] : []
  history.push({ at: new Date().toISOString(), by: actor, action: 'approval_requested' })

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.gateVisitorVisit.update({
      where: { id },
      data: {
        status: 'waiting_approval',
        approvalStatus: 'pending',
        approvalHistoryJson: toJson(history),
        updatedBy: actor,
      },
    })
    const requestNumber = await nextGateNumber(tenantId, 'GAR', (t) =>
      tx.gateApproval.count({ where: { tenantId: t } }),
    )
    await tx.gateApproval.create({
      data: {
        tenantId,
        requestNumber,
        requestType: 'walk_in_visitor',
        requestedBy: actor,
        subject: `${row.visitorName}${row.company ? ` — ${row.company}` : ''}`,
        reason: row.purpose,
        priority: 'normal',
        status: 'pending',
        sourceType: 'visitor',
        sourceId: row.id,
      },
    })
    return row
  })
  return mapVisit(updated)
}

export async function approveVisitor(tenantId: string, actor: string, id: string, remarks?: string) {
  const visit = await getVisitOrThrow(tenantId, id)
  if (!['waiting_approval', 'arrived', 'expected'].includes(visit.status)) {
    throw new InvalidStateError(`Cannot approve a visit in status "${visit.status}"`)
  }
  const now = new Date()
  const history = Array.isArray(visit.approvalHistoryJson) ? [...(visit.approvalHistoryJson as unknown[])] : []
  history.push({ at: now.toISOString(), by: actor, action: 'approved', remarks })

  const updated = await prisma.gateVisitorVisit.update({
    where: { id },
    data: {
      status: 'approved',
      approvalStatus: 'approved',
      approvedBy: actor,
      approvedAt: now,
      approvalRemarks: remarks ?? visit.approvalRemarks,
      approvalHistoryJson: toJson(history),
      updatedBy: actor,
    },
  })
  await pushGateActivity(tenantId, actor, {
    event: 'visitor_approved',
    recordType: 'visitor',
    recordId: updated.id,
    recordLabel: updated.visitorName,
    company: updated.company,
    gate: updated.gate,
    status: updated.status,
  })
  return mapVisit(updated)
}

export async function rejectVisitor(tenantId: string, actor: string, id: string, remarks: string) {
  if (!remarks?.trim()) throw new InvalidStateError('Rejection remarks are required')
  const visit = await getVisitOrThrow(tenantId, id)
  if (['inside', 'exited', 'cancelled'].includes(visit.status)) {
    throw new InvalidStateError(`Cannot reject a visit in status "${visit.status}"`)
  }
  const history = Array.isArray(visit.approvalHistoryJson) ? [...(visit.approvalHistoryJson as unknown[])] : []
  history.push({ at: new Date().toISOString(), by: actor, action: 'rejected', remarks })
  const updated = await prisma.gateVisitorVisit.update({
    where: { id },
    data: {
      status: 'rejected',
      approvalStatus: 'rejected',
      approvalRemarks: remarks,
      approvalHistoryJson: toJson(history),
      updatedBy: actor,
    },
  })
  return mapVisit(updated)
}

export async function recordVisitorEntry(tenantId: string, actor: string, id: string) {
  const visit = await getVisitOrThrow(tenantId, id)
  if (visit.status === 'inside') throw new InvalidStateError('Visitor is already inside')
  if (visit.status === 'rejected') {
    throw new InvalidStateError('Rejected visitors require an approval override before entry')
  }
  if (['exited', 'cancelled'].includes(visit.status)) {
    throw new InvalidStateError('This visit is closed — create a new entry instead')
  }
  if (visit.hostApprovalRequired && visit.approvalStatus !== 'approved') {
    throw new InvalidStateError('Host approval is required before entry can be allowed')
  }
  // Boundary: visitors never create attendance — status/entryTime only.
  const updated = await prisma.gateVisitorVisit.update({
    where: { id },
    data: { status: 'inside', entryTime: new Date(), updatedBy: actor },
  })
  await pushGateActivity(tenantId, actor, {
    event: 'visitor_entered',
    recordType: 'visitor',
    recordId: updated.id,
    recordLabel: updated.visitorName,
    company: updated.company,
    gate: updated.gate,
    status: 'inside',
  })
  return mapVisit(updated)
}

export async function recordVisitorExit(
  tenantId: string,
  actor: string,
  id: string,
  input: { badgeReturned: boolean; exitRemarks?: string },
) {
  const visit = await getVisitOrThrow(tenantId, id)
  if (visit.status === 'exited') {
    throw new InvalidStateError('Exit has already been recorded for this visit')
  }
  if (!visit.entryTime || !['inside', 'overstayed'].includes(visit.status)) {
    throw new InvalidStateError('Cannot record exit before entry')
  }
  const updated = await prisma.gateVisitorVisit.update({
    where: { id },
    data: {
      status: 'exited',
      exitTime: new Date(),
      badgeReturned: input.badgeReturned,
      exitRemarks: input.exitRemarks ?? null,
      updatedBy: actor,
    },
  })
  await pushGateActivity(tenantId, actor, {
    event: 'visitor_exited',
    recordType: 'visitor',
    recordId: updated.id,
    recordLabel: updated.visitorName,
    company: updated.company,
    gate: updated.gate,
    status: 'exited',
  })
  return mapVisit(updated)
}

export async function cancelVisitor(tenantId: string, actor: string, id: string, remarks?: string) {
  const visit = await getVisitOrThrow(tenantId, id)
  if (['inside', 'exited', 'cancelled'].includes(visit.status)) {
    throw new InvalidStateError(`Cannot cancel a visit in status "${visit.status}"`)
  }
  const history = Array.isArray(visit.approvalHistoryJson) ? [...(visit.approvalHistoryJson as unknown[])] : []
  history.push({ at: new Date().toISOString(), by: actor, action: 'cancelled', remarks })
  const updated = await prisma.gateVisitorVisit.update({
    where: { id },
    data: { status: 'cancelled', approvalHistoryJson: toJson(history), updatedBy: actor },
  })
  return mapVisit(updated)
}
