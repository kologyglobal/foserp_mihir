import { prisma } from '../../../config/database.js'
import { resolveUserNames } from '../../../shared/index.js'
import * as repo from './sales-order.repository.js'
import { mapSalesOrderToDto } from './sales-order.types.js'
import type { ListSalesOrdersQuery } from './sales-order.validation.js'

export async function listSalesOrders(tenantId: string, query: ListSalesOrdersQuery) {
  const result = await repo.findSalesOrders(tenantId, query)
  const nameMap = await resolveUserNames(
    result.items.flatMap((o) => [o.createdBy, o.updatedBy]),
    tenantId,
    prisma,
  )
  return {
    items: result.items.map((o) =>
      mapSalesOrderToDto(o, {
        createdByName: o.createdBy ? nameMap.get(o.createdBy) : undefined,
        modifiedByName: o.updatedBy ? nameMap.get(o.updatedBy) : undefined,
      }),
    ),
    total: result.total,
    page: result.page,
    limit: result.limit,
  }
}

export async function getSalesOrder(tenantId: string, id: string) {
  const order = await repo.findSalesOrderById(tenantId, id)
  if (!order) {
    const { NotFoundError } = await import('../../../utils/errors.js')
    throw new NotFoundError('Sales order not found')
  }
  const nameMap = await resolveUserNames([order.createdBy, order.updatedBy], tenantId, prisma)
  return mapSalesOrderToDto(order, {
    createdByName: order.createdBy ? nameMap.get(order.createdBy) : undefined,
    modifiedByName: order.updatedBy ? nameMap.get(order.updatedBy) : undefined,
  })
}
