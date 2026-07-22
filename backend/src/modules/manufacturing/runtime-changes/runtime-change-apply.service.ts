import type { Request } from 'express'
import type { Prisma, ProductionStageStatus } from '@prisma/client'
import { Prisma as PrismaRuntime } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { InvalidStateError, ValidationError } from '../../../utils/errors.js'
import { logProductionActivity } from '../shared/activity.service.js'
import { recomputeOrderHealth } from '../work-orders/work-order-health.service.js'
import { holdWorkOrder, resumeWorkOrder } from '../work-orders/work-order-lifecycle.service.js'
import { syncStageAssignmentIndicators } from '../assignments/assignment.helpers.js'
import * as jobWorkService from '../job-work/job-work.service.js'
import { toDecimal } from '../shared/quantity.service.js'
import * as repo from './runtime-change.repository.js'
import type { RuntimeChangeContext } from './runtime-change-impact.service.js'
import type { RuntimeChangeRow } from './runtime-change.repository.js'

export interface ApplyRuntimeChangeResult {
  applicationReference: string | null
  jobWorkOrderId: string | null
}

const TERMINAL_OP_STATUSES = ['COMPLETED', 'CANCELLED', 'SKIPPED']
const TERMINAL_STAGE_STATUSES = ['COMPLETED', 'CANCELLED', 'SKIPPED']

/**
 * Applies a validated + (if required) approved runtime change to the work order.
 * Immutable data (stage ledger, completed quantities, quality records, job work
 * dispatches, inventory) is never rewritten — only remaining targets / header
 * fields / incomplete stages & operations are updated.
 */
export async function applyRuntimeChange(
  req: Request,
  tenantId: string,
  change: RuntimeChangeRow,
  context: RuntimeChangeContext,
): Promise<ApplyRuntimeChangeResult> {
  const userId = req.context?.userId ?? ''

  switch (context.changeType) {
    case 'WORK_ORDER_HOLD': {
      const value = context.proposedValue as { reasonCategory: string; remarks?: string; expectedResumeAt?: string }
      await holdWorkOrder(req, tenantId, context.order.id, value as never)
      return { applicationReference: null, jobWorkOrderId: null }
    }
    case 'WORK_ORDER_RESUME': {
      const value = context.proposedValue as { remarks?: string }
      await resumeWorkOrder(req, tenantId, context.order.id, value)
      return { applicationReference: null, jobWorkOrderId: null }
    }
    case 'CONVERT_TO_JOB_WORK': {
      const value = context.proposedValue as {
        vendorId: string
        processName: string
        itemId: string
        orderedQty: number
        rate: number
        rateBasis: 'PER_PIECE' | 'PER_KG' | 'PER_HOUR' | 'PER_BATCH' | 'FIXED'
        materialWarehouseId: string
        receiptWarehouseId: string
        qualityRequired?: boolean
        materialLines: Array<{ itemId: string; uomId?: string; requiredQty: number }>
      }
      const created = await jobWorkService.create(req, tenantId, {
        vendorId: value.vendorId,
        productionOrderId: context.order.id,
        processName: value.processName,
        itemId: value.itemId,
        orderedQty: value.orderedQty,
        rate: value.rate,
        rateBasis: value.rateBasis,
        materialWarehouseId: value.materialWarehouseId,
        receiptWarehouseId: value.receiptWarehouseId,
        qualityRequired: value.qualityRequired,
        materialLines: value.materialLines,
        idempotencyKey: `rc:${change.id}`,
      } as never)
      await prisma.productionRuntimeChange.update({
        where: { id: change.id },
        data: { jobWorkOrderId: created.id },
      })
      await logProductionActivity({
        tenantId,
        productionOrderId: context.order.id,
        activityType: 'RUNTIME_CHANGE_APPLIED',
        userId,
        message: `Operation outsourced to job work ${created.jwNumber} via runtime change ${change.changeNumber}`,
        sourceTransactionId: change.id,
      })
      return { applicationReference: created.jwNumber, jobWorkOrderId: created.id }
    }
    default:
      return applyInTransaction(req, tenantId, change, context)
  }
}

