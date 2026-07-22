import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import { getPagination } from '../../../utils/pagination.js'
import { NotFoundError } from '../../../utils/errors.js'
import type { ListWorkOrdersQuery } from './work-order.schemas.js'

function buildWhere(tenantId: string, query: ListWorkOrdersQuery) {
  const where: Prisma.ProductionOrderWhereInput = {
    ...tenantActiveFilter(tenantId),
    ...(query.status ? { status: query.status } : {}),
    ...(query.healthStatus ? { healthStatus: query.healthStatus } : {}),
    ...(query.productItemId ? { productItemId: query.productItemId } : {}),
    ...(query.salesOrderId ? { salesOrderId: query.salesOrderId } : {}),
    ...(query.supervisorId ? { supervisorId: query.supervisorId } : {}),
    ...(query.managerId ? { managerId: query.managerId } : {}),
  }
  if (query.search) {
    where.OR = [{ orderNumber: { contains: query.search } }, { jobNumber: { contains: query.search } }]
  }
  return where
}

export async function listWorkOrders(tenantId: string, query: ListWorkOrdersQuery) {
  const { skip, take } = getPagination(query)
  const where = buildWhere(tenantId, query)
  const [items, total] = await Promise.all([
    prisma.productionOrder.findMany({ where, skip, take, orderBy: { createdAt: query.sortOrder } }),
    prisma.productionOrder.count({ where }),
  ])
  return { items, total, page: query.page, limit: query.limit }
}

export async function getWorkOrder(tenantId: string, id: string) {
  const order = await prisma.productionOrder.findFirst({ where: { id, ...tenantActiveFilter(tenantId) } })
  if (!order) throw new NotFoundError('Work order not found')
  return order
}

export async function getWorkOrderDetail(tenantId: string, id: string) {
  const order = await prisma.productionOrder.findFirst({
    where: { id, ...tenantActiveFilter(tenantId) },
    include: {
      bomSnapshot: { include: { lines: { orderBy: { sequence: 'asc' } } } },
      routingSnapshot: true,
      stages: { orderBy: { displayOrder: 'asc' } },
      operations: { orderBy: { sequence: 'asc' } },
      dependencies: true,
    },
  })
  if (!order) throw new NotFoundError('Work order not found')
  return order
}

export async function getWorkOrderForUpdate(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  const order = await tx.productionOrder.findFirst({ where: { id, ...tenantActiveFilter(tenantId) } })
  if (!order) throw new NotFoundError('Work order not found')
  return order
}

export async function listActivities(tenantId: string, productionOrderId: string) {
  return prisma.productionActivity.findMany({
    where: { tenantId, productionOrderId },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
}

export async function listLedgerEntries(tenantId: string, productionOrderId: string) {
  return prisma.productionStageLedger.findMany({
    where: { tenantId, productionOrderId },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })
}
