import { prisma } from '../../../../config/database.js'
import { NotFoundError } from '../../../../utils/errors.js'
import { postStockMovement } from '../../../inventory/shared/stock-posting.service.js'
import { isPositive, subDec, toDecimal } from '../../shared/quantity.service.js'
import { CorrectionBlockedError, CorrectionValidationError } from '../correction.errors.js'
import { collectDependencies } from '../correction-dependency.service.js'
import { emptyPreview, makePreviewToken, makeSourceVersion, newIdempotencySuffix } from '../correction-preview.util.js'
import type { CorrectionHandler } from '../correction.types.js'
import { defaultApprovalRequired, defaultRisk } from '../correction.enums.js'

export const fgReceiptHandler: CorrectionHandler = {
  async preview(ctx) {
    const movement = await prisma.inventoryStockMovement.findFirst({
      where: { id: ctx.sourceEntityId, tenantId: ctx.tenantId },
    })
    if (!movement) throw new NotFoundError('FG receipt movement not found')
    if (movement.referenceType !== 'FG_RECEIPT') {
      throw new CorrectionValidationError('Source is not a finished goods receipt')
    }
    const received = toDecimal(movement.quantity).abs()
    const receipt = await prisma.productionFinishedGoodsReceipt.findFirst({
      where: {
        tenantId: ctx.tenantId,
        inventoryMovementId: movement.id,
        deletedAt: null,
      },
      select: { acceptedQuantity: true, reversedQuantity: true, status: true, receiptNumber: true },
    })
    const alreadyReversed = receipt ? toDecimal(receipt.reversedQuantity) : toDecimal(0)
    const maxReversible = receipt
      ? subDec(receipt.acceptedQuantity, alreadyReversed)
      : received
    if (!isPositive(maxReversible)) {
      throw new CorrectionValidationError('No remaining quantity to reverse on this FG receipt')
    }
    const qty = toDecimal((ctx.requestedValues?.quantity as number | undefined) ?? maxReversible.toNumber())
    if (qty.greaterThan(maxReversible)) {
      throw new CorrectionValidationError(
        `Only ${maxReversible.toString()} units remain eligible for Finished Goods reversal.`,
      )
    }
    const deps = await collectDependencies({
      ...ctx,
      productionOrderId: movement.workOrderId,
      transactionType: 'FG_RECEIPT',
    })
    const blockers = deps.filter((d) => d.severity === 'blocker').map((d) => d.message)
    const sourceVersion = makeSourceVersion(movement.createdAt, movement.id)
    return emptyPreview({
      headline: `Reverse FG receipt ${qty.toString()}${receipt ? ` (${receipt.receiptNumber})` : ''}`,
      originalQuantity: received.toString(),
      alreadyReversedQuantity: alreadyReversed.toString(),
      maxReversibleQuantity: maxReversible.toString(),
      proposedQuantity: qty.toString(),
      inventoryImpact: [
        'Compensating ISSUE from FG warehouse',
        'Original FG_RECEIPT inventory movement remains',
        'ProductionFinishedGoodsReceipt status/reversedQuantity updated',
      ],
      blockers,
      warnings: [
        'Inventory quantity can be corrected; linked accounting vouchers (if any) require a separate Finance reversal',
      ],
      dependencies: deps,
      approvalRequired: true,
      riskLevel: 'HIGH',
      followUpActions: [],
      original: {
        movementId: movement.id,
        receiptStatus: receipt?.status ?? null,
        quantity: received.toString(),
        alreadyReversed: alreadyReversed.toString(),
      },
      proposed: { quantity: qty.toString() },
      sourceVersion,
      previewToken: makePreviewToken({ id: movement.id, sourceVersion, qty: qty.toString() }),
    })
  },

  async apply(ctx, tx) {
    const deps = await collectDependencies({ ...ctx, transactionType: 'FG_RECEIPT' })
    if (deps.some((d) => d.severity === 'blocker')) {
      throw new CorrectionBlockedError(deps.find((d) => d.severity === 'blocker')!.message)
    }
    const movement = await tx.inventoryStockMovement.findFirst({
      where: { id: ctx.sourceEntityId, tenantId: ctx.tenantId },
    })
    if (!movement) throw new NotFoundError('FG receipt not found')
    if (movement.referenceType !== 'FG_RECEIPT') {
      throw new CorrectionValidationError('Source is not a finished goods receipt')
    }

    const receipt = await tx.productionFinishedGoodsReceipt.findFirst({
      where: {
        tenantId: ctx.tenantId,
        inventoryMovementId: movement.id,
        deletedAt: null,
      },
    })

    const accepted = receipt
      ? toDecimal(receipt.acceptedQuantity)
      : toDecimal(movement.quantity).abs()
    const alreadyReversed = receipt ? toDecimal(receipt.reversedQuantity) : toDecimal(0)
    const maxReversible = subDec(accepted, alreadyReversed)
    if (!isPositive(maxReversible)) {
      throw new CorrectionValidationError('No remaining quantity to reverse on this FG receipt')
    }

    const qty = toDecimal((ctx.requestedValues?.quantity as number | undefined) ?? maxReversible.toNumber())
    if (qty.lessThanOrEqualTo(0)) {
      throw new CorrectionValidationError('Reversal quantity must be positive')
    }
    if (qty.greaterThan(maxReversible)) {
      throw new CorrectionValidationError(
        `Only ${maxReversible.toString()} units remain eligible for Finished Goods reversal.`,
      )
    }

    const reversal = await postStockMovement(
      {
        tenantId: ctx.tenantId,
        itemId: movement.itemId,
        warehouseId: movement.warehouseId,
        movementType: 'ISSUE',
        referenceType: 'FG_RECEIPT',
        quantity: qty,
        workOrderId: movement.workOrderId ?? undefined,
        referenceNo: `REV-FG-${movement.movementNumber}`,
        remarks: ctx.reason,
        idempotencyKey: `FG_REV:${movement.id}:${qty.toString()}:${newIdempotencySuffix()}`,
        createdBy: ctx.userId,
        consumeWoReservation: false,
      },
      tx,
    )

    if (receipt) {
      const newReversed = alreadyReversed.plus(qty)
      const fully = newReversed.greaterThanOrEqualTo(accepted)
      await tx.productionFinishedGoodsReceipt.update({
        where: { id: receipt.id },
        data: {
          reversedQuantity: newReversed,
          status: fully ? 'FULLY_REVERSED' : 'PARTIALLY_REVERSED',
          reversalStatus: fully ? 'FULL' : 'PARTIAL',
          updatedBy: ctx.userId,
        },
      })
    }

    const originalAccountingEvent = await tx.productionAccountingEvent.findFirst({
      where: {
        tenantId: ctx.tenantId,
        eventType: 'FINISHED_GOODS_RECEIVED',
        sourceDocumentId: movement.id,
      },
      orderBy: { createdAt: 'asc' },
    })
    if (originalAccountingEvent) {
      const originalQty = toDecimal(originalAccountingEvent.quantity).abs()
      const proportionalAmount = originalQty.greaterThan(0)
        ? toDecimal(originalAccountingEvent.amount).abs().mul(qty).div(originalQty)
        : toDecimal(0)
      if (proportionalAmount.greaterThan(0)) {
        await tx.productionAccountingEvent.create({
          data: {
            tenantId: ctx.tenantId,
            legalEntityId: originalAccountingEvent.legalEntityId,
            eventType: 'MANUFACTURING_REVERSAL',
            status: 'RECORDED',
            productionOrderId: movement.workOrderId,
            idempotencyKey: `P7E_FG_REV:${reversal.id}:V1`,
            sourceDocumentType: 'INVENTORY_STOCK_MOVEMENT',
            sourceDocumentId: reversal.id,
            quantity: qty,
            amount: proportionalAmount,
            currencyCode: originalAccountingEvent.currencyCode,
            payloadJson: {
              originalEventId: originalAccountingEvent.id,
              originalMovementId: movement.id,
              debitMappingKey: 'WIP_INVENTORY',
              creditMappingKey: 'FINISHED_GOODS_INVENTORY',
              reversedQuantity: qty.toString(),
            },
            createdBy: ctx.userId,
          },
        })
      }
    }

    return {
      reversalEntityType: 'INVENTORY_STOCK_MOVEMENT',
      reversalEntityId: reversal.id,
      quantityReversed: qty.toString(),
    }
  },
}

void defaultApprovalRequired
void defaultRisk