async function applyInTransaction(
  req: Request,
  tenantId: string,
  change: RuntimeChangeRow,
  context: RuntimeChangeContext,
): Promise<ApplyRuntimeChangeResult> {
  const userId = req.context?.userId ?? ''

  return prisma.$transaction(async (tx) => {
    switch (context.changeType) {
      case 'QUANTITY_CHANGE':
        await applyQuantityChange(tx, tenantId, userId, change, context)
        break
      case 'DUE_DATE_CHANGE':
        await applyDueDateChange(tx, tenantId, userId, change, context)
        break
      case 'PRIORITY_CHANGE':
        await applyPriorityChange(tx, tenantId, userId, change, context)
        break
      case 'SUPERVISOR_CHANGE':
        await applySupervisorChange(tx, tenantId, userId, change, context)
        break
      case 'OPERATOR_CHANGE':
        await applyOperatorChange(tx, tenantId, userId, change, context)
        break
      case 'MACHINE_CHANGE':
        await applyMachineChange(tx, tenantId, userId, change, context)
        break
      case 'WORK_CENTRE_CHANGE':
        await applyWorkCentreChange(tx, tenantId, userId, change, context)
        break
      case 'ADD_OPERATION':
        await applyAddOperation(tx, tenantId, userId, change, context)
        break
      case 'REPEAT_OPERATION':
        await applyRepeatOperation(tx, tenantId, userId, change, context)
        break
      case 'SKIP_OPERATION':
        await applySkipOperation(tx, tenantId, userId, change, context)
        break
      case 'STAGE_HOLD':
        await applyStageHold(tx, tenantId, userId, change, context)
        break
      case 'STAGE_RESUME':
        await applyStageResume(tx, tenantId, userId, change, context)
        break
      default:
        throw new ValidationError(`Runtime change apply not implemented for ${context.changeType}`)
    }
    return { applicationReference: null, jobWorkOrderId: null }
  })
}

async function applyQuantityChange(
  tx: Prisma.TransactionClient,
  tenantId: string,
  userId: string,
  change: RuntimeChangeRow,
  context: RuntimeChangeContext,
) {
  const order = context.order
  const originalQty = toDecimal((context.original as { plannedQuantity: string }).plannedQuantity)
  const proposedQty = toDecimal((context.proposed as { plannedQuantity: string }).plannedQuantity)
  const completed = toDecimal(order.completedGoodQuantity)
  if (proposedQty.lessThan(completed)) {
    throw new InvalidStateError(
      `Proposed quantity (${proposedQty}) cannot be less than completed good quantity (${completed})`,
    )
  }
  const scaleFactor = originalQty.greaterThan(0) ? proposedQty.dividedBy(originalQty) : new PrismaRuntime.Decimal(1)

  await tx.productionOrder.update({
    where: { id: order.id, tenantId },
    data: { plannedQuantity: proposedQty, updatedBy: userId },
  })

  const stages = await tx.productionOrderStage.findMany({ where: { productionOrderId: order.id, tenantId } })
  for (const stage of stages) {
    if (TERMINAL_STAGE_STATUSES.includes(stage.status)) continue
    await tx.productionOrderStage.update({
      where: { id: stage.id },
      data: { plannedQuantity: toDecimal(stage.plannedQuantity).times(scaleFactor) },
    })
  }

  const operations = await tx.productionOrderOperation.findMany({ where: { productionOrderId: order.id, tenantId } })
  for (const operation of operations) {
    if (TERMINAL_OP_STATUSES.includes(operation.status)) continue
    await tx.productionOrderOperation.update({
      where: { id: operation.id },
      data: { plannedQuantity: toDecimal(operation.plannedQuantity).times(scaleFactor) },
    })
  }

  if (context.demand) {
    const delta = proposedQty.minus(originalQty)
    const newConverted = toDecimal(context.demand.convertedQuantity).plus(delta)
    const newRemaining = toDecimal(context.demand.remainingQuantity).minus(delta)
    const clampedRemaining = newRemaining.lessThan(0) ? toDecimal(0) : newRemaining
    await tx.productionDemand.update({
      where: { id: context.demand.id },
      data: {
        convertedQuantity: newConverted,
        remainingQuantity: clampedRemaining,
        status: clampedRemaining.lessThanOrEqualTo(0) ? 'FULLY_CONVERTED' : 'PARTIALLY_CONVERTED',
      },
    })
  }

  await recomputeOrderHealth(tx, tenantId, order.id)
  await logProductionActivity(
    {
      tenantId,
      productionOrderId: order.id,
      activityType: 'RUNTIME_CHANGE_APPLIED',
      userId,
      message: `Planned quantity changed ${originalQty} → ${proposedQty} via runtime change ${change.changeNumber}`,
      oldValue: { plannedQuantity: originalQty.toString() },
      newValue: { plannedQuantity: proposedQty.toString() },
      sourceTransactionId: change.id,
    },
    tx,
  )
}

