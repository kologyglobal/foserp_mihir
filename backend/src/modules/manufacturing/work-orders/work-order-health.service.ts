import type { Prisma } from '@prisma/client'
import { computeOrderHealth } from '../shared/health.service.js'

/**
 * Recomputes and persists `healthStatus` for a work order based on its current
 * status, dates, completion percent, and the statuses of its stages.
 */
export async function recomputeOrderHealth(tx: Prisma.TransactionClient, tenantId: string, productionOrderId: string) {
  const order = await tx.productionOrder.findFirstOrThrow({ where: { id: productionOrderId, tenantId } })
  const stages = await tx.productionOrderStage.findMany({ where: { productionOrderId, tenantId } })

  const healthStatus = computeOrderHealth({
    status: order.status,
    requiredCompletionDate: order.requiredCompletionDate,
    plannedStartDate: order.plannedStartDate,
    completionPercent: order.completionPercent,
    stageStatuses: stages.map((s) => s.status),
  })

  if (healthStatus !== order.healthStatus) {
    await tx.productionOrder.update({ where: { id: productionOrderId }, data: { healthStatus } })
  }

  return healthStatus
}
