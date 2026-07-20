import { PurchaseOrderNotFoundError } from './purchase-order.errors.js'
import { mapPurchaseOrderToDto } from './purchase-order.mapper.js'
import * as repo from './purchase-order.repository.js'
import type { ListPurchaseOrdersQuery } from './purchase-order.validation.js'

export async function listPurchaseOrders(tenantId: string, query: ListPurchaseOrdersQuery) {
  const result = await repo.findPurchaseOrders(tenantId, query)
  return {
    items: result.items.map(mapPurchaseOrderToDto),
    total: result.total,
    page: result.page,
    limit: result.limit,
  }
}

export async function getPurchaseOrder(tenantId: string, id: string) {
  const order = await repo.findPurchaseOrderById(tenantId, id)
  if (!order) throw new PurchaseOrderNotFoundError()
  return mapPurchaseOrderToDto(order)
}
