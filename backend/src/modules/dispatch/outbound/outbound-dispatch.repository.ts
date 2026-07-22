import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import type { ListOutboundDispatchesQuery } from './outbound-dispatch.schemas.js'

const lineOrder = { lineNo: 'asc' as const }

export async function findById(tenantId: string, id: string) {
  return prisma.outboundDispatch.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: { lines: { orderBy: lineOrder } },
  })
}

export async function findByIdempotencyKey(tenantId: string, idempotencyKey: string) {
  return prisma.outboundDispatch.findFirst({
    where: { tenantId, idempotencyKey, deletedAt: null },
    include: { lines: { orderBy: lineOrder } },
  })
}

export async function list(tenantId: string, query: ListOutboundDispatchesQuery) {
  const where: Prisma.OutboundDispatchWhereInput = {
    tenantId,
    deletedAt: null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.salesOrderId ? { salesOrderId: query.salesOrderId } : {}),
    ...(query.search
      ? {
          OR: [
            { dispatchNo: { contains: query.search } },
            { salesOrderNo: { contains: query.search } },
          ],
        }
      : {}),
  }
  const [total, items] = await Promise.all([
    prisma.outboundDispatch.count({ where }),
    prisma.outboundDispatch.findMany({
      where,
      include: { lines: { orderBy: lineOrder } },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ])
  return { total, items }
}
