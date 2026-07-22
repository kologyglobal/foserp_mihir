import { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { logProductionActivity } from '../shared/activity.service.js'

export interface SplitWorkOrderInput {
  quantity: number
  reason?: string
}

function decimal(value: Prisma.Decimal.Value) {
  return new Prisma.Decimal(value)
}

export function validateSplitQuantity(
  plannedQuantity: Prisma.Decimal.Value,
  completedGoodQuantity: Prisma.Decimal.Value,
  splitQuantity: Prisma.Decimal.Value,
) {
  const remaining = decimal(plannedQuantity).minus(completedGoodQuantity)
  const quantity = decimal(splitQuantity)
  if (!quantity.greaterThan(0)) throw new ValidationError('Split quantity must be greater than zero')
  if (!quantity.lessThan(remaining)) {
    throw new ValidationError(`Split quantity must be less than remaining open quantity (${remaining.toString()})`)
  }
  return { quantity, remaining }
}

export function calculateSplitQuantities(
  plannedQuantity: Prisma.Decimal.Value,
  completedGoodQuantity: Prisma.Decimal.Value,
  splitQuantity: Prisma.Decimal.Value,
) {
  const validated = validateSplitQuantity(plannedQuantity, completedGoodQuantity, splitQuantity)
  const originalPlanned = decimal(plannedQuantity)
  return {
    ...validated,
    originalPlanned,
    parentPlanned: originalPlanned.minus(validated.quantity),
    childPlanned: validated.quantity,
    childRatio: validated.quantity.dividedBy(originalPlanned),
  }
}

async function assertNoSplitBlockers(
  tx: Prisma.TransactionClient,
  tenantId: string,
  parentId: string,
  remaining: Prisma.Decimal,
) {
  const [openJobWork, holdingQc, pendingCorrection] = await Promise.all([
    tx.jobWorkOrder.count({
      where: {
        tenantId,
        productionOrderId: parentId,
        deletedAt: null,
        status: { notIn: ['CLOSED', 'CANCELLED'] },
      },
    }),
    tx.manufacturingQualityInspection.findMany({
      where: {
        tenantId,
        productionOrderId: parentId,
        status: { in: ['PENDING', 'READY', 'IN_PROGRESS'] },
      },
      select: { heldQty: true, pendingQty: true, inspectedQty: true },
    }),
    tx.manufacturingTransactionCorrection.count({
      where: {
        tenantId,
        productionOrderId: parentId,
        deletedAt: null,
        status: { in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'APPLYING'] },
      },
    }),
  ])

  if (openJobWork) throw new InvalidStateError('Split is blocked while the work order has open Job Work')
  const wholeRemainderHeld = holdingQc.some((qc) =>
    decimal(qc.heldQty ?? qc.pendingQty ?? qc.inspectedQty ?? 0).greaterThanOrEqualTo(remaining),
  )
  if (wholeRemainderHeld) {
    throw new InvalidStateError('Split is blocked while quality control holds the whole remaining quantity')
  }
  if (pendingCorrection) throw new InvalidStateError('Split is blocked while the work order has unapplied corrections')
}

