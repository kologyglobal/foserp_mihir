import type { Request } from 'express'
import type {
  DispatchPackingSessionStatus,
  Prisma,
} from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { ConflictError, InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { getPagination, type PaginationInput } from '../../../utils/pagination.js'
import { isPositive, toDecimal } from '../../inventory/shared/quantity.helpers.js'
import { n, roundQty } from '../shared/dispatch-qty.js'
import { netPickedForLine } from '../picking/dispatch-pick-list.service.js'
import * as outboundRepo from '../outbound/outbound-dispatch.repository.js'

export interface CreatePackingSessionInput {
  idempotencyKey?: string
  plannedPackingDate?: string
  assignedTo?: string
  packingStation?: string
  remarks?: string
}

export interface PackingShortageInput {
  pickLineId: string
  quantity: number
  reasonCode?: string
  remarks?: string
  idempotencyKey?: string
}

export interface CreatePackageTypeInput {
  code: string
  name: string
  description?: string
  defaultTareWeight?: number
  defaultLength?: number
  defaultWidth?: number
  defaultHeight?: number
  weightUomId?: string
  dimensionUomId?: string
  reusable?: boolean
  active?: boolean
}

export interface UpdatePackageTypeInput {
  name?: string
  description?: string | null
  defaultTareWeight?: number | null
  defaultLength?: number | null
  defaultWidth?: number | null
  defaultHeight?: number | null
  weightUomId?: string | null
  dimensionUomId?: string | null
  reusable?: boolean
  active?: boolean
}

function userId(req: Request): string {
  return req.context?.userId ?? ''
}

async function netPackedForPickLine(tenantId: string, pickLineId: string): Promise<number> {
  const lines = await prisma.dispatchPackageLine.findMany({
    where: { tenantId, pickLineId, status: { in: ['PACKED', 'MOVED'] } },
  })
  return roundQty(lines.reduce((s, l) => s + n(l.packedQuantity), 0))
}

async function netPackedForDispatchLine(tenantId: string, outboundDispatchLineId: string): Promise<number> {
  const lines = await prisma.dispatchPackageLine.findMany({
    where: {
      tenantId,
      outboundDispatchLineId,
      status: { in: ['PACKED', 'MOVED'] },
    },
  })
  return roundQty(lines.reduce((s, l) => s + n(l.packedQuantity), 0))
}

function mapSession(row: {
  id: string
  packingSessionNumber: string
  outboundDispatchId: string
  warehouseId: string
  status: DispatchPackingSessionStatus
  assignedTo: string | null
  packingStation: string | null
  plannedPackingDate: Date | null
  startedAt: Date | null
  completedAt: Date | null
  verifiedAt: Date | null
  totalPickedQuantity: Prisma.Decimal
  totalPackedQuantity: Prisma.Decimal
  totalUnpackedQuantity: Prisma.Decimal
  totalShortageQuantity: Prisma.Decimal
  totalPackages: number
  remarks: string | null
  packages?: Array<{ id: string; packageNumber: string; status: string; packageSequence: number }>
}) {
  return {
    id: row.id,
    packingSessionNumber: row.packingSessionNumber,
    outboundDispatchId: row.outboundDispatchId,
    warehouseId: row.warehouseId,
    status: row.status,
    assignedTo: row.assignedTo,
    packingStation: row.packingStation,
    plannedPackingDate: row.plannedPackingDate?.toISOString().slice(0, 10) ?? null,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    totalPickedQuantity: n(row.totalPickedQuantity),
    totalPackedQuantity: n(row.totalPackedQuantity),
    totalUnpackedQuantity: n(row.totalUnpackedQuantity),
    totalShortageQuantity: n(row.totalShortageQuantity),
    totalPackages: row.totalPackages,
    remarks: row.remarks,
    packages: row.packages?.map((p) => ({
      id: p.id,
      packageNumber: p.packageNumber,
      status: p.status,
      packageSequence: p.packageSequence,
    })),
  }
}

async function loadSession(tenantId: string, sessionId: string) {
  const row = await prisma.dispatchPackingSession.findFirst({
    where: { id: sessionId, tenantId, deletedAt: null },
    include: { packages: { orderBy: { packageSequence: 'asc' } } },
  })
  if (!row) throw new NotFoundError('Packing session not found')
  return row
}

async function refreshSessionTotals(tx: Prisma.TransactionClient, tenantId: string, sessionId: string) {
  const packedLines = await tx.dispatchPackageLine.findMany({
    where: { tenantId, packingSessionId: sessionId, status: { in: ['PACKED', 'MOVED'] } },
  })
  const totalPacked = roundQty(packedLines.reduce((s, l) => s + n(l.packedQuantity), 0))
  const totalUnpacked = roundQty(
    (
      await tx.dispatchPackingEvent.findMany({
        where: { tenantId, packingSessionId: sessionId, eventType: 'UNPACK' },
      })
    ).reduce((s, e) => s + n(e.quantity), 0),
  )
  const shortageEvents = await tx.dispatchPackingEvent.findMany({
    where: {
      tenantId,
      packingSessionId: sessionId,
      eventType: { in: ['SHORTAGE_REPORTED', 'SHORTAGE_RESOLVED'] },
    },
  })
  let totalShortage = 0
  for (const e of shortageEvents) {
    const q = n(e.quantity)
    if (e.eventType === 'SHORTAGE_REPORTED') totalShortage += q
    else totalShortage -= q
  }
  totalShortage = roundQty(Math.max(0, totalShortage))

  const packageCount = await tx.dispatchPackage.count({
    where: { tenantId, packingSessionId: sessionId, status: { not: 'CANCELLED' } },
  })

  const session = await tx.dispatchPackingSession.findFirstOrThrow({ where: { id: sessionId } })
  let status = session.status
  if (session.status === 'BLOCKED' && totalShortage <= 0) status = session.startedAt ? 'IN_PROGRESS' : 'READY'
  else if (!['VERIFIED', 'CANCELLED', 'BLOCKED'].includes(session.status)) {
    if (session.completedAt) status = 'PACKED'
    else if (totalPacked > 0) status = 'PARTIALLY_PACKED'
    else if (session.startedAt) status = 'IN_PROGRESS'
  }

  await tx.dispatchPackingSession.update({
    where: { id: sessionId },
    data: {
      totalPackedQuantity: totalPacked,
      totalUnpackedQuantity: totalUnpacked,
      totalShortageQuantity: totalShortage,
      totalPackages: packageCount,
      status,
    },
  })
}

export async function createSessionFromDispatch(
  req: Request,
  tenantId: string,
  dispatchId: string,
  input: CreatePackingSessionInput,
) {
  if (input.idempotencyKey) {
    const existing = await prisma.dispatchPackingSession.findFirst({
      where: { tenantId, idempotencyKey: input.idempotencyKey },
      include: { packages: true },
    })
    if (existing) return [mapSession(existing)]
  }

  const dispatch = await outboundRepo.findById(tenantId, dispatchId)
  if (!dispatch) throw new NotFoundError('Outbound dispatch not found')
  if (dispatch.status !== 'DRAFT') {
    throw new InvalidStateError('Packing sessions can only be created for DRAFT dispatches')
  }

  const pickLists = await prisma.dispatchPickList.findMany({
    where: { tenantId, outboundDispatchId: dispatchId, deletedAt: null, status: { not: 'CANCELLED' } },
    include: { lines: true },
  })
  if (!pickLists.length) throw new ValidationError('No pick lists found for this dispatch')

  for (const pl of pickLists) {
    if (pl.status !== 'PICKED') {
      throw new InvalidStateError('All active pick lists must be PICKED before creating packing sessions')
    }
  }

  const byWarehouse = new Map<string, typeof pickLists>()
  for (const pl of pickLists) {
    let warehouseNet = 0
    for (const line of pl.lines) {
      warehouseNet += await netPickedForLine(line.id)
    }
    if (warehouseNet <= 0) continue
    const list = byWarehouse.get(pl.warehouseId) ?? []
    list.push(pl)
    byWarehouse.set(pl.warehouseId, list)
  }
  if (!byWarehouse.size) {
    throw new ValidationError('No net picked quantity found for this dispatch')
  }

  const actor = userId(req)
  const created = await prisma.$transaction(async (tx) => {
    const sessions = []
    for (const [warehouseId] of byWarehouse) {
      const packingSessionNumber = await nextCode(tenantId, 'DISPATCH_PACKING_SESSION', tx)
      let totalPicked = 0
      for (const pl of pickLists.filter((p) => p.warehouseId === warehouseId)) {
        for (const line of pl.lines) {
          totalPicked += await netPickedForLine(line.id)
        }
      }
      totalPicked = roundQty(totalPicked)

      const session = await tx.dispatchPackingSession.create({
        data: {
          tenantId,
          packingSessionNumber,
          outboundDispatchId: dispatchId,
          warehouseId,
          status: 'READY',
          assignedTo: input.assignedTo ?? null,
          packingStation: input.packingStation ?? null,
          plannedPackingDate: input.plannedPackingDate ? new Date(input.plannedPackingDate) : null,
          totalPickedQuantity: totalPicked,
          idempotencyKey: input.idempotencyKey ?? null,
          remarks: input.remarks ?? null,
          createdBy: actor || null,
          updatedBy: actor || null,
        },
        include: { packages: true },
      })

      await tx.dispatchPackingEvent.create({
        data: {
          tenantId,
          packingSessionId: session.id,
          eventType: 'SESSION_CREATED',
          quantity: totalPicked,
          performedBy: actor,
        },
      })
      sessions.push(session)
    }
    return sessions
  })

  return created.map(mapSession)
}

export async function getSession(tenantId: string, sessionId: string) {
  const row = await loadSession(tenantId, sessionId)
  return mapSession(row)
}

export async function listSessions(
  tenantId: string,
  query: { page?: number; limit?: number; outboundDispatchId?: string; status?: DispatchPackingSessionStatus },
) {
  const { skip, take, page, limit } = getPagination(query as PaginationInput)
  const where = {
    tenantId,
    deletedAt: null as Date | null,
    ...(query.outboundDispatchId ? { outboundDispatchId: query.outboundDispatchId } : {}),
    ...(query.status ? { status: query.status } : {}),
  }
  const [rows, total] = await Promise.all([
    prisma.dispatchPackingSession.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { packages: { orderBy: { packageSequence: 'asc' } } },
    }),
    prisma.dispatchPackingSession.count({ where }),
  ])
  return { items: rows.map(mapSession), total, page, limit }
}

