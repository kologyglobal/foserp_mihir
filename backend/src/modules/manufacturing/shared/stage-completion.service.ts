import type { Prisma, ProductionOrderStage } from '@prisma/client'
import { deriveStageStatusFromOperations, findOperationsToPromote, type ReadinessOperation } from './readiness.service.js'
import { recomputeOrderHealth } from '../work-orders/work-order-health.service.js'

type DbClient = Prisma.TransactionClient

export interface StagePromotionResult {
  completedStage: ProductionOrderStage
  promotedStages: ProductionOrderStage[]
  order: { id: string; currentStageId: string | null }
}

/**
 * Marks a stage COMPLETED and promotes successor operations/stages (shared by
 * normal completeStage and QC PASS on an IN_PROCESS inspection).
 */
export async function promoteSuccessorsAfterStageComplete(
  tx: DbClient,
  tenantId: string,
  productionOrderId: string,
  completedStage: ProductionOrderStage,
  orderCurrentStageId: string | null,
  now: Date = new Date(),
): Promise<StagePromotionResult> {
  const completedStageRecord = await tx.productionOrderStage.update({
    where: { id: completedStage.id },
    data: { status: 'COMPLETED', completedAt: now },
  })

  const stageOperations = await tx.productionOrderOperation.findMany({
    where: { stageId: completedStage.id, tenantId },
  })
  const allOperations = await tx.productionOrderOperation.findMany({ where: { productionOrderId, tenantId } })
  const dependencies = await tx.productionOrderDependency.findMany({ where: { productionOrderId, tenantId } })

  const promotedOperationIds = new Set<string>()
  for (const op of stageOperations) {
    const promotable = findOperationsToPromote(op.id, allOperations, dependencies)
    for (const opId of promotable) promotedOperationIds.add(opId)
  }

  for (const opId of promotedOperationIds) {
    await tx.productionOrderOperation.update({ where: { id: opId }, data: { status: 'READY' } })
  }

  const refreshedOperations = await tx.productionOrderOperation.findMany({ where: { productionOrderId, tenantId } })
  const opsByStage = new Map<string, ReadinessOperation[]>()
  for (const op of refreshedOperations) {
    const list = opsByStage.get(op.stageId) ?? []
    list.push({ id: op.id, stageId: op.stageId, isOptional: op.isOptional, status: op.status })
    opsByStage.set(op.stageId, list)
  }

  const allStages = await tx.productionOrderStage.findMany({ where: { productionOrderId, tenantId } })
  const readyOrRunningStages: ProductionOrderStage[] = []
  const promotedStages: ProductionOrderStage[] = []
  for (const s of allStages) {
    if (s.id === completedStage.id) continue
    const ops = opsByStage.get(s.id) ?? []
    const derived = deriveStageStatusFromOperations(ops)
    const statusChanged = derived !== s.status
    if (statusChanged) {
      await tx.productionOrderStage.update({ where: { id: s.id }, data: { status: derived } })
      if (derived === 'READY') promotedStages.push({ ...s, status: derived })
    }
    if (derived === 'READY' || derived === 'IN_PROGRESS') readyOrRunningStages.push({ ...s, status: derived })
  }

  let currentStageId = orderCurrentStageId
  if (currentStageId === completedStage.id) {
    const next = readyOrRunningStages.sort((a, b) => a.displayOrder - b.displayOrder)[0]
    currentStageId = next?.id ?? null
    await tx.productionOrder.update({ where: { id: productionOrderId }, data: { currentStageId } })
  }

  await recomputeOrderHealth(tx, tenantId, productionOrderId)

  const order = await tx.productionOrder.findFirstOrThrow({ where: { id: productionOrderId, tenantId } })
  return { promotedStages, order: { id: order.id, currentStageId: order.currentStageId }, completedStage: completedStageRecord }
}
