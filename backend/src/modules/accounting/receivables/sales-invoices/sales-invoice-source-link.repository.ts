import { Prisma, type SalesInvoiceSourceLink } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { toDecimal } from '../../shared/finance-decimal.js'
import { SalesInvoiceNotFoundError } from './sales-invoice.errors.js'

export interface CreateSalesInvoiceSourceLinkInput {
  sourceType: 'SALES_ORDER' | 'OUTBOUND_DISPATCH' | 'DELIVERY_CHALLAN'
  sourceDocumentId: string
  sourceLineId?: string | null
  salesOrderId?: string | null
  salesOrderLineId?: string | null
  deliveryChallanId?: string | null
  deliveryChallanLineId?: string | null
  quantity: string | number
  salesInvoiceLineId?: string | null
  sourceDocumentNumberSnapshot?: string | null
  itemId?: string | null
  itemCodeSnapshot?: string | null
  itemNameSnapshot?: string | null
  metadata?: Prisma.InputJsonValue | null
}

export async function listSalesInvoiceSourceLinks(
  tenantId: string,
  legalEntityId: string,
  salesInvoiceId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<SalesInvoiceSourceLink[]> {
  return tx.salesInvoiceSourceLink.findMany({
    where: { tenantId, legalEntityId, salesInvoiceId },
    orderBy: { createdAt: 'asc' },
  })
}

export async function replaceSalesInvoiceSourceLinks(
  tenantId: string,
  legalEntityId: string,
  salesInvoiceId: string,
  links: CreateSalesInvoiceSourceLinkInput[],
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<SalesInvoiceSourceLink[]> {
  const header = await tx.salesInvoice.findFirst({
    where: { id: salesInvoiceId, tenantId, legalEntityId },
    select: { id: true },
  })
  if (!header) throw new SalesInvoiceNotFoundError()

  await tx.salesInvoiceSourceLink.deleteMany({ where: { tenantId, salesInvoiceId } })
  if (links.length === 0) return []

  await tx.salesInvoiceSourceLink.createMany({
    data: links.map((link) => ({
      tenantId,
      legalEntityId,
      salesInvoiceId,
      salesInvoiceLineId: link.salesInvoiceLineId ?? null,
      sourceType: link.sourceType,
      sourceDocumentId: link.sourceDocumentId,
      sourceLineId: link.sourceLineId ?? null,
      salesOrderId: link.salesOrderId ?? null,
      salesOrderLineId: link.salesOrderLineId ?? null,
      deliveryChallanId: link.deliveryChallanId ?? null,
      deliveryChallanLineId: link.deliveryChallanLineId ?? null,
      quantity: toDecimal(link.quantity),
      status: 'ACTIVE',
      sourceDocumentNumberSnapshot: link.sourceDocumentNumberSnapshot ?? null,
      itemId: link.itemId ?? null,
      itemCodeSnapshot: link.itemCodeSnapshot ?? null,
      itemNameSnapshot: link.itemNameSnapshot ?? null,
      metadata: link.metadata ?? Prisma.JsonNull,
    })),
  })

  return listSalesInvoiceSourceLinks(tenantId, legalEntityId, salesInvoiceId, tx)
}

export async function releaseSalesInvoiceSourceLinks(
  tenantId: string,
  salesInvoiceId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<number> {
  const result = await tx.salesInvoiceSourceLink.updateMany({
    where: { tenantId, salesInvoiceId, status: 'ACTIVE' },
    data: { status: 'RELEASED' },
  })
  return result.count
}
