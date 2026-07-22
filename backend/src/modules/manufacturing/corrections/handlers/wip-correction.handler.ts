import { prisma } from '../../../../config/database.js'
import { NotFoundError } from '../../../../utils/errors.js'
import { postStockMovement } from '../../../inventory/shared/stock-posting.service.js'
import { toDecimal } from '../../shared/quantity.service.js'
import { CorrectionBlockedError, CorrectionValidationError } from '../correction.errors.js'
import { emptyPreview, makePreviewToken, makeSourceVersion, newIdempotencySuffix } from '../correction-preview.util.js'
import type { CorrectionHandler } from '../correction.types.js'
import { defaultApprovalRequired, defaultRisk } from '../correction.enums.js'

/** Reverse a posted ProductionWipMovement by swapping warehouses (paired ISSUE+INWARD). */
export const wipMovementHandler: CorrectionHandler = {
  async preview(ctx) {
    const move = await prisma.productionWipMovement.findFirst({
      where: { id: ctx.sourceEntityId, tenantId: ctx.tenantId, deletedAt: null },
    })
    if (!move) throw new NotFoundError('WIP movement not found')
    if (move.status !== 'POSTED') throw new CorrectionValidationError('Only posted WIP movements can be reversed')

    const prior = await prisma.manufacturingTransactionReversalLink.findFirst({
      where: {
        tenantId: ctx.tenantId,
        sourceEntityType: 'WIP_MOVEMENT',
        sourceEntityId: move.id,
      },
    })
    if (prior) throw new CorrectionValidationError('This WIP movement has already been reversed')

    const later = await prisma.productionWipMovement.count({
      where: {
        tenantId: ctx.tenantId,
        productionOrderId: move.productionOrderId,
        status: 'POSTED',
        deletedAt: null,
        createdAt: { gt: move.createdAt },
        id: { not: move.id },
      },
    })
    const blockers: string[] = []
    if (later > 0) {
      blockers.push('A later WIP movement exists. Reverse downstream WIP movements first.')
    }

    const qty = toDecimal(move.quantity)
    const risk = defaultRisk('WIP_MOVEMENT')
    const sourceVersion = makeSourceVersion(move.updatedAt, move.id)
    return emptyPreview({
      headline: `Reverse WIP movement ${move.movementNumber} (${qty.toString()})`,
      originalQuantity: qty.toString(),
      maxReversibleQuantity: qty.toString(),
      proposedQuantity: qty.toString(),
      inventoryImpact: move.physicalPosted
        ? [`Swap warehouses ${move.toWarehouseId} → ${move.fromWarehouseId}`]
        : ['Logical WIP — activity/status only (no stock)'],
      stageLedgerImpact: ['Original WIP movement remains posted; compensating movement created'],
      blockers,
      warnings: [],
      dependencies: blockers.map((m) => ({ code: 'LATER_WIP', severity: 'blocker' as const, message: m })),
      approvalRequired: defaultApprovalRequired(risk),
      riskLevel: risk,
      recommendedPlan: blockers.length
        ? ['1. Reverse later WIP movements', '2. Reverse this movement']
        : undefined,
      followUpActions: [],
      original: {
        movementId: move.id,
        movementNumber: move.movementNumber,
        fromWarehouseId: move.fromWarehouseId,
        toWarehouseId: move.toWarehouseId,
        quantity: qty.toString(),
        physicalPosted: move.physicalPosted,
      },
      proposed: { reverse: true },
      sourceVersion,
      previewToken: makePreviewToken({ id: move.id, sourceVersion }),
    })
  },

  async apply(ctx, tx) {
    const move = await tx.productionWipMovement.findFirst({
      where: { id: ctx.sourceEntityId, tenantId: ctx.tenantId, deletedAt: null },
    })
    if (!move) throw new NotFoundError('WIP movement not found')
    const later = await tx.productionWipMovement.count({
      where: {
        tenantId: ctx.tenantId,
        productionOrderId: move.productionOrderId,
        status: 'POSTED',
        deletedAt: null,
        createdAt: { gt: move.createdAt },
        id: { not: move.id },
      },
    })
    if (later > 0) throw new CorrectionBlockedError('Reverse later WIP movements first')

    let outboundId: string | null = null
    let inboundId: string | null = null
    if (move.physicalPosted) {
      const out = await postStockMovement(
        {
          tenantId: ctx.tenantId,
          itemId: move.itemId,
          warehouseId: move.toWarehouseId,
          movementType: 'ISSUE',
          referenceType: 'WIP_TRANSFER',
          quantity: move.quantity,
          workOrderId: move.productionOrderId,
          referenceNo: `REV-${move.movementNumber}`,
          remarks: ctx.reason,
          idempotencyKey: `WIP_REV:${move.id}:OUT:${newIdempotencySuffix()}`,
          createdBy: ctx.userId,
          consumeWoReservation: false,
        },
        tx,
      )
      const inn = await postStockMovement(
        {
          tenantId: ctx.tenantId,
          itemId: move.itemId,
          warehouseId: move.fromWarehouseId,
          movementType: 'INWARD',
          referenceType: 'WIP_TRANSFER',
          quantity: move.quantity,
          workOrderId: move.productionOrderId,
          referenceNo: `REV-${move.movementNumber}`,
          remarks: ctx.reason,
          idempotencyKey: `WIP_REV:${move.id}:IN:${newIdempotencySuffix()}`,
          createdBy: ctx.userId,
        },
        tx,
      )
      outboundId = out.id
      inboundId = inn.id
    }

    const compensating = await tx.productionWipMovement.create({
      data: {
        tenantId: ctx.tenantId,
        movementNumber: `${move.movementNumber}-R`,
        movementType: move.movementType,
        status: 'POSTED',
        productionOrderId: move.productionOrderId,
        targetProductionOrderId: move.targetProductionOrderId,
        itemId: move.itemId,
        quantity: move.quantity,
        uomId: move.uomId,
        fromWarehouseId: move.toWarehouseId,
        toWarehouseId: move.fromWarehouseId,
        reason: ctx.reason,
        remarks: `Reversal of ${move.movementNumber}`,
        physicalPosted: move.physicalPosted,
        outboundMovementId: outboundId,
        inboundMovementId: inboundId,
        postedBy: ctx.userId,
        postedAt: new Date(),
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
        idempotencyKey: `WIP_REV_DOC:${move.id}`,
      },
    })

    return {
      reversalEntityType: 'WIP_MOVEMENT',
      reversalEntityId: compensating.id,
      quantityReversed: move.quantity.toString(),
    }
  },
}