async function applyDueDateChange(
  tx: Prisma.TransactionClient,
  tenantId: string,
  userId: string,
  change: RuntimeChangeRow,
  context: RuntimeChangeContext,
) {
  const order = context.order
  const proposed = new Date((context.proposed as { requiredCompletionDate: string }).requiredCompletionDate)
  await tx.productionOrder.update({
    where: { id: order.id, tenantId },
    data: { requiredCompletionDate: proposed, updatedBy: userId },
  })
  await recomputeOrderHealth(tx, tenantId, order.id)
  await logProductionActivity(
    {
      tenantId,
      productionOrderId: order.id,
      activityType: 'DUE_DATE_CHANGED',
      userId,
      message: `Required completion date changed via runtime change ${change.changeNumber}`,
      oldValue: { requiredCompletionDate: order.requiredCompletionDate.toISOString() },
      newValue: { requiredCompletionDate: proposed.toISOString() },
      sourceTransactionId: change.id,
    },
    tx,
  )
}

async function applyPriorityChange(
  tx: Prisma.TransactionClient,
  tenantId: string,
  userId: string,
  change: RuntimeChangeRow,
  context: RuntimeChangeContext,
) {
  const order = context.order
  const proposed = (context.proposed as { priority: string }).priority
  await tx.productionOrder.update({
    where: { id: order.id, tenantId },
    data: { priority: proposed, updatedBy: userId },
  })
  await logProductionActivity(
    {
      tenantId,
      productionOrderId: order.id,
      activityType: 'PRIORITY_CHANGED',
      userId,
      message: `Priority changed ${order.priority} → ${proposed} via runtime change ${change.changeNumber}`,
      oldValue: { priority: order.priority },
      newValue: { priority: proposed },
      sourceTransactionId: change.id,
    },
    tx,
  )
}

async function applySupervisorChange(
  tx: Prisma.TransactionClient,
  tenantId: string,
  userId: string,
  change: RuntimeChangeRow,
  context: RuntimeChangeContext,
) {
  const order = context.order
  const proposed = (context.proposed as { supervisorId: string | null }).supervisorId
  await tx.productionOrder.update({
    where: { id: order.id, tenantId },
    data: { supervisorId: proposed, updatedBy: userId },
  })
  await logProductionActivity(
    {
      tenantId,
      productionOrderId: order.id,
      activityType: 'RUNTIME_CHANGE_APPLIED',
      userId,
      message: `Supervisor changed via runtime change ${change.changeNumber}`,
      oldValue: { supervisorId: order.supervisorId },
      newValue: { supervisorId: proposed },
      sourceTransactionId: change.id,
    },
    tx,
  )
}

async function applyOperatorChange(
  tx: Prisma.TransactionClient,
  tenantId: string,
  userId: string,
  change: RuntimeChangeRow,
  context: RuntimeChangeContext,
) {
  const assignment = context.assignment
  if (!assignment) throw new ValidationError('Assignment not found for OPERATOR_CHANGE')
  if (['COMPLETED', 'CANCELLED'].includes(assignment.status)) {
    throw new InvalidStateError(`Cannot reassign an assignment in ${assignment.status} status`)
  }
  const proposed = context.proposed as { userId: string; employeeId?: string | null }

  await tx.productionAssignment.update({
    where: { id: assignment.id },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelledBy: userId,
      cancellationReason: `Reassigned via runtime change ${change.changeNumber}`,
      updatedBy: userId,
    },
  })

  const created = await tx.productionAssignment.create({
    data: {
      tenantId,
      productionOrderId: assignment.productionOrderId,
      stageId: assignment.stageId,
      operationId: assignment.operationId,
      userId: proposed.userId,
      employeeId: proposed.employeeId ?? null,
      machineId: assignment.machineId,
      workCentreId: assignment.workCentreId,
      assignmentDate: assignment.assignmentDate,
      plannedStartAt: assignment.plannedStartAt,
      plannedEndAt: assignment.plannedEndAt,
      shiftCode: assignment.shiftCode,
      shiftLabel: assignment.shiftLabel,
      assignedQuantity: assignment.assignedQuantity,
      notes: assignment.notes,
      workInstruction: assignment.workInstruction,
      reassignedFromId: assignment.id,
      assignedBy: userId,
      createdBy: userId,
      updatedBy: userId,
    },
  })

  await syncStageAssignmentIndicators(tx, tenantId, assignment.stageId)
  await logProductionActivity(
    {
      tenantId,
      productionOrderId: assignment.productionOrderId,
      activityType: 'WORK_REASSIGNED',
      userId,
      message: `Operator reassigned via runtime change ${change.changeNumber}`,
      oldValue: { assignmentId: assignment.id, userId: assignment.userId },
      newValue: { assignmentId: created.id, userId: proposed.userId },
      sourceTransactionId: change.id,
    },
    tx,
  )
}

