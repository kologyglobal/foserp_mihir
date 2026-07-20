import type { Prisma, PurchasePlanningStatus, PurchasePriority, PurchasePlanningPurchaseType } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import type { ListPlanningSheetQuery } from './purchase-planning.validation.js'
import { OPEN_PO_STATUSES, startOfTodayUtc } from './purchase-planning.workflow.js'

function parseDateBound(value: string | Date | null | undefined): Date | undefined {
  if (value == null || value === '') return undefined
  if (value instanceof Date) return value
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00.000Z`)
  return new Date(value)
}

export function buildPlanningWhere(
  tenantId: string,
  query: Partial<ListPlanningSheetQuery> = {},
): Prisma.PurchasePlanningRowWhereInput {
  const today = startOfTodayUtc()
  const and: Prisma.PurchasePlanningRowWhereInput[] = []

  if (query.planningDateFrom || query.planningDateTo) {
    and.push({
      planningDate: {
        ...(query.planningDateFrom ? { gte: parseDateBound(query.planningDateFrom) } : {}),
        ...(query.planningDateTo ? { lte: parseDateBound(query.planningDateTo) } : {}),
      },
    })
  }
  if (query.requiredDateFrom || query.requiredDateTo) {
    and.push({
      requiredDate: {
        ...(query.requiredDateFrom ? { gte: parseDateBound(query.requiredDateFrom) } : {}),
        ...(query.requiredDateTo ? { lte: parseDateBound(query.requiredDateTo) } : {}),
      },
    })
  }
  if (query.overdue) {
    and.push({
      requiredDate: { lt: today },
      status: { notIn: ['CANCELLED', 'COMPLETED', 'PO_CREATED'] },
    })
  }
  if (query.poPending) {
    and.push({ status: 'PO_PENDING' })
  }
  if (query.search) {
    and.push({
      OR: [
        { planningNumber: { contains: query.search } },
        { purchaseRequisitionNumberSnapshot: { contains: query.search } },
        { itemCodeSnapshot: { contains: query.search } },
        { itemNameSnapshot: { contains: query.search } },
        { remarks: { contains: query.search } },
      ],
    })
  }

  return {
    ...tenantActiveFilter(tenantId),
    ...(query.planningNumber ? { planningNumber: { contains: query.planningNumber } } : {}),
    ...(query.purchaseRequisitionNumber
      ? { purchaseRequisitionNumberSnapshot: { contains: query.purchaseRequisitionNumber } }
      : {}),
    ...(query.status ? { status: query.status as PurchasePlanningStatus } : {}),
    ...(query.departmentId ? { departmentId: query.departmentId } : {}),
    ...(query.itemId ? { itemId: query.itemId } : {}),
    ...(query.selectedVendorId ? { selectedVendorId: query.selectedVendorId } : {}),
    ...(query.buyerId ? { buyerId: query.buyerId } : {}),
    ...(query.priority ? { priority: query.priority as PurchasePriority } : {}),
    ...(query.purchaseType ? { purchaseType: query.purchaseType as PurchasePlanningPurchaseType } : {}),
    ...(and.length ? { AND: and } : {}),
  }
}

export async function findPlanningRows(tenantId: string, query: ListPlanningSheetQuery) {
  const where = buildPlanningWhere(tenantId, query)
  const skip = (query.page - 1) * query.limit
  const take = query.limit
  const orderBy: Prisma.PurchasePlanningRowOrderByWithRelationInput = {
    [query.sortBy]: query.sortOrder,
  }

  const [items, total] = await Promise.all([
    prisma.purchasePlanningRow.findMany({ where, skip, take, orderBy }),
    prisma.purchasePlanningRow.count({ where }),
  ])

  return { items, total, page: query.page, limit: query.limit }
}

export async function findPlanningRowById(tenantId: string, id: string) {
  return prisma.purchasePlanningRow.findFirst({
    where: { id, ...tenantActiveFilter(tenantId) },
  })
}

export async function findPlanningRowsByIds(tenantId: string, ids: string[]) {
  if (ids.length === 0) return []
  return prisma.purchasePlanningRow.findMany({
    where: { id: { in: ids }, ...tenantActiveFilter(tenantId) },
  })
}

export async function findActivePlanningRowsForRecalc(
  tenantId: string,
  limit = 500,
) {
  return prisma.purchasePlanningRow.findMany({
    where: {
      ...tenantActiveFilter(tenantId),
      status: { notIn: ['CANCELLED', 'COMPLETED'] },
    },
    take: limit,
    orderBy: { planningDate: 'desc' },
  })
}

export async function updatePlanningRow(
  tenantId: string,
  id: string,
  data: Prisma.PurchasePlanningRowUncheckedUpdateInput,
  tx: Prisma.TransactionClient = prisma,
) {
  const existing = await tx.purchasePlanningRow.findFirst({
    where: { id, ...tenantActiveFilter(tenantId) },
  })
  if (!existing) return null
  return tx.purchasePlanningRow.update({ where: { id }, data })
}

export async function updatePlanningRowsMany(
  tenantId: string,
  ids: string[],
  data: Prisma.PurchasePlanningRowUncheckedUpdateInput,
  tx: Prisma.TransactionClient = prisma,
) {
  if (ids.length === 0) return { count: 0 }
  return tx.purchasePlanningRow.updateMany({
    where: { id: { in: ids }, ...tenantActiveFilter(tenantId) },
    data,
  })
}

export async function getPlanningSummaryAggregates(tenantId: string) {
  const today = startOfTodayUtc()
  const base = tenantActiveFilter(tenantId)

  const [
    totalPendingPlanning,
    criticalItems,
    overdueItems,
    vendorSelectionPending,
    poPending,
    poCreated,
    estimatedAgg,
  ] = await Promise.all([
    prisma.purchasePlanningRow.count({
      where: { ...base, status: 'PENDING_PLANNING' },
    }),
    prisma.purchasePlanningRow.count({
      where: {
        ...base,
        priority: { in: ['CRITICAL', 'URGENT'] },
        status: { notIn: ['CANCELLED', 'COMPLETED'] },
      },
    }),
    prisma.purchasePlanningRow.count({
      where: {
        ...base,
        requiredDate: { lt: today },
        status: { notIn: ['CANCELLED', 'COMPLETED', 'PO_CREATED'] },
      },
    }),
    prisma.purchasePlanningRow.count({
      where: {
        ...base,
        selectedVendorId: null,
        status: { in: ['PENDING_PLANNING', 'UNDER_REVIEW'] },
      },
    }),
    prisma.purchasePlanningRow.count({
      where: { ...base, status: 'PO_PENDING' },
    }),
    prisma.purchasePlanningRow.count({
      where: { ...base, status: 'PO_CREATED' },
    }),
    prisma.purchasePlanningRow.aggregate({
      where: {
        ...base,
        status: { notIn: ['CANCELLED', 'COMPLETED'] },
      },
      _sum: { estimatedAmount: true },
    }),
  ])

  return {
    totalPendingPlanning,
    criticalItems,
    overdueItems,
    vendorSelectionPending,
    poPending,
    poCreated,
    totalEstimatedPurchaseValue: Number(estimatedAgg._sum.estimatedAmount ?? 0),
  }
}

/**
 * Batch open-PO remaining qty by itemId for the tenant (avoids N+1).
 * Open = approved / sent / partially received POs; remaining = qty − received.
 */
export async function loadOpenPoQtyByItemId(
  tenantId: string,
  itemIds: string[],
  tx: Prisma.TransactionClient = prisma,
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  const unique = [...new Set(itemIds.filter(Boolean))]
  if (unique.length === 0) return map

  const lines = await tx.purchaseOrderLine.findMany({
    where: {
      tenantId,
      itemId: { in: unique },
      purchaseOrder: {
        tenantId,
        deletedAt: null,
        status: { in: [...OPEN_PO_STATUSES] },
      },
    },
    select: {
      itemId: true,
      quantity: true,
      receivedQuantity: true,
    },
  })

  for (const line of lines) {
    if (!line.itemId) continue
    const remaining = Math.max(0, Number(line.quantity) - Number(line.receivedQuantity))
    map.set(line.itemId, (map.get(line.itemId) ?? 0) + remaining)
  }
  return map
}

/**
 * Inventory backend is deferred — stock resolves to 0 until stock ledgers exist.
 * Kept as a single batch helper so callers stay N+1-free when stock is wired.
 */
export async function loadCurrentStockByItemId(
  _tenantId: string,
  itemIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  for (const id of itemIds) {
    if (id) map.set(id, 0)
  }
  return map
}

export async function createPlanningStatusHistory(
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
      documentType: 'PURCHASE_PLANNING_ROW',
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
