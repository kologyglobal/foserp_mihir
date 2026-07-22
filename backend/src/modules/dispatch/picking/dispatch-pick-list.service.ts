import type { Request } from 'express'
import type { DispatchPickLineStatus, DispatchPickListStatus, Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { ConflictError, InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { getPagination } from '../../../utils/pagination.js'
import { isPositive, subDec, toDecimal } from '../../inventory/shared/quantity.helpers.js'
import { n, roundQty } from '../shared/dispatch-qty.js'
import * as outboundRepo from '../outbound/outbound-dispatch.repository.js'

export interface CreatePickListsInput {
  idempotencyKey?: string
  plannedPickDate?: string
  priority?: string
  remarks?: string
}

export interface PickActionInput {
  pickLineId: string
  quantity: number
  lotRef?: string
  serialRef?: string
  heatNumber?: string
  idempotencyKey?: string
  remarks?: string
}

export interface ShortageInput {
  pickLineId: string
  quantity: number
  reasonCode?: string
  remarks?: string
  idempotencyKey?: string
}

export interface AssignPickListInput {
  assignedTo: string
}

function userId(req: Request): string {
  return req.context?.userId ?? ''
}

export async function netPickedForLine(pickLineId: string): Promise<number> {
  const events = await prisma.dispatchPickEvent.findMany({
    where: { pickLineId },
    select: { eventType: true, quantity: true },
  })
  let net = 0
  for (const e of events) {
    const q = n(e.quantity)
    if (e.eventType === 'PICK') net += q
    else if (e.eventType === 'UNPICK') net -= q
  }
  return roundQty(Math.max(0, net))
}

async function reservedQtyForDispatchLine(tenantId: string, lineId: string): Promise<number> {
  const rows = await prisma.inventoryStockReservation.findMany({
    where: {
      tenantId,
      outboundDispatchLineId: lineId,
      status: 'ACTIVE',
      demandType: 'DISPATCH',
    },
  })
  return roundQty(
    rows.reduce((s, r) => {
      const net = n(subDec(subDec(r.quantity, r.fulfilledQty), r.releasedQty))
      return s + Math.max(0, net)
    }, 0),
  )
}

function mapPickList(row: {
  id: string
  pickListNumber: string
  outboundDispatchId: string
  warehouseId: string
  assignedTo: string | null
  plannedPickDate: Date | null
  priority: string
  status: DispatchPickListStatus
  releasedAt: Date | null
  startedAt: Date | null
  completedAt: Date | null
  remarks: string | null
  lines?: Array<{
    id: string
    outboundDispatchLineId: string
    itemId: string
    warehouseId: string
    requestedQuantity: Prisma.Decimal
    reservedQuantity: Prisma.Decimal
    pickedQuantity: Prisma.Decimal
    shortageQuantity: Prisma.Decimal
    status: DispatchPickLineStatus
  }>
}) {
  return {
    id: row.id,
    pickListNumber: row.pickListNumber,
    outboundDispatchId: row.outboundDispatchId,
    warehouseId: row.warehouseId,
    assignedTo: row.assignedTo,
    plannedPickDate: row.plannedPickDate?.toISOString().slice(0, 10) ?? null,
    priority: row.priority,
    status: row.status,
    releasedAt: row.releasedAt?.toISOString() ?? null,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    remarks: row.remarks,
    lines: row.lines?.map((l) => ({
      id: l.id,
      outboundDispatchLineId: l.outboundDispatchLineId,
      itemId: l.itemId,
      warehouseId: l.warehouseId,
      requestedQuantity: n(l.requestedQuantity),
      reservedQuantity: n(l.reservedQuantity),
      pickedQuantity: n(l.pickedQuantity),
      shortageQuantity: n(l.shortageQuantity),
      status: l.status,
    })),
  }
}

async function loadPickList(tenantId: string, pickListId: string) {
  const row = await prisma.dispatchPickList.findFirst({
    where: { id: pickListId, tenantId, deletedAt: null },
    include: { lines: true },
  })
  if (!row) throw new NotFoundError('Pick list not found')
  return row
}

function deriveLineStatus(
  requested: number,
  picked: number,
  shortage: number,
): DispatchPickLineStatus {
  if (shortage > 0 && picked + shortage >= requested) return 'SHORT'
  if (picked >= requested) return 'PICKED'
  if (picked > 0) return 'PARTIALLY_PICKED'
  return 'NOT_STARTED'
}

function deriveListStatus(lines: Array<{ status: DispatchPickLineStatus }>): DispatchPickListStatus {
  if (!lines.length) return 'DRAFT'
  if (lines.every((l) => l.status === 'PICKED' || l.status === 'SHORT')) return 'PICKED'
  if (lines.some((l) => l.status === 'PARTIALLY_PICKED' || l.status === 'IN_PROGRESS')) {
    return 'PARTIALLY_PICKED'
  }
  return 'IN_PROGRESS'
}

export async function createPickListsFromDispatch(
  req: Request,
  tenantId: string,
  dispatchId: string,
  input: CreatePickListsInput,
) {
  if (input.idempotencyKey) {
    const existing = await prisma.dispatchPickList.findFirst({
      where: { tenantId, idempotencyKey: input.idempotencyKey },
      include: { lines: true },
    })
    if (existing) return [mapPickList(existing)]
  }

  const dispatch = await outboundRepo.findById(tenantId, dispatchId)
  if (!dispatch) throw new NotFoundError('Outbound dispatch not found')
  if (dispatch.status !== 'DRAFT') {
    throw new InvalidStateError('Pick lists can only be created for DRAFT dispatches')
  }

  const byWarehouse = new Map<string, typeof dispatch.lines>()
  for (const line of dispatch.lines) {
    const reserved = await reservedQtyForDispatchLine(tenantId, line.id)
    if (reserved <= 0) continue
    const list = byWarehouse.get(line.warehouseId) ?? []
    list.push(line)
    byWarehouse.set(line.warehouseId, list)
  }
  if (!byWarehouse.size) {
    throw new ValidationError('No reserved lines found for this dispatch')
  }

  const actor = userId(req)
  const created = await prisma.$transaction(async (tx) => {
    const lists = []
    for (const [warehouseId, lines] of byWarehouse) {
      const pickListNumber = await nextCode(tenantId, 'DISPATCH_PICK_LIST', tx)
      const pickList = await tx.dispatchPickList.create({
        data: {
          tenantId,
          pickListNumber,
          outboundDispatchId: dispatchId,
          warehouseId,
          plannedPickDate: input.plannedPickDate ? new Date(input.plannedPickDate) : null,
          priority: input.priority ?? 'MEDIUM',
          remarks: input.remarks ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
          createdBy: actor || null,
          updatedBy: actor || null,
          lines: {
            create: await Promise.all(
              lines.map(async (line) => {
                const reserved = await reservedQtyForDispatchLine(tenantId, line.id)
                return {
                  tenantId,
                  outboundDispatchLineId: line.id,
                  dispatchRequirementId: line.dispatchRequirementId,
                  salesOrderId: line.salesOrderId,
                  salesOrderLineId: line.salesOrderLineId,
                  itemId: line.itemId,
                  warehouseId: line.warehouseId,
                  requestedQuantity: line.quantity,
                  reservedQuantity: reserved,
                }
              }),
            ),
          },
        },
        include: { lines: true },
      })
      lists.push(pickList)
    }
    return lists
  })

  return created.map(mapPickList)
}

export async function getPickList(tenantId: string, pickListId: string) {
  const row = await loadPickList(tenantId, pickListId)
  return mapPickList(row)
}

export async function listPickLists(
  tenantId: string,
  query: { page?: number; limit?: number; outboundDispatchId?: string; status?: DispatchPickListStatus },
) {
  const { skip, take, page, limit } = getPagination({
    page: query.page ?? 1,
    limit: query.limit ?? 20,
    sortOrder: 'desc',
  })
  const where = {
    tenantId,
    deletedAt: null as Date | null,
    ...(query.outboundDispatchId ? { outboundDispatchId: query.outboundDispatchId } : {}),
    ...(query.status ? { status: query.status } : {}),
  }
  const [rows, total] = await Promise.all([
    prisma.dispatchPickList.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { lines: true },
    }),
    prisma.dispatchPickList.count({ where }),
  ])
  return { items: rows.map(mapPickList), total, page, limit }
}

