import type { Prisma, PurchaseOrderStatus } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import type { ListPurchaseOrdersQuery } from './purchase-order.validation.js'

const includeOrder = {
  lines: { orderBy: { lineNumber: 'asc' as const } },
  vendor: {
    select: {
      id: true,
      code: true,
      name: true,
      gstin: true,
      state: true,
      address: true,
      city: true,
    },
  },
  purchaseRequisition: {
    select: { id: true, requisitionNumber: true },
  },
  requestForQuotation: {
    select: { id: true, rfqNumber: true },
  },
} as const

export async function findPurchaseOrders(tenantId: string, query: ListPurchaseOrdersQuery) {
  const { getPagination } = await import('../../../utils/pagination.js')
  const pageSize = query.pageSize ?? query.limit
  const { skip, take } = getPagination({ ...query, page: query.page ?? 1, limit: pageSize ?? 50 })

  const where: Prisma.PurchaseOrderWhereInput = {
    ...tenantActiveFilter(tenantId),
    ...(query.status ? { status: query.status as PurchaseOrderStatus } : {}),
    ...(query.vendorId ? { vendorId: query.vendorId } : {}),
    ...(query.search
      ? {
          OR: [
            { orderNumber: { contains: query.search } },
            { remarks: { contains: query.search } },
            { vendor: { name: { contains: query.search } } },
            { vendor: { code: { contains: query.search } } },
          ],
        }
      : {}),
  }

  const [items, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      skip,
      take,
      orderBy: { orderDate: query.sortOrder },
      include: includeOrder,
    }),
    prisma.purchaseOrder.count({ where }),
  ])

  return { items, total, page: query.page ?? 1, limit: take }
}

export async function findPurchaseOrderById(tenantId: string, id: string) {
  return prisma.purchaseOrder.findFirst({
    where: { id, ...tenantActiveFilter(tenantId) },
    include: includeOrder,
  })
}
