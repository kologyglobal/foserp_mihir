import type { Prisma, VendorQuotationStatus } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import type { ListVendorQuotationsQuery } from './vendor-quotation.validation.js'

const includeQuotation = { lines: { orderBy: { lineNumber: 'asc' as const } } }

export async function findVendorQuotations(tenantId: string, query: ListVendorQuotationsQuery) {
  const { getPagination } = await import('../../../utils/pagination.js')
  const { skip, take } = getPagination({ ...query, page: query.page ?? 1, limit: query.pageSize ?? query.limit ?? 25 })
  const where: Prisma.VendorQuotationWhereInput = {
    ...tenantActiveFilter(tenantId),
    ...(query.requestForQuotationId ? { requestForQuotationId: query.requestForQuotationId } : {}),
    ...(query.vendorId ? { vendorId: query.vendorId } : {}),
    ...(query.status ? { status: query.status as VendorQuotationStatus } : {}),
    ...(query.search
      ? { OR: [{ quotationNumber: { contains: query.search } }, { remarks: { contains: query.search } }] }
      : {}),
  }
  const [items, total] = await Promise.all([
    prisma.vendorQuotation.findMany({ where, skip, take, orderBy: { createdAt: query.sortOrder }, include: includeQuotation }),
    prisma.vendorQuotation.count({ where }),
  ])
  return { items, total, page: query.page ?? 1, limit: take }
}

export function findVendorQuotationById(tenantId: string, id: string, tx: Prisma.TransactionClient = prisma) {
  return tx.vendorQuotation.findFirst({
    where: { id, ...tenantActiveFilter(tenantId) },
    include: includeQuotation,
  })
}

export function createVendorQuotation(data: Prisma.VendorQuotationCreateArgs['data'], tx: Prisma.TransactionClient = prisma) {
  return tx.vendorQuotation.create({ data, include: includeQuotation })
}

export async function replaceVendorQuotationLines(
  tenantId: string,
  vendorQuotationId: string,
  lines: Array<Record<string, unknown>>,
  tx: Prisma.TransactionClient = prisma,
) {
  await tx.vendorQuotationLine.deleteMany({ where: { tenantId, vendorQuotationId } })
  if (lines.length) {
    await tx.vendorQuotationLine.createMany({
      data: lines.map((line) => ({ tenantId, vendorQuotationId, ...line })) as Prisma.VendorQuotationLineCreateManyInput[],
    })
  }
}

export function createStatusHistory(
  tenantId: string,
  documentId: string,
  fromStatus: string | null,
  toStatus: string,
  actorId: string,
  remarks: string | null,
  tx: Prisma.TransactionClient = prisma,
) {
  return tx.purchaseStatusHistory.create({
    data: {
      tenantId,
      documentType: 'VENDOR_QUOTATION',
      documentId,
      action: 'STATUS_CHANGED',
      fromStatus,
      toStatus,
      actorId,
      remarks,
    },
  })
}