export async function startSession(req: Request, tenantId: string, sessionId: string) {
  const session = await loadSession(tenantId, sessionId)
  if (!['DRAFT', 'READY'].includes(session.status)) {
    throw new InvalidStateError('Packing session cannot be started in current status')
  }
  const actor = userId(req)
  const updated = await prisma.$transaction(async (tx) => {
    await tx.dispatchPackingEvent.create({
      data: {
        tenantId,
        packingSessionId: sessionId,
        eventType: 'SESSION_STARTED',
        performedBy: actor,
      },
    })
    return tx.dispatchPackingSession.update({
      where: { id: sessionId },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        startedBy: actor || null,
        updatedBy: actor || null,
      },
      include: { packages: true },
    })
  })
  return mapSession(updated)
}

export async function completeSession(req: Request, tenantId: string, sessionId: string) {
  const session = await loadSession(tenantId, sessionId)
  if (['CANCELLED', 'VERIFIED'].includes(session.status)) {
    throw new InvalidStateError('Packing session cannot be completed in current status')
  }

  const dispatch = await outboundRepo.findById(tenantId, session.outboundDispatchId)
  if (!dispatch) throw new NotFoundError('Outbound dispatch not found')

  for (const line of dispatch.lines.filter((l) => l.warehouseId === session.warehouseId)) {
    const netPacked = await netPackedForDispatchLine(tenantId, line.id)
    const lineQty = n(line.quantity)
    if (roundQty(netPacked) !== lineQty) {
      throw new ConflictError('Net packed quantity must equal dispatch line quantity before session complete')
    }
  }

  const actor = userId(req)
  const updated = await prisma.$transaction(async (tx) => {
    await tx.dispatchPackingEvent.create({
      data: {
        tenantId,
        packingSessionId: sessionId,
        eventType: 'SESSION_COMPLETED',
        performedBy: actor,
      },
    })
    const row = await tx.dispatchPackingSession.update({
      where: { id: sessionId },
      data: {
        status: 'PACKED',
        completedAt: new Date(),
        completedBy: actor || null,
        updatedBy: actor || null,
      },
      include: { packages: true },
    })
    await refreshSessionTotals(tx, tenantId, sessionId)
    return row
  })
  return mapSession(updated)
}