async function refreshPickLineQuantities(tx: Prisma.TransactionClient, pickLineId: string) {
  const events = await tx.dispatchPickEvent.findMany({ where: { pickLineId } })
  let picked = 0
  let shortage = 0
  for (const e of events) {
    const q = n(e.quantity)
    if (e.eventType === 'PICK') picked += q
    else if (e.eventType === 'UNPICK') picked -= q
    else if (e.eventType === 'SHORTAGE') shortage += q
    else if (e.eventType === 'SHORTAGE_RESOLVED') shortage -= q
  }
  picked = roundQty(Math.max(0, picked))
  shortage = roundQty(Math.max(0, shortage))

  const line = await tx.dispatchPickLine.findFirstOrThrow({ where: { id: pickLineId } })
  const status = deriveLineStatus(n(line.requestedQuantity), picked, shortage)
  await tx.dispatchPickLine.update({
    where: { id: pickLineId },
    data: { pickedQuantity: picked, shortageQuantity: shortage, status },
  })
  return { picked, shortage, status }
}

export async function releasePickList(req: Request, tenantId: string, pickListId: string) {
  const list = await loadPickList(tenantId, pickListId)
  if (list.status !== 'DRAFT') throw new InvalidStateError('Only DRAFT pick lists can be released')
  const actor = userId(req)
  const updated = await prisma.$transaction(async (tx) => {
    await tx.dispatchPickEvent.create({
      data: {
        tenantId,
        pickListId,
        pickLineId: list.lines[0]!.id,
        eventType: 'RELEASE',
        quantity: 0,
        performedBy: actor,
      },
    })
    return tx.dispatchPickList.update({
      where: { id: pickListId },
      data: {
        status: 'RELEASED',
        releasedAt: new Date(),
        releasedBy: actor || null,
        updatedBy: actor || null,
      },
      include: { lines: true },
    })
  })
  return mapPickList(updated)
}

