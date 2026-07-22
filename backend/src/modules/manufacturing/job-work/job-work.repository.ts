import { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'

export const detailInclude = {
  vendor: true, item: true, materialWarehouse: true, receiptWarehouse: true,
  materialLines: { include: { item: true }, orderBy: { lineNo: 'asc' } },
  dispatches: { include: { lines: { include: { materialLine: true } } }, orderBy: { dispatchedAt: 'desc' } },
  receipts: { orderBy: { receivedAt: 'desc' } },
} satisfies Prisma.JobWorkOrderInclude

export function find(tenantId: string, id: string) {
  return prisma.jobWorkOrder.findFirst({ where: { id, tenantId, deletedAt: null }, include: detailInclude })
}

export async function list(tenantId: string, query: { status?: string; vendorId?: string; productionOrderId?: string; search?: string; page?: number; limit?: number }) {
  const page = query.page ?? 1; const limit = query.limit ?? 20
  const where: Prisma.JobWorkOrderWhereInput = {
    tenantId, deletedAt: null, ...(query.status ? { status: query.status as never } : {}),
    ...(query.vendorId ? { vendorId: query.vendorId } : {}), ...(query.productionOrderId ? { productionOrderId: query.productionOrderId } : {}),
    ...(query.search ? { OR: [{ jwNumber: { contains: query.search } }, { processName: { contains: query.search } }, { vendor: { name: { contains: query.search } } }, { item: { name: { contains: query.search } } }] } : {}),
  }
  const [items, total] = await Promise.all([prisma.jobWorkOrder.findMany({ where, include: detailInclude, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }), prisma.jobWorkOrder.count({ where })])
  return { items, total, page, limit }
}
