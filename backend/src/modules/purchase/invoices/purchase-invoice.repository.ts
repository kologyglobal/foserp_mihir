import type { Prisma, PurchaseInvoiceStatus } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import type { ListPurchaseInvoicesQuery } from './purchase-invoice.validation.js'

export const includePurchaseInvoice = { lines: { orderBy: { lineNumber: 'asc' as const } } } as const

export async function findPurchaseInvoices(tenantId: string, query: ListPurchaseInvoicesQuery) {
  const { getPagination } = await import('../../../utils/pagination.js')
  const { skip, take } = getPagination({
    page: query.page ?? 1,
    limit: query.limit ?? 50,
    sortOrder: query.sortOrder ?? 'desc',
  })
  const where: Prisma.PurchaseInvoiceWhereInput = {
    ...tenantActiveFilter(tenantId),
    ...(query.status ? { status: query.status as PurchaseInvoiceStatus } : {}),
    ...(query.vendorId ? { vendorId: query.vendorId } : {}),
    ...(query.purchaseOrderId ? { purchaseOrderId: query.purchaseOrderId } : {}),
    ...(query.goodsReceiptId ? { goodsReceiptId: query.goodsReceiptId } : {}),
    ...(query.search ? { OR: [
      { invoiceNumber: { contains: query.search } },
      { vendorInvoiceNumber: { contains: query.search } },
    ] } : {}),
  }
  const [items, total] = await Promise.all([
    prisma.purchaseInvoice.findMany({ where, skip, take, orderBy: { invoiceDate: query.sortOrder }, include: includePurchaseInvoice }),
    prisma.purchaseInvoice.count({ where }),
  ])
  return { items, total, page: query.page ?? 1, limit: take }
}

export const findPurchaseInvoiceById = (tenantId: string, id: string) =>
  prisma.purchaseInvoice.findFirst({ where: { id, ...tenantActiveFilter(tenantId) }, include: includePurchaseInvoice })

export async function updatePurchaseInvoice(
  tenantId: string,
  id: string,
  data: Prisma.PurchaseInvoiceUncheckedUpdateInput,
  tx: Prisma.TransactionClient = prisma,
) {
  const result = await tx.purchaseInvoice.updateMany({ where: { id, tenantId, deletedAt: null }, data })
  if (result.count !== 1) return null
  return tx.purchaseInvoice.findFirst({ where: { id, tenantId, deletedAt: null }, include: includePurchaseInvoice })
}

export async function replacePurchaseInvoiceLines(
  tenantId: string,
  purchaseInvoiceId: string,
  lines: Array<Omit<Prisma.PurchaseInvoiceLineUncheckedCreateInput, 'id' | 'tenantId' | 'purchaseInvoiceId' | 'createdAt' | 'updatedAt'>>,
  tx: Prisma.TransactionClient,
) {
  await tx.purchaseInvoiceLine.deleteMany({ where: { tenantId, purchaseInvoiceId } })
  await tx.purchaseInvoiceLine.createMany({ data: lines.map((line) => ({ ...line, tenantId, purchaseInvoiceId })) })
}

export async function addInvoiceHistory(
  tenantId: string, id: string, number: string, action: string,
  fromStatus: string | null, toStatus: string, actorId: string, remarks: string | undefined,
  tx: Prisma.TransactionClient,
) {
  await tx.purchaseStatusHistory.create({ data: {
    tenantId, documentType: 'PURCHASE_INVOICE', documentId: id, documentNumber: number,
    action, fromStatus, toStatus, actorId, remarks: remarks?.trim() || null,
  } })
}
