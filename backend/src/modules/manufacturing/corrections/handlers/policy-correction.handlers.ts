import { prisma } from '../../../../config/database.js'
import { NotFoundError } from '../../../../utils/errors.js'
import { postStockMovement } from '../../../inventory/shared/stock-posting.service.js'
import { toDecimal } from '../../shared/quantity.service.js'
import { CorrectionBlockedError, CorrectionValidationError } from '../correction.errors.js'
import { emptyPreview, makePreviewToken, makeSourceVersion, newIdempotencySuffix } from '../correction-preview.util.js'
import type { CorrectionHandler } from '../correction.types.js'

export const jobWorkDispatchHandler: CorrectionHandler = {
  async preview(ctx) {
    const dispatch = await prisma.jobWorkDispatch.findFirst({
      where: { id: ctx.sourceEntityId, tenantId: ctx.tenantId },
      include: { jobWorkOrder: true, lines: true },
    })
    if (!dispatch) throw new NotFoundError('Job Work dispatch not found')

    const receipts = await prisma.jobWorkReceipt.count({
      where: { tenantId: ctx.tenantId, jobWorkOrderId: dispatch.jobWorkOrderId },
    })
    const blockers: string[] = []
    if (receipts > 0) {
      blockers.push('A Job Work receipt exists. Reverse the receipt before reversing this dispatch.')
    }

    const sourceVersion = makeSourceVersion(dispatch.createdAt, dispatch.id)
    return emptyPreview({
      headline: `Reverse Job Work dispatch ${dispatch.dispatchNumber ?? dispatch.id}`,
      blockers,
      warnings: ['Vendor invoice / AP values are not automatically corrected in this phase'],
      dependencies: blockers.map((m) => ({ code: 'JW_RECEIPT', severity: 'blocker' as const, message: m })),
      approvalRequired: true,
      riskLevel: 'HIGH',
      inventoryImpact: ['Compensating SUBCON_IN for dispatched stockable lines'],
      followUpActions: [],
      original: { dispatchId: dispatch.id, jobWorkOrderId: dispatch.jobWorkOrderId },
      proposed: { reverse: true },
      sourceVersion,
      previewToken: makePreviewToken({ id: dispatch.id, sourceVersion }),
    })
  },

  async apply(ctx, tx) {
    const dispatch = await tx.jobWorkDispatch.findFirst({
      where: { id: ctx.sourceEntityId, tenantId: ctx.tenantId },
      include: {
        lines: { include: { materialLine: true } },
        jobWorkOrder: true,
      },
    })
    if (!dispatch) throw new NotFoundError('Job Work dispatch not found')
    const receipts = await tx.jobWorkReceipt.count({
      where: { tenantId: ctx.tenantId, jobWorkOrderId: dispatch.jobWorkOrderId },
    })
    if (receipts > 0) throw new CorrectionBlockedError('Reverse Job Work receipt first')

    let lastMovementId = dispatch.id
    const warehouseId = dispatch.jobWorkOrder.materialWarehouseId
    for (const line of dispatch.lines) {
      const qty = toDecimal(line.quantity)
      if (!qty.greaterThan(0)) continue
      const itemId = line.materialLine.itemId
      const item = await tx.masterItem.findFirst({ where: { id: itemId, tenantId: ctx.tenantId } })
      if (!item?.isStockable) continue
      const mov = await postStockMovement(
        {
          tenantId: ctx.tenantId,
          itemId,
          warehouseId,
          movementType: 'INWARD',
          referenceType: 'SUBCON_IN',
          quantity: qty,
          workOrderId: dispatch.jobWorkOrder.productionOrderId ?? undefined,
          referenceNo: `REV-JW-DISP-${dispatch.id}`,
          remarks: ctx.reason,
          idempotencyKey: `JW_DISP_REV:${dispatch.id}:${line.id}:${newIdempotencySuffix()}`,
          createdBy: ctx.userId,
        },
        tx,
      )
      lastMovementId = mov.id
    }

    await tx.jobWorkOrder.update({
      where: { id: dispatch.jobWorkOrderId },
      data: { status: 'DRAFT', updatedBy: ctx.userId },
    })

    return {
      reversalEntityType: 'INVENTORY_STOCK_MOVEMENT',
      reversalEntityId: lastMovementId,
    }
  },
}

