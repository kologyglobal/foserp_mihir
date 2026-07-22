import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { NotFoundError } from '../../../utils/errors.js'

export const wipMovementInclude = {
  item: { select: { id: true, code: true, name: true, isStockable: true } },
  fromWarehouse: { select: { id: true, code: true, name: true } },
  toWarehouse: { select: { id: true, code: true, name: true } },
  productionOrder: { select: { id: true, orderNumber: true, status: true } },
  targetProductionOrder: { select: { id: true, orderNumber: true, status: true } },
  materialLine: { select: { id: true, itemId: true, issuedQty: true, returnedQty: true, warehouseId: true } },
} satisfies Prisma.ProductionWipMovementInclude

export type WipMovementRow = Prisma.ProductionWipMovementGetPayload<{ include: typeof wipMovementInclude }>

export async function findByIdempotencyKey(tenantId: string, idempotencyKey: string) {
  return prisma.productionWipMovement.findFirst({
    where: { tenantId, idempotencyKey, deletedAt: null },
    include: wipMovementInclude,
  })
}

export async function findMovement(tenantId: string, workOrderId: string, movementId: string) {
  const row = await prisma.productionWipMovement.findFirst({
    where: {
      id: movementId,
      tenantId,
      deletedAt: null,
      OR: [{ productionOrderId: workOrderId }, { targetProductionOrderId: workOrderId }],
    },
    include: wipMovementInclude,
  })
  if (!row) throw new NotFoundError('WIP movement not found')
  return row
}

export async function listMovements(
  tenantId: string,
  workOrderId: string,
  opts: { movementType?: string; limit?: number; offset?: number },
) {
  const where: Prisma.ProductionWipMovementWhereInput = {
    tenantId,
    deletedAt: null,
    OR: [{ productionOrderId: workOrderId }, { targetProductionOrderId: workOrderId }],
    ...(opts.movementType ? { movementType: opts.movementType as never } : {}),
  }
  const [total, data] = await Promise.all([
    prisma.productionWipMovement.count({ where }),
    prisma.productionWipMovement.findMany({
      where,
      include: wipMovementInclude,
      orderBy: { createdAt: 'desc' },
      take: opts.limit ?? 50,
      skip: opts.offset ?? 0,
    }),
  ])
  return { total, data }
}
