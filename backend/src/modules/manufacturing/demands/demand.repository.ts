import type { Prisma, ProductionDemand } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import { getPagination } from '../../../utils/pagination.js'
import { NotFoundError } from '../../../utils/errors.js'
import type { ListDemandsQuery } from './demand.schemas.js'

function buildDemandWhere(tenantId: string, query: ListDemandsQuery) {
  const where: Prisma.ProductionDemandWhereInput = {
    ...tenantActiveFilter(tenantId),
    ...(query.status ? { status: query.status } : {}),
    ...(query.sourceType ? { sourceType: query.sourceType } : {}),
    ...(query.productItemId ? { productItemId: query.productItemId } : {}),
    ...(query.salesOrderId ? { salesOrderId: query.salesOrderId } : {}),
  }
  if (query.search) {
    where.OR = [{ demandNumber: { contains: query.search } }, { projectRef: { contains: query.search } }]
  }
  return where
}

export async function listDemands(tenantId: string, query: ListDemandsQuery) {
  const { skip, take } = getPagination(query)
  const where = buildDemandWhere(tenantId, query)
  const [items, total] = await Promise.all([
    prisma.productionDemand.findMany({ where, skip, take, orderBy: { createdAt: query.sortOrder } }),
    prisma.productionDemand.count({ where }),
  ])
  return { items, total, page: query.page, limit: query.limit }
}

export async function getDemand(tenantId: string, demandId: string): Promise<ProductionDemand> {
  const demand = await prisma.productionDemand.findFirst({ where: { id: demandId, ...tenantActiveFilter(tenantId) } })
  if (!demand) throw new NotFoundError('Production demand not found')
  return demand
}

export async function findDemandBySourceLineKey(tenantId: string, sourceLineKey: string) {
  return prisma.productionDemand.findFirst({ where: { tenantId, sourceLineKey, deletedAt: null } })
}

export async function findDemandByIdempotencyKey(tenantId: string, idempotencyKey: string) {
  return prisma.productionDemand.findFirst({ where: { tenantId, idempotencyKey, deletedAt: null } })
}

export async function createDemand(
  data: Prisma.ProductionDemandUncheckedCreateInput,
  tx?: Prisma.TransactionClient,
) {
  const client = tx ?? prisma
  return client.productionDemand.create({ data })
}

export async function updateDemand(
  tenantId: string,
  demandId: string,
  data: Prisma.ProductionDemandUncheckedUpdateInput,
  tx?: Prisma.TransactionClient,
) {
  const client = tx ?? prisma
  return client.productionDemand.update({ where: { id: demandId, tenantId }, data })
}
