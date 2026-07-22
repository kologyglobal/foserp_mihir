import type { Prisma, QualityInspectionStatus } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import type { ListQualityInspectionsQuery } from './quality-inspection.validation.js'
export const includeQualityInspection = { lines: { orderBy: { lineNumber: 'asc' as const } } } as const
export async function findQualityInspections(tenantId: string, query: ListQualityInspectionsQuery) {
  const { getPagination } = await import('../../../utils/pagination.js')
  const { skip, take } = getPagination({
    page: query.page ?? 1,
    limit: query.limit ?? 50,
    sortOrder: query.sortOrder ?? 'desc',
  })
  const where: Prisma.PurchaseQualityInspectionWhereInput = {
    ...tenantActiveFilter(tenantId),
    ...(query.status ? { status: query.status as QualityInspectionStatus } : {}),
    ...(query.goodsReceiptId ? { goodsReceiptId: query.goodsReceiptId } : {}),
    ...(query.purchaseOrderId ? { purchaseOrderId: query.purchaseOrderId } : {}),
    ...(query.vendorId ? { vendorId: query.vendorId } : {}),
    ...(query.search ? { inspectionNumber: { contains: query.search } } : {}),
  }
  const [items, total] = await Promise.all([
    prisma.purchaseQualityInspection.findMany({ where, include: includeQualityInspection, skip, take, orderBy: { inspectionDate: query.sortOrder } }),
    prisma.purchaseQualityInspection.count({ where }),
  ])
  return { items, total, page: query.page ?? 1, limit: take }
}
export const findQualityInspectionById = (tenantId: string, id: string) =>
  prisma.purchaseQualityInspection.findFirst({ where: { id, ...tenantActiveFilter(tenantId) }, include: includeQualityInspection })
export async function updateQualityInspection(tenantId: string, id: string, data: Prisma.PurchaseQualityInspectionUncheckedUpdateInput, tx: Prisma.TransactionClient = prisma) {
  const result = await tx.purchaseQualityInspection.updateMany({ where: { id, tenantId, deletedAt: null }, data })
  if (!result.count) return null
  return tx.purchaseQualityInspection.findFirst({ where: { id, tenantId, deletedAt: null }, include: includeQualityInspection })
}
export async function replaceQualityInspectionLines(
  tenantId: string,
  qualityInspectionId: string,
  lines: Array<
    Omit<
      Prisma.PurchaseQualityInspectionLineUncheckedCreateInput,
      'id' | 'tenantId' | 'qualityInspectionId' | 'createdAt' | 'updatedAt'
    >
  >,
  tx: Prisma.TransactionClient,
) {
  await tx.purchaseQualityInspectionLine.deleteMany({ where: { tenantId, qualityInspectionId } })
  await tx.purchaseQualityInspectionLine.createMany({
    data: lines.map((line) => ({ ...line, tenantId, qualityInspectionId })),
  })
}
export const addQiHistory = (
  tenantId: string, id: string, number: string, action: string, fromStatus: string | null,
  toStatus: string, actorId: string, remarks: string | undefined, tx: Prisma.TransactionClient,
) => tx.purchaseStatusHistory.create({ data: {
  tenantId, documentType: 'QUALITY_INSPECTION', documentId: id, documentNumber: number,
  action, fromStatus, toStatus, actorId, remarks: remarks?.trim() || null,
} })
