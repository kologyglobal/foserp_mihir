import type { Request } from 'express'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { NotFoundError } from '../../../utils/errors.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { getPagination } from '../../../utils/pagination.js'
import { applyReservationDeltaInTx, freeQty, getOrCreateBalance } from '../shared/balance.service.js'
import {
  InventoryInsufficientStockError,
  InventoryItemBlockedError,
  InventoryItemNotStockableError,
  InventoryReservationInvalidStateError,
  InventoryReservationNotFoundError,
  InventoryWarehouseInactiveError,
} from '../shared/inventory.errors.js'
import { mapStockReservation } from '../shared/inventory.mappers.js'
import { isPositive, toDecimal } from '../shared/quantity.helpers.js'
import type { CancelReservationInput, CreateReservationInput, ListReservationsQuery } from './reservation.schemas.js'

async function validateItemAndWarehouse(
  tenantId: string,
  itemId: string,
  warehouseId: string,
): Promise<void> {
  const item = await prisma.masterItem.findFirst({
    where: { id: itemId, tenantId, deletedAt: null },
    select: { id: true, isStockable: true, isBlocked: true, status: true },
  })
  if (!item) throw new NotFoundError('Item not found')
  if (!item.isStockable) throw new InventoryItemNotStockableError()
  if (item.isBlocked) throw new InventoryItemBlockedError()
  if (item.status !== 'ACTIVE') throw new InventoryItemBlockedError('Item is not active')

  const warehouse = await prisma.masterWarehouse.findFirst({
    where: { id: warehouseId, tenantId, deletedAt: null },
    select: { id: true, status: true },
  })
  if (!warehouse) throw new NotFoundError('Warehouse not found')
  if (warehouse.status !== 'ACTIVE') throw new InventoryWarehouseInactiveError()
}

