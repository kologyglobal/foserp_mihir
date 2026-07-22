import { prisma } from '../../../config/database.js'
import { InvalidStateError, NotFoundError } from '../../../utils/errors.js'
import {
  type GateListFilter,
  matchesSearch,
  nextGateNumber,
  pushGateActivity,
  toJson,
} from '../shared/gate-shared.js'
import { mapInward } from '../shared/gate-mappers.js'
import { getSettingsPayload } from '../settings/settings.service.js'

async function getOrThrow(tenantId: string, id: string) {
  const row = await prisma.gateMaterialInward.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
  if (!row) throw new NotFoundError('Material inward entry not found')
  return row
}

export async function listMaterialInward(tenantId: string, filter: GateListFilter = {}) {
  const rows = await prisma.gateMaterialInward.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.gate ? { gate: filter.gate } : {}),
    },
    orderBy: [{ arrivalTime: 'desc' }, { createdAt: 'desc' }],
  })
  let mapped = rows.map(mapInward)
  if (filter.search) {
    mapped = mapped.filter((e) =>
      matchesSearch(
        filter.search,
        e.entryNumber,
        e.vendorName,
        e.poNumber,
        e.challanNumber,
        e.vehicleNumber,
        e.materialSummary,
      ),
    )
  }
  return mapped
}

export async function getMaterialInwardById(tenantId: string, id: string) {
  return mapInward(await getOrThrow(tenantId, id))
}

/** Physical arrival only — never posts inventory / GRN. */
export async function createMaterialInward(
  tenantId: string,
  actor: string,
  input: {
    inwardType: string
    vendorName?: string
    poNumber?: string
    challanNumber?: string
    invoiceNumber?: string
    lrNumber?: string
    vehicleNumber?: string
    vehicleType?: string
    transporter?: string
    driverName?: string
    driverMobile?: string
    sealNumber?: string
    materialSummary: string
    packages: number
    approxQty?: number
    uom?: string
    grossWeight?: string
    warehouse?: string
    unloadingLocation?: string
    remarks?: string
    gate: string
    saveAsDraft?: boolean
  },
) {
  const settings = await getSettingsPayload(tenantId)
  if (settings.material.vehicleNumberRequired && !input.vehicleNumber?.trim() && !input.saveAsDraft) {
    throw new InvalidStateError('Vehicle number is required by gate settings')
  }
  if (input.inwardType === 'without_po' && !settings.material.allowInwardWithoutPo) {
    throw new InvalidStateError('Inward without PO is disabled in gate settings')
  }

  const now = new Date()
  const status = input.saveAsDraft ? 'draft' : 'vehicle_arrived'
  const entryNumber = await nextGateNumber(tenantId, 'MIN', (t) =>
    prisma.gateMaterialInward.count({ where: { tenantId: t } }),
  )
  const { saveAsDraft: _d, ...rest } = input

  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.gateMaterialInward.create({
      data: {
        tenantId,
        entryNumber,
        status,
        arrivalTime: input.saveAsDraft ? null : now,
        linesJson: [],
        linkedGrnNumber: null,
        linkedQcNumber: null,
        timelineJson: [{ at: now.toISOString(), status, by: actor }],
        createdBy: actor,
        updatedBy: actor,
        ...rest,
      },
    })

    if (!input.saveAsDraft) {
      await pushGateActivity(tenantId, actor, {
        event: 'material_inward_registered',
        recordType: 'material_inward',
        recordId: created.id,
        recordLabel: created.materialSummary,
        company: created.vendorName,
        gate: created.gate,
        status,
      }, tx)
    }

    if (input.inwardType === 'without_po' && !input.saveAsDraft) {
      const requestNumber = await nextGateNumber(tenantId, 'GAR', (t) =>
        tx.gateApproval.count({ where: { tenantId: t } }),
      )
      await tx.gateApproval.create({
        data: {
          tenantId,
          requestNumber,
          requestType: 'inward_without_po',
          requestedBy: actor,
          subject: `${created.vendorName ?? 'Unknown vendor'} — ${created.materialSummary}`,
          reason: created.remarks ?? 'Material inward without purchase order',
          priority: 'high',
          status: 'pending',
          sourceType: 'material_inward',
          sourceId: created.id,
        },
      })
    }

    return created
  })

  return mapInward(row)
}

export async function updateMaterialInwardStatus(
  tenantId: string,
  actor: string,
  id: string,
  status: string,
  note?: string,
) {
  const entry = await getOrThrow(tenantId, id)
  if (['closed', 'cancelled', 'rejected'].includes(entry.status)) {
    throw new InvalidStateError('Closed, rejected or cancelled inward entries are read-only')
  }
  const timeline = Array.isArray(entry.timelineJson) ? [...(entry.timelineJson as unknown[])] : []
  timeline.push({ at: new Date().toISOString(), status, by: actor, note })
  const updated = await prisma.gateMaterialInward.update({
    where: { id },
    data: {
      status,
      arrivalTime:
        status === 'vehicle_arrived' && !entry.arrivalTime ? new Date() : entry.arrivalTime,
      timelineJson: toJson(timeline),
      updatedBy: actor,
    },
  })
  return mapInward(updated)
}

export async function cancelMaterialInward(
  tenantId: string,
  actor: string,
  id: string,
  remarks: string,
) {
  if (!remarks?.trim()) throw new InvalidStateError('Cancellation remarks are required')
  const entry = await getOrThrow(tenantId, id)
  if (['closed', 'cancelled', 'accepted'].includes(entry.status)) {
    throw new InvalidStateError(`Cannot cancel an entry in status "${entry.status}"`)
  }
  const timeline = Array.isArray(entry.timelineJson) ? [...(entry.timelineJson as unknown[])] : []
  timeline.push({ at: new Date().toISOString(), status: 'cancelled', by: actor, note: remarks })
  const updated = await prisma.gateMaterialInward.update({
    where: { id },
    data: { status: 'cancelled', timelineJson: toJson(timeline), updatedBy: actor },
  })
  return mapInward(updated)
}
