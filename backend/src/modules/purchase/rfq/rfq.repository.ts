import type { Prisma, RequestForQuotationStatus } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import type { ListRfqsQuery } from './rfq.validation.js'

const includeRfq = {
  lines: { orderBy: { lineNumber: 'asc' as const } },
  vendors: {
    orderBy: { invitedAt: 'asc' as const },
    include: {
      vendor: {
        select: {
          id: true,
          code: true,
          name: true,
          email: true,
          contactPerson: true,
          contactPhone: true,
          gstin: true,
          state: true,
          rating: true,
        },
      },
    },
  },
  purchaseRequisition: {
    select: {
      id: true,
      requisitionNumber: true,
      warehouse: { select: { id: true, code: true, name: true } },
    },
  },
}

export async function findRfqs(tenantId: string, query: ListRfqsQuery) {
  const { getPagination } = await import('../../../utils/pagination.js')
  const pageSize = query.pageSize ?? query.limit
  const { skip, take } = getPagination({ ...query, page: query.page ?? 1, limit: pageSize ?? 25 })

  const where: Prisma.RequestForQuotationWhereInput = {
    ...tenantActiveFilter(tenantId),
    ...(query.status ? { status: query.status as RequestForQuotationStatus } : {}),
    ...(query.purchaseRequisitionId
      ? { purchaseRequisitionId: query.purchaseRequisitionId }
      : {}),
    ...(query.search
      ? {
          OR: [
            { rfqNumber: { contains: query.search } },
            { title: { contains: query.search } },
            { remarks: { contains: query.search } },
          ],
        }
      : {}),
  }

  const [items, total] = await Promise.all([
    prisma.requestForQuotation.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: query.sortOrder },
      include: includeRfq,
    }),
    prisma.requestForQuotation.count({ where }),
  ])

  return { items, total, page: query.page ?? 1, limit: take }
}

export async function findRfqById(tenantId: string, id: string) {
  return prisma.requestForQuotation.findFirst({
    where: { id, ...tenantActiveFilter(tenantId) },
    include: includeRfq,
  })
}

export async function createRfq(
  data: Prisma.RequestForQuotationCreateInput,
  tx: Prisma.TransactionClient = prisma,
) {
  return tx.requestForQuotation.create({ data, include: includeRfq })
}

export async function updateRfq(
  tenantId: string,
  id: string,
  data: Prisma.RequestForQuotationUpdateInput,
  tx: Prisma.TransactionClient = prisma,
) {
  await tx.requestForQuotation.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: data as never,
  })
  return findRfqByIdTx(tenantId, id, tx)
}

async function findRfqByIdTx(tenantId: string, id: string, tx: Prisma.TransactionClient) {
  return tx.requestForQuotation.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: includeRfq,
  })
}

export async function replaceRfqLines(
  tenantId: string,
  requestForQuotationId: string,
  lines: Array<{
    lineNumber: number
    purchaseRequisitionLineId: string | null
    itemId: string | null
    itemCodeSnapshot: string
    itemNameSnapshot: string
    description: string | null
    requiredQuantity: number
    uomId: string | null
    targetRate: number | null
    requiredDate: Date | null
    remarks: string | null
  }>,
  tx: Prisma.TransactionClient = prisma,
) {
  await tx.requestForQuotationLine.deleteMany({ where: { tenantId, requestForQuotationId } })
  if (!lines.length) return
  await tx.requestForQuotationLine.createMany({
    data: lines.map((l) => ({
      tenantId,
      requestForQuotationId,
      ...l,
    })),
  })
}

export async function replaceRfqVendors(
  tenantId: string,
  requestForQuotationId: string,
  vendorIds: string[],
  tx: Prisma.TransactionClient = prisma,
) {
  await tx.rfqVendor.deleteMany({ where: { tenantId, requestForQuotationId } })
  if (!vendorIds.length) return
  await tx.rfqVendor.createMany({
    data: vendorIds.map((vendorId) => ({
      tenantId,
      requestForQuotationId,
      vendorId,
      inviteStatus: 'INVITED',
    })),
  })
}

export async function resolveUserNames(tenantId: string, userIds: Array<string | null>) {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))]
  if (ids.length === 0) return new Map<string, string>()
  const users = await prisma.user.findMany({
    where: { tenantId, id: { in: ids }, deletedAt: null },
    select: { id: true, firstName: true, lastName: true },
  })
  return new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]))
}

export async function createStatusHistory(
  tenantId: string,
  documentId: string,
  fromStatus: string | null,
  toStatus: string,
  actorId: string,
  remarks: string | null,
  tx: Prisma.TransactionClient = prisma,
) {
  await tx.purchaseStatusHistory.create({
    data: {
      tenantId,
      documentType: 'REQUEST_FOR_QUOTATION',
      documentId,
      action: 'STATUS_CHANGED',
      fromStatus,
      toStatus,
      actorId,
      remarks,
    },
  })
}

export { findRfqByIdTx }