export async function createReservation(req: Request, tenantId: string, input: CreateReservationInput) {
  const userId = req.context?.userId ?? ''
  const qty = toDecimal(input.quantity)
  if (!isPositive(qty)) throw new InventoryInsufficientStockError('Reservation quantity must be positive')

  await validateItemAndWarehouse(tenantId, input.itemId, input.warehouseId)

  if (input.demandType === 'DISPATCH') {
    const dispatchLine = await prisma.outboundDispatchLine.findFirst({
      where: {
        id: input.demandId,
        tenantId,
        itemId: input.itemId,
        warehouseId: input.warehouseId,
        outboundDispatch: { status: 'DRAFT' },
      },
      select: { id: true },
    })
    if (!dispatchLine) {
      throw new NotFoundError(
        'Draft dispatch line not found for this item and warehouse; use the outbound dispatch line ID',
      )
    }
  }

  const reservation = await prisma.$transaction(async (tx) => {
    if (input.idempotencyKey) {
      const existing = await tx.inventoryStockReservation.findFirst({
        where: { tenantId, idempotencyKey: input.idempotencyKey },
      })
      if (existing) return existing
    }

    let reservationDispatchLine:
      | {
          id: string
          outboundDispatchId: string
          dispatchRequirementId: string | null
          salesOrderId: string | null
          salesOrderLineId: string | null
          quantity: Prisma.Decimal
          outboundDispatch: { id: string; dispatchNo: string }
        }
      | null = null
    if (input.demandType === 'DISPATCH') {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT odl.id
        FROM outbound_dispatch_lines odl
        INNER JOIN outbound_dispatches od ON od.id = odl.outboundDispatchId
        WHERE odl.id = ${input.demandId}
          AND odl.tenantId = ${tenantId}
          AND odl.itemId = ${input.itemId}
          AND odl.warehouseId = ${input.warehouseId}
          AND od.status = 'DRAFT'
        FOR UPDATE
      `
      if (!locked.length) {
        throw new NotFoundError('Draft dispatch line is no longer available for reservation')
      }
      reservationDispatchLine = await tx.outboundDispatchLine.findFirst({
        where: { id: locked[0]!.id, tenantId },
        include: { outboundDispatch: { select: { id: true, dispatchNo: true } } },
      })
      if (!reservationDispatchLine) {
        throw new NotFoundError('Draft dispatch line is no longer available for reservation')
      }

      const existing = await tx.inventoryStockReservation.aggregate({
        where: {
          tenantId,
          outboundDispatchLineId: reservationDispatchLine.id,
          status: 'ACTIVE',
          demandType: 'DISPATCH',
        },
        _sum: { quantity: true, fulfilledQty: true, releasedQty: true },
      })
      const existingNet = toDecimal(existing._sum.quantity)
        .minus(toDecimal(existing._sum.fulfilledQty))
        .minus(toDecimal(existing._sum.releasedQty))
      if (existingNet.plus(qty).greaterThan(reservationDispatchLine.quantity)) {
        throw new InventoryInsufficientStockError(
          'Cannot reserve more than the remaining dispatch line quantity',
        )
      }
    }

    const balance = await getOrCreateBalance(tx, tenantId, input.itemId, input.warehouseId)
    if (qty.greaterThan(freeQty(balance))) {
      throw new InventoryInsufficientStockError('Cannot reserve more than free quantity')
    }

    const reservationNumber = await nextCode(tenantId, 'STOCK_RESERVATION', tx)
    const row = await tx.inventoryStockReservation.create({
      data: {
        tenantId,
        reservationNumber,
        itemId: input.itemId,
        warehouseId: input.warehouseId,
        quantity: qty,
        demandType: input.demandType,
        demandId: input.demandId,
        outboundDispatchId: reservationDispatchLine?.outboundDispatchId ?? null,
        outboundDispatchLineId: reservationDispatchLine?.id ?? null,
        dispatchRequirementId: reservationDispatchLine?.dispatchRequirementId ?? null,
        salesOrderId: reservationDispatchLine?.salesOrderId ?? null,
        salesOrderLineId: reservationDispatchLine?.salesOrderLineId ?? null,
        referenceNo: input.referenceNo ?? reservationDispatchLine?.outboundDispatch.dispatchNo ?? null,
        remarks: input.remarks ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        createdBy: userId,
        updatedBy: userId,
      },
    })

    await applyReservationDeltaInTx(tx, tenantId, input.itemId, input.warehouseId, qty)
    return row
  })

  return mapStockReservation(reservation)
}

export async function cancelReservation(
  req: Request,
  tenantId: string,
  reservationId: string,
  input: CancelReservationInput,
) {
  const userId = req.context?.userId ?? ''

  const updated = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM inventory_stock_reservations
      WHERE id = ${reservationId} AND tenantId = ${tenantId}
      FOR UPDATE
    `
    if (!locked.length) throw new InventoryReservationNotFoundError()

    const reservation = await tx.inventoryStockReservation.findFirstOrThrow({
      where: { id: locked[0]!.id },
    })
    if (reservation.status !== 'ACTIVE') {
      throw new InventoryReservationInvalidStateError('Only ACTIVE reservations can be cancelled')
    }

    const remaining = toDecimal(reservation.quantity)
      .minus(toDecimal(reservation.fulfilledQty))
      .minus(toDecimal(reservation.releasedQty))

    const row = await tx.inventoryStockReservation.update({
      where: { id: reservation.id },
      data: {
        status: 'CANCELLED',
        releasedQty: toDecimal(reservation.releasedQty).plus(
          remaining.greaterThan(0) ? remaining : toDecimal(0),
        ),
        cancelledAt: new Date(),
        cancelledBy: userId,
        remarks: input.remarks ?? reservation.remarks,
        updatedBy: userId,
      },
    })

    if (remaining.greaterThan(0)) {
      await applyReservationDeltaInTx(
        tx,
        tenantId,
        reservation.itemId,
        reservation.warehouseId,
        remaining.negated(),
      )
    }

    return row
  })

  return mapStockReservation(updated)
}

export async function listReservations(tenantId: string, query: ListReservationsQuery) {
  const { skip, take, page, limit } = getPagination(query)
  const where = {
    tenantId,
    ...(query.itemId ? { itemId: query.itemId } : {}),
    ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
    ...(query.demandType ? { demandType: query.demandType } : {}),
    ...(query.demandId ? { demandId: query.demandId } : {}),
    ...(query.status ? { status: query.status } : {}),
  }

  const [rows, total] = await Promise.all([
    prisma.inventoryStockReservation.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        item: { select: { id: true, code: true, name: true } },
        warehouse: { select: { id: true, code: true, name: true } },
      },
    }),
    prisma.inventoryStockReservation.count({ where }),
  ])

  return {
    items: rows.map(mapStockReservation),
    total,
    page,
    limit,
  }
}
