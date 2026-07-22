import type { ArDispute, ArDisputeStatus, Prisma } from '@prisma/client'
import { prisma } from '../../../../config/database.js'

export type ListArDisputesArgs = {
  tenantId: string
  legalEntityId: string
  status?: ArDisputeStatus
  customerId?: string
  salesInvoiceId?: string
  salesOrderId?: string
  search?: string
  page: number
  limit: number
  sortOrder: 'asc' | 'desc'
}

export async function listArDisputes(args: ListArDisputesArgs): Promise<{ items: ArDispute[]; total: number }> {
  const where: Prisma.ArDisputeWhereInput = {
    tenantId: args.tenantId,
    legalEntityId: args.legalEntityId,
    deletedAt: null,
  }
  if (args.status) where.status = args.status
  if (args.customerId) where.customerId = args.customerId
  if (args.salesInvoiceId) where.salesInvoiceId = args.salesInvoiceId
  if (args.salesOrderId) {
    where.salesInvoice = {
      OR: [
        { sourceType: 'SALES_ORDER', sourceDocumentId: args.salesOrderId },
        {
          sourceLinks: {
            some: {
              status: 'ACTIVE',
              OR: [
                { salesOrderId: args.salesOrderId },
                { sourceType: 'SALES_ORDER', sourceDocumentId: args.salesOrderId },
              ],
            },
          },
        },
      ],
    }
  }
  if (args.search?.trim()) {
    const q = args.search.trim()
    where.OR = [
      { disputeNumber: { contains: q } },
      { customerNameSnapshot: { contains: q } },
      { invoiceNumberSnapshot: { contains: q } },
      { description: { contains: q } },
    ]
  }
  const skip = (args.page - 1) * args.limit
  const [items, total] = await Promise.all([
    prisma.arDispute.findMany({
      where,
      orderBy: [{ disputeDate: args.sortOrder }, { createdAt: args.sortOrder }],
      skip,
      take: args.limit,
    }),
    prisma.arDispute.count({ where }),
  ])
  return { items, total }
}

export async function findArDisputeById(tenantId: string, id: string): Promise<ArDispute | null> {
  return prisma.arDispute.findFirst({ where: { id, tenantId, deletedAt: null } })
}

export async function countActiveDisputesForInvoice(
  tenantId: string,
  salesInvoiceId: string,
  excludeId?: string,
): Promise<number> {
  return prisma.arDispute.count({
    where: {
      tenantId,
      salesInvoiceId,
      deletedAt: null,
      status: { notIn: ['RESOLVED', 'REJECTED', 'CLOSED'] },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  })
}

export async function nextDisputeSequence(tenantId: string, legalEntityId: string, year: number): Promise<number> {
  const prefix = `DSP-${year}-`
  const latest = await prisma.arDispute.findFirst({
    where: {
      tenantId,
      legalEntityId,
      disputeNumber: { startsWith: prefix },
    },
    orderBy: { disputeNumber: 'desc' },
    select: { disputeNumber: true },
  })
  if (!latest) return 1
  const tail = latest.disputeNumber.slice(prefix.length)
  const n = Number.parseInt(tail, 10)
  return Number.isFinite(n) ? n + 1 : 1
}

export async function createArDispute(data: Prisma.ArDisputeCreateInput): Promise<ArDispute> {
  return prisma.arDispute.create({ data })
}

export async function updateArDispute(id: string, data: Prisma.ArDisputeUpdateInput): Promise<ArDispute> {
  return prisma.arDispute.update({ where: { id }, data })
}

export async function softDeleteArDispute(id: string, updatedBy: string | null): Promise<ArDispute> {
  return prisma.arDispute.update({
    where: { id },
    data: { deletedAt: new Date(), updatedBy, status: 'CLOSED' },
  })
}