export async function verifySession(req: Request, tenantId: string, sessionId: string) {
  const session = await loadSession(tenantId, sessionId)
  if (session.status !== 'PACKED') {
    throw new InvalidStateError('Only PACKED sessions can be verified')
  }
  const actor = userId(req)
  const updated = await prisma.$transaction(async (tx) => {
    await tx.dispatchPackingEvent.create({
      data: {
        tenantId,
        packingSessionId: sessionId,
        eventType: 'SESSION_VERIFIED',
        performedBy: actor,
      },
    })
    return tx.dispatchPackingSession.update({
      where: { id: sessionId },
      data: {
        status: 'VERIFIED',
        verifiedAt: new Date(),
        verifiedBy: actor || null,
        updatedBy: actor || null,
      },
      include: { packages: true },
    })
  })
  return mapSession(updated)
}

export async function reopenSession(req: Request, tenantId: string, sessionId: string) {
  const session = await loadSession(tenantId, sessionId)
  if (!['PACKED', 'VERIFIED'].includes(session.status)) {
    throw new InvalidStateError('Only completed packing sessions can be reopened')
  }
  const actor = userId(req)
  const updated = await prisma.dispatchPackingSession.update({
    where: { id: sessionId },
    data: {
      status: 'IN_PROGRESS',
      completedAt: null,
      completedBy: null,
      verifiedAt: null,
      verifiedBy: null,
      updatedBy: actor || null,
    },
    include: { packages: true },
  })
  return mapSession(updated)
}

