import type { Request } from 'express'
import type { Prisma, ProductionStageStatus } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import { InvalidStateError, ValidationError } from '../../../utils/errors.js'
import { computeBomLineRequiredQuantity } from '../shared/quantity.service.js'
import { logProductionActivity } from '../shared/activity.service.js'
import { computeInitialOperationStatus, deriveStageStatusFromOperations, type ReadinessOperation } from '../shared/readiness.service.js'
import * as repo from './work-order.repository.js'
import { syncRequirements } from '../materials/material.service.js'

/**
 * Snapshots the order's BOM version + routing version into immutable
 * ProductionOrderBomLine / ProductionOrderStage / ProductionOrderOperation rows,
 * then transitions DRAFT -> READY. Later changes to the master BOM/routing
 * (new versions, revisions) never affect an already-released order.
 */
export async function releaseWorkOrder(req: Request, tenantId: string, id: string) {
  const userId = req.context?.userId ?? ''
  const before = await repo.getWorkOrder(tenantId, id)

  if (before.status !== 'DRAFT') {
    throw new InvalidStateError(`Work order can only be released from DRAFT status (current: ${before.status})`)
  }

  const order = await prisma.$transaction(async (tx) => {
    const bomVersion = await tx.manufacturingBomVersion.findFirst({
      where: { id: before.bomVersionId, tenantId, deletedAt: null },
    })
    if (!bomVersion || bomVersion.status !== 'ACTIVE') {
      throw new ValidationError('The BOM version linked to this work order is no longer ACTIVE; cannot release')
    }

    if (!before.routingVersionId) {
      throw new ValidationError('Work order has no routing version to snapshot; cannot release')
    }
    const routingVersion = await tx.manufacturingRoutingVersion.findFirst({
      where: { id: before.routingVersionId, tenantId, deletedAt: null },
    })
    if (!routingVersion || routingVersion.status !== 'ACTIVE') {
      throw new ValidationError('The routing version linked to this work order is no longer ACTIVE; cannot release')
    }

    await snapshotBom(tx, tenantId, before.id, bomVersion, before.plannedQuantity)
    const { currentStageId } = await snapshotRouting(tx, tenantId, before.id, routingVersion)

    const orderStages = await tx.productionOrderStage.findMany({ where: { productionOrderId: id, tenantId } })
    const orderOps = await tx.productionOrderOperation.findMany({
      where: { productionOrderId: id, tenantId },
      select: { qualityRequired: true },
    })
    const qualityRequired =
      orderStages.some((s) => s.qualityRequired) || orderOps.some((o) => o.qualityRequired)
    const qualityStatus = qualityRequired ? 'PENDING_QC' : 'NOT_APPLICABLE'

    const updated = await tx.productionOrder.update({
      where: { id, tenantId },
      data: {
        status: 'READY',
        releasedAt: new Date(),
        releasedBy: userId,
        currentStageId,
        materialControlStatus: 'NOT_CONNECTED',
        qualityStatus,
        updatedBy: userId,
      },
    })

    await logProductionActivity(
      {
        tenantId,
        productionOrderId: id,
        activityType: 'RELEASED',
        userId,
        message: `Work order ${before.orderNumber} released (BOM v${bomVersion.versionNumber}, Routing v${routingVersion.versionNumber})`,
        oldValue: { status: before.status },
        newValue: { status: 'READY' },
      },
      tx,
    )

    return updated
  })

  const meta = auditFromRequest(req)
  await createAuditLog({
    tenantId,
    userId: meta.userId,
    module: 'manufacturing',
    entity: 'productionOrder',
    entityId: id,
    action: 'RELEASE',
    oldValues: before,
    newValues: order,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  })

  const profile = await prisma.manufacturingProfile.findFirst({
    where: { id: before.manufacturingProfileId, tenantId },
    select: { productionWarehouseId: true },
  })
  if (profile?.productionWarehouseId) {
    try {
      await syncRequirements(req, tenantId, id)
    } catch {
      // Release still succeeds; material control stays NOT_CONNECTED until Sync is run
      // (e.g. BOM has no stockable lines, or warehouse/item validation fails).
    }
  }

  return prisma.productionOrder.findFirstOrThrow({ where: { id, tenantId } })
}