async function applyMachineChange(
  tx: Prisma.TransactionClient,
  tenantId: string,
  userId: string,
  change: RuntimeChangeRow,
  context: RuntimeChangeContext,
) {
  const operation = context.operation
  if (!operation) throw new ValidationError('Operation not found for MACHINE_CHANGE')
  if (TERMINAL_OP_STATUSES.includes(operation.status)) {
    throw new InvalidStateError(`Cannot change machine on an operation in ${operation.status} status`)
  }
  const proposed = context.proposed as { machineId: string | null }
  if (proposed.machineId) {
    const machine = await tx.manufacturingMachine.findFirst({ where: { id: proposed.machineId, tenantId, deletedAt: null } })
    if (!machine) throw new ValidationError('Machine not found in tenant')
    if (!machine.isActive) throw new ValidationError('Machine is not active')
    if (machine.status === 'OUT_OF_SERVICE' || machine.status === 'UNDER_MAINTENANCE') {
      throw new InvalidStateError(`Machine is ${machine.status} and cannot be assigned`)
    }
  }
  await tx.productionOrderOperation.update({
    where: { id: operation.id },
    data: { machineId: proposed.machineId },
  })
  await logProductionActivity(
    {
      tenantId,
      productionOrderId: operation.productionOrderId,
      activityType: 'MACHINE_ASSIGNED',
      userId,
      message: `Operation "${operation.name}" machine changed via runtime change ${change.changeNumber}`,
      oldValue: { machineId: operation.machineId },
      newValue: { machineId: proposed.machineId },
      sourceTransactionId: change.id,
    },
    tx,
  )
}

async function applyWorkCentreChange(
  tx: Prisma.TransactionClient,
  tenantId: string,
  userId: string,
  change: RuntimeChangeRow,
  context: RuntimeChangeContext,
) {
  const target = context.operation ?? context.stage
  if (!target) throw new ValidationError('stageId or operationId is required for WORK_CENTRE_CHANGE')
  if (TERMINAL_STAGE_STATUSES.includes(target.status)) {
    throw new InvalidStateError(`Cannot change work centre on ${target.status} stage/operation`)
  }
  const proposed = context.proposed as { workCentreId: string | null }
  if (proposed.workCentreId) {
    const workCentre = await tx.manufacturingWorkCentre.findFirst({
      where: { id: proposed.workCentreId, tenantId, deletedAt: null },
    })
    if (!workCentre) throw new ValidationError('Work centre not found in tenant')
    if (!workCentre.isActive) throw new ValidationError('Work centre is not active')
  }

  if (context.operation) {
    await tx.productionOrderOperation.update({ where: { id: context.operation.id }, data: { workCentreId: proposed.workCentreId } })
  } else if (context.stage) {
    await tx.productionOrderStage.update({ where: { id: context.stage.id }, data: { workCentreId: proposed.workCentreId } })
  }

  await logProductionActivity(
    {
      tenantId,
      productionOrderId: context.order.id,
      activityType: 'RUNTIME_CHANGE_APPLIED',
      userId,
      message: `Work centre changed via runtime change ${change.changeNumber}`,
      oldValue: { workCentreId: target.workCentreId },
      newValue: { workCentreId: proposed.workCentreId },
      sourceTransactionId: change.id,
    },
    tx,
  )
}

