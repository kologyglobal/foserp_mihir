import { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { getPagination } from '../../../utils/pagination.js'
import { freeQty, getBalance, unrestrictedQty } from '../shared/balance.service.js'
import { mapStockBalance } from '../shared/inventory.mappers.js'
import { dec } from '../shared/quantity.helpers.js'
import type { ListBalancesQuery } from './balance.schemas.js'

export async function listBalances(tenantId: string, query: ListBalancesQuery) {
  const { skip, take, page, limit } = getPagination(query)
  const where = {
    tenantId,
    ...(query.itemId ? { itemId: query.itemId } : {}),
    ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
  }

  const [rows, total, transferLines] = await Promise.all([
    prisma.inventoryStockBalance.findMany({
      where,
      skip,
      take,
      orderBy: { updatedAt: 'desc' },
      include: {
        item: { select: { id: true, code: true, name: true } },
        warehouse: { select: { id: true, code: true, name: true } },
      },
    }),
    prisma.inventoryStockBalance.count({ where }),
    prisma.inventoryTransferLine.findMany({
      where: {
        tenantId,
        ...(query.itemId ? { itemId: query.itemId } : {}),
        transfer: { status: { in: ['IN_TRANSIT', 'PARTIALLY_RECEIVED'] } },
      },
      select: {
        itemId: true,
        dispatchedQty: true,
        receivedQty: true,
        transfer: { select: { fromWarehouseId: true } },
      },
    }),
  ])
  const inTransit = new Map<string, number>()
  for (const line of transferLines) {
    const key = `${line.itemId}:${line.transfer.fromWarehouseId}`
    inTransit.set(key, (inTransit.get(key) ?? 0) + line.dispatchedQty.minus(line.receivedQty).toNumber())
  }

  return {
    items: rows.map((row) => mapStockBalance(row, inTransit.get(`${row.itemId}:${row.warehouseId}`) ?? 0)),
    total,
    page,
    limit,
  }
}

export async function getStockPosition(tenantId: string, itemId: string, warehouseId: string) {
  const balance = await getBalance(tenantId, itemId, warehouseId)
  if (!balance) {
    return {
      itemId,
      warehouseId,
      onHandQty: '0',
      reservedQty: '0',
      unrestrictedQty: '0',
      qcHoldQty: '0',
      blockedQty: '0',
      rejectedQty: '0',
      inTransitQty: '0',
      freeQty: '0',
    }
  }
  const transit = await prisma.inventoryTransferLine.aggregate({
    where: {
      tenantId,
      itemId,
      transfer: {
        fromWarehouseId: warehouseId,
        status: { in: ['IN_TRANSIT', 'PARTIALLY_RECEIVED'] },
      },
    },
    _sum: { dispatchedQty: true, receivedQty: true },
  })
  return {
    itemId,
    warehouseId,
    onHandQty: dec(balance.onHandQty),
    reservedQty: dec(balance.reservedQty),
    unrestrictedQty: dec(unrestrictedQty(balance)),
    qcHoldQty: dec(balance.qcHoldQty),
    blockedQty: dec(balance.blockedQty),
    rejectedQty: dec(balance.rejectedQty),
    inTransitQty: dec(
      (transit._sum.dispatchedQty ?? new Prisma.Decimal(0)).minus(
        transit._sum.receivedQty ?? new Prisma.Decimal(0),
      ),
    ),
    freeQty: dec(freeQty(balance)),
  }
}
