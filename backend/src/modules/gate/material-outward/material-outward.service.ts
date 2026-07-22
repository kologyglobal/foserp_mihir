import { prisma } from '../../../config/database.js'
import { InvalidStateError, NotFoundError } from '../../../utils/errors.js'
import {
  DEFAULT_OUTWARD_CHECKLIST,
  type GateListFilter,
  matchesSearch,
  pushGateActivity,
  toJson,
} from '../shared/gate-shared.js'
import { mapOutward } from '../shared/gate-mappers.js'
import { getSettingsPayload } from '../settings/settings.service.js'

async function getOrThrow(tenantId: string, id: string) {
  const row = await prisma.gateMaterialOutward.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
  if (!row) throw new NotFoundError('Material outward entry not found')
  return row
}

export async function listMaterialOutward(tenantId: string, filter: GateListFilter = {}) {
  const rows = await prisma.gateMaterialOutward.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.gate ? { gate: filter.gate } : {}),
    },
    orderBy: [{ plannedTime: 'desc' }, { createdAt: 'desc' }],
  })
  let mapped = rows.map(mapOutward)
  if (filter.search) {
    mapped = mapped.filter((e) =>
      matchesSearch(
        filter.search,
        e.entryNumber,
        e.documentNumber,
        e.partyName,
        e.vehicleNumber,
        e.materialSummary,
      ),
    )
  }
  return mapped
}

export async function getMaterialOutwardById(tenantId: string, id: string) {
  return mapOutward(await getOrThrow(tenantId, id))
}

export async function searchOutwardDocuments(tenantId: string, query: string) {
  const term = query.trim().toLowerCase()
  if (!term) return []
  const rows = await prisma.gateMaterialOutward.findMany({
    where: {
      tenantId,
      deletedAt: null,
      status: { notIn: ['released', 'rejected', 'cancelled'] },
    },
  })
  return rows
    .filter((e) =>
      [e.documentNumber, e.partyName, e.vehicleNumber, e.entryNumber, e.materialSummary].some((v) =>
        v?.toLowerCase().includes(term),
      ),
    )
    .map((e) => ({
      documentType: e.documentType,
      documentNumber: e.documentNumber,
      partyName: e.partyName ?? undefined,
      materialSummary: e.materialSummary,
      packagesExpected: e.packagesExpected,
      approved: e.documentApproved && e.approvalStatus === 'approved',
      outwardType: e.outwardType,
      existingOutwardId: e.id,
    }))
}

export async function verifyMaterialOutward(
  tenantId: string,
  actor: string,
  id: string,
  input: {
    checklist: Record<string, boolean>
    vehicleNumber?: string
    driverName?: string
    sealNumber?: string
    packagesVerified?: number
  },
) {
  const entry = await getOrThrow(tenantId, id)
  if (['released', 'rejected', 'cancelled'].includes(entry.status)) {
    throw new InvalidStateError('Released, rejected or cancelled outward entries are read-only')
  }
  const checklist = {
    ...DEFAULT_OUTWARD_CHECKLIST,
    ...(typeof entry.checklistJson === 'object' && entry.checklistJson ? entry.checklistJson as object : {}),
    ...input.checklist,
  }
  const updated = await prisma.gateMaterialOutward.update({
    where: { id },
    data: {
      checklistJson: toJson(checklist),
      vehicleNumber: input.vehicleNumber ?? entry.vehicleNumber,
      driverName: input.driverName ?? entry.driverName,
      sealNumber: input.sealNumber ?? entry.sealNumber,
      packagesVerified: input.packagesVerified ?? entry.packagesVerified,
      updatedBy: actor,
    },
  })
  return mapOutward(updated)
}

export async function holdMaterialOutward(
  tenantId: string,
  actor: string,
  id: string,
  remarks: string,
) {
  if (!remarks?.trim()) throw new InvalidStateError('Hold remarks are required')
  const entry = await getOrThrow(tenantId, id)
  if (['released', 'rejected', 'cancelled'].includes(entry.status)) {
    throw new InvalidStateError('Released, rejected or cancelled outward entries are read-only')
  }
  const timeline = Array.isArray(entry.timelineJson) ? [...(entry.timelineJson as unknown[])] : []
  timeline.push({ at: new Date().toISOString(), status: 'held', by: actor, note: remarks })
  const updated = await prisma.gateMaterialOutward.update({
    where: { id },
    data: {
      status: 'held',
      holdRemarks: remarks,
      timelineJson: toJson(timeline),
      updatedBy: actor,
    },
  })
  return mapOutward(updated)
}

