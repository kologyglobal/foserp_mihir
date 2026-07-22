import type { InventoryStockBalance, InventoryStockMovement, InventoryStockReservation } from '@prisma/client'
import { dec, toDecimal } from './quantity.helpers.js'

export function isoDateTime(value: Date | null | undefined): string | null {
  if (!value) return null
  return value.toISOString()
}

export function dateOnly(value: Date | null | undefined): string | null {
  if (!value) return null
  return value.toISOString().slice(0, 10)
}

export function mapStockBalance(
  row: InventoryStockBalance & {
    item?: { id: string; code: string; name: string } | null
    warehouse?: { id: string; code: string; name: string } | null
  },
  inTransitQty = 0,
) {
  const onHandQty = toDecimal(row.onHandQty)
  const reservedQty = toDecimal(row.reservedQty)
  return {
    id: row.id,
    tenantId: row.tenantId,
    itemId: row.itemId,
    warehouseId: row.warehouseId,
    onHandQty: dec(onHandQty),
    reservedQty: dec(reservedQty),
    unrestrictedQty: dec(
      onHandQty.minus(row.qcHoldQty).minus(row.blockedQty).minus(row.rejectedQty),
    ),
    qcHoldQty: dec(row.qcHoldQty),
    blockedQty: dec(row.blockedQty),
    rejectedQty: dec(row.rejectedQty),
    inTransitQty: dec(inTransitQty),
    freeQty: dec(
      onHandQty
        .minus(row.qcHoldQty)
        .minus(row.blockedQty)
        .minus(row.rejectedQty)
        .minus(reservedQty),
    ),
    avgRate: dec(row.avgRate),
    stockValue: dec(row.stockValue),
    item: row.item ?? undefined,
    warehouse: row.warehouse ?? undefined,
    updatedAt: isoDateTime(row.updatedAt),
    createdAt: isoDateTime(row.createdAt),
  }
}

export function mapStockMovement(row: InventoryStockMovement) {
  return {
    ...row,
    movementDate: dateOnly(row.movementDate),
    quantity: dec(row.quantity),
    rate: dec(row.rate),
    value: dec(row.value),
    balanceAfter: dec(row.balanceAfter),
    createdAt: isoDateTime(row.createdAt),
  }
}

export function mapStockReservation(row: InventoryStockReservation) {
  const quantity = toDecimal(row.quantity)
  const fulfilledQty = toDecimal(row.fulfilledQty)
  const releasedQty = toDecimal(row.releasedQty)
  return {
    ...row,
    quantity: dec(quantity),
    fulfilledQty: dec(fulfilledQty),
    releasedQty: dec(releasedQty),
    remainingQty: dec(quantity.minus(fulfilledQty).minus(releasedQty)),
    cancelledAt: isoDateTime(row.cancelledAt),
    fulfilledAt: isoDateTime(row.fulfilledAt),
    createdAt: isoDateTime(row.createdAt),
    updatedAt: isoDateTime(row.updatedAt),
  }
}