export const jobWorkReceiptHandler: CorrectionHandler = {
  async preview(ctx) {
    const receipt = await prisma.jobWorkReceipt.findFirst({
      where: { id: ctx.sourceEntityId, tenantId: ctx.tenantId },
    })
    if (!receipt) throw new NotFoundError('Job Work receipt not found')
    const sourceVersion = makeSourceVersion(receipt.createdAt, receipt.id)
    return emptyPreview({
      headline: `Reverse Job Work receipt ${receipt.id}`,
      blockers: [],
      warnings: [
        'Quality decisions are not silently reversed — supersede QC separately if required',
        'Vendor invoice and accounting values are not automatically corrected in this phase',
      ],
      dependencies: [],
      approvalRequired: true,
      riskLevel: 'HIGH',
      inventoryImpact: ['Compensating SUBCON_OUT / ISSUE for received stockable output'],
      followUpActions: [],
      original: { receiptId: receipt.id },
      proposed: { reverse: true },
      sourceVersion,
      previewToken: makePreviewToken({ id: receipt.id, sourceVersion }),
    })
  },

  async apply(ctx, tx) {
    const receipt = await tx.jobWorkReceipt.findFirst({
      where: { id: ctx.sourceEntityId, tenantId: ctx.tenantId },
      include: { jobWorkOrder: true },
    })
    if (!receipt) throw new NotFoundError('Job Work receipt not found')
    const jw = receipt.jobWorkOrder
    const qty = toDecimal(receipt.acceptedQty)
    const mov = await postStockMovement(
      {
        tenantId: ctx.tenantId,
        itemId: jw.itemId,
        warehouseId: jw.receiptWarehouseId,
        movementType: 'ISSUE',
        referenceType: 'SUBCON_OUT',
        quantity: qty,
        workOrderId: jw.productionOrderId ?? undefined,
        referenceNo: `REV-JW-RCV-${receipt.id}`,
        remarks: ctx.reason,
        idempotencyKey: `JW_RCV_REV:${receipt.id}:${newIdempotencySuffix()}`,
        createdBy: ctx.userId,
        consumeWoReservation: false,
      },
      tx,
    )
    return {
      reversalEntityType: 'INVENTORY_STOCK_MOVEMENT',
      reversalEntityId: mov.id,
      quantityReversed: qty.toString(),
    }
  },
}