export async function reportMaterialMismatch(
  tenantId: string,
  actor: string,
  id: string,
  remarks: string,
) {
  if (!remarks?.trim()) throw new InvalidStateError('Mismatch remarks are required')
  const entry = await getOrThrow(tenantId, id)
  if (['released', 'rejected', 'cancelled'].includes(entry.status)) {
    throw new InvalidStateError('Released, rejected or cancelled outward entries are read-only')
  }
  const timeline = Array.isArray(entry.timelineJson) ? [...(entry.timelineJson as unknown[])] : []
  timeline.push({ at: new Date().toISOString(), status: 'mismatch', by: actor, note: remarks })
  const updated = await prisma.gateMaterialOutward.update({
    where: { id },
    data: {
      status: 'mismatch',
      mismatchRemarks: remarks,
      timelineJson: toJson(timeline),
      updatedBy: actor,
    },
  })
  return mapOutward(updated)
}

/** Verify/release only — never issues stock. */
export async function releaseMaterialOutward(tenantId: string, actor: string, id: string) {
  const settings = await getSettingsPayload(tenantId)
  const entry = await getOrThrow(tenantId, id)
  if (entry.status === 'released') {
    throw new InvalidStateError('This outward entry has already been released')
  }
  if (['rejected', 'cancelled'].includes(entry.status)) {
    throw new InvalidStateError('Rejected or cancelled outward entries cannot be released')
  }
  if (!entry.documentApproved || entry.approvalStatus !== 'approved') {
    throw new InvalidStateError('Cannot release without an approved source document')
  }
  if (settings.material.releaseChecklistRequired) {
    const checklist = (entry.checklistJson ?? DEFAULT_OUTWARD_CHECKLIST) as Record<string, boolean>
    const incomplete = Object.entries(checklist).filter(([, done]) => !done)
    if (incomplete.length > 0) {
      throw new InvalidStateError(
        `Release checklist is incomplete (${incomplete.length} item${incomplete.length === 1 ? '' : 's'} pending)`,
      )
    }
  }
  const timeline = Array.isArray(entry.timelineJson) ? [...(entry.timelineJson as unknown[])] : []
  timeline.push({ at: new Date().toISOString(), status: 'released', by: actor })
  const updated = await prisma.gateMaterialOutward.update({
    where: { id },
    data: {
      status: 'released',
      releasedAt: new Date(),
      releasedBy: actor,
      timelineJson: toJson(timeline),
      updatedBy: actor,
    },
  })
  await pushGateActivity(tenantId, actor, {
    event: 'outward_released',
    recordType: 'material_outward',
    recordId: updated.id,
    recordLabel: `${updated.documentNumber} — ${updated.materialSummary}`,
    company: updated.partyName,
    gate: updated.gate,
    status: 'released',
  })
  return mapOutward(updated)
}

export async function rejectMaterialOutward(
  tenantId: string,
  actor: string,
  id: string,
  remarks: string,
) {
  if (!remarks?.trim()) throw new InvalidStateError('Rejection remarks are required')
  const entry = await getOrThrow(tenantId, id)
  if (['released', 'rejected', 'cancelled'].includes(entry.status)) {
    throw new InvalidStateError('Released, rejected or cancelled outward entries are read-only')
  }
  const timeline = Array.isArray(entry.timelineJson) ? [...(entry.timelineJson as unknown[])] : []
  timeline.push({ at: new Date().toISOString(), status: 'rejected', by: actor, note: remarks })
  const updated = await prisma.gateMaterialOutward.update({
    where: { id },
    data: {
      status: 'rejected',
      rejectRemarks: remarks,
      timelineJson: toJson(timeline),
      updatedBy: actor,
    },
  })
  return mapOutward(updated)
}
