import type { InventoryStockBalance, InventoryStockStatus, Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { NotFoundError } from '../../../utils/errors.js'
import { addDec, subDec } from './quantity.helpers.js'

type BucketBalance = Pick<
  InventoryStockBalance,
  'onHandQty' | 'reservedQty' | 'qcHoldQty' | 'blockedQty' | 'rejectedQty'
>

export function unrestrictedQty(balance: BucketBalance): Prisma.Decimal {
  return subDec(
    subDec(subDec(balance.onHandQty, balance.qcHoldQty), balance.blockedQty),
    balance.rejectedQty,
  )
}

export function freeQty(balance: BucketBalance): Prisma.Decimal {
  return subDec(unrestrictedQty(balance), balance.reservedQty)
}

/** Lock or create the balance row for item+warehouse inside a transaction. */
export async function getOrCreateBalance(
  tx: Prisma.TransactionClient,
  tenantId: string,
  itemId: string,
  warehouseId: string,
): Promise<InventoryStockBalance> {
  const locked = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM inventory_stock_balances
    WHERE tenantId = ${tenantId} AND itemId = ${itemId} AND warehouseId = ${warehouseId}
    FOR UPDATE
  `

  if (locked.length > 0) {
    return tx.inventoryStockBalance.findFirstOrThrow({ where: { id: locked[0]!.id } })
  }

  await tx.inventoryStockBalance.create({
    data: { tenantId, itemId, warehouseId },
  })

  const created = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM inventory_stock_balances
    WHERE tenantId = ${tenantId} AND itemId = ${itemId} AND warehouseId = ${warehouseId}
    FOR UPDATE
  `
  return tx.inventoryStockBalance.findFirstOrThrow({ where: { id: created[0]!.id } })
}

export async function getBalance(
  tenantId: string,
  itemId: string,
  warehouseId: string,
): Promise<InventoryStockBalance | null> {
  return prisma.inventoryStockBalance.findFirst({
    where: { tenantId, itemId, warehouseId },
  })
}

export async function applyMovementInTx(
  tx: Prisma.TransactionClient,
  tenantId: string,
  itemId: string,
  warehouseId: string,
  signedQty: Prisma.Decimal,
  stockStatus: InventoryStockStatus = 'UNRESTRICTED',
): Promise<{ balance: InventoryStockBalance; balanceAfter: Prisma.Decimal }> {
  const balance = await getOrCreateBalance(tx, tenantId, itemId, warehouseId)
  const balanceAfter = addDec(balance.onHandQty, signedQty)
  const bucketField =
    stockStatus === 'QC_HOLD'
      ? 'qcHoldQty'
      : stockStatus === 'BLOCKED'
        ? 'blockedQty'
        : stockStatus === 'REJECTED'
          ? 'rejectedQty'
          : null
  const bucketAfter = bucketField ? addDec(balance[bucketField], signedQty) : null
  if (balanceAfter.lessThan(0) || (bucketAfter && bucketAfter.lessThan(0))) {
    throw new NotFoundError('Stock status quantity would become negative')
  }
  const updated = await tx.inventoryStockBalance.update({
    where: { id: balance.id },
    data: {
      onHandQty: balanceAfter,
      ...(bucketField && bucketAfter ? { [bucketField]: bucketAfter } : {}),
    },
  })
  return { balance: updated, balanceAfter }
}

export async function applyStatusTransferInTx(
  tx: Prisma.TransactionClient,
  tenantId: string,
  itemId: string,
  warehouseId: string,
  fromStatus: InventoryStockStatus,
  toStatus: InventoryStockStatus,
  quantity: Prisma.Decimal,
): Promise<InventoryStockBalance> {
  const balance = await getOrCreateBalance(tx, tenantId, itemId, warehouseId)
  if (!quantity.greaterThan(0) || fromStatus === toStatus) {
    throw new NotFoundError('Stock status transfer must have a positive quantity and different statuses')
  }
  const getQty = (status: InventoryStockStatus) =>
    status === 'UNRESTRICTED'
      ? unrestrictedQty(balance)
      : status === 'QC_HOLD'
        ? balance.qcHoldQty
        : status === 'BLOCKED'
          ? balance.blockedQty
          : balance.rejectedQty
  if (quantity.greaterThan(getQty(fromStatus))) {
    throw new NotFoundError(`Insufficient ${fromStatus} quantity`)
  }
  const field = (status: InventoryStockStatus) =>
    status === 'QC_HOLD'
      ? 'qcHoldQty'
      : status === 'BLOCKED'
        ? 'blockedQty'
        : status === 'REJECTED'
          ? 'rejectedQty'
          : null
  const data: Prisma.InventoryStockBalanceUpdateInput = {}
  const fromField = field(fromStatus)
  const toField = field(toStatus)
  if (fromField) data[fromField] = subDec(balance[fromField], quantity)
  if (toField) data[toField] = addDec(balance[toField], quantity)
  return tx.inventoryStockBalance.update({ where: { id: balance.id }, data })
}

export async function applyReservationDeltaInTx(
  tx: Prisma.TransactionClient,
  tenantId: string,
  itemId: string,
  warehouseId: string,
  delta: Prisma.Decimal,
): Promise<InventoryStockBalance> {
  const balance = await getOrCreateBalance(tx, tenantId, itemId, warehouseId)
  const reservedAfter = addDec(balance.reservedQty, delta)
  if (reservedAfter.lessThan(0)) {
    throw new NotFoundError('Reserved quantity would become negative')
  }
  return tx.inventoryStockBalance.update({
    where: { id: balance.id },
    data: { reservedQty: reservedAfter },
  })
}
