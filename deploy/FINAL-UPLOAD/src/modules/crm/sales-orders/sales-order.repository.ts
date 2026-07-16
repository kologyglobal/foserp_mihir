import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import type { ListSalesOrdersQuery } from './sales-order.validation.js'

export async function findSalesOrders(tenantId: string, query: ListSalesOrdersQuery) {
  const { getPagination } = await import('../../../utils/pagination.js')
  const { skip, take } = getPagination(query)

  const where: Prisma.CrmSalesOrderWhereInput = {
    ...tenantActiveFilter(tenantId),
    ...(query.customerId ? { companyId: query.customerId } : {}),
    ...(query.quotationId ? { quotationId: query.quotationId } : {}),
    ...(query.opportunityId ? { opportunityId: query.opportunityId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { salesOrderNo: { contains: query.search } },
            { quotationNo: { contains: query.search } },
            { customerPoNumber: { contains: query.search } },
          ],
        }
      : {}),
  }

  const [items, total] = await Promise.all([
    prisma.crmSalesOrder.findMany({ where, skip, take, orderBy: { createdAt: query.sortOrder } }),
    prisma.crmSalesOrder.count({ where }),
  ])

  return { items, total, page: query.page, limit: query.limit }
}

export async function findSalesOrderById(tenantId: string, id: string) {
  return prisma.crmSalesOrder.findFirst({
    where: { id, ...tenantActiveFilter(tenantId) },
  })
}

export async function findSalesOrderByQuotationId(tenantId: string, quotationId: string) {
  return prisma.crmSalesOrder.findFirst({
    where: { tenantId, quotationId, deletedAt: null },
  })
}
