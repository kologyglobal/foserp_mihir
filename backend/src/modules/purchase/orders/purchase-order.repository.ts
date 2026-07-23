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
    select: {
      id: true,
      requisitionNumber: true,
      warehouseId: true,
      warehouse: { select: { id: true, code: true, name: true, plantId: true } },
    },
  },
  requestForQuotation: {
    select: { id: true, rfqNumber: true },
  },
  deliveryWarehouse: {
    select: { id: true, code: true, name: true, plantId: true },
  },
} as const

export async function resolveUserNames(tenantId: string, userIds: Array<string | null | undefined>) {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))]
  if (ids.length === 0) return new Map<string, string>()
  const users = await prisma.user.findMany({
    where: { tenantId, id: { in: ids }, deletedAt: null },
    select: { id: true, firstName: true, lastName: true },
  })
  return new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]))
}

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

export async function updatePurchaseOrder(
  tenantId: string,
  id: string,
  data: Prisma.PurchaseOrderUncheckedUpdateInput,
  tx: Prisma.TransactionClient = prisma,
) {
  const result = await tx.purchaseOrder.updateMany({
    where: { id, tenantId, deletedAt: null },
    data,
  })
  if (result.count !== 1) return null
  return tx.purchaseOrder.findFirst({
    where: { id, tenantId },
    include: includeOrder,
  })
}

export async function createStatusHistory(
  input: {
    tenantId: string
    documentId: string
    documentNumber?: string | null
    action: string
    fromStatus?: string | null
    toStatus?: string | null
    actorId?: string | null
    remarks?: string | null
  },
  tx: Prisma.TransactionClient = prisma,
) {
  return tx.purchaseStatusHistory.create({
    data: {
      tenantId: input.tenantId,
      documentType: 'PURCHASE_ORDER',
      documentId: input.documentId,
      documentNumber: input.documentNumber ?? null,
      action: input.action,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      actorId: input.actorId ?? null,
      remarks: input.remarks ?? null,
    },
  })
}

export async function createApprovalRequest(
  input: {
    tenantId: string
    documentId: string
    documentNumber: string
    requesterId: string
    amount?: number | null
    level?: number
    approverRole?: string | null
  },
  tx: Prisma.TransactionClient = prisma,
) {
  return tx.purchaseApproval.create({
    data: {
      tenantId: input.tenantId,
      documentType: 'PURCHASE_ORDER',
      documentId: input.documentId,
      documentNumber: input.documentNumber,
      purchaseOrderId: input.documentId,
      level: input.level ?? 1,
      status: 'PENDING',
      approverRole: input.approverRole ?? null,
      requesterId: input.requesterId,
      amount: input.amount ?? null,
    },
  })
}

export async function resolvePendingApprovals(
  tenantId: string,
  purchaseOrderId: string,
  status: 'APPROVED' | 'REJECTED' | 'RETURNED' | 'CANCELLED',
  actorId: string,
  remarks?: string | null,
  tx: Prisma.TransactionClient = prisma,
) {
  await tx.purchaseApproval.updateMany({
    where: { tenantId, purchaseOrderId, status: 'PENDING' },
    data: {
      status,
      approverId: actorId,
      respondedAt: new Date(),
      remarks: remarks ?? null,
    },
  })
}

export async function replacePurchaseOrderLines(
  tenantId: string,
  purchaseOrderId: string,
  lines: Array<{
    lineNumber: number
    itemId: string | null
    itemCodeSnapshot: string
    itemNameSnapshot: string
    description: string | null
    quantity: number
    uomId: string | null
    rate: number
    amount: number
    requiredDate: Date | null
    remarks: string | null
    purchaseRequisitionLineId: string | null
    purchasePlanningRowId: string | null
  }>,
  tx: Prisma.TransactionClient,
) {
  await tx.purchaseOrderLine.deleteMany({ where: { tenantId, purchaseOrderId } })
  await tx.purchaseOrderLine.createMany({
    data: lines.map((line) => ({ ...line, tenantId, purchaseOrderId })),
  })
}
