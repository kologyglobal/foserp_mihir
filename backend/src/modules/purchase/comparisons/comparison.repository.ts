import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import type { ComparisonListQuery } from './comparison.validation.js'

const includeComparison = { lines: { orderBy: { lineNumber: 'asc' as const } } }

export async function findComparisons(tenantId: string, query: ComparisonListQuery) {
  const { getPagination } = await import('../../../utils/pagination.js')
  const { skip, take } = getPagination({ ...query, page: query.page ?? 1, limit: query.pageSize ?? query.limit ?? 25, sortOrder: 'desc' })
  const where = { ...tenantActiveFilter(tenantId), ...(query.requestForQuotationId ? { requestForQuotationId: query.requestForQuotationId } : {}) }
  const [items, total] = await Promise.all([
    prisma.vendorComparison.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: includeComparison }),
    prisma.vendorComparison.count({ where }),
  ])
  return { items, total, page: query.page ?? 1, limit: take }
}

export function findComparisonById(tenantId: string, id: string, tx: Prisma.TransactionClient = prisma) {
  return tx.vendorComparison.findFirst({ where: { id, ...tenantActiveFilter(tenantId) }, include: includeComparison })
}

export function findSubmittedQuotations(tenantId: string, requestForQuotationId: string, tx: Prisma.TransactionClient = prisma) {
  return tx.vendorQuotation.findMany({
    where: { ...tenantActiveFilter(tenantId), requestForQuotationId, status: 'SUBMITTED' },
    include: { lines: { orderBy: { lineNumber: 'asc' } } },
  })
}

export function findComparisonQuotations(tenantId: string, requestForQuotationId: string, tx: Prisma.TransactionClient = prisma) {
  return tx.vendorQuotation.findMany({
    where: { ...tenantActiveFilter(tenantId), requestForQuotationId, status: { in: ['SUBMITTED', 'SELECTED', 'REJECTED'] } },
    include: { lines: { orderBy: { lineNumber: 'asc' } } },
  })
}

export function createStatusHistory(
  tenantId: string, documentId: string, fromStatus: string | null, toStatus: string, actorId: string, remarks: string | null,
  tx: Prisma.TransactionClient = prisma,
) {
  return tx.purchaseStatusHistory.create({
    data: { tenantId, documentType: 'VENDOR_COMPARISON', documentId, action: 'STATUS_CHANGED', fromStatus, toStatus, actorId, remarks },
  })
}
