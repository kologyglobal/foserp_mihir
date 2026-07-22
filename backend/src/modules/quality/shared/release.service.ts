import { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { postStockMovement } from '../../inventory/shared/stock-posting.service.js'

export class QualityReleaseService {
  static async releaseAcceptedStock(input: {
    tenantId: string
    inspectionId: string
    userId: string
    fromWarehouseId: string
    toWarehouseId: string
    quantity: number
    idempotencyKey: string
  }) {
    if (!input.idempotencyKey) throw new ValidationError('idempotencyKey is required')
    return prisma.$transaction(async (tx) => {
      const inspection = await tx.manufacturingQualityInspection.findFirst({ where: { id: input.inspectionId, tenantId: input.tenantId } })
      if (!inspection) throw new NotFoundError('Inspection not found')
      if (!['PASS', 'CONDITIONAL_PASS'].includes(inspection.decision ?? '')) {
        throw new InvalidStateError('Only PASS or CONDITIONAL_PASS inspections may release stock')
      }
      if (!inspection.itemId) throw new ValidationError('Inspection item is required to release stock')
      const requested = new Prisma.Decimal(input.quantity)
      const accepted = inspection.acceptedQty ?? new Prisma.Decimal(0)
      if (requested.lessThanOrEqualTo(0) || requested.greaterThan(accepted)) {
        throw new ValidationError('Release quantity must be positive and cannot exceed accepted quantity')
      }
      if (inspection.releaseIdempotencyKey && inspection.releaseIdempotencyKey !== input.idempotencyKey) {
        throw new InvalidStateError('Inspection has already been released with a different idempotency key')
      }
      const key = `quality-release:${input.inspectionId}:${input.idempotencyKey}`
      const issue = await postStockMovement({
        tenantId: input.tenantId, itemId: inspection.itemId, warehouseId: input.fromWarehouseId,
        movementType: 'ISSUE', referenceType: 'QUALITY_RELEASE', quantity: requested,
        referenceNo: inspection.inspectionNumber, idempotencyKey: `${key}:issue`, createdBy: input.userId,
      }, tx)
      const inward = await postStockMovement({
        tenantId: input.tenantId, itemId: inspection.itemId, warehouseId: input.toWarehouseId,
        movementType: 'INWARD', referenceType: 'QUALITY_RELEASE', quantity: requested,
        referenceNo: inspection.inspectionNumber, idempotencyKey: `${key}:inward`, createdBy: input.userId,
      }, tx)
      await tx.manufacturingQualityInspection.update({
        where: { id: inspection.id },
        data: { releaseIdempotencyKey: input.idempotencyKey, warehouseFromId: input.fromWarehouseId, warehouseToId: input.toWarehouseId, updatedBy: input.userId },
      })
      return { issue, inward }
    })
  }
}
