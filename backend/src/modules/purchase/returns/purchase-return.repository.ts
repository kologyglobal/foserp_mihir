import type { Prisma, PurchaseReturnStatus } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import type { ListPurchaseReturnsQuery } from './purchase-return.validation.js'
export const includePurchaseReturn = { lines: { orderBy: { lineNumber: 'asc' as const } } } as const
export async function findPurchaseReturns(tenantId: string, query: ListPurchaseReturnsQuery) {
  const { getPagination } = await import('../../../utils/pagination.js')
  const { skip, take } = getPagination({
    page: query.page ?? 1,
    limit: query.limit ?? 50,
    sortOrder: query.sortOrder ?? 'desc',
  })
  const where: Prisma.PurchaseReturnWhereInput = {
    ...tenantActiveFilter(tenantId),
    ...(query.status ? { status: query.status as PurchaseReturnStatus } : {}),
    ...(query.vendorId ? { vendorId: query.vendorId } : {}),
    ...(query.purchaseOrderId ? { purchaseOrderId: query.purchaseOrderId } : {}),
    ...(query.goodsReceiptId ? { goodsReceiptId: query.goodsReceiptId } : {}),
    ...(query.search ? { returnNumber: { contains: query.search } } : {}),
  }
  const [items, total] = await Promise.all([
    prisma.purchaseReturn.findMany({ where, include: includePurchaseReturn, skip, take, orderBy: { returnDate: query.sortOrder } }),
    prisma.purchaseReturn.count({ where }),
  ])
  return { items, total, page: query.page ?? 1, limit: take }
}
export const findPurchaseReturnById = (tenantId: string, id: string) =>
  prisma.purchaseReturn.findFirst({ where: { id, ...tenantActiveFilter(tenantId) }, include: includePurchaseReturn })
export async function updatePurchaseReturn(tenantId: string, id: string, data: Prisma.PurchaseReturnUncheckedUpdateInput, tx: Prisma.TransactionClient = prisma) {
  const result = await tx.purchaseReturn.updateMany({ where: { id, tenantId, deletedAt: null }, data })
  if (!result.count) return null
  return tx.purchaseReturn.findFirst({ where: { id, tenantId, deletedAt: null }, include: includePurchaseReturn })
}
export async function replacePurchaseReturnLines(
  tenantId: string,
  purchaseReturnId: string,
  lines: Array<Omit<Prisma.PurchaseReturnLineUncheckedCreateWithoutPurchaseReturnInput, 'tenantId'>>,
  tx: Prisma.TransactionClient,
) {
  await tx.purchaseReturnLine.deleteMany({ where: { tenantId, purchaseReturnId } })
  await tx.purchaseReturnLine.createMany({ data: lines.map((line) => ({ ...line, tenantId, purchaseReturnId })) })
}
export const addReturnHistory = (
  tenantId: string, id: string, number: string, action: string, fromStatus: string | null,
  toStatus: string, actorId: string, remarks: string | undefined, tx: Prisma.TransactionClient,
) => tx.purchaseStatusHistory.create({ data: {
  tenantId, documentType: 'PURCHASE_RETURN', documentId: id, documentNumber: number,
  action, fromStatus, toStatus, actorId, remarks: remarks?.trim() || null,
} })