export const workOrderSplitHandler: CorrectionHandler = {
  async preview(ctx) {
    const split = await prisma.productionOrderSplit.findFirst({
      where: { id: ctx.sourceEntityId, tenantId: ctx.tenantId },
      include: { parentOrder: true, childOrder: true },
    })
    if (!split) throw new NotFoundError('Work Order split not found')
    const blockers = await collectSplitReversalBlockers(ctx.tenantId, split.childOrderId)
    const sourceVersion = makeSourceVersion(split.createdAt, `${split.id}:${split.childOrder.updatedAt.toISOString()}`)
    return emptyPreview({
      headline: `Reverse split from ${split.parentOrder.orderNumber} to ${split.childOrder.orderNumber}`,
      blockers,
      warnings: ['The child work order will be cancelled and soft-deleted; the split audit record remains'],
      dependencies: blockers.map((message) => ({ code: 'SPLIT_CHILD_ACTIVE', severity: 'blocker' as const, message })),
      approvalRequired: true,
      riskLevel: 'HIGH',
      followUpActions: [],
      original: {
        splitId: split.id,
        productionOrderId: split.parentOrderId,
        parentOrderId: split.parentOrderId,
        childOrderId: split.childOrderId,
        splitQty: split.splitQty.toString(),
      },
      proposed: { cancelChild: true, restoreParentQuantity: split.splitQty.toString() },
      sourceVersion,
      previewToken: makePreviewToken({ split: split.id, childUpdatedAt: split.childOrder.updatedAt }),
    })
  },
  async apply(ctx, tx) {
    const split = await tx.productionOrderSplit.findFirst({
      where: { id: ctx.sourceEntityId, tenantId: ctx.tenantId },
      include: {
        parentOrder: {
          include: {
            bomSnapshot: { include: { lines: true } },
            stages: true,
            operations: true,
            materials: { include: { reservation: true, bomLine: true } },
          },
        },
        childOrder: {
          include: {
            bomSnapshot: { include: { lines: true } },
            stages: true,
            operations: true,
            materials: { include: { reservation: true, bomLine: true } },
          },
        },
      },
    })
    if (!split) throw new NotFoundError('Work Order split not found')
    const blockers = await collectSplitReversalBlockers(ctx.tenantId, split.childOrderId, tx)
    if (blockers.length) throw new CorrectionBlockedError(blockers[0]!)

    const parent = split.parentOrder
    const child = split.childOrder
    await tx.productionOrder.update({
      where: { id: parent.id },
      data: {
        plannedQuantity: toDecimal(parent.plannedQuantity).plus(child.plannedQuantity),
        version: { increment: 1 },
        updatedBy: ctx.userId,
      },
    })

    const parentBomBySource = new Map(
      (parent.bomSnapshot?.lines ?? []).map((line) => [line.sourceBomLineId ?? line.sequence.toString(), line]),
    )
    for (const line of child.bomSnapshot?.lines ?? []) {
      const parentLine = parentBomBySource.get(line.sourceBomLineId ?? line.sequence.toString())
      if (parentLine) {
        await tx.productionOrderBomLine.update({
          where: { id: parentLine.id },
          data: { requiredQuantity: toDecimal(parentLine.requiredQuantity).plus(line.requiredQuantity) },
        })
      }
    }

    const parentStages = new Map(parent.stages.map((stage) => [stage.sourceStageGroupId, stage]))
    for (const stage of child.stages) {
      const parentStage = parentStages.get(stage.sourceStageGroupId)
      if (parentStage) {
        await tx.productionOrderStage.update({
          where: { id: parentStage.id },
          data: { plannedQuantity: toDecimal(parentStage.plannedQuantity).plus(stage.plannedQuantity), updatedBy: ctx.userId },
        })
      }
    }
    const parentOperations = new Map(parent.operations.map((operation) => [operation.sourceOperationId, operation]))
    for (const operation of child.operations) {
      const parentOperation = parentOperations.get(operation.sourceOperationId)
      if (parentOperation) {
        await tx.productionOrderOperation.update({
          where: { id: parentOperation.id },
          data: { plannedQuantity: toDecimal(parentOperation.plannedQuantity).plus(operation.plannedQuantity) },
        })
      }
    }

    const parentMaterials = new Map(
      parent.materials.map((material) => [
        `${material.itemId}:${material.bomLine.sourceBomLineId ?? material.bomLine.sequence}`,
        material,
      ]),
    )
    for (const material of child.materials) {
      const parentMaterial = parentMaterials.get(
        `${material.itemId}:${material.bomLine.sourceBomLineId ?? material.bomLine.sequence}`,
      )
      if (!parentMaterial) continue
      await tx.productionOrderMaterial.update({
        where: { id: parentMaterial.id },
        data: {
          requiredQty: toDecimal(parentMaterial.requiredQty).plus(material.requiredQty),
          reservedQty: toDecimal(parentMaterial.reservedQty).plus(material.reservedQty),
          shortageQty: toDecimal(parentMaterial.shortageQty).plus(material.shortageQty),
          updatedBy: ctx.userId,
        },
      })
      if (material.reservation?.status === 'ACTIVE' && parentMaterial.reservation) {
        await tx.inventoryStockReservation.update({
          where: { id: parentMaterial.reservation.id },
          data: {
            quantity: toDecimal(parentMaterial.reservation.quantity).plus(material.reservation.quantity),
            sourceVersion: { increment: 1 },
            updatedBy: ctx.userId,
          },
        })
        await tx.inventoryStockReservation.update({
          where: { id: material.reservation.id },
          data: {
            releasedQty: material.reservation.quantity,
            status: 'CANCELLED',
            cancelledAt: new Date(),
            cancelledBy: ctx.userId,
            sourceVersion: { increment: 1 },
            updatedBy: ctx.userId,
          },
        })
      }
    }

    await tx.productionOrder.update({
      where: { id: child.id },
      data: { status: 'CANCELLED', deletedAt: new Date(), updatedBy: ctx.userId },
    })

    return {
      reversalEntityType: 'PRODUCTION_ORDER',
      reversalEntityId: child.id,
      quantityReversed: split.splitQty.toString(),
    }
  },
}

