import type { ApDisputeStatus, Prisma } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import type { ApDisputeWithContext } from './ap-dispute.types.js'

const contextInclude = {
  vendorInvoice: { include: { sourceLinks: { orderBy: { createdAt: 'asc' as const } } } },
} satisfies Prisma.ApDisputeInclude

export type ListApDisputesArgs = {
  tenantId: string
  legalEntityId: string
  status?: ApDisputeStatus
  vendorId?: string
  vendorInvoiceId?: string
  purchaseOrderId?: string
  search?: string
  page: number
  limit: number
  sortOrder: 'asc' | 'desc'
}

export async function listApDisputes(
  args: ListApDisputesArgs,
): Promise<{ items: ApDisputeWithContext[]; total: number }> {
  const where: Prisma.ApDisputeWhereInput = {
    tenantId: args.tenantId,
    legalEntityId: args.legalEntityId,
    deletedAt: null,
  }
  if (args.status) where.status = args.status
  if (args.vendorId) where.vendorId = args.vendorId
  if (args.vendorInvoiceId) where.vendorInvoiceId = args.vendorInvoiceId
  if (args.purchaseOrderId) {
    where.vendorInvoice = {
      sourceLinks: {
        some: {
          sourceType: 'PURCHASE_ORDER',
          sourceDocumentId: args.purchaseOrderId,
        },
      },
    }
  }
  if (args.search?.trim()) {
    const q = args.search.trim()
    where.OR = [
      { disputeNumber: { contains: q } },
      { vendorCodeSnapshot: { contains: q } },
      { vendorNameSnapshot: { contains: q } },
      { vendorInvoiceNumberSnapshot: { contains: q } },
      { supplierInvoiceNumberSnapshot: { contains: q } },
      { description: { contains: q } },
    ]
  }
  const skip = (args.page - 1) * args.limit
  const [items, total] = await Promise.all([
    prisma.apDispute.findMany({
      where,
      include: contextInclude,
      orderBy: [{ disputeDate: args.sortOrder }, { createdAt: args.sortOrder }],
      skip,
      take: args.limit,
    }),
    prisma.apDispute.count({ where }),
  ])
  return { items, total }
}

export async function findApDisputeById(tenantId: string, id: string): Promise<ApDisputeWithContext | null> {
  return prisma.apDispute.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: contextInclude,
  })
}

export async function nextDisputeSequence(tenantId: string, legalEntityId: string, year: number): Promise<number> {
  const prefix = `APDSP-${year}-`
  const latest = await prisma.apDispute.findFirst({
    where: {
      tenantId,
      legalEntityId,
      disputeNumber: { startsWith: prefix },
    },
    orderBy: { disputeNumber: 'desc' },
    select: { disputeNumber: true },
  })
  if (!latest) return 1
  const n = Number.parseInt(latest.disputeNumber.slice(prefix.length), 10)
  return Number.isFinite(n) ? n + 1 : 1
}