async function snapshotBom(
  tx: Prisma.TransactionClient,
  tenantId: string,
  productionOrderId: string,
  bomVersion: { id: string; versionNumber: number; baseQuantity: Prisma.Decimal; baseUomId: string },
  plannedOrderQuantity: Prisma.Decimal,
) {
  const snapshot = await tx.productionOrderBomSnapshot.create({
    data: {
      tenantId,
      productionOrderId,
      bomVersionId: bomVersion.id,
      bomVersionNumber: bomVersion.versionNumber,
      baseQuantity: bomVersion.baseQuantity,
      baseUomId: bomVersion.baseUomId,
    },
  })

  const sourceLines = await tx.manufacturingBomLine.findMany({
    where: { bomVersionId: bomVersion.id, tenantId, deletedAt: null },
    orderBy: { sequence: 'asc' },
  })

  const idMap = new Map<string, string>()
  const created: Array<{ newId: string; parentLineId: string | null }> = []

  for (const line of sourceLines) {
    const requiredQuantity = computeBomLineRequiredQuantity({
      quantityBasis: line.quantityBasis,
      quantityPerBase: line.quantity,
      fixedQuantity: line.fixedQuantity,
      plannedOrderQuantity,
      baseQuantity: bomVersion.baseQuantity,
      scrapPercent: line.scrapPercent,
    })

    const created1 = await tx.productionOrderBomLine.create({
      data: {
        tenantId,
        bomSnapshotId: snapshot.id,
        sourceBomLineId: line.id,
        parentLineId: null,
        sequence: line.sequence,
        level: line.level,
        itemId: line.itemId,
        descriptionOverride: line.descriptionOverride,
        perUnitQuantity: line.quantity,
        uomId: line.uomId,
        scrapPercent: line.scrapPercent,
        requiredQuantity,
        makeOrBuy: line.makeOrBuy,
        lineType: line.lineType,
        issueStageGroupId: line.issueStageGroupId,
        issueOperationId: line.issueOperationId,
        isOptional: line.isOptional,
      },
    })
    idMap.set(line.id, created1.id)
    created.push({ newId: created1.id, parentLineId: line.parentLineId })
  }

  for (const entry of created) {
    if (!entry.parentLineId) continue
    const newParentId = idMap.get(entry.parentLineId)
    if (!newParentId) continue
    await tx.productionOrderBomLine.update({ where: { id: entry.newId }, data: { parentLineId: newParentId } })
  }
}

