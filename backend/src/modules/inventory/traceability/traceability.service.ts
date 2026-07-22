import { prisma } from '../../../config/database.js'
import { NotFoundError } from '../../../utils/errors.js'
import { mapStockMovement } from '../shared/inventory.mappers.js'
import { dec } from '../shared/quantity.helpers.js'

const movementInclude = {
  item: { select: { id: true, code: true, name: true } },
  warehouse: { select: { id: true, code: true, name: true } },
} as const

export async function getBatchLineage(tenantId: string, batchId: string) {
  const batch = await prisma.inventoryBatch.findFirst({
    where: { id: batchId, tenantId },
    include: {
      item: { select: { id: true, code: true, name: true } },
      balances: {
        include: { warehouse: { select: { id: true, code: true, name: true } } },
        orderBy: [{ warehouseId: 'asc' }, { stockStatus: 'asc' }],
      },
      movements: { include: movementInclude, orderBy: [{ movementDate: 'asc' }, { createdAt: 'asc' }] },
      serials: { select: { id: true, serialNumber: true, warehouseId: true, stockStatus: true, status: true } },
    },
  })
  if (!batch) throw new NotFoundError('Inventory batch not found')
  return {
    ...batch,
    balances: batch.balances.map((row) => ({ ...row, quantity: dec(row.quantity) })),
    movements: batch.movements.map(mapStockMovement),
  }
}

export async function getSerialLineage(tenantId: string, serialId: string) {
  const serial = await prisma.inventorySerial.findFirst({
    where: { id: serialId, tenantId },
    include: {
      item: { select: { id: true, code: true, name: true } },
      batch: true,
      warehouse: { select: { id: true, code: true, name: true } },
      lineage: {
        include: {
          movement: { include: movementInclude },
          warehouse: { select: { id: true, code: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!serial) throw new NotFoundError('Inventory serial not found')
  return {
    ...serial,
    lineage: serial.lineage.map((row) => ({
      ...row,
      quantity: dec(row.quantity),
      movement: mapStockMovement(row.movement),
    })),
  }
}

export async function getItemLineage(tenantId: string, itemId: string) {
  const item = await prisma.masterItem.findFirst({
    where: { id: itemId, tenantId, deletedAt: null },
    select: { id: true, code: true, name: true, batchTracked: true, serialTracked: true },
  })
  if (!item) throw new NotFoundError('Item not found')
  const [balances, batches, serials, movements] = await Promise.all([
    prisma.inventoryStockBalance.findMany({
      where: { tenantId, itemId },
      include: { warehouse: { select: { id: true, code: true, name: true } } },
    }),
    prisma.inventoryBatch.findMany({
      where: { tenantId, itemId },
      include: { balances: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.inventorySerial.findMany({
      where: { tenantId, itemId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.inventoryStockMovement.findMany({
      where: { tenantId, itemId },
      include: movementInclude,
      orderBy: [{ movementDate: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    }),
  ])
  return {
    item,
    balances: balances.map((row) => ({
      ...row,
      onHandQty: dec(row.onHandQty),
      reservedQty: dec(row.reservedQty),
      qcHoldQty: dec(row.qcHoldQty),
      blockedQty: dec(row.blockedQty),
      rejectedQty: dec(row.rejectedQty),
    })),
    batches: batches.map((batch) => ({
      ...batch,
      balances: batch.balances.map((row) => ({ ...row, quantity: dec(row.quantity) })),
    })),
    serials,
    movements: movements.map(mapStockMovement),
  }
}
