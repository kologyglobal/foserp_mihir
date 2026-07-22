import type { DispatchReadinessStatus, DispatchRequirementStatus, Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'

export async function findById(tenantId: string, id: string) {
  return prisma.dispatchRequirement.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: {
      salesOrder: { select: { id: true, salesOrderNo: true, status: true, company: { select: { id: true, name: true } } } },
    },
  })
}

export async function findBySource(tenantId: string, salesOrderId: string, salesOrderLineId: string) {
  return prisma.dispatchRequirement.findFirst({
    where: { tenantId, salesOrderId, salesOrderLineId, deletedAt: null },
  })
}

export async function list(
  tenantId: string,
  query: {
    page: number
    limit: number
    readinessStatus?: DispatchReadinessStatus | DispatchReadinessStatus[]
    status?: DispatchRequirementStatus
    customerId?: string
    salesOrderId?: string
    itemId?: string
    overdueOnly?: boolean
    search?: string
  },
) {
  const readinessFilter = query.readinessStatus
    ? Array.isArray(query.readinessStatus)
      ? { in: query.readinessStatus }
      : query.readinessStatus
    : undefined

  const where: Prisma.DispatchRequirementWhereInput = {
    tenantId,
    deletedAt: null,
    ...(query.status ? { status: query.status } : {}),
    ...(readinessFilter ? { readinessStatus: readinessFilter } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(query.salesOrderId ? { salesOrderId: query.salesOrderId } : {}),
    ...(query.itemId ? { itemId: query.itemId } : {}),
    ...(query.overdueOnly
      ? {
          remainingQuantitySnapshot: { gt: 0 },
          status: { in: ['ACTIVE', 'ON_HOLD', 'RECONCILIATION_REQUIRED'] },
          requestedDeliveryDate: { lt: new Date() },
        }
      : {}),
    ...(query.search
      ? {
          OR: [
            { requirementNumber: { contains: query.search } },
            { salesOrder: { salesOrderNo: { contains: query.search } } },
          ],
        }
      : {}),
  }

  const [total, items] = await Promise.all([
    prisma.dispatchRequirement.count({ where }),
    prisma.dispatchRequirement.findMany({
      where,
      include: {
        salesOrder: { select: { id: true, salesOrderNo: true, status: true, company: { select: { id: true, name: true } } } },
      },
      orderBy: [{ requestedDeliveryDate: 'asc' }, { createdAt: 'desc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ])
  return { total, items }
}

export async function upsertRequirement(
  tenantId: string,
  data: Prisma.DispatchRequirementUncheckedCreateInput,
  update: Prisma.DispatchRequirementUncheckedUpdateInput,
) {
  return prisma.dispatchRequirement.upsert({
    where: {
      tenantId_salesOrderId_salesOrderLineId: {
        tenantId,
        salesOrderId: data.salesOrderId,
        salesOrderLineId: data.salesOrderLineId,
      },
    },
    create: data,
    update,
  })
}

export async function countByReadiness(tenantId: string, readinessStatus: DispatchReadinessStatus | DispatchReadinessStatus[]) {
  return prisma.dispatchRequirement.count({
    where: {
      tenantId,
      deletedAt: null,
      status: { in: ['ACTIVE', 'ON_HOLD', 'RECONCILIATION_REQUIRED'] },
      readinessStatus: Array.isArray(readinessStatus) ? { in: readinessStatus } : readinessStatus,
    },
  })
}
