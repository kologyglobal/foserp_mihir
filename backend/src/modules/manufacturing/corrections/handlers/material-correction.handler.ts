import { prisma } from '../../../../config/database.js'
import { NotFoundError } from '../../../../utils/errors.js'
import { postStockMovement } from '../../../inventory/shared/stock-posting.service.js'
import { toDecimal } from '../../shared/quantity.service.js'
import { CorrectionBlockedError, CorrectionValidationError } from '../correction.errors.js'
import { collectDependencies } from '../correction-dependency.service.js'
import { emptyPreview, makePreviewToken, makeSourceVersion, newIdempotencySuffix } from '../correction-preview.util.js'
import type { CorrectionHandler } from '../correction.types.js'
import { defaultApprovalRequired, defaultRisk } from '../correction.enums.js'

/** Reverse material ISSUE_TO_WO by posting RETURN_FROM_WO compensating movement. */
export const materialIssueHandler: CorrectionHandler = {
  async preview(ctx) {
    const movement = await prisma.inventoryStockMovement.findFirst({
      where: { id: ctx.sourceEntityId, tenantId: ctx.tenantId },
    })
    if (!movement) throw new NotFoundError('Inventory movement not found')
    if (movement.referenceType !== 'ISSUE_TO_WO' && movement.movementType !== 'ISSUE') {
      throw new CorrectionValidationError('Source is not a material issue to work order')
    }
    const issued = toDecimal(movement.quantity).abs()
    const requestedQty = toDecimal((ctx.requestedValues?.quantity as number | undefined) ?? issued.toNumber())
    if (requestedQty.greaterThan(issued) || requestedQty.lessThanOrEqualTo(0)) {
      throw new CorrectionValidationError(`Reversal quantity must be between 0 and ${issued.toString()}`)
    }
    const destWarehouseId = (ctx.requestedValues?.destinationWarehouseId as string | undefined) ?? movement.warehouseId
    const deps = await collectDependencies({ ...ctx, productionOrderId: movement.workOrderId })
    const blockers = deps.filter((d) => d.severity === 'blocker').map((d) => d.message)
    const risk = defaultRisk('MATERIAL_ISSUE')
    const sourceVersion = makeSourceVersion(movement.createdAt, movement.id)

    return emptyPreview({
      headline: `Reverse material issue ${requestedQty.toString()} of ${movement.itemId}`,
      originalQuantity: issued.toString(),
      maxReversibleQuantity: issued.toString(),
      proposedQuantity: requestedQty.toString(),
      resultingQuantity: issued.minus(requestedQty).toString(),
      inventoryImpact: [
        `Compensating RETURN_FROM_WO / INWARD to warehouse ${destWarehouseId}`,
        'Original ISSUE movement remains immutable',
      ],
      blockers,
      warnings: [
        ...deps.filter((d) => d.severity === 'warning').map((d) => d.message),
        'Unusable condition must not return to unrestricted stock automatically — select destination carefully',
      ],
      dependencies: deps,
      approvalRequired: defaultApprovalRequired(risk),
      riskLevel: risk,
      followUpActions: ['Apply posts compensating stock inward and reduces derived issued totals'],
      original: {
        movementId: movement.id,
        itemId: movement.itemId,
        warehouseId: movement.warehouseId,
        workOrderId: movement.workOrderId,
        quantity: issued.toString(),
      },
      proposed: {
        quantity: requestedQty.toString(),
        destinationWarehouseId: destWarehouseId,
        condition: (ctx.requestedValues?.condition as string) ?? 'Usable',
      },
      sourceVersion,
      previewToken: makePreviewToken({ id: movement.id, sourceVersion, qty: requestedQty.toString() }),
    })
  },

  async apply(ctx, tx) {
    const deps = await collectDependencies(ctx)
    if (deps.some((d) => d.severity === 'blocker')) {
      throw new CorrectionBlockedError(deps.find((d) => d.severity === 'blocker')!.message)
    }
    const movement = await tx.inventoryStockMovement.findFirst({
      where: { id: ctx.sourceEntityId, tenantId: ctx.tenantId },
    })
    if (!movement) throw new NotFoundError('Inventory movement not found')
    const issued = toDecimal(movement.quantity).abs()
    const qty = toDecimal((ctx.requestedValues?.quantity as number | undefined) ?? issued.toNumber())
    const destWarehouseId = (ctx.requestedValues?.destinationWarehouseId as string | undefined) ?? movement.warehouseId

    const reversal = await postStockMovement(
      {
        tenantId: ctx.tenantId,
        itemId: movement.itemId,
        warehouseId: destWarehouseId,
        movementType: 'INWARD',
        referenceType: 'RETURN_FROM_WO',
        quantity: qty,
        workOrderId: movement.workOrderId ?? undefined,
        sourceWorkOrderId: movement.workOrderId ?? undefined,
        referenceNo: `REV-${movement.movementNumber}`,
        remarks: ctx.reason,
        idempotencyKey: `MAT_ISSUE_REV:${movement.id}:${qty.toString()}:${newIdempotencySuffix()}`,
        createdBy: ctx.userId,
      },
      tx,
    )

    if (movement.workOrderId) {
      const lines = await tx.productionOrderMaterial.findMany({
        where: { tenantId: ctx.tenantId, productionOrderId: movement.workOrderId, itemId: movement.itemId },
      })
      for (const line of lines) {
        const newReturned = toDecimal(line.returnedQty).plus(qty)
        await tx.productionOrderMaterial.update({
          where: { id: line.id },
          data: { returnedQty: newReturned, updatedBy: ctx.userId },
        })
        break
      }
    }

    return {
      reversalEntityType: 'INVENTORY_STOCK_MOVEMENT',
      reversalEntityId: reversal.id,
      quantityReversed: qty.toString(),
    }
  },
}

