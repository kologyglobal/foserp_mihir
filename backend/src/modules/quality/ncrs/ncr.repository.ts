import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import type { ListNcrsQuery } from './ncr.schemas.js'

export async function listNcrs(tenantId: string, query: ListNcrsQuery) {
  const page = query.page ?? 1
  const limit = query.limit ?? 20
  const where: Prisma.QualityNcrWhereInput = {
    tenantId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.productionOrderId ? { productionOrderId: query.productionOrderId } : {}),
  }
  const [items, total] = await Promise.all([
    prisma.qualityNcr.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.qualityNcr.count({ where }),
  ])
  return { items, total, page, limit }
}

export async function getNcr(tenantId: string, id: string) {
  return prisma.qualityNcr.findFirst({ where: { id, tenantId } })
}
