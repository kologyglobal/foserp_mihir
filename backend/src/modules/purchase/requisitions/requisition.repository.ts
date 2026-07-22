import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { PurchaseRequisitionNotFoundError } from '../shared/requisition.errors.js'
import type { RequisitionRow } from '../shared/mappers.js'
import type { ListRequisitionsQuery } from './requisition.schemas.js'
import { getPagination } from '../../../utils/pagination.js'

export const requisitionInclude = {
  warehouse: { select: { id: true, code: true, name: true } },
  lines: {
    orderBy: { lineNo: 'asc' as const },
    include: {
      item: { select: { id: true, code: true, name: true } },
      warehouse: { select: { id: true, code: true, name: true } },
    },
  },
} satisfies Prisma.PurchaseRequisitionInclude

export async function findRequisitionById(tenantId: string, id: string): Promise<RequisitionRow | null> {
  return prisma.purchaseRequisition.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: requisitionInclude,
  })
}

export async function findRequisitionByIdOrThrow(tenantId: string, id: string): Promise<RequisitionRow> {
  const row = await findRequisitionById(tenantId, id)
  if (!row) throw new PurchaseRequisitionNotFoundError()
  return row
}

export async function findRequisitionByIdempotencyKey(tenantId: string, idempotencyKey: string): Promise<RequisitionRow | null> {
  return prisma.purchaseRequisition.findFirst({
    where: { tenantId, idempotencyKey, deletedAt: null },
    include: requisitionInclude,
  })
}

export async function listRequisitions(tenantId: string, query: ListRequisitionsQuery) {
  const { skip, take, page, limit } = getPagination(query)
  const where: Prisma.PurchaseRequisitionWhereInput = {
    tenantId,
    deletedAt: null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.source ? { source: query.source } : {}),
    ...(query.priority ? { priority: query.priority } : {}),
    ...(query.productionOrderId ? { productionOrderId: query.productionOrderId } : {}),
    ...(query.salesOrderId ? { salesOrderId: query.salesOrderId } : {}),
    ...(query.search
      ? {
          OR: [
            { prNumber: { contains: query.search } },
            { purpose: { contains: query.search } },
            { projectRef: { contains: query.search } },
          ],
        }
      : {}),
  }

  const [rows, total] = await Promise.all([
    prisma.purchaseRequisition.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: requisitionInclude,
    }),
    prisma.purchaseRequisition.count({ where }),
  ])

  return { rows, total, page, limit }
}

export async function listRequisitionsByProductionOrder(tenantId: string, productionOrderId: string) {
  return prisma.purchaseRequisition.findMany({
    where: { tenantId, productionOrderId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    include: requisitionInclude,
  })
}

export async function getNextLineNo(tx: Prisma.TransactionClient, requisitionId: string): Promise<number> {
  const agg = await tx.purchaseRequisitionLine.aggregate({
    where: { requisitionId },
    _max: { lineNo: true },
  })
  return (agg._max.lineNo ?? 0) + 1
}

export async function countLines(tx: Prisma.TransactionClient, requisitionId: string): Promise<number> {
  return tx.purchaseRequisitionLine.count({ where: { requisitionId } })
}

export async function findLineById(tenantId: string, lineId: string) {
  return prisma.purchaseRequisitionLine.findFirst({
    where: { id: lineId, tenantId },
    include: {
      requisition: true,
      item: { select: { id: true, code: true, name: true } },
      warehouse: { select: { id: true, code: true, name: true } },
    },
  })
}