async function collectSplitReversalBlockers(
  tenantId: string,
  childOrderId: string,
  client: typeof prisma | Parameters<CorrectionHandler['apply']>[1] = prisma,
) {
  const child = await client.productionOrder.findFirst({
    where: { id: childOrderId, tenantId },
    select: { status: true, deletedAt: true },
  })
  if (!child || child.deletedAt || child.status === 'CANCELLED') return ['The split child is already inactive']
  const [
    progress,
    dailyLines,
    productionIssues,
    wip,
    qc,
    jobWork,
    fg,
    assignments,
    furtherSplits,
    issuedMaterials,
  ] = await Promise.all([
    client.productionStageLedger.count({ where: { tenantId, productionOrderId: childOrderId } }),
    client.dailyProductionLine.count({ where: { tenantId, productionOrderId: childOrderId } }),
    client.productionIssue.count({ where: { tenantId, productionOrderId: childOrderId } }),
    client.productionWipMovement.count({
      where: {
        tenantId,
        deletedAt: null,
        OR: [{ productionOrderId: childOrderId }, { targetProductionOrderId: childOrderId }],
      },
    }),
    client.manufacturingQualityInspection.count({ where: { tenantId, productionOrderId: childOrderId } }),
    client.jobWorkOrder.count({ where: { tenantId, productionOrderId: childOrderId, deletedAt: null } }),
    client.productionFinishedGoodsReceipt.count({ where: { tenantId, productionOrderId: childOrderId } }),
    client.productionAssignment.count({ where: { tenantId, productionOrderId: childOrderId } }),
    client.productionOrderSplit.count({ where: { tenantId, parentOrderId: childOrderId } }),
    client.productionOrderMaterial.count({
      where: {
        tenantId,
        productionOrderId: childOrderId,
        OR: [{ issuedQty: { gt: 0 } }, { returnedQty: { gt: 0 } }],
      },
    }),
  ])
  const blockers: string[] = []
  if (progress || dailyLines) blockers.push('Child has production progress')
  if (productionIssues || issuedMaterials) blockers.push('Child has production or material issues')
  if (wip) blockers.push('Child has WIP movements')
  if (qc) blockers.push('Child has quality records')
  if (jobWork) blockers.push('Child has Job Work records')
  if (fg) blockers.push('Child has finished-goods receipts')
  if (assignments) blockers.push('Child has assignments')
  if (furtherSplits) blockers.push('Child has further splits')
  return blockers
}

export const qualityDecisionHandler: CorrectionHandler = {
  async preview(ctx) {
    const inspection = await prisma.manufacturingQualityInspection.findFirst({
      where: { id: ctx.sourceEntityId, tenantId: ctx.tenantId },
    })
    if (!inspection) throw new NotFoundError('Quality inspection not found')
    const sourceVersion = makeSourceVersion(inspection.updatedAt, inspection.id)
    return emptyPreview({
      headline: `Supersede quality decision on ${inspection.inspectionNumber}`,
      blockers: [],
      warnings: [
        'Original inspection remains visible and immutable',
        'Create a superseding inspection/decision via Quality service — manufacturing does not overwrite PASS/REJECT',
      ],
      dependencies: [],
      approvalRequired: true,
      riskLevel: 'HIGH',
      followUpActions: [
        'Use Quality correction permission to open a superseding inspection',
        'Reverse downstream WIP/FG first if movement already occurred',
      ],
      original: {
        inspectionId: inspection.id,
        status: inspection.status,
        decision: inspection.decision,
      },
      proposed: { action: 'SUPERSEDE_DECISION' },
      sourceVersion,
      previewToken: makePreviewToken({ id: inspection.id, sourceVersion }),
    })
  },
  async apply() {
    throw new CorrectionBlockedError(
      'Quality decisions must be superseded through the Quality module — manufacturing will not overwrite the original inspection',
    )
  },
}

export const blockedPolicyHandler = (message: string): CorrectionHandler => ({
  async preview(ctx) {
    const sourceVersion = makeSourceVersion(new Date(), ctx.sourceEntityId)
    return emptyPreview({
      headline: message,
      blockers: [message],
      warnings: [],
      dependencies: [{ code: 'POLICY', severity: 'blocker', message }],
      approvalRequired: true,
      riskLevel: 'HIGH',
      followUpActions: [],
      original: { sourceEntityId: ctx.sourceEntityId },
      proposed: {},
      sourceVersion,
      previewToken: makePreviewToken({ id: ctx.sourceEntityId, message }),
    })
  },
  async apply() {
    throw new CorrectionBlockedError(message)
  },
})

void CorrectionValidationError