export async function assignPickList(req: Request, tenantId: string, pickListId: string, input: AssignPickListInput) {
  const list = await loadPickList(tenantId, pickListId)
  if (list.status === 'CANCELLED' || list.status === 'PICKED') {
    throw new InvalidStateError('Pick list cannot be assigned in current status')
  }
  const updated = await prisma.dispatchPickList.update({
    where: { id: pickListId },
    data: { assignedTo: input.assignedTo, updatedBy: userId(req) || null },
    include: { lines: true },
  })
  return mapPickList(updated)
}

export async function startPickList(req: Request, tenantId: string, pickListId: string) {
  const list = await loadPickList(tenantId, pickListId)
  if (!['RELEASED', 'DRAFT'].includes(list.status)) {
    throw new InvalidStateError('Pick list cannot be started in current status')
  }
  const actor = userId(req)
  const updated = await prisma.$transaction(async (tx) => {
    await tx.dispatchPickEvent.create({
      data: {
        tenantId,
        pickListId,
        pickLineId: list.lines[0]!.id,
        eventType: 'START',
        quantity: 0,
        performedBy: actor,
      },
    })
    return tx.dispatchPickList.update({
      where: { id: pickListId },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        startedBy: actor || null,
        updatedBy: actor || null,
      },
      include: { lines: true },
    })
  })
  return mapPickList(updated)
}

export async function pickLine(req: Request, tenantId: string, pickListId: string, input: PickActionInput) {
  if (input.idempotencyKey) {
    const existing = await prisma.dispatchPickEvent.findFirst({
      where: { tenantId, idempotencyKey: input.idempotencyKey },
    })
    if (existing) return getPickList(tenantId, pickListId)
  }

  const list = await loadPickList(tenantId, pickListId)
  if (['CANCELLED', 'PICKED'].includes(list.status)) {
    throw new InvalidStateError('Pick list is not open for picking')
  }
  const line = list.lines.find((l) => l.id === input.pickLineId)
  if (!line) throw new NotFoundError('Pick line not found on this list')

  const qty = toDecimal(input.quantity)
  if (!isPositive(qty)) throw new ValidationError('Pick quantity must be positive')

  const currentNet = await netPickedForLine(line.id)
  const reserved = n(line.reservedQuantity)
  if (currentNet + n(qty) > reserved) {
    throw new ConflictError('Pick quantity exceeds reserved quantity')
  }

  const actor = userId(req)
  await prisma.$transaction(async (tx) => {
    await tx.dispatchPickEvent.create({
      data: {
        tenantId,
        pickListId,
        pickLineId: line.id,
        eventType: 'PICK',
        quantity: qty,
        lotRef: input.lotRef ?? null,
        serialRef: input.serialRef ?? null,
        heatNumber: input.heatNumber ?? null,
        remarks: input.remarks ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        performedBy: actor,
      },
    })

    if (input.serialRef || input.lotRef) {
      const reservation = await tx.inventoryStockReservation.findFirst({
        where: {
          tenantId,
          outboundDispatchLineId: line.outboundDispatchLineId,
          status: 'ACTIVE',
        },
      })
      if (reservation) {
        await tx.dispatchTrackingAllocation.create({
          data: {
            tenantId,
            inventoryReservationId: reservation.id,
            outboundDispatchId: list.outboundDispatchId,
            outboundDispatchLineId: line.outboundDispatchLineId,
            itemId: line.itemId,
            warehouseId: line.warehouseId,
            lotRef: input.lotRef ?? null,
            serialRef: input.serialRef ?? null,
            heatNumber: input.heatNumber ?? null,
            allocatedQuantity: qty,
            status: 'PICKED',
          },
        })
      }
    }

    await refreshPickLineQuantities(tx, line.id)
    const refreshedLines = await tx.dispatchPickLine.findMany({ where: { pickListId } })
    await tx.dispatchPickList.update({
      where: { id: pickListId },
      data: {
        status: deriveListStatus(refreshedLines),
        updatedBy: actor || null,
      },
    })
  })

  return getPickList(tenantId, pickListId)
}

