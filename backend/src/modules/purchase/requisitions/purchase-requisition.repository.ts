import type { Prisma, PurchaseRequisitionStatus } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import type { ListPurchaseRequisitionsQuery } from './purchase-requisition.validation.js'

const lineOrder = { lineNumber: 'asc' as const }

export async function findPurchaseRequisitions(tenantId: string, query: ListPurchaseRequisitionsQuery) {
  const { getPagination } = await import('../../../utils/pagination.js')
  const { skip, take } = getPagination(query)

  const where: Prisma.PurchaseRequisitionWhereInput = {
    ...tenantActiveFilter(tenantId),
    ...(query.status ? { status: query.status as PurchaseRequisitionStatus } : {}),
    ...(query.rfqRequired !== undefined ? { rfqRequired: query.rfqRequired } : {}),
    ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
    ...(query.search
      ? {
          OR: [
            { requisitionNumber: { contains: query.search } },
            { purchasePurpose: { contains: query.search } },
            { remarks: { contains: query.search } },
          ],
        }
      : {}),
  }

  const [items, total] = await Promise.all([
    prisma.purchaseRequisition.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: query.sortOrder },
      include: { lines: { orderBy: lineOrder } },
    }),
    prisma.purchaseRequisition.count({ where }),
  ])

  return { items, total, page: query.page, limit: query.limit }
}

export async function findPurchaseRequisitionById(tenantId: string, id: string) {
  return prisma.purchaseRequisition.findFirst({
    where: { id, ...tenantActiveFilter(tenantId) },
    include: { lines: { orderBy: lineOrder } },
  })
}

export async function createPurchaseRequisition(
  data: Prisma.PurchaseRequisitionCreateInput,
  tx: Prisma.TransactionClient = prisma,
) {
  return tx.purchaseRequisition.create({
    data,
    include: { lines: { orderBy: lineOrder } },
  })
}

export async function replacePurchaseRequisitionLines(
  tenantId: string,
  purchaseRequisitionId: string,
  lines: Array<{
    lineNumber: number
    itemId: string | null
    itemCodeSnapshot: string
    itemNameSnapshot: string
    description: string | null
    requiredQuantity: number
    uomId: string | null
    estimatedRate: number
    estimatedAmount: number
    warehouseId: string | null
    binId: string | null
    preferredVendorId: string | null
    requiredDate: Date | null
    remarks: string | null
  }>,
  tx: Prisma.TransactionClient = prisma,
) {
  await tx.purchaseRequisitionLine.deleteMany({
    where: { tenantId, purchaseRequisitionId },
  })
  if (lines.length === 0) return
  await tx.purchaseRequisitionLine.createMany({
    data: lines.map((line) => ({
      tenantId,
      purchaseRequisitionId,
      lineNumber: line.lineNumber,
      itemId: line.itemId,
      itemCodeSnapshot: line.itemCodeSnapshot,
      itemNameSnapshot: line.itemNameSnapshot,
      description: line.description,
      requiredQuantity: line.requiredQuantity,
      uomId: line.uomId,
      estimatedRate: line.estimatedRate,
      estimatedAmount: line.estimatedAmount,
      warehouseId: line.warehouseId,
      binId: line.binId,
      preferredVendorId: line.preferredVendorId,
      requiredDate: line.requiredDate,
      remarks: line.remarks,
    })),
  })
}

export async function updatePurchaseRequisition(
  tenantId: string,
  id: string,
  data: Prisma.PurchaseRequisitionUncheckedUpdateInput,
  tx: Prisma.TransactionClient = prisma,
) {
  const existing = await tx.purchaseRequisition.findFirst({
    where: { id, ...tenantActiveFilter(tenantId) },
  })
  if (!existing) return null
  return tx.purchaseRequisition.update({
    where: { id },
    data,
    include: { lines: { orderBy: lineOrder } },
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
      documentType: 'PURCHASE_REQUISITION',
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
    purchaseRequisitionId: string
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
      documentType: 'PURCHASE_REQUISITION',
      documentId: input.documentId,
      documentNumber: input.documentNumber,
      purchaseRequisitionId: input.purchaseRequisitionId,
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
  purchaseRequisitionId: string,
  status: 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'RETURNED',
  actorId: string,
  remarks?: string | null,
  tx: Prisma.TransactionClient = prisma,
) {
  await tx.purchaseApproval.updateMany({
    where: {
      tenantId,
      purchaseRequisitionId,
      status: 'PENDING',
    },
    data: {
      status,
      approverId: actorId,
      respondedAt: new Date(),
      remarks: remarks ?? null,
    },
  })
}

export async function softDeletePlanningRowsForPr(
  tenantId: string,
  purchaseRequisitionId: string,
  actorId: string,
  tx: Prisma.TransactionClient = prisma,
) {
  await tx.purchasePlanningRow.updateMany({
    where: {
      tenantId,
      purchaseRequisitionId,
      deletedAt: null,
    },
    data: {
      deletedAt: new Date(),
      updatedById: actorId,
      status: 'CANCELLED',
    },
  })
}