export async function cancelSession(req: Request, tenantId: string, sessionId: string, reason?: string) {
  const session = await loadSession(tenantId, sessionId)
  if (session.status === 'VERIFIED') {
    throw new InvalidStateError('Verified packing session cannot be cancelled')
  }
  const actor = userId(req)
  const updated = await prisma.$transaction(async (tx) => {
    await tx.dispatchPackingEvent.create({
      data: {
        tenantId,
        packingSessionId: sessionId,
        eventType: 'SESSION_CANCELLED',
        remarks: reason ?? null,
        performedBy: actor,
      },
    })
    return tx.dispatchPackingSession.update({
      where: { id: sessionId },
      data: {
        status: 'CANCELLED',
        remarks: reason ?? session.remarks,
        updatedBy: actor || null,
      },
      include: { packages: true },
    })
  })
  return mapSession(updated)
}

export async function reportPackingShortage(
  req: Request,
  tenantId: string,
  sessionId: string,
  input: PackingShortageInput,
) {
  const session = await loadSession(tenantId, sessionId)
  if (['CANCELLED', 'VERIFIED', 'PACKED'].includes(session.status)) {
    throw new InvalidStateError('Packing session cannot accept shortage in current status')
  }
  const qty = toDecimal(input.quantity)
  if (!isPositive(qty)) throw new ValidationError('Shortage quantity must be positive')

  const pickLine = await prisma.dispatchPickLine.findFirst({
    where: { id: input.pickLineId, tenantId },
  })
  if (!pickLine) throw new NotFoundError('Pick line not found')

  const actor = userId(req)
  await prisma.$transaction(async (tx) => {
    await tx.dispatchPackingEvent.create({
      data: {
        tenantId,
        packingSessionId: sessionId,
        eventType: 'SHORTAGE_REPORTED',
        itemId: pickLine.itemId,
        quantity: qty,
        reasonCode: input.reasonCode ?? null,
        remarks: input.remarks ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        performedBy: actor,
      },
    })
    await tx.dispatchPackingSession.update({
      where: { id: sessionId },
      data: { status: 'BLOCKED', updatedBy: actor || null },
    })
    await refreshSessionTotals(tx, tenantId, sessionId)
  })
  return getSession(tenantId, sessionId)
}

