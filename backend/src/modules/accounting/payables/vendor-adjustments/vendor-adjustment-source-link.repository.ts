import { Prisma, type VendorAdjustmentSourceLink } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { VendorAdjustmentNotFoundError, VendorAdjustmentSourceLinkConflictError } from './vendor-adjustment.errors.js'
import type { CreateVendorAdjustmentSourceLinkInput } from './vendor-adjustment.types.js'

export async function listVendorAdjustmentSourceLinks(
  tenantId: string,
  legalEntityId: string,
  vendorAdjustmentId: string,
): Promise<VendorAdjustmentSourceLink[]> {
  return prisma.vendorAdjustmentSourceLink.findMany({
    where: { tenantId, legalEntityId, vendorAdjustmentId },
    orderBy: { createdAt: 'asc' },
  })
}

/**
 * Create source links for an invoice. Optional Purchase/Contract/Project soft refs only.
 * Does not create stock, GRN, or purchase transactions.
 */
export async function createVendorAdjustmentSourceLinks(
  tenantId: string,
  legalEntityId: string,
  vendorAdjustmentId: string,
  links: CreateVendorAdjustmentSourceLinkInput[],
): Promise<VendorAdjustmentSourceLink[]> {
  const header = await prisma.vendorAdjustment.findFirst({
    where: { id: vendorAdjustmentId, tenantId, legalEntityId },
    select: { id: true },
  })
  if (!header) throw new VendorAdjustmentNotFoundError()
  if (links.length === 0) return []

  try {
    await prisma.vendorAdjustmentSourceLink.createMany({
      data: links.map((link) => ({
        tenantId,
        legalEntityId,
        vendorAdjustmentId,
        sourceType: link.sourceType,
        sourceDocumentId: link.sourceDocumentId,
        sourceDocumentNumberSnapshot: link.sourceDocumentNumberSnapshot ?? null,
        sourceDocumentDateSnapshot: link.sourceDocumentDateSnapshot ?? null,
        metadata: link.metadata ?? Prisma.JsonNull,
      })),
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new VendorAdjustmentSourceLinkConflictError()
    }
    throw err
  }

  return listVendorAdjustmentSourceLinks(tenantId, legalEntityId, vendorAdjustmentId)
}