/** Reverse a RETURN_FROM_WO by re-issuing to the work order. */
export const materialReturnHandler: CorrectionHandler = {
  async preview(ctx) {
    const movement = await prisma.inventoryStockMovement.findFirst({
      where: { id: ctx.sourceEntityId, tenantId: ctx.tenantId },
    })
    if (!movement) throw new NotFoundError('Inventory movement not found')
    if (movement.referenceType !== 'RETURN_FROM_WO') {
      throw new CorrectionValidationError('Source is not a material return from work order')
    }
    const qty = toDecimal(movement.quantity).abs()
    const balance = await prisma.inventoryStockBalance.findFirst({
      where: { tenantId: ctx.tenantId, itemId: movement.itemId, warehouseId: movement.warehouseId },
    })
    const available = balance ? toDecimal(balance.onHandQty).minus(balance.reservedQty) : toDecimal(0)
    const blockers: string[] = []
    if (available.lessThan(qty)) {
      blockers.push('Returned stock is no longer available at the source warehouse')
    }
    const risk = defaultRisk('MATERIAL_RETURN')
    const sourceVersion = makeSourceVersion(movement.createdAt, movement.id)
    return emptyPreview({
      headline: `Reverse material return (re-issue ${qty.toString()} to WO)`,
      originalQuantity: qty.toString(),
      maxReversibleQuantity: qty.toString(),
      proposedQuantity: qty.toString(),
      inventoryImpact: ['Compensating ISSUE_TO_WO from return warehouse'],
      blockers,
      warnings: [],
      dependencies: [],
      approvalRequired: defaultApprovalRequired(risk),
      riskLevel: risk,
      followUpActions: [],
      original: { movementId: movement.id, quantity: qty.toString() },
      proposed: { quantity: qty.toString() },
      sourceVersion,
      previewToken: makePreviewToken({ id: movement.id, sourceVersion }),
    })
  },

  async apply(ctx, tx) {
    const movement = await tx.inventoryStockMovement.findFirst({
      where: { id: ctx.sourceEntityId, tenantId: ctx.tenantId },
    })
    if (!movement?.workOrderId) throw new NotFoundError('Return movement not found')
    const qty = toDecimal(movement.quantity).abs()
    const reversal = await postStockMovement(
      {
        tenantId: ctx.tenantId,
        itemId: movement.itemId,
        warehouseId: movement.warehouseId,
        movementType: 'ISSUE',
        referenceType: 'ISSUE_TO_WO',
        quantity: qty,
        workOrderId: movement.workOrderId,
        referenceNo: `REV-RET-${movement.movementNumber}`,
        remarks: ctx.reason,
        idempotencyKey: `MAT_RET_REV:${movement.id}:${newIdempotencySuffix()}`,
        createdBy: ctx.userId,
        consumeWoReservation: false,
      },
      tx,
    )
    return {
      reversalEntityType: 'INVENTORY_STOCK_MOVEMENT',
      reversalEntityId: reversal.id,
      quantityReversed: qty.toString(),
    }
  },
}
