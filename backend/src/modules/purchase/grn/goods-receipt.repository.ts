import type { GoodsReceiptStatus, GrnLineToleranceStatus, GrnLineWeightToleranceStatus, GrnReceiptApprovalReason, Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import type { ListGoodsReceiptsQuery } from './goods-receipt.validation.js'

const includeGrn = {
  lines: { orderBy: { lineNumber: 'asc' as const } },
  purchaseOrder: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      expectedDeliveryDate: true,
      paymentTerms: true,
      deliveryTerms: true,
      currencyCode: true,
    },
  },
  vendor: {
    select: { id: true, code: true, name: true, gstin: true },
  },
  warehouse: {
    select: { id: true, code: true, name: true, plantId: true },
  },
} as const

export type GrnLineCreateData = {
  lineNumber: number
  purchaseOrderLineId: string
  itemId: string | null
  itemCodeSnapshot: string
  itemNameSnapshot: string
  description: string | null
  uomId: string | null
  uomCodeSnapshot: string
  uomConversionFactor: number
  unitCostPrimary: number
  orderedQuantity: number
  previouslyReceivedQuantity: number
  openQuantity: number
  challanQuantity: number
  receivedQuantity: number
  damagedQuantity: number
  shortQuantity: number
  excessQuantity: number
  acceptedForQcQuantity: number
  acceptedQuantity: number
  rejectedQuantity: number
  orderedUomQuantity: number
  receivedUomQuantity: number
  acceptedUomQuantity: number
  rejectedUomQuantity: number
  rate: number
  amount: number
  warehouseId: string | null
  storageLocationId: string | null
  binId: string | null
  binCodeSnapshot: string
  batchNumber: string | null
  heatNumber: string | null
  lotNumber: string | null
  serialNumber: string | null
  manufacturingDate: Date | null
  expiryDate: Date | null
  qcRequired: boolean
  tolerancePercentage: number
  variancePercentage: number | null
  toleranceStatus: GrnLineToleranceStatus
  receivingToleranceIdSnapshot: string | null
  receivingToleranceCodeSnapshot: string
  receivingToleranceNameSnapshot: string
  receivingTolerancePercentageSnapshot: number
  weightReceivingToleranceIdSnapshot: string | null
  weightReceivingToleranceCodeSnapshot: string
  weightReceivingToleranceNameSnapshot: string
  weightReceivingTolerancePercentageSnapshot: number
  maximumAllowedUnitQuantity: number
  unitVariance: number
  receivedWeight: number | null
  expectedWeight: number | null
  maximumAllowedWeight: number | null
  weightVariance: number | null
  weightVariancePercentage: number | null
  weightConversionRateSnapshot: number | null
  weightUomIdSnapshot: string | null
  weightUomCodeSnapshot: string
  manualUnitEntry: boolean
  manualWeightEntry: boolean
  weightToleranceStatus: GrnLineWeightToleranceStatus
  requiresApproval: boolean
  approvalReasons: GrnReceiptApprovalReason[]
  shortCloseRequested: boolean
  shortCloseReason: string | null
  closeOpenQuantity: boolean
  receivingCondition: import('@prisma/client').GrnReceivingCondition
  receivingConditionReason: string | null
  remarks: string | null
}

export async function findGoodsReceipts(tenantId: string, query: ListGoodsReceiptsQuery) {
  const { getPagination } = await import('../../../utils/pagination.js')
  const { skip, take } = getPagination({ ...query, page: query.page ?? 1, limit: query.limit ?? 50 })

  const where: Prisma.GoodsReceiptWhereInput = {
    ...tenantActiveFilter(tenantId),
    ...(query.status ? { status: query.status as GoodsReceiptStatus } : {}),
    ...(query.purchaseOrderId ? { purchaseOrderId: query.purchaseOrderId } : {}),
    ...(query.vendorId ? { vendorId: query.vendorId } : {}),
    ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
    ...(query.search
      ? {
          OR: [
            { grnNumber: { contains: query.search } },
            { purchaseOrderNumber: { contains: query.search } },
            { vendorNameSnapshot: { contains: query.search } },
            { vendorChallanNumber: { contains: query.search } },
            { gateEntryNumber: { contains: query.search } },
          ],
        }
      : {}),
  }

  const [items, total] = await Promise.all([
    prisma.goodsReceipt.findMany({
      where,
      skip,
      take,
      orderBy: { receiptDate: query.sortOrder },
      include: includeGrn,
    }),
    prisma.goodsReceipt.count({ where }),
  ])

  return { items, total, page: query.page ?? 1, limit: take }
}

export async function findGoodsReceiptById(tenantId: string, id: string) {
  return prisma.goodsReceipt.findFirst({
    where: { id, ...tenantActiveFilter(tenantId) },
    include: includeGrn,
  })
}

export async function updateGoodsReceipt(
  tenantId: string,
  id: string,
  data: Prisma.GoodsReceiptUncheckedUpdateInput,
  tx: Prisma.TransactionClient = prisma,
) {
  const result = await tx.goodsReceipt.updateMany({
    where: { id, tenantId, deletedAt: null },
    data,
  })
  if (result.count !== 1) return null
  return tx.goodsReceipt.findFirst({
    where: { id, tenantId },
    include: includeGrn,
  })
}

export async function replaceGoodsReceiptLines(
  tenantId: string,
  goodsReceiptId: string,
  lines: GrnLineCreateData[],
  tx: Prisma.TransactionClient,
) {
  await tx.goodsReceiptLine.deleteMany({ where: { tenantId, goodsReceiptId } })
  await tx.goodsReceiptLine.createMany({
    data: lines.map((line) => ({ ...line, tenantId, goodsReceiptId })),
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
      documentType: 'GOODS_RECEIPT',
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

export async function findDuplicateChallan(
  tenantId: string,
  vendorId: string,
  vendorChallanNumber: string,
  excludeId?: string,
) {
  return prisma.goodsReceipt.findFirst({
    where: {
      tenantId,
      vendorId,
      vendorChallanNumber,
      deletedAt: null,
      status: { notIn: ['CANCELLED', 'REVERSED'] },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, grnNumber: true },
  })
}

export { includeGrn }