export async function unpickLine(req: Request, tenantId: string, pickListId: string, input: PickActionInput) {
  const list = await loadPickList(tenantId, pickListId)
  if (list.status === 'CANCELLED') {
    throw new InvalidStateError('Pick list is cancelled')
  }
  const line = list.lines.find((l) => l.id === input.pickLineId)
  if (!line) throw new NotFoundError('Pick line not found on this list')

  const qty = toDecimal(input.quantity)
  if (!isPositive(qty)) throw new ValidationError('Unpick quantity must be positive')

  const currentNet = await netPickedForLine(line.id)
  if (n(qty) > currentNet) throw new ConflictError('Unpick quantity exceeds net picked')

  const { assertUnpickAllowedWhenPacking } = await import('../packing/dispatch-packing.service.js')
  await assertUnpickAllowedWhenPacking(tenantId, line.id, n(qty))

  const actor = userId(req)
  await prisma.$transaction(async (tx) => {
    await tx.dispatchPickEvent.create({
      data: {
        tenantId,
        pickListId,
        pickLineId: line.id,
        eventType: 'UNPICK',
        quantity: qty,
        lotRef: input.lotRef ?? null,
        serialRef: input.serialRef ?? null,
        heatNumber: input.heatNumber ?? null,
        remarks: input.remarks ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        performedBy: actor,
      },
    })
    await refreshPickLineQuantities(tx, line.id)
    const refreshedLines = await tx.dispatchPickLine.findMany({ where: { pickListId } })
    await tx.dispatchPickList.update({
      where: { id: pickListId },
      data: { status: deriveListStatus(refreshedLines), updatedBy: actor || null },
    })
  })

  return getPickList(tenantId, pickListId)
}

export async function reportShortage(req: Request, tenantId: string, pickListId: string, input: ShortageInput) {
  const list = await loadPickList(tenantId, pickListId)
  const line = list.lines.find((l) => l.id === input.pickLineId)
  if (!line) throw new NotFoundError('Pick line not found on this list')
  const qty = toDecimal(input.quantity)
  if (!isPositive(qty)) throw new ValidationError('Shortage quantity must be positive')

  const actor = userId(req)
  await prisma.$transaction(async (tx) => {
    await tx.dispatchPickEvent.create({
      data: {
        tenantId,
        pickListId,
        pickLineId: line.id,
        eventType: 'SHORTAGE',
        quantity: qty,
        reasonCode: input.reasonCode ?? null,
        remarks: input.remarks ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        performedBy: actor,
      },
    })
    if (input.reasonCode || input.remarks) {
      await tx.dispatchPickLine.update({
        where: { id: line.id },
        data: { primaryShortageReason: input.remarks ?? input.reasonCode ?? null },
      })
    }
    await refreshPickLineQuantities(tx, line.id)
    const refreshedLines = await tx.dispatchPickLine.findMany({ where: { pickListId } })
    await tx.dispatchPickList.update({
      where: { id: pickListId },
      data: { status: deriveListStatus(refreshedLines), updatedBy: actor || null },
    })
  })

  return getPickList(tenantId, pickListId)
}

export async function resolveShortage(
  req: Request,
  tenantId: string,
  pickListId: string,
  input: ShortageInput,
) {
  const list = await loadPickList(tenantId, pickListId)
  const line = list.lines.find((l) => l.id === input.pickLineId)
  if (!line) throw new NotFoundError('Pick line not found on this list')
  const actor = userId(req)
  await prisma.$transaction(async (tx) => {
    await tx.dispatchPickEvent.create({
      data: {
        tenantId,
        pickListId,
        pickLineId: line.id,
        eventType: 'SHORTAGE_RESOLVED',
        quantity: toDecimal(input.quantity),
        reasonCode: input.reasonCode ?? null,
        remarks: input.remarks ?? 'Shortage resolved',
        idempotencyKey: input.idempotencyKey ?? null,
        performedBy: actor,
      },
    })
    await refreshPickLineQuantities(tx, line.id)
  })
  return getPickList(tenantId, pickListId)
}

