import { prisma } from '../../../config/database.js'
import { InvalidStateError, NotFoundError } from '../../../utils/errors.js'
import {
  type GateListFilter,
  matchesSearch,
  nextGateNumber,
  pushGateActivity,
  toJson,
} from '../shared/gate-shared.js'
import { mapVehicle } from '../shared/gate-mappers.js'

async function getOrThrow(tenantId: string, id: string) {
  const row = await prisma.gateVehicle.findFirst({ where: { id, tenantId, deletedAt: null } })
  if (!row) throw new NotFoundError('Vehicle record not found')
  return row
}

export async function listVehicles(tenantId: string, filter: GateListFilter = {}) {
  const rows = await prisma.gateVehicle.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.gate ? { gate: filter.gate } : {}),
    },
    orderBy: [{ entryTime: 'desc' }, { createdAt: 'desc' }],
  })
  let mapped = rows.map(mapVehicle)
  if (filter.search) {
    mapped = mapped.filter((v) =>
      matchesSearch(
        filter.search,
        v.entryNumber,
        v.vehicleNumber,
        v.companyName,
        v.driverName,
        v.purpose,
        v.relatedDocument,
      ),
    )
  }
  return mapped
}

export async function getVehicleById(tenantId: string, id: string) {
  return mapVehicle(await getOrThrow(tenantId, id))
}

export async function createVehicleEntry(
  tenantId: string,
  actor: string,
  input: {
    vehicleNumber: string
    vehicleType: string
    purpose: string
    companyName?: string
    transporter?: string
    driverName: string
    driverMobile?: string
    licenceVerified: string
    relatedDocument?: string
    gate: string
    plannedLocation?: string
    sealNumber?: string
    remarks?: string
    markArrived?: boolean
  },
) {
  const now = new Date()
  const status = input.markArrived ? 'arrived' : 'expected'
  const entryNumber = await nextGateNumber(tenantId, 'VEH', (t) =>
    prisma.gateVehicle.count({ where: { tenantId: t } }),
  )
  const { markArrived: _m, ...rest } = input
  const row = await prisma.gateVehicle.create({
    data: {
      tenantId,
      entryNumber,
      status,
      currentLocation: input.markArrived ? 'Gate' : null,
      timelineJson: [{ at: now.toISOString(), status, by: actor }],
      createdBy: actor,
      updatedBy: actor,
      ...rest,
    },
  })
  if (input.markArrived) {
    await pushGateActivity(tenantId, actor, {
      event: 'vehicle_arrived',
      recordType: 'vehicle',
      recordId: row.id,
      recordLabel: row.vehicleNumber,
      company: row.companyName,
      gate: row.gate,
      status: row.status,
    })
  }
  return mapVehicle(row)
}

export async function markVehicleArrived(tenantId: string, actor: string, id: string) {
  const vehicle = await getOrThrow(tenantId, id)
  if (vehicle.status !== 'expected') {
    throw new InvalidStateError(`Vehicle is already "${vehicle.status}"`)
  }
  const timeline = Array.isArray(vehicle.timelineJson) ? [...(vehicle.timelineJson as unknown[])] : []
  timeline.push({ at: new Date().toISOString(), status: 'arrived', by: actor })
  const updated = await prisma.gateVehicle.update({
    where: { id },
    data: {
      status: 'arrived',
      currentLocation: 'Gate',
      timelineJson: toJson(timeline),
      updatedBy: actor,
    },
  })
  await pushGateActivity(tenantId, actor, {
    event: 'vehicle_arrived',
    recordType: 'vehicle',
    recordId: updated.id,
    recordLabel: updated.vehicleNumber,
    company: updated.companyName,
    gate: updated.gate,
    status: 'arrived',
  })
  return mapVehicle(updated)
}

export async function allowVehicleInside(tenantId: string, actor: string, id: string) {
  const vehicle = await getOrThrow(tenantId, id)
  if (vehicle.status === 'rejected') {
    throw new InvalidStateError('Rejected vehicles need an override approval before entry')
  }
  if (!['arrived', 'waiting'].includes(vehicle.status)) {
    throw new InvalidStateError(`Cannot allow a vehicle inside from status "${vehicle.status}"`)
  }
  const timeline = Array.isArray(vehicle.timelineJson) ? [...(vehicle.timelineJson as unknown[])] : []
  timeline.push({ at: new Date().toISOString(), status: 'allowed_inside', by: actor })
  const updated = await prisma.gateVehicle.update({
    where: { id },
    data: {
      status: 'allowed_inside',
      entryTime: new Date(),
      currentLocation: vehicle.plannedLocation ?? 'Inside plant',
      timelineJson: toJson(timeline),
      updatedBy: actor,
    },
  })
  return mapVehicle(updated)
}

export async function updateVehicleLocation(
  tenantId: string,
  actor: string,
  id: string,
  location: string,
  status?: string,
) {
  const vehicle = await getOrThrow(tenantId, id)
  if (['exited', 'cancelled', 'rejected'].includes(vehicle.status)) {
    throw new InvalidStateError('Exited, rejected or cancelled vehicles are read-only')
  }
  const timeline = Array.isArray(vehicle.timelineJson) ? [...(vehicle.timelineJson as unknown[])] : []
  const data: Record<string, unknown> = {
    currentLocation: location,
    updatedBy: actor,
  }
  if (status) {
    data.status = status
    timeline.push({ at: new Date().toISOString(), status, by: actor, note: location })
    data.timelineJson = toJson(timeline)
  }
  const updated = await prisma.gateVehicle.update({
    where: { id },
    data: data as Parameters<typeof prisma.gateVehicle.update>[0]['data'],
  })
  return mapVehicle(updated)
}

export async function markVehicleReadyForExit(tenantId: string, actor: string, id: string) {
  const vehicle = await getOrThrow(tenantId, id)
  if (!['allowed_inside', 'loading', 'unloading'].includes(vehicle.status)) {
    throw new InvalidStateError(`Cannot mark ready-for-exit from status "${vehicle.status}"`)
  }
  const timeline = Array.isArray(vehicle.timelineJson) ? [...(vehicle.timelineJson as unknown[])] : []
  timeline.push({ at: new Date().toISOString(), status: 'ready_exit', by: actor })
  const updated = await prisma.gateVehicle.update({
    where: { id },
    data: { status: 'ready_exit', timelineJson: toJson(timeline), updatedBy: actor },
  })
  return mapVehicle(updated)
}

export async function recordVehicleExit(
  tenantId: string,
  actor: string,
  id: string,
  remarks?: string,
) {
  const vehicle = await getOrThrow(tenantId, id)
  if (vehicle.status === 'exited') {
    throw new InvalidStateError('Exit has already been recorded for this vehicle')
  }
  if (!vehicle.entryTime) {
    throw new InvalidStateError('Cannot record exit before the vehicle has entered')
  }
  const timeline = Array.isArray(vehicle.timelineJson) ? [...(vehicle.timelineJson as unknown[])] : []
  timeline.push({ at: new Date().toISOString(), status: 'exited', by: actor, note: remarks })
  const updated = await prisma.gateVehicle.update({
    where: { id },
    data: {
      status: 'exited',
      exitTime: new Date(),
      exitRemarks: remarks ?? null,
      timelineJson: toJson(timeline),
      updatedBy: actor,
    },
  })
  await pushGateActivity(tenantId, actor, {
    event: 'vehicle_exited',
    recordType: 'vehicle',
    recordId: updated.id,
    recordLabel: updated.vehicleNumber,
    company: updated.companyName,
    gate: updated.gate,
    status: 'exited',
  })
  return mapVehicle(updated)
}