export async function resolvePackingShortage(
  req: Request,
  tenantId: string,
  sessionId: string,
  input: PackingShortageInput,
) {
  const session = await loadSession(tenantId, sessionId)
  if (session.status !== 'BLOCKED') {
    throw new InvalidStateError('Only blocked sessions can resolve shortage')
  }
  const actor = userId(req)
  await prisma.$transaction(async (tx) => {
    await tx.dispatchPackingEvent.create({
      data: {
        tenantId,
        packingSessionId: sessionId,
        eventType: 'SHORTAGE_RESOLVED',
        quantity: toDecimal(input.quantity),
        reasonCode: input.reasonCode ?? null,
        remarks: input.remarks ?? 'Shortage resolved',
        idempotencyKey: input.idempotencyKey ?? null,
        performedBy: actor,
      },
    })
    await tx.dispatchPackingSession.update({
      where: { id: sessionId },
      data: { status: 'IN_PROGRESS', updatedBy: actor || null },
    })
    await refreshSessionTotals(tx, tenantId, sessionId)
  })
  return getSession(tenantId, sessionId)
}

export async function getPackingPosition(tenantId: string, dispatchId: string) {
  const sessions = await prisma.dispatchPackingSession.findMany({
    where: { tenantId, outboundDispatchId: dispatchId, deletedAt: null },
    include: { packages: { orderBy: { packageSequence: 'asc' } } },
  })
  return {
    outboundDispatchId: dispatchId,
    packingSessions: sessions.map(mapSession),
  }
}

export async function listPackageTypes(tenantId: string, activeOnly = true) {
  const rows = await prisma.dispatchPackageType.findMany({
    where: { tenantId, ...(activeOnly ? { active: true } : {}) },
    orderBy: { code: 'asc' },
  })
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    description: r.description,
    defaultTareWeight: r.defaultTareWeight ? n(r.defaultTareWeight) : null,
    defaultLength: r.defaultLength ? n(r.defaultLength) : null,
    defaultWidth: r.defaultWidth ? n(r.defaultWidth) : null,
    defaultHeight: r.defaultHeight ? n(r.defaultHeight) : null,
    weightUomId: r.weightUomId,
    dimensionUomId: r.dimensionUomId,
    reusable: r.reusable,
    active: r.active,
  }))
}

export async function createPackageType(req: Request, tenantId: string, input: CreatePackageTypeInput) {
  const actor = userId(req)
  const row = await prisma.dispatchPackageType.create({
    data: {
      tenantId,
      code: input.code,
      name: input.name,
      description: input.description ?? null,
      defaultTareWeight: input.defaultTareWeight ?? null,
      defaultLength: input.defaultLength ?? null,
      defaultWidth: input.defaultWidth ?? null,
      defaultHeight: input.defaultHeight ?? null,
      weightUomId: input.weightUomId ?? null,
      dimensionUomId: input.dimensionUomId ?? null,
      reusable: input.reusable ?? true,
      active: input.active ?? true,
      createdBy: actor || null,
      updatedBy: actor || null,
    },
  })
  return { id: row.id, code: row.code, name: row.name }
}

export async function updatePackageType(
  req: Request,
  tenantId: string,
  typeId: string,
  input: UpdatePackageTypeInput,
) {
  const existing = await prisma.dispatchPackageType.findFirst({ where: { id: typeId, tenantId } })
  if (!existing) throw new NotFoundError('Package type not found')
  const row = await prisma.dispatchPackageType.update({
    where: { id: typeId },
    data: {
      name: input.name,
      description: input.description,
      defaultTareWeight: input.defaultTareWeight,
      defaultLength: input.defaultLength,
      defaultWidth: input.defaultWidth,
      defaultHeight: input.defaultHeight,
      weightUomId: input.weightUomId,
      dimensionUomId: input.dimensionUomId,
      reusable: input.reusable,
      active: input.active,
      updatedBy: userId(req) || null,
    },
  })
  return { id: row.id, code: row.code, name: row.name, active: row.active }
}

export { netPackedForPickLine, netPackedForDispatchLine }

export async function assertUnpickAllowedWhenPacking(
  tenantId: string,
  pickLineId: string,
  unpickQty: number,
): Promise<void> {
  const netPacked = await netPackedForPickLine(tenantId, pickLineId)
  if (netPacked <= 0) return

  const activeSessions = await prisma.dispatchPackingSession.count({
    where: {
      tenantId,
      deletedAt: null,
      status: 'IN_PROGRESS',
      packageLines: { some: { pickLineId, status: { in: ['PACKED', 'MOVED'] } } },
    },
  })
  if (activeSessions > 0 && unpickQty > roundQty(await netPickedForLine(pickLineId)) - netPacked) {
    throw new ConflictError('Unpick blocked: unpack packed quantity before unpicking (Phase 7C3)')
  }
}
