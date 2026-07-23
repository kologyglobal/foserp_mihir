import { prisma } from '../../../config/database.js'
import { NotFoundError } from '../../../utils/errors.js'
import { getPagination } from '../../../utils/pagination.js'
import { mapStockMovement } from '../shared/inventory.mappers.js'
import type { ListLedgerQuery } from './ledger.schemas.js'

export async function listLedger(tenantId: string, query: ListLedgerQuery) {
  const { skip, take, page, limit } = getPagination(query)
  const where = {
    tenantId,
    ...(query.itemId ? { itemId: query.itemId } : {}),
    ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
    ...(query.movementType ? { movementType: query.movementType } : {}),
    ...(query.referenceType ? { referenceType: query.referenceType } : {}),
    ...(query.workOrderId ? { workOrderId: query.workOrderId } : {}),
    ...(query.stockStatus ? { stockStatus: query.stockStatus } : {}),
    ...(query.batchId ? { batchId: query.batchId } : {}),
    ...(query.serialId ? { serialId: query.serialId } : {}),
    ...(query.fromDate || query.toDate
      ? {
          movementDate: {
            ...(query.fromDate ? { gte: query.fromDate } : {}),
            ...(query.toDate ? { lte: query.toDate } : {}),
          },
        }
      : {}),
  }

  const [rows, total] = await Promise.all([
    prisma.inventoryStockMovement.findMany({
      where,
      skip,
      take,
      orderBy: [{ movementDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        item: { select: { id: true, code: true, name: true } },
        warehouse: { select: { id: true, code: true, name: true } },
      },
    }),
    prisma.inventoryStockMovement.count({ where }),
  ])

  return {
    items: rows.map(mapStockMovement),
    total,
    page,
    limit,
  }
}

export async function getMovement(tenantId: string, id: string) {
  const row = await prisma.inventoryStockMovement.findFirst({
    where: { id, tenantId },
    include: {
      item: { select: { id: true, code: true, name: true } },
      warehouse: { select: { id: true, code: true, name: true } },
    },
  })
  if (!row) throw new NotFoundError('Stock movement not found')
  return mapStockMovement(row)
}