export async function completePickList(req: Request, tenantId: string, pickListId: string) {
  const list = await loadPickList(tenantId, pickListId)
  if (list.status === 'CANCELLED') throw new InvalidStateError('Cancelled pick list cannot be completed')

  const actor = userId(req)
  const updated = await prisma.$transaction(async (tx) => {
    for (const line of list.lines) {
      await refreshPickLineQuantities(tx, line.id)
    }
    const refreshedLines = await tx.dispatchPickLine.findMany({ where: { pickListId } })

    for (const line of refreshedLines) {
      const events = await tx.dispatchPickEvent.findMany({ where: { pickLineId: line.id } })
      let net = 0
      for (const e of events) {
        const q = n(e.quantity)
        if (e.eventType === 'PICK') net += q
        else if (e.eventType === 'UNPICK') net -= q
      }
      net = roundQty(Math.max(0, net))
      const shortage = n(line.shortageQuantity)
      const requested = n(line.requestedQuantity)
      const ok =
        (line.status === 'PICKED' && net >= requested) ||
        (line.status === 'SHORT' && shortage > 0 && net + shortage >= requested)
      if (!ok) {
        throw new ConflictError('All lines must be PICKED or SHORT with recorded shortage before complete')
      }
    }

    await tx.dispatchPickEvent.create({
      data: {
        tenantId,
        pickListId,
        pickLineId: refreshedLines[0]!.id,
        eventType: 'COMPLETE',
        quantity: 0,
        performedBy: actor,
      },
    })
    return tx.dispatchPickList.update({
      where: { id: pickListId },
      data: {
        status: 'PICKED',
        completedAt: new Date(),
        completedBy: actor || null,
        updatedBy: actor || null,
      },
      include: { lines: true },
    })
  })
  return mapPickList(updated)
}

export async function cancelPickList(req: Request, tenantId: string, pickListId: string, reason?: string) {
  const list = await loadPickList(tenantId, pickListId)
  if (list.status === 'PICKED') throw new InvalidStateError('Completed pick list cannot be cancelled')
  const actor = userId(req)
  const updated = await prisma.$transaction(async (tx) => {
    await tx.dispatchPickEvent.create({
      data: {
        tenantId,
        pickListId,
        pickLineId: list.lines[0]!.id,
        eventType: 'CANCEL',
        quantity: 0,
        remarks: reason ?? null,
        performedBy: actor,
      },
    })
    await tx.dispatchPickLine.updateMany({
      where: { pickListId },
      data: { status: 'CANCELLED' },
    })
    return tx.dispatchPickList.update({
      where: { id: pickListId },
      data: {
        status: 'CANCELLED',
        remarks: reason ?? list.remarks,
        updatedBy: actor || null,
      },
      include: { lines: true },
    })
  })
  return mapPickList(updated)
}

export async function getPickingPosition(tenantId: string, dispatchId: string) {
  const lists = await prisma.dispatchPickList.findMany({
    where: { tenantId, outboundDispatchId: dispatchId, deletedAt: null },
    include: { lines: true },
  })
  return {
    outboundDispatchId: dispatchId,
    pickLists: lists.map(mapPickList),
  }
}

export async function assertPickListsAllowConfirm(tenantId: string, dispatchId: string): Promise<void> {
  const lists = await prisma.dispatchPickList.findMany({
    where: {
      tenantId,
      outboundDispatchId: dispatchId,
      deletedAt: null,
      status: { not: 'CANCELLED' },
    },
    include: { lines: true },
  })
  if (!lists.length) return

  const dispatch = await outboundRepo.findById(tenantId, dispatchId)
  if (!dispatch) return

  for (const list of lists) {
    if (list.status !== 'PICKED') {
      throw new ConflictError(
        'Outbound confirm blocked: active pick list must be PICKED before confirm (Phase 7C2)',
      )
    }
    for (const pl of list.lines) {
      const dispatchLine = dispatch.lines.find((l) => l.id === pl.outboundDispatchLineId)
      if (!dispatchLine) continue
      const net = await netPickedForLine(pl.id)
      const shortage = n(pl.shortageQuantity)
      const lineQty = n(dispatchLine.quantity)
      if (pl.status === 'SHORT') {
        if (roundQty(net + shortage) < lineQty) {
          throw new ConflictError('Pick list line shortage does not cover dispatch line quantity')
        }
      } else if (roundQty(net) !== lineQty) {
        throw new ConflictError('Net picked quantity must equal dispatch line quantity before confirm')
      }
    }
  }
}