async function applyAddOperation(
  tx: Prisma.TransactionClient,
  tenantId: string,
  userId: string,
  change: RuntimeChangeRow,
  context: RuntimeChangeContext,
) {
  const stage = context.stage
  if (!stage) throw new ValidationError('stageId is required for ADD_OPERATION')
  if (TERMINAL_STAGE_STATUSES.includes(stage.status)) {
    throw new InvalidStateError(`Cannot add an operation to a ${stage.status} stage`)
  }
  const value = context.proposedValue as {
    name: string
    code?: string
    workCentreId?: string
    machineId?: string
    plannedQuantity?: number
    qualityRequired?: boolean
    isOptional?: boolean
    predecessorOperationIds?: string[]
  }

  const maxSeq = await tx.productionOrderOperation.aggregate({
    where: { productionOrderId: context.order.id, tenantId },
    _max: { sequence: true },
  })
  const sequence = (maxSeq._max.sequence ?? 0) + 10

  const created = await tx.productionOrderOperation.create({
    data: {
      tenantId,
      productionOrderId: context.order.id,
      stageId: stage.id,
      sourceOperationId: '',
      code: value.code ?? `RC-${sequence}`,
      name: value.name,
      sequence,
      workCentreId: value.workCentreId ?? stage.workCentreId ?? null,
      machineId: value.machineId ?? null,
      qualityRequired: value.qualityRequired ?? false,
      isOptional: value.isOptional ?? true,
      status: 'NOT_STARTED',
      plannedQuantity: value.plannedQuantity ?? stage.plannedQuantity,
    },
  })
  await tx.productionOrderOperation.update({ where: { id: created.id }, data: { sourceOperationId: created.id } })

  if (value.predecessorOperationIds?.length) {
    for (const predecessorId of value.predecessorOperationIds) {
      const predecessor = await tx.productionOrderOperation.findFirst({
        where: { id: predecessorId, productionOrderId: context.order.id, tenantId },
      })
      if (!predecessor) continue
      await tx.productionOrderDependency.create({
        data: {
          tenantId,
          productionOrderId: context.order.id,
          predecessorOperationId: predecessor.id,
          successorOperationId: created.id,
        },
      })
    }
  }

  await logProductionActivity(
    {
      tenantId,
      productionOrderId: context.order.id,
      activityType: 'RUNTIME_CHANGE_APPLIED',
      userId,
      message: `Operation "${created.name}" added to stage "${stage.name}" via runtime change ${change.changeNumber}`,
      newValue: { operationId: created.id, name: created.name },
      sourceTransactionId: change.id,
    },
    tx,
  )
}

async function applyRepeatOperation(
  tx: Prisma.TransactionClient,
  tenantId: string,
  userId: string,
  change: RuntimeChangeRow,
  context: RuntimeChangeContext,
) {
  const value = context.proposedValue as { sourceOperationId: string; plannedQuantity?: number }
  const source = await tx.productionOrderOperation.findFirst({
    where: { id: value.sourceOperationId, productionOrderId: context.order.id, tenantId },
  })
  if (!source) throw new ValidationError('Source operation not found on this work order')

  const existingRepeats = await repo.countRepeatsOfOperation(tenantId, context.order.id, source.name)
  const repeatNumber = existingRepeats + 1

  const maxSeq = await tx.productionOrderOperation.aggregate({
    where: { productionOrderId: context.order.id, tenantId },
    _max: { sequence: true },
  })
  const sequence = (maxSeq._max.sequence ?? source.sequence) + 10

  const created = await tx.productionOrderOperation.create({
    data: {
      tenantId,
      productionOrderId: context.order.id,
      stageId: source.stageId,
      sourceOperationId: source.sourceOperationId,
      code: `${source.code}-R${repeatNumber}`,
      name: `${source.name} — Repeat ${repeatNumber}`,
      sequence,
      workCentreId: source.workCentreId,
      machineId: source.machineId,
      setupTimeMinutes: source.setupTimeMinutes,
      runTimeValue: source.runTimeValue,
      runTimeBasis: source.runTimeBasis,
      qualityRequired: source.qualityRequired,
      isOptional: source.isOptional,
      status: 'NOT_STARTED',
      plannedQuantity: value.plannedQuantity ?? source.plannedQuantity,
    },
  })

  await logProductionActivity(
    {
      tenantId,
      productionOrderId: context.order.id,
      activityType: 'RUNTIME_CHANGE_APPLIED',
      userId,
      message: `Operation "${source.name}" repeated (${created.name}) via runtime change ${change.changeNumber}`,
      newValue: { operationId: created.id, sourceOperationId: source.id },
      sourceTransactionId: change.id,
    },
    tx,
  )
}

