import { prisma } from '../../../config/database.js'
import { InvalidStateError, NotFoundError } from '../../../utils/errors.js'
import {
  type GateListFilter,
  matchesSearch,
  nextGateNumber,
  pushGateActivity,
} from '../shared/gate-shared.js'
import { mapCourier } from '../shared/gate-mappers.js'

async function getOrThrow(tenantId: string, id: string) {
  const row = await prisma.gateCourierEntry.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
  if (!row) throw new NotFoundError('Courier entry not found')
  return row
}

export async function listCouriers(tenantId: string, filter: GateListFilter = {}) {
  const rows = await prisma.gateCourierEntry.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(filter.status ? { status: filter.status } : {}),
    },
    orderBy: { createdAt: 'desc' },
  })
  let mapped = rows.map(mapCourier)
  if (filter.search) {
    mapped = mapped.filter((c) =>
      matchesSearch(
        filter.search,
        c.entryNumber,
        c.courierCompany,
        c.trackingNumber,
        c.senderName,
        c.recipientEmployee,
        c.parcelDescription,
      ),
    )
  }
  return mapped
}

export async function getCourierById(tenantId: string, id: string) {
  return mapCourier(await getOrThrow(tenantId, id))
}

export async function createCourierEntry(
  tenantId: string,
  actor: string,
  input: {
    direction: 'incoming' | 'outgoing'
    courierCompany: string
    trackingNumber?: string
    senderName?: string
    recipientEmployee?: string
    department?: string
    parcelType?: string
    parcelDescription?: string
    charges?: number
    remarks?: string
    gate: string
  },
) {
  const now = new Date()
  const entryNumber = await nextGateNumber(tenantId, 'COUR', (t) =>
    prisma.gateCourierEntry.count({ where: { tenantId: t } }),
  )
  const status = input.direction === 'incoming' ? 'pending_handover' : 'dispatched'
  const row = await prisma.gateCourierEntry.create({
    data: {
      tenantId,
      entryNumber,
      status,
      receivedTime: input.direction === 'incoming' ? now : null,
      receivedBy: input.direction === 'incoming' ? actor : null,
      dispatchTime: input.direction === 'outgoing' ? now : null,
      createdBy: actor,
      updatedBy: actor,
      ...input,
    },
  })
  await pushGateActivity(tenantId, actor, {
    event: input.direction === 'incoming' ? 'courier_received' : 'courier_handed_over',
    recordType: 'courier',
    recordId: row.id,
    recordLabel: `${row.courierCompany}${row.trackingNumber ? ` ${row.trackingNumber}` : ''}`,
    company: row.senderName,
    gate: row.gate,
    status: row.status,
  })
  return mapCourier(row)
}

export async function markCourierHandedOver(
  tenantId: string,
  actor: string,
  id: string,
  handedOverTo: string,
) {
  const record = await getOrThrow(tenantId, id)
  if (record.direction !== 'incoming') {
    throw new InvalidStateError('Handover applies to incoming parcels only')
  }
  if (record.status === 'handed_over') {
    throw new InvalidStateError('Parcel has already been handed over')
  }
  if (!handedOverTo.trim()) {
    throw new InvalidStateError('Receiver name is required for handover')
  }
  const updated = await prisma.gateCourierEntry.update({
    where: { id },
    data: {
      status: 'handed_over',
      handoverTime: new Date(),
      handedOverTo,
      updatedBy: actor,
    },
  })
  await pushGateActivity(tenantId, actor, {
    event: 'courier_handed_over',
    recordType: 'courier',
    recordId: updated.id,
    recordLabel: `${updated.courierCompany}${updated.trackingNumber ? ` ${updated.trackingNumber}` : ''}`,
    company: updated.senderName,
    gate: updated.gate,
    status: 'handed_over',
  })
  return mapCourier(updated)
}
