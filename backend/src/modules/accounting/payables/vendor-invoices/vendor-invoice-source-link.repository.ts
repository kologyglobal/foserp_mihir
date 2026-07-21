import { Prisma, type VendorInvoiceSourceLink } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { VendorInvoiceNotFoundError, VendorInvoiceSourceLinkConflictError } from './vendor-invoice.errors.js'
import type { CreateVendorInvoiceSourceLinkInput } from './vendor-invoice.types.js'

export async function listVendorInvoiceSourceLinks(
  tenantId: string,
  legalEntityId: string,
  vendorInvoiceId: string,
): Promise<VendorInvoiceSourceLink[]> {
  return prisma.vendorInvoiceSourceLink.findMany({
    where: { tenantId, legalEntityId, vendorInvoiceId },
    orderBy: { createdAt: 'asc' },
  })
}

/**
 * Create source links for an invoice. Optional Purchase/Contract/Project soft refs only.
 * Does not create stock, GRN, or purchase transactions.
 */
export async function createVendorInvoiceSourceLinks(
  tenantId: string,
  legalEntityId: string,
  vendorInvoiceId: string,
  links: CreateVendorInvoiceSourceLinkInput[],
): Promise<VendorInvoiceSourceLink[]> {
  const header = await prisma.vendorInvoice.findFirst({
    where: { id: vendorInvoiceId, tenantId, legalEntityId },
    select: { id: true },
  })
  if (!header) throw new VendorInvoiceNotFoundError()
  if (links.length === 0) return []

  try {
    await prisma.vendorInvoiceSourceLink.createMany({
      data: links.map((link) => ({
        tenantId,
        legalEntityId,
        vendorInvoiceId,
        sourceType: link.sourceType,
        sourceDocumentId: link.sourceDocumentId,
        sourceDocumentNumberSnapshot: link.sourceDocumentNumberSnapshot ?? null,
        sourceDocumentDateSnapshot: link.sourceDocumentDateSnapshot ?? null,
        metadata: link.metadata ?? Prisma.JsonNull,
      })),
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new VendorInvoiceSourceLinkConflictError()
    }
    throw err
  }

  return listVendorInvoiceSourceLinks(tenantId, legalEntityId, vendorInvoiceId)
}