async function applySkipOperation(
  tx: Prisma.TransactionClient,
  tenantId: string,
  userId: string,
  change: RuntimeChangeRow,
  context: RuntimeChangeContext,
) {
  const operation = context.operation
  if (!operation) throw new ValidationError('Operation not found for SKIP_OPERATION')
  if (operation.status === 'COMPLETED') throw new InvalidStateError('Cannot skip a completed operation')
  if (toDecimal(operation.goodQuantity).greaterThan(0)) {
    throw new InvalidStateError('Cannot skip an operation that already has recorded good quantity')
  }

  await tx.productionOrderOperation.update({ where: { id: operation.id }, data: { status: 'SKIPPED' } })
  await logProductionActivity(
    {
      tenantId,
      productionOrderId: context.order.id,
      activityType: 'RUNTIME_CHANGE_APPLIED',
      userId,
      message: `Operation "${operation.name}" skipped via runtime change ${change.changeNumber}`,
      oldValue: { status: operation.status },
      newValue: { status: 'SKIPPED' },
      sourceTransactionId: change.id,
    },
    tx,
  )
}

async function applyStageHold(
  tx: Prisma.TransactionClient,
  tenantId: string,
  userId: string,
  change: RuntimeChangeRow,
  context: RuntimeChangeContext,
) {
  const stage = context.stage
  if (!stage) throw new ValidationError('stageId is required for STAGE_HOLD')
  if (!['READY', 'IN_PROGRESS'].includes(stage.status)) {
    throw new InvalidStateError(`Stage can only be held from READY or IN_PROGRESS status (current: ${stage.status})`)
  }
  const value = context.proposedValue as { reasonCategory?: string; remarks?: string }

  await tx.productionOrderStage.update({
    where: { id: stage.id },
    data: {
      status: 'ON_HOLD',
      holdReasonCategory: (value.reasonCategory as never) ?? null,
      holdRemarks: value.remarks ?? null,
    },
  })
  await logProductionActivity(
    {
      tenantId,
      productionOrderId: context.order.id,
      activityType: 'STAGE_HELD',
      userId,
      message: `Stage "${stage.name}" held via runtime change ${change.changeNumber}`,
      oldValue: { status: stage.status },
      newValue: { status: 'ON_HOLD' },
      reason: value.remarks ?? null,
      sourceTransactionId: change.id,
    },
    tx,
  )
  await recomputeOrderHealth(tx, tenantId, context.order.id)
}

async function applyStageResume(
  tx: Prisma.TransactionClient,
  tenantId: string,
  userId: string,
  change: RuntimeChangeRow,
  context: RuntimeChangeContext,
) {
  const stage = context.stage
  if (!stage) throw new ValidationError('stageId is required for STAGE_RESUME')
  if (stage.status !== 'ON_HOLD') {
    throw new InvalidStateError(`Stage can only be resumed from ON_HOLD status (current: ${stage.status})`)
  }

  const lastHold = await repo.findLastAppliedChangeForStage(tenantId, stage.id, 'STAGE_HOLD')
  const restoredStatus =
    (lastHold?.originalValueJson as { status?: string } | null)?.status ?? (stage.startedAt ? 'IN_PROGRESS' : 'READY')

  await tx.productionOrderStage.update({
    where: { id: stage.id },
    data: {
      status: restoredStatus as ProductionStageStatus,
      holdReasonCategory: null,
      holdRemarks: null,
    },
  })
  await logProductionActivity(
    {
      tenantId,
      productionOrderId: context.order.id,
      activityType: 'STAGE_RESUMED',
      userId,
      message: `Stage "${stage.name}" resumed via runtime change ${change.changeNumber}`,
      oldValue: { status: stage.status },
      newValue: { status: restoredStatus },
      sourceTransactionId: change.id,
    },
    tx,
  )
  await recomputeOrderHealth(tx, tenantId, context.order.id)
}
