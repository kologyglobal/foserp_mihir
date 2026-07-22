import { prisma } from '../../../config/database.js'
import type { Prisma } from '@prisma/client'
import { NotFoundError } from '../../../utils/errors.js'

export const correctionInclude = {
  productionOrder: { select: { id: true, orderNumber: true, status: true } },
  links: true,
} satisfies Prisma.ManufacturingTransactionCorrectionInclude

export type CorrectionRow = Prisma.ManufacturingTransactionCorrectionGetPayload<{
  include: typeof correctionInclude
}>

export async function findCorrection(tenantId: string, correctionId: string) {
  const row = await prisma.manufacturingTransactionCorrection.findFirst({
    where: { id: correctionId, tenantId, deletedAt: null },
    include: correctionInclude,
  })
  if (!row) throw new NotFoundError('Correction not found')
  return row
}

export async function findByIdempotency(tenantId: string, key: string) {
  return prisma.manufacturingTransactionCorrection.findFirst({
    where: { tenantId, idempotencyKey: key, deletedAt: null },
    include: correctionInclude,
  })
}

export async function listCorrections(
  tenantId: string,
  opts: {
    status?: string
    transactionType?: string
    productionOrderId?: string
    riskLevel?: string
    page?: number
    limit?: number
  },
) {
  const page = opts.page ?? 1
  const limit = opts.limit ?? 50
  const where: Prisma.ManufacturingTransactionCorrectionWhereInput = {
    tenantId,
    deletedAt: null,
    ...(opts.status ? { status: opts.status as never } : {}),
    ...(opts.transactionType ? { transactionType: opts.transactionType as never } : {}),
    ...(opts.productionOrderId ? { productionOrderId: opts.productionOrderId } : {}),
    ...(opts.riskLevel ? { riskLevel: opts.riskLevel as never } : {}),
  }
  const [total, data] = await Promise.all([
    prisma.manufacturingTransactionCorrection.count({ where }),
    prisma.manufacturingTransactionCorrection.findMany({
      where,
      include: correctionInclude,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])
  return { total, page, limit, data }
}

export async function listHistory(tenantId: string, entityType: string, entityId: string) {
  return prisma.manufacturingTransactionCorrection.findMany({
    where: {
      tenantId,
      deletedAt: null,
      OR: [
        { sourceEntityType: entityType, sourceEntityId: entityId },
        { sourceTransactionId: entityId },
        { productionLedgerId: entityId },
        { inventoryMovementId: entityId },
        { wipMovementId: entityId },
      ],
    },
    include: correctionInclude,
    orderBy: { createdAt: 'desc' },
  })
}
