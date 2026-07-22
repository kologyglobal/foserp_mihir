import type { Request } from 'express'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { ConflictError, InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { applyReservationDeltaInTx, freeQty, getOrCreateBalance } from '../../inventory/shared/balance.service.js'
import { InventoryInsufficientStockError } from '../../inventory/shared/inventory.errors.js'
import { isPositive, subDec, toDecimal } from '../../inventory/shared/quantity.helpers.js'
import { getFgAvailabilityByItemIds } from '../availability/dispatch-availability.service.js'
import { n, roundQty } from '../shared/dispatch-qty.js'
import * as outboundRepo from '../outbound/outbound-dispatch.repository.js'

export interface ReservationLineInput {
  outboundDispatchLineId: string
  quantity: number
}

export interface PostReservationsInput {
  lines: ReservationLineInput[]
  remarks?: string
  idempotencyKey?: string
}

export interface ReleaseReservationsInput {
  reservationIds?: string[]
  quantities?: Array<{ reservationId: string; quantity: number }>
  reason?: string
}

export interface ReallocateReservationInput {
  reservationId: string
  toWarehouseId: string
  quantity: number
  reason?: string
}

function userId(req: Request): string {
  return req.context?.userId ?? ''
}

function netReservedQty(res: {
  quantity: Prisma.Decimal
  fulfilledQty: Prisma.Decimal
  releasedQty: Prisma.Decimal
}): Prisma.Decimal {
  return subDec(subDec(res.quantity, res.fulfilledQty), res.releasedQty)
}

async function loadDraftDispatch(tenantId: string, dispatchId: string) {
  const dispatch = await outboundRepo.findById(tenantId, dispatchId)
  if (!dispatch) throw new NotFoundError('Outbound dispatch not found')
  if (dispatch.status !== 'DRAFT') {
    throw new InvalidStateError('Reservations can only be posted against DRAFT dispatches')
  }
  return dispatch
}

async function existingReservedByLine(tenantId: string, dispatchId: string) {
  const rows = await prisma.inventoryStockReservation.findMany({
    where: {
      tenantId,
      outboundDispatchId: dispatchId,
      status: 'ACTIVE',
      demandType: 'DISPATCH',
    },
  })
  const byLine = new Map<string, number>()
  for (const row of rows) {
    const lineId = row.outboundDispatchLineId ?? row.demandId
    const net = n(netReservedQty(row))
    if (net > 0) byLine.set(lineId, roundQty((byLine.get(lineId) ?? 0) + net))
  }
  return byLine
}

async function availableToReserveAtWarehouse(
  tenantId: string,
  itemId: string,
  warehouseId: string,
): Promise<number> {
  const balance = await prisma.inventoryStockBalance.findFirst({
    where: { tenantId, itemId, warehouseId },
  })
  if (!balance) return 0
  return roundQty(n(freeQty(balance)))
}

export async function previewReservation(
  tenantId: string,
  dispatchId: string,
  lines: ReservationLineInput[],
) {
  return previewReservationResolved(tenantId, dispatchId, lines)
}

export async function previewReservationResolved(
  tenantId: string,
  dispatchId: string,
  lines: ReservationLineInput[],
) {
  const dispatch = await loadDraftDispatch(tenantId, dispatchId)
  const lineMap = new Map(dispatch.lines.map((l) => [l.id, l]))
  const existing = await existingReservedByLine(tenantId, dispatchId)
  const itemIds = [...new Set(dispatch.lines.map((l) => l.itemId))]
  const fgAvail = await getFgAvailabilityByItemIds(tenantId, itemIds)

  const previews = []
  for (const input of lines) {
    const line = lineMap.get(input.outboundDispatchLineId)
    if (!line) {
      previews.push({
        outboundDispatchLineId: input.outboundDispatchLineId,
        ok: false,
        message: 'Dispatch line not found',
        requestedQty: input.quantity,
      })
      continue
    }
    const already = existing.get(line.id) ?? 0
    const remainingLine = roundQty(Math.max(0, n(line.quantity) - already))
    const whFree = await availableToReserveAtWarehouse(tenantId, line.itemId, line.warehouseId)
    const fgAvailable = fgAvail.get(line.itemId)?.availableToDispatch ?? 0
    const allowed = Math.min(remainingLine, whFree, fgAvailable)
    const ok = isPositive(input.quantity) && input.quantity <= allowed
    previews.push({
      outboundDispatchLineId: line.id,
      itemId: line.itemId,
      warehouseId: line.warehouseId,
      requestedQty: roundQty(input.quantity),
      alreadyReservedQty: already,
      remainingLineQty: remainingLine,
      warehouseFreeQty: whFree,
      fgAvailableQty: fgAvailable,
      allowedQty: allowed,
      ok,
      message: ok
        ? 'OK'
        : input.quantity > remainingLine
          ? 'Exceeds remaining dispatch line quantity'
          : input.quantity > whFree
            ? 'Insufficient free quantity at warehouse'
            : 'Insufficient FG availability',
    })
  }
  return previews
}

export async function postReservations(
  req: Request,
  tenantId: string,
  dispatchId: string,
  input: PostReservationsInput,
) {
  if (input.idempotencyKey) {
    const existing = await prisma.inventoryStockReservation.findFirst({
      where: { tenantId, idempotencyKey: input.idempotencyKey },
    })
    if (existing) {
      return listReservationsForDispatch(tenantId, dispatchId)
    }
  }

  const dispatch = await loadDraftDispatch(tenantId, dispatchId)
  const lineMap = new Map(dispatch.lines.map((l) => [l.id, l]))
  const previews = await previewReservationResolved(tenantId, dispatchId, input.lines)
  for (const p of previews) {
    if (!p.ok) throw new ValidationError(p.message ?? 'Reservation preview failed')
  }

  const actor = userId(req)
  await prisma.$transaction(async (tx) => {
    for (const lineInput of input.lines) {
      const line = lineMap.get(lineInput.outboundDispatchLineId)!
      const qty = toDecimal(lineInput.quantity)

      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT odl.id
        FROM outbound_dispatch_lines odl
        INNER JOIN outbound_dispatches od ON od.id = odl.outboundDispatchId
        WHERE odl.id = ${line.id}
          AND odl.tenantId = ${tenantId}
          AND od.status = 'DRAFT'
        FOR UPDATE
      `
      if (!locked.length) {
        throw new InvalidStateError('Dispatch line is no longer available for reservation')
      }

      const existing = await tx.inventoryStockReservation.aggregate({
        where: {
          tenantId,
          outboundDispatchLineId: line.id,
          status: 'ACTIVE',
          demandType: 'DISPATCH',
        },
        _sum: { quantity: true, fulfilledQty: true, releasedQty: true },
      })
      const existingNet = toDecimal(existing._sum.quantity)
        .minus(toDecimal(existing._sum.fulfilledQty))
        .minus(toDecimal(existing._sum.releasedQty))
      if (existingNet.plus(qty).greaterThan(toDecimal(line.quantity))) {
        throw new ValidationError('Cannot reserve more than the remaining dispatch line quantity')
      }

      const balance = await getOrCreateBalance(tx, tenantId, line.itemId, line.warehouseId)
      if (qty.greaterThan(freeQty(balance))) {
        throw new InventoryInsufficientStockError('Cannot reserve more than free quantity')
      }
      const reservationNumber = await nextCode(tenantId, 'STOCK_RESERVATION', tx)
      await tx.inventoryStockReservation.create({
        data: {
          tenantId,
          reservationNumber,
          itemId: line.itemId,
          warehouseId: line.warehouseId,
          quantity: qty,
          demandType: 'DISPATCH',
          demandId: line.id,
          outboundDispatchId: dispatchId,
          outboundDispatchLineId: line.id,
          dispatchRequirementId: line.dispatchRequirementId,
          salesOrderId: line.salesOrderId,
          salesOrderLineId: line.salesOrderLineId,
          referenceNo: dispatch.dispatchNo,
          remarks: input.remarks ?? null,
          idempotencyKey: input.idempotencyKey
            ? `${input.idempotencyKey}:${line.id}`
            : null,
          createdBy: actor || null,
          updatedBy: actor || null,
        },
      })
      await applyReservationDeltaInTx(tx, tenantId, line.itemId, line.warehouseId, qty)
    }
  })

  return listReservationsForDispatch(tenantId, dispatchId)
}

export async function listReservationsForDispatch(tenantId: string, dispatchId: string) {
  const rows = await prisma.inventoryStockReservation.findMany({
    where: { tenantId, outboundDispatchId: dispatchId },
    orderBy: { createdAt: 'asc' },
    include: {
      item: { select: { id: true, code: true, name: true } },
      warehouse: { select: { id: true, code: true, name: true } },
    },
  })
  return rows.map((r) => ({
    id: r.id,
    reservationNumber: r.reservationNumber,
    outboundDispatchLineId: r.outboundDispatchLineId ?? r.demandId,
    itemId: r.itemId,
    warehouseId: r.warehouseId,
    quantity: n(r.quantity),
    fulfilledQty: n(r.fulfilledQty),
    releasedQty: n(r.releasedQty),
    netReservedQty: n(netReservedQty(r)),
    status: r.status,
    demandType: r.demandType,
    createdAt: r.createdAt.toISOString(),
    item: r.item,
    warehouse: r.warehouse,
  }))
}

export async function getReservationPosition(tenantId: string, dispatchId: string) {
  const dispatch = await outboundRepo.findById(tenantId, dispatchId)
  if (!dispatch) throw new NotFoundError('Outbound dispatch not found')
  const reservations = await listReservationsForDispatch(tenantId, dispatchId)
  const byLine = dispatch.lines.map((line) => {
    const lineRes = reservations.filter((r) => r.outboundDispatchLineId === line.id)
    const netReserved = roundQty(lineRes.reduce((s, r) => s + r.netReservedQty, 0))
    return {
      outboundDispatchLineId: line.id,
      lineNo: line.lineNo,
      itemId: line.itemId,
      warehouseId: line.warehouseId,
      dispatchQty: n(line.quantity),
      netReservedQty: netReserved,
      unreservedQty: roundQty(Math.max(0, n(line.quantity) - netReserved)),
      reservations: lineRes,
    }
  })
  return {
    outboundDispatchId: dispatchId,
    dispatchNo: dispatch.dispatchNo,
    status: dispatch.status,
    lines: byLine,
  }
}

export async function releaseReservations(
  req: Request,
  tenantId: string,
  dispatchId: string,
  input: ReleaseReservationsInput,
) {
  await loadDraftDispatch(tenantId, dispatchId)
  const actor = userId(req)
  const targets =
    input.quantities ??
    (input.reservationIds ?? []).map((id) => ({ reservationId: id, quantity: -1 }))

  if (!targets.length) throw new ValidationError('No reservations specified for release')

  await prisma.$transaction(async (tx) => {
    for (const target of targets) {
      const reservation = await tx.inventoryStockReservation.findFirst({
        where: {
          id: target.reservationId,
          tenantId,
          outboundDispatchId: dispatchId,
          status: 'ACTIVE',
        },
      })
      if (!reservation) throw new NotFoundError('Active reservation not found')

      const net = netReservedQty(reservation)
      const releaseQty =
        target.quantity < 0 ? net : toDecimal(Math.min(target.quantity, n(net)))
      if (!isPositive(releaseQty)) continue

      const newReleased = toDecimal(reservation.releasedQty).plus(releaseQty)
      const newNet = subDec(subDec(reservation.quantity, reservation.fulfilledQty), newReleased)
      const status =
        newNet.lessThanOrEqualTo(0) || !isPositive(newNet) ? 'CANCELLED' : reservation.status

      await tx.inventoryStockReservation.update({
        where: { id: reservation.id },
        data: {
          releasedQty: newReleased,
          status,
          cancelledAt: status === 'CANCELLED' ? new Date() : undefined,
          cancelledBy: status === 'CANCELLED' ? actor || null : undefined,
          remarks: input.reason ?? reservation.remarks,
          updatedBy: actor || null,
        },
      })
      await applyReservationDeltaInTx(
        tx,
        tenantId,
        reservation.itemId,
        reservation.warehouseId,
        releaseQty.negated(),
      )
    }
  })

  return getReservationPosition(tenantId, dispatchId)
}

export async function reallocateReservation(
  req: Request,
  tenantId: string,
  dispatchId: string,
  input: ReallocateReservationInput,
) {
  await loadDraftDispatch(tenantId, dispatchId)
  const actor = userId(req)
  const qty = toDecimal(input.quantity)
  if (!isPositive(qty)) throw new ValidationError('Reallocate quantity must be positive')

  await prisma.$transaction(async (tx) => {
    const reservation = await tx.inventoryStockReservation.findFirst({
      where: {
        id: input.reservationId,
        tenantId,
        outboundDispatchId: dispatchId,
        status: 'ACTIVE',
      },
    })
    if (!reservation) throw new NotFoundError('Active reservation not found')
    if (reservation.warehouseId === input.toWarehouseId) {
      throw new ConflictError('Reservation is already at the target warehouse')
    }

    const net = netReservedQty(reservation)
    if (qty.greaterThan(net)) {
      throw new ValidationError('Cannot reallocate more than net reserved quantity')
    }

    const targetBalance = await getOrCreateBalance(
      tx,
      tenantId,
      reservation.itemId,
      input.toWarehouseId,
    )
    if (qty.greaterThan(freeQty(targetBalance))) {
      throw new InventoryInsufficientStockError('Insufficient free quantity at target warehouse')
    }

    await applyReservationDeltaInTx(
      tx,
      tenantId,
      reservation.itemId,
      reservation.warehouseId,
      qty.negated(),
    )
    await applyReservationDeltaInTx(tx, tenantId, reservation.itemId, input.toWarehouseId, qty)

    if (qty.equals(net)) {
      await tx.inventoryStockReservation.update({
        where: { id: reservation.id },
        data: {
          warehouseId: input.toWarehouseId,
          remarks: input.reason ?? reservation.remarks,
          updatedBy: actor || null,
          sourceVersion: { increment: 1 },
        },
      })
    } else {
      await tx.inventoryStockReservation.update({
        where: { id: reservation.id },
        data: {
          quantity: subDec(reservation.quantity, qty),
          updatedBy: actor || null,
          sourceVersion: { increment: 1 },
        },
      })
      const reservationNumber = await nextCode(tenantId, 'STOCK_RESERVATION', tx)
      await tx.inventoryStockReservation.create({
        data: {
          tenantId,
          reservationNumber,
          itemId: reservation.itemId,
          warehouseId: input.toWarehouseId,
          quantity: qty,
          demandType: reservation.demandType,
          demandId: reservation.demandId,
          outboundDispatchId: reservation.outboundDispatchId,
          outboundDispatchLineId: reservation.outboundDispatchLineId,
          dispatchRequirementId: reservation.dispatchRequirementId,
          salesOrderId: reservation.salesOrderId,
          salesOrderLineId: reservation.salesOrderLineId,
          referenceNo: reservation.referenceNo,
          remarks: input.reason ?? reservation.remarks,
          createdBy: actor || null,
          updatedBy: actor || null,
        },
      })
    }
  })

  return getReservationPosition(tenantId, dispatchId)
}

export async function getTrackingAvailability(
  tenantId: string,
  dispatchId: string,
  lineId: string,
) {
  const line = await prisma.outboundDispatchLine.findFirst({
    where: { id: lineId, tenantId, outboundDispatchId: dispatchId },
  })
  if (!line) throw new NotFoundError('Dispatch line not found')
  const [batches, serials] = await Promise.all([
    prisma.inventoryBatchBalance.findMany({
      where: {
        tenantId,
        itemId: line.itemId,
        warehouseId: line.warehouseId,
        stockStatus: 'UNRESTRICTED',
        quantity: { gt: 0 },
      },
      include: { batch: { select: { id: true, batchNumber: true, expiryDate: true, status: true } } },
      orderBy: { batch: { expiryDate: 'asc' } },
    }),
    prisma.inventorySerial.findMany({
      where: {
        tenantId,
        itemId: line.itemId,
        warehouseId: line.warehouseId,
        stockStatus: 'UNRESTRICTED',
        status: 'AVAILABLE',
      },
      select: { id: true, serialNumber: true, batchId: true },
      orderBy: { serialNumber: 'asc' },
    }),
  ])
  return {
    outboundDispatchLineId: lineId,
    itemId: line.itemId,
    warehouseId: line.warehouseId,
    lots: batches.map((row) => ({
      batchId: row.batchId,
      lotRef: row.batch.batchNumber,
      availableQty: n(row.quantity),
      expiryDate: row.batch.expiryDate?.toISOString().slice(0, 10) ?? null,
      status: row.batch.status,
    })),
    serials: serials.map((row) => ({
      serialId: row.id,
      serialRef: row.serialNumber,
      batchId: row.batchId,
      availableQty: 1,
    })),
  }
}