async function snapshotRouting(
  tx: Prisma.TransactionClient,
  tenantId: string,
  productionOrderId: string,
  routingVersion: { id: string; versionNumber: number },
) {
  await tx.productionOrderRoutingSnapshot.create({
    data: {
      tenantId,
      productionOrderId,
      routingVersionId: routingVersion.id,
      routingVersionNumber: routingVersion.versionNumber,
    },
  })

  const order = await tx.productionOrder.findFirstOrThrow({ where: { id: productionOrderId, tenantId } })

  const stageGroups = await tx.manufacturingStageGroup.findMany({
    where: { routingVersionId: routingVersion.id, tenantId, deletedAt: null, isActive: true },
    orderBy: { displayOrder: 'asc' },
  })
  if (stageGroups.length === 0) {
    throw new ValidationError('Routing has no active stage groups — cannot release this work order')
  }

  const stageIdMap = new Map<string, string>()
  for (const group of stageGroups) {
    const stage = await tx.productionOrderStage.create({
      data: {
        tenantId,
        productionOrderId,
        sourceStageGroupId: group.id,
        code: group.code,
        name: group.name,
        displayOrder: group.displayOrder,
        workCentreId: group.defaultWorkCentreId,
        isOptional: group.isOptional,
        parallelAllowed: group.parallelAllowed,
        qualityRequired: group.qualityRequired,
        completionRule: group.completionRule,
        status: 'NOT_STARTED',
        plannedQuantity: order.plannedQuantity,
      },
    })
    stageIdMap.set(group.id, stage.id)
  }

  const operations = await tx.manufacturingRoutingOperation.findMany({
    where: { routingVersionId: routingVersion.id, tenantId, deletedAt: null, isActive: true },
    orderBy: { sequence: 'asc' },
  })

  const opIdMap = new Map<string, string>()
  for (const op of operations) {
    const stageId = stageIdMap.get(op.stageGroupId)
    if (!stageId) continue
    const created = await tx.productionOrderOperation.create({
      data: {
        tenantId,
        productionOrderId,
        stageId,
        sourceOperationId: op.id,
        code: op.code,
        name: op.name,
        sequence: op.sequence,
        workCentreId: op.workCentreId,
        machineId: op.defaultMachineId,
        setupTimeMinutes: op.setupTimeMinutes,
        runTimeValue: op.runTimeValue,
        runTimeBasis: op.runTimeBasis,
        qualityRequired: op.qualityRequired,
        isOptional: op.isOptional,
        status: 'NOT_STARTED',
        plannedQuantity: order.plannedQuantity,
      },
    })
    opIdMap.set(op.id, created.id)
  }

  const dependencies = await tx.manufacturingOperationDependency.findMany({
    where: { routingVersionId: routingVersion.id, tenantId, deletedAt: null },
  })

  const newDependencies: Array<{ predecessorOperationId: string; successorOperationId: string; isMandatory: boolean }> = []
  for (const dep of dependencies) {
    const predecessorOperationId = opIdMap.get(dep.predecessorOperationId)
    const successorOperationId = opIdMap.get(dep.successorOperationId)
    if (!predecessorOperationId || !successorOperationId) continue
    await tx.productionOrderDependency.create({
      data: {
        tenantId,
        productionOrderId,
        predecessorOperationId,
        successorOperationId,
        dependencyType: dep.dependencyType,
        minimumCompletionPercent: dep.minimumCompletionPercent,
        isMandatory: dep.isMandatory,
      },
    })
    newDependencies.push({ predecessorOperationId, successorOperationId, isMandatory: dep.isMandatory })
  }

  // Compute initial op readiness now that dependencies are remapped to new operation ids.
  // When the routing has no mandatory dependencies, only the first stage (by displayOrder)
  // should start READY so the shopfloor advances process-by-process.
  const allNewOperationIds = Array.from(opIdMap.values())
  if (newDependencies.length === 0) {
    const stageOrder = await tx.productionOrderStage.findMany({
      where: { productionOrderId, tenantId },
      select: { id: true, displayOrder: true },
      orderBy: { displayOrder: 'asc' },
    })
    const firstStageId = stageOrder[0]?.id ?? null
    const ops = await tx.productionOrderOperation.findMany({
      where: { productionOrderId, tenantId },
      select: { id: true, stageId: true },
    })
    for (const op of ops) {
      const status = firstStageId && op.stageId === firstStageId ? 'READY' : 'NOT_STARTED'
      await tx.productionOrderOperation.update({ where: { id: op.id }, data: { status } })
    }
  } else {
    for (const operationId of allNewOperationIds) {
      const status = computeInitialOperationStatus(operationId, newDependencies)
      await tx.productionOrderOperation.update({ where: { id: operationId }, data: { status } })
    }
  }

  // Derive each stage's status from its (now-updated) operations.
  const allOperations = await tx.productionOrderOperation.findMany({ where: { productionOrderId, tenantId } })
  const opsByStage = new Map<string, ReadinessOperation[]>()
  for (const op of allOperations) {
    const list = opsByStage.get(op.stageId) ?? []
    list.push({ id: op.id, stageId: op.stageId, isOptional: op.isOptional, status: op.status })
    opsByStage.set(op.stageId, list)
  }

  let currentStageId: string | null = null
  const stagesSorted = Array.from(stageIdMap.entries())
  for (const [, stageId] of stagesSorted) {
    const ops = opsByStage.get(stageId) ?? []
    const status: ProductionStageStatus = deriveStageStatusFromOperations(ops)
    await tx.productionOrderStage.update({ where: { id: stageId }, data: { status } })
    if (!currentStageId && (status === 'READY' || status === 'IN_PROGRESS')) {
      currentStageId = stageId
    }
  }

  return { currentStageId }
}
