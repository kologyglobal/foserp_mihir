import type { Request } from 'express'
import { prisma } from '../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import { InvalidStateError } from '../../../utils/errors.js'
import { createProductionOrderRecord } from '../shared/production-order-factory.service.js'
import { logProductionActivity } from '../shared/activity.service.js'
import { restoreDemandOnWorkOrderCancel } from '../demands/demand-coverage.service.js'
import * as repo from './work-order.repository.js'
import type { CancelWorkOrderInput, CreateManualWorkOrderInput, ListWorkOrdersQuery } from './work-order.schemas.js'

async function audit(req: Request, tenantId: string, entityId: string, action: string, oldValues: unknown, newValues: unknown) {
  const meta = auditFromRequest(req)
  await createAuditLog({
    tenantId,
    userId: meta.userId,
    module: 'manufacturing',
    entity: 'productionOrder',
    entityId,
    action,
    oldValues,
    newValues,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  })
}

export async function listWorkOrders(tenantId: string, query: ListWorkOrdersQuery) {
  return repo.listWorkOrders(tenantId, query)
}

export async function getWorkOrder(tenantId: string, id: string) {
  return repo.getWorkOrder(tenantId, id)
}

export async function getWorkOrderDetail(tenantId: string, id: string) {
  return repo.getWorkOrderDetail(tenantId, id)
}

export async function getWorkOrderActivities(tenantId: string, id: string) {
  await repo.getWorkOrder(tenantId, id)
  return repo.listActivities(tenantId, id)
}

export async function getWorkOrderLedger(tenantId: string, id: string) {
  await repo.getWorkOrder(tenantId, id)
  return repo.listLedgerEntries(tenantId, id)
}

export async function createManualWorkOrder(req: Request, tenantId: string, input: CreateManualWorkOrderInput) {
  const userId = req.context?.userId ?? ''

  if (input.idempotencyKey) {
    const existing = await prisma.productionOrder.findFirst({
      where: { tenantId, idempotencyKey: input.idempotencyKey, deletedAt: null },
    })
    if (existing) return existing
  }

  const order = await prisma.$transaction((tx) =>
    createProductionOrderRecord(tx, {
      tenantId,
      userId,
      sourceType: 'MANUAL',
      productItemId: input.productItemId,
      plannedQuantity: input.plannedQuantity,
      requiredCompletionDate: new Date(input.requiredCompletionDate),
      plannedStartDate: input.plannedStartDate ? new Date(input.plannedStartDate) : null,
      priority: input.priority,
      plantCode: input.plantCode ?? null,
      managerId: input.managerId ?? null,
      supervisorId: input.supervisorId ?? null,
      jobNumber: input.jobNumber ?? null,
      notes: input.notes ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
    }),
  )

  await audit(req, tenantId, order.id, 'CREATE', undefined, order)
  return order
}

export async function cancelWorkOrder(req: Request, tenantId: string, id: string, input: CancelWorkOrderInput) {
  const userId = req.context?.userId ?? ''
  const before = await repo.getWorkOrder(tenantId, id)

  if (before.status === 'COMPLETED' || before.status === 'CLOSED' || before.status === 'CANCELLED') {
    throw new InvalidStateError(`Cannot cancel a work order in ${before.status} status`)
  }

  const order = await prisma.$transaction(async (tx) => {
    const updated = await tx.productionOrder.update({
      where: { id, tenantId },
      data: { status: 'CANCELLED', updatedBy: userId },
    })
    // Phase 6A1 prerequisite: restore ProductionDemand remaining when WO coverage is released.
    await restoreDemandOnWorkOrderCancel(tx, {
      tenantId,
      demandId: before.demandId,
      plannedQuantity: before.plannedQuantity,
      userId,
    })
    await logProductionActivity(
      {
        tenantId,
        productionOrderId: id,
        activityType: 'CANCELLED',
        userId,
        message: `Work order ${before.orderNumber} cancelled`,
        oldValue: { status: before.status },
        newValue: { status: 'CANCELLED' },
        reason: input.reason ?? null,
      },
      tx,
    )
    return updated
  })

  await audit(req, tenantId, id, 'CANCEL', before, order)
  return order
}