export async function splitWorkOrder(
  tenantId: string,
  parentId: string,
  input: SplitWorkOrderInput,
  userId: string,
) {
  return prisma.$transaction(async (tx) => {
    const parent = await tx.productionOrder.findFirst({
      where: { id: parentId, tenantId, deletedAt: null },
      include: {
        bomSnapshot: { include: { lines: { orderBy: { sequence: 'asc' } } } },
        routingSnapshot: true,
        stages: { orderBy: { displayOrder: 'asc' } },
        operations: { orderBy: { sequence: 'asc' } },
        dependencies: true,
        materials: { include: { reservation: true } },
      },
    })
    if (!parent) throw new NotFoundError('Work order not found')
    if (!['READY', 'IN_PROGRESS'].includes(parent.status)) {
      throw new InvalidStateError(`Only released or in-progress work orders can be split (current: ${parent.status})`)
    }
    if (!parent.bomSnapshot || !parent.routingSnapshot) {
      throw new InvalidStateError('Released BOM and routing snapshots are required before splitting')
    }

    const { quantity, remaining, originalPlanned, parentPlanned, childRatio } = calculateSplitQuantities(
      parent.plannedQuantity,
      parent.completedGoodQuantity,
      input.quantity,
    )
    await assertNoSplitBlockers(tx, tenantId, parentId, remaining)

    const nextSequence = (await tx.productionOrder.aggregate({
      where: { tenantId, splitFromOrderId: parentId },
      _max: { splitSequence: true },
    }))._max.splitSequence ?? 0
    const childOrderNumber = await nextCode(tenantId, 'PRODUCTION_ORDER', tx)

    const child = await tx.productionOrder.create({
      data: {
        tenantId,
        orderNumber: childOrderNumber,
        demandId: parent.demandId,
        sourceType: parent.sourceType,
        sourceDocumentId: parent.sourceDocumentId,
        sourceLineReference: parent.sourceLineReference,
        salesOrderId: parent.salesOrderId,
        customerId: parent.customerId,
        projectRef: parent.projectRef,
        productItemId: parent.productItemId,
        manufacturingProfileId: parent.manufacturingProfileId,
        bomVersionId: parent.bomVersionId,
        routingVersionId: parent.routingVersionId,
        plannedQuantity: quantity,
        uomId: parent.uomId,
        plantCode: parent.plantCode,
        plannedStartDate: parent.plannedStartDate,
        requiredCompletionDate: parent.requiredCompletionDate,
        priority: parent.priority,
        managerId: parent.managerId,
        supervisorId: parent.supervisorId,
        jobNumber: parent.jobNumber,
        outputTrackingType: parent.outputTrackingType,
        status: 'READY',
        healthStatus: 'ON_TRACK',
        materialControlStatus: parent.materialControlStatus,
        qualityStatus: parent.qualityStatus,
        notes: parent.notes,
        releasedAt: new Date(),
        releasedBy: userId,
        splitFromOrderId: parentId,
        splitSequence: nextSequence + 1,
        createdBy: userId,
        updatedBy: userId,
      },
    })

    await tx.productionOrder.update({
      where: { id: parentId },
      data: { plannedQuantity: parentPlanned, version: { increment: 1 }, updatedBy: userId },
    })

    const childBom = await tx.productionOrderBomSnapshot.create({
      data: {
        tenantId,
        productionOrderId: child.id,
        bomVersionId: parent.bomSnapshot.bomVersionId,
        bomVersionNumber: parent.bomSnapshot.bomVersionNumber,
        baseQuantity: parent.bomSnapshot.baseQuantity,
        baseUomId: parent.bomSnapshot.baseUomId,
        snapshotAt: new Date(),
        createdBy: userId,
      },
    })

    const bomLineMap = new Map<string, string>()
    for (const line of parent.bomSnapshot.lines) {
      const childRequired = decimal(line.requiredQuantity).times(childRatio)
      const cloned = await tx.productionOrderBomLine.create({
        data: {
          tenantId,
          bomSnapshotId: childBom.id,
          sourceBomLineId: line.sourceBomLineId,
          parentLineId: null,
          sequence: line.sequence,
          level: line.level,
          itemId: line.itemId,
          descriptionOverride: line.descriptionOverride,
          perUnitQuantity: line.perUnitQuantity,
          uomId: line.uomId,
          scrapPercent: line.scrapPercent,
          requiredQuantity: childRequired,
          makeOrBuy: line.makeOrBuy,
          lineType: line.lineType,
          issueStageGroupId: line.issueStageGroupId,
          issueOperationId: line.issueOperationId,
          isOptional: line.isOptional,
        },
      })
      bomLineMap.set(line.id, cloned.id)
      await tx.productionOrderBomLine.update({
        where: { id: line.id },
        data: { requiredQuantity: decimal(line.requiredQuantity).minus(childRequired) },
      })
    }
    for (const line of parent.bomSnapshot.lines) {
      if (!line.parentLineId) continue
      const childLineId = bomLineMap.get(line.id)
      const childParentId = bomLineMap.get(line.parentLineId)
      if (childLineId && childParentId) {
        await tx.productionOrderBomLine.update({ where: { id: childLineId }, data: { parentLineId: childParentId } })
      }
    }

    const childRouting = await tx.productionOrderRoutingSnapshot.create({
      data: {
        tenantId,
        productionOrderId: child.id,
        routingVersionId: parent.routingSnapshot.routingVersionId,
        routingVersionNumber: parent.routingSnapshot.routingVersionNumber,
        snapshotAt: new Date(),
        createdBy: userId,
      },
    })
    void childRouting

    const stageMap = new Map<string, string>()
    for (const stage of parent.stages) {
      const cloned = await tx.productionOrderStage.create({
        data: {
          tenantId,
          productionOrderId: child.id,
          sourceStageGroupId: stage.sourceStageGroupId,
          code: stage.code,
          name: stage.name,
          displayOrder: stage.displayOrder,
          workCentreId: stage.workCentreId,
          isOptional: stage.isOptional,
          parallelAllowed: stage.parallelAllowed,
          qualityRequired: stage.qualityRequired,
          completionRule: stage.completionRule,
          status: 'BLOCKED',
          plannedQuantity: quantity,
          createdBy: userId,
          updatedBy: userId,
        },
      })
      stageMap.set(stage.id, cloned.id)
      await tx.productionOrderStage.update({
        where: { id: stage.id },
        data: { plannedQuantity: decimal(stage.plannedQuantity).minus(quantity), updatedBy: userId },
      })
    }

    const operationMap = new Map<string, string>()
    for (const operation of parent.operations) {
      const childStageId = stageMap.get(operation.stageId)
      if (!childStageId) continue
      const cloned = await tx.productionOrderOperation.create({
        data: {
          tenantId,
          productionOrderId: child.id,
          stageId: childStageId,
          sourceOperationId: operation.sourceOperationId,
          code: operation.code,
          name: operation.name,
          sequence: operation.sequence,
          workCentreId: operation.workCentreId,
          machineId: operation.machineId,
          setupTimeMinutes: operation.setupTimeMinutes,
          runTimeValue: operation.runTimeValue,
          runTimeBasis: operation.runTimeBasis,
          qualityRequired: operation.qualityRequired,
          isOptional: operation.isOptional,
          status: 'BLOCKED',
          plannedQuantity: quantity,
        },
      })
      operationMap.set(operation.id, cloned.id)
      await tx.productionOrderOperation.update({
        where: { id: operation.id },
        data: { plannedQuantity: decimal(operation.plannedQuantity).minus(quantity) },
      })
    }

    const childHasPredecessor = new Set<string>()
    for (const dependency of parent.dependencies) {
      const predecessorOperationId = operationMap.get(dependency.predecessorOperationId)
      const successorOperationId = operationMap.get(dependency.successorOperationId)
      if (!predecessorOperationId || !successorOperationId) continue
      childHasPredecessor.add(successorOperationId)
      await tx.productionOrderDependency.create({
        data: {
          tenantId,
          productionOrderId: child.id,
          predecessorOperationId,
          successorOperationId,
          dependencyType: dependency.dependencyType,
          minimumCompletionPercent: dependency.minimumCompletionPercent,
          isMandatory: dependency.isMandatory,
        },
      })
    }

    const readyStageIds = new Set<string>()
    for (const childOperationId of operationMap.values()) {
      if (childHasPredecessor.has(childOperationId)) continue
      const ready = await tx.productionOrderOperation.update({
        where: { id: childOperationId },
        data: { status: 'READY' },
        select: { stageId: true },
      })
      readyStageIds.add(ready.stageId)
    }
    for (const stageId of readyStageIds) {
      await tx.productionOrderStage.update({ where: { id: stageId }, data: { status: 'READY' } })
    }
    const currentStageId = [...readyStageIds][0] ?? null
    await tx.productionOrder.update({ where: { id: child.id }, data: { currentStageId } })

    for (const material of parent.materials) {
      const childBomLineId = bomLineMap.get(material.bomLineId)
      if (!childBomLineId) continue
      const childRequired = decimal(material.requiredQty).times(childRatio)
      let childReserved = decimal(material.reservedQty).times(childRatio)
      let childReservationId: string | null = null

      if (material.reservation?.status === 'ACTIVE' && childReserved.greaterThan(0)) {
        const activeReservationQty = Prisma.Decimal.max(
          decimal(material.reservation.quantity)
            .minus(material.reservation.fulfilledQty)
            .minus(material.reservation.releasedQty),
          0,
        )
        childReserved = Prisma.Decimal.min(childReserved, activeReservationQty)
      }
      if (material.reservation?.status === 'ACTIVE' && childReserved.greaterThan(0)) {
        const reservationNumber = await nextCode(tenantId, 'STOCK_RESERVATION', tx)
        const childReservation = await tx.inventoryStockReservation.create({
          data: {
            tenantId,
            reservationNumber,
            itemId: material.reservation.itemId,
            warehouseId: material.reservation.warehouseId,
            quantity: childReserved,
            demandType: material.reservation.demandType,
            demandId: child.id,
            referenceNo: childOrderNumber,
            status: 'ACTIVE',
            sourceVersion: 1,
            remarks: `Transferred by split from ${parent.orderNumber}`,
            createdBy: userId,
            updatedBy: userId,
          },
        })
        childReservationId = childReservation.id
        await tx.inventoryStockReservation.update({
          where: { id: material.reservation.id },
          data: {
            quantity: decimal(material.reservation.quantity).minus(childReserved),
            sourceVersion: { increment: 1 },
            updatedBy: userId,
          },
        })
      }

      await tx.productionOrderMaterial.create({
        data: {
          tenantId,
          productionOrderId: child.id,
          bomLineId: childBomLineId,
          itemId: material.itemId,
          uomId: material.uomId,
          warehouseId: material.warehouseId,
          requiredQty: childRequired,
          reservedQty: childReserved,
          issuedQty: 0,
          returnedQty: 0,
          shortageQty: Prisma.Decimal.max(childRequired.minus(childReserved), 0),
          status: childReserved.greaterThanOrEqualTo(childRequired) ? 'RESERVED' : 'OPEN',
          reservationId: childReservationId,
          issueStageGroupId: material.issueStageGroupId,
          issueOperationId: material.issueOperationId,
          remarks: input.reason ?? `Split from ${parent.orderNumber}`,
          createdBy: userId,
          updatedBy: userId,
        },
      })
      await tx.productionOrderMaterial.update({
        where: { id: material.id },
        data: {
          requiredQty: decimal(material.requiredQty).minus(childRequired),
          reservedQty: decimal(material.reservedQty).minus(childReserved),
          shortageQty: Prisma.Decimal.max(
            decimal(material.requiredQty).minus(childRequired).minus(decimal(material.reservedQty).minus(childReserved)),
            0,
          ),
          updatedBy: userId,
        },
      })
    }

    const split = await tx.productionOrderSplit.create({
      data: { tenantId, parentOrderId: parentId, childOrderId: child.id, splitQty: quantity, reason: input.reason, createdBy: userId },
    })
    const correctionNumber = await nextCode(tenantId, 'MANUFACTURING_CORRECTION', tx)
    const correction = await tx.manufacturingTransactionCorrection.create({
      data: {
        tenantId,
        correctionNumber,
        transactionType: 'WORK_ORDER_SPLIT',
        correctionType: 'REVERSE_ONLY',
        status: 'APPLIED',
        riskLevel: 'HIGH',
        sourceEntityType: 'PRODUCTION_ORDER_SPLIT',
        sourceEntityId: split.id,
        sourceTransactionId: split.id,
        productionOrderId: parentId,
        requestedAction: 'SPLIT',
        requestedValuesJson: { childOrderId: child.id, splitQty: quantity.toString() },
        originalValuesJson: { parentOrderId: parentId, plannedQuantity: originalPlanned.toString() },
        impactSummaryJson: { parentPlannedQuantity: parentPlanned.toString(), childOrderId: child.id },
        dependencySummaryJson: [],
        reason: input.reason ?? 'Work order split',
        approvalRequired: false,
        requestedBy: userId,
        requestedAt: new Date(),
        approvedBy: userId,
        approvedAt: new Date(),
        appliedBy: userId,
        appliedAt: new Date(),
        reversalTransactionId: split.id,
        createdBy: userId,
        updatedBy: userId,
      },
    })

    await logProductionActivity({
      tenantId,
      productionOrderId: parentId,
      activityType: 'CORRECTION_APPLIED',
      userId,
      message: `Split ${quantity.toString()} to child work order ${childOrderNumber}`,
      oldValue: { plannedQuantity: originalPlanned.toString() },
      newValue: { plannedQuantity: parentPlanned.toString(), childOrderId: child.id },
      reason: input.reason,
      sourceTransactionId: split.id,
    }, tx)
    await logProductionActivity({
      tenantId,
      productionOrderId: child.id,
      activityType: 'CREATED',
      userId,
      message: `Work order ${childOrderNumber} created by split from ${parent.orderNumber}`,
      newValue: { parentOrderId: parentId, splitQty: quantity.toString() },
      reason: input.reason,
      sourceTransactionId: split.id,
    }, tx)

    return { parentId, child, split, correctionId: correction.id }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}
