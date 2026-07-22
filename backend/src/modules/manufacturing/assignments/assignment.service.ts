import type { Request } from 'express'
import { prisma } from '../../../config/database.js'
import { AuthorizationError, InvalidStateError, NotFoundError } from '../../../utils/errors.js'
import { logProductionActivity } from '../shared/activity.service.js'
import { toDecimal } from '../shared/quantity.service.js'
import { recordProgress } from '../work-orders/work-order-progress.service.js'
import { endOpenAssignmentDowntime, startDowntime } from '../downtime/downtime.service.js'
import { resolveAssignmentAllowedActions } from './assignment-allowed-actions.js'
import {
  assertNoDuplicateActiveAssignment,
  parseAssignmentDate,
  releaseMachineIfIdle,
  setMachineInUse,
  syncStageAssignmentIndicators,
  validateAssignmentQuantity,
  validateMachineForAssignment,
} from './assignment.helpers.js'
import * as repo from './assignment.repository.js'
import type {
  CancelAssignmentInput,
  CompleteAssignmentInput,
  CreateAssignmentInput,
  ListAssignmentsQuery,
  PauseAssignmentInput,
  ReassignAssignmentInput,
} from './assignment.schemas.js'

function assertAllowed(req: Request, assignment: { status: string; userId: string | null }, action: keyof ReturnType<typeof resolveAssignmentAllowedActions>) {
  const allowed = resolveAssignmentAllowedActions(req, assignment as never)
  if (!allowed[action]) throw new AuthorizationError(`Action "${action}" is not allowed for this assignment`)
}

export async function createAssignment(req: Request, tenantId: string, input: CreateAssignmentInput) {
  const userId = req.context?.userId ?? ''
  const allowInUse = (req.context?.permissions ?? []).includes('manufacturing.assignment.manage')

  const order = await prisma.productionOrder.findFirst({ where: { id: input.productionOrderId, tenantId, deletedAt: null } })
  if (!order) throw new NotFoundError('Work order not found')
  if (!['READY', 'IN_PROGRESS'].includes(order.status)) {
    throw new InvalidStateError(`Assignments can only be created for READY or IN_PROGRESS work orders (current: ${order.status})`)
  }

  const stage = await prisma.productionOrderStage.findFirst({
    where: { id: input.stageId, productionOrderId: input.productionOrderId, tenantId },
  })
  if (!stage) throw new NotFoundError('Stage not found on this work order')

  if (input.operationId) {
    const op = await prisma.productionOrderOperation.findFirst({
      where: { id: input.operationId, stageId: stage.id, tenantId },
    })
    if (!op) throw new NotFoundError('Operation not found on this stage')
  }

  const warnings = await prisma.$transaction(async (tx) => {
    await assertNoDuplicateActiveAssignment(tx, tenantId, {
      userId: input.userId,
      stageId: input.stageId,
      operationId: input.operationId,
      shiftCode: input.shiftCode,
    })
    await validateAssignmentQuantity(tx, tenantId, stage, order.manufacturingProfileId, input.assignedQuantity)
    const machineWarnings = await validateMachineForAssignment(tx, tenantId, input.machineId, allowInUse)
    return machineWarnings
  })

  const assignment = await prisma.$transaction(async (tx) => {
    const row = await tx.productionAssignment.create({
      data: {
        tenantId,
        productionOrderId: input.productionOrderId,
        stageId: input.stageId,
        operationId: input.operationId ?? null,
        userId: input.userId,
        employeeId: input.employeeId ?? null,
        machineId: input.machineId ?? null,
        workCentreId: input.workCentreId ?? stage.workCentreId ?? null,
        assignmentDate: parseAssignmentDate(input.assignmentDate),
        plannedStartAt: input.plannedStartAt ? new Date(input.plannedStartAt) : null,
        plannedEndAt: input.plannedEndAt ? new Date(input.plannedEndAt) : null,
        shiftCode: input.shiftCode ?? null,
        shiftLabel: input.shiftLabel ?? null,
        assignedQuantity: input.assignedQuantity,
        notes: input.notes ?? null,
        workInstruction: input.workInstruction ?? null,
        assignedBy: userId,
        createdBy: userId,
        updatedBy: userId,
      },
    })

    await logProductionActivity(
      {
        tenantId,
        productionOrderId: input.productionOrderId,
        activityType: 'OPERATOR_ASSIGNED',
        userId,
        message: `Operator assigned to stage "${stage.name}"`,
        newValue: { assignmentId: row.id, userId: input.userId },
      },
      tx,
    )
    if (input.machineId) {
      await logProductionActivity(
        {
          tenantId,
          productionOrderId: input.productionOrderId,
          activityType: 'MACHINE_ASSIGNED',
          userId,
          message: `Machine assigned to stage "${stage.name}"`,
          newValue: { assignmentId: row.id, machineId: input.machineId },
        },
        tx,
      )
    }

    await syncStageAssignmentIndicators(tx, tenantId, stage.id)
    return row
  })

  const full = await repo.getAssignment(tenantId, assignment.id)
  return { assignment: full, warnings }
}

export async function reassignAssignment(req: Request, tenantId: string, id: string, input: ReassignAssignmentInput) {
  const userId = req.context?.userId ?? ''
  const existing = await repo.getAssignment(tenantId, id)
  assertAllowed(req, existing, 'reassign')

  await cancelAssignment(req, tenantId, id, { reason: input.reason ?? 'Reassigned' }, true)

  const createInput: CreateAssignmentInput = {
    productionOrderId: existing.productionOrderId,
    stageId: existing.stageId,
    operationId: input.operationId ?? existing.operationId ?? undefined,
    userId: input.userId ?? existing.userId!,
    employeeId: input.employeeId ?? existing.employeeId ?? undefined,
    machineId: input.machineId ?? existing.machineId ?? undefined,
    workCentreId: input.workCentreId ?? existing.workCentreId ?? undefined,
    assignmentDate: input.assignmentDate ?? existing.assignmentDate.toISOString().slice(0, 10),
    plannedStartAt: input.plannedStartAt,
    plannedEndAt: input.plannedEndAt,
    shiftCode: input.shiftCode ?? existing.shiftCode ?? undefined,
    shiftLabel: input.shiftLabel ?? existing.shiftLabel ?? undefined,
    assignedQuantity: input.assignedQuantity ?? Number(existing.assignedQuantity),
    notes: input.notes ?? existing.notes ?? undefined,
    workInstruction: input.workInstruction ?? existing.workInstruction ?? undefined,
  }

  const { assignment, warnings } = await createAssignment(req, tenantId, createInput)
  await prisma.productionAssignment.update({
    where: { id: assignment.id },
    data: { reassignedFromId: id, updatedBy: userId },
  })

  await prisma.$transaction(async (tx) => {
    await logProductionActivity(
      {
        tenantId,
        productionOrderId: existing.productionOrderId,
        activityType: 'WORK_REASSIGNED',
        userId,
        message: `Work reassigned from assignment ${id}`,
        oldValue: { assignmentId: id },
        newValue: { assignmentId: assignment.id },
        reason: input.reason ?? null,
      },
      tx,
    )
  })

  return { assignment: await repo.getAssignment(tenantId, assignment.id), warnings }
}

export async function cancelAssignment(
  req: Request,
  tenantId: string,
  id: string,
  input: CancelAssignmentInput,
  internal = false,
) {
  const userId = req.context?.userId ?? ''
  const assignment = await repo.getAssignment(tenantId, id)
  if (!internal) assertAllowed(req, assignment, 'cancel')
  if (['COMPLETED', 'CANCELLED'].includes(assignment.status)) {
    throw new InvalidStateError(`Cannot cancel assignment in ${assignment.status} status`)
  }

  const updated = await prisma.$transaction(async (tx) => {
    await endOpenAssignmentDowntime(tx, tenantId, id, userId)
    const row = await tx.productionAssignment.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledBy: userId,
        cancellationReason: input.reason ?? null,
        updatedBy: userId,
      },
    })
    if (assignment.machineId) await releaseMachineIfIdle(tx, tenantId, assignment.machineId, userId)
    await syncStageAssignmentIndicators(tx, tenantId, assignment.stageId)
    await logProductionActivity(
      {
        tenantId,
        productionOrderId: assignment.productionOrderId,
        activityType: 'ASSIGNMENT_CANCELLED',
        userId,
        message: 'Production assignment cancelled',
        reason: input.reason ?? null,
      },
      tx,
    )
    return row
  })

  return repo.getAssignment(tenantId, updated.id)
}

export async function acceptAssignment(req: Request, tenantId: string, id: string) {
  const userId = req.context?.userId ?? ''
  const assignment = await repo.getAssignment(tenantId, id)
  assertAllowed(req, assignment, 'accept')
  if (assignment.status !== 'ASSIGNED') throw new InvalidStateError('Only ASSIGNED assignments can be accepted')

  await prisma.$transaction(async (tx) => {
    await tx.productionAssignment.update({
      where: { id },
      data: { status: 'ACCEPTED', acceptedAt: new Date(), updatedBy: userId },
    })
    await logProductionActivity(
      {
        tenantId,
        productionOrderId: assignment.productionOrderId,
        activityType: 'ASSIGNMENT_ACCEPTED',
        userId,
        message: 'Assignment accepted by operator',
      },
      tx,
    )
  })

  return repo.getAssignment(tenantId, id)
}

export async function startAssignment(req: Request, tenantId: string, id: string) {
  const userId = req.context?.userId ?? ''
  const allowInUse = (req.context?.permissions ?? []).includes('manufacturing.assignment.manage')
  const assignment = await repo.getAssignment(tenantId, id)
  assertAllowed(req, assignment, 'start')
  if (assignment.status !== 'ACCEPTED') throw new InvalidStateError('Only ACCEPTED assignments can be started')

  const warnings = await prisma.$transaction(async (tx) => {
    const machineWarnings = await validateMachineForAssignment(tx, tenantId, assignment.machineId, allowInUse)
    if (assignment.machineId) await setMachineInUse(tx, tenantId, assignment.machineId, userId)
    await tx.productionAssignment.update({
      where: { id },
      data: { status: 'IN_PROGRESS', startedAt: new Date(), updatedBy: userId },
    })
    await syncStageAssignmentIndicators(tx, tenantId, assignment.stageId)
    await logProductionActivity(
      {
        tenantId,
        productionOrderId: assignment.productionOrderId,
        activityType: 'TASK_STARTED',
        userId,
        message: 'Production task started',
      },
      tx,
    )
    return machineWarnings
  })

  return { assignment: await repo.getAssignment(tenantId, id), warnings }
}

export async function pauseAssignment(req: Request, tenantId: string, id: string, input: PauseAssignmentInput) {
  const userId = req.context?.userId ?? ''
  const assignment = await repo.getAssignment(tenantId, id)
  assertAllowed(req, assignment, 'pause')
  if (assignment.status !== 'IN_PROGRESS') throw new InvalidStateError('Only IN_PROGRESS assignments can be paused')

  await prisma.$transaction(async (tx) => {
    await tx.productionAssignment.update({
      where: { id },
      data: { status: 'PAUSED', pausedAt: new Date(), updatedBy: userId },
    })
    if (input.startDowntime) {
      await startDowntime(tx, {
        tenantId,
        productionOrderId: assignment.productionOrderId,
        stageId: assignment.stageId,
        operationId: assignment.operationId,
        assignmentId: assignment.id,
        workCentreId: assignment.workCentreId,
        machineId: assignment.machineId,
        scope: 'TASK',
        reasonType: input.reasonType ?? null,
        reasonLabel: input.reasonLabel ?? input.remarks ?? null,
        startedBy: userId,
        notes: input.remarks ?? null,
      })
    }
    await syncStageAssignmentIndicators(tx, tenantId, assignment.stageId)
    await logProductionActivity(
      {
        tenantId,
        productionOrderId: assignment.productionOrderId,
        activityType: 'TASK_PAUSED',
        userId,
        message: 'Production task paused',
        reason: input.remarks ?? null,
      },
      tx,
    )
  })

  return repo.getAssignment(tenantId, id)
}

export async function resumeAssignment(req: Request, tenantId: string, id: string) {
  const userId = req.context?.userId ?? ''
  const assignment = await repo.getAssignment(tenantId, id)
  assertAllowed(req, assignment, 'resume')
  if (assignment.status !== 'PAUSED') throw new InvalidStateError('Only PAUSED assignments can be resumed')

  await prisma.$transaction(async (tx) => {
    await endOpenAssignmentDowntime(tx, tenantId, id, userId)
    await tx.productionAssignment.update({
      where: { id },
      data: { status: 'IN_PROGRESS', pausedAt: null, updatedBy: userId },
    })
    await syncStageAssignmentIndicators(tx, tenantId, assignment.stageId)
    await logProductionActivity(
      {
        tenantId,
        productionOrderId: assignment.productionOrderId,
        activityType: 'TASK_RESUMED',
        userId,
        message: 'Production task resumed',
      },
      tx,
    )
  })

  return repo.getAssignment(tenantId, id)
}

export async function completeAssignment(req: Request, tenantId: string, id: string, input: CompleteAssignmentInput) {
  const userId = req.context?.userId ?? ''
  const assignment = await repo.getAssignment(tenantId, id)

  if (input.idempotencyKey) {
    const existingLedger = await prisma.productionStageLedger.findFirst({
      where: { tenantId, idempotencyKey: input.idempotencyKey },
    })
    if (existingLedger && assignment.status === 'COMPLETED') {
      return { assignment, progress: { ledgerEntry: existingLedger } }
    }
  }

  assertAllowed(req, assignment, 'complete')
  if (!['IN_PROGRESS', 'PAUSED'].includes(assignment.status)) {
    throw new InvalidStateError('Only IN_PROGRESS or PAUSED assignments can be completed')
  }

  const progress = await recordProgress(req, tenantId, assignment.productionOrderId, {
    stageId: assignment.stageId,
    operationId: assignment.operationId ?? undefined,
    goodQuantity: input.goodQuantity,
    reworkQuantity: input.reworkQuantity,
    rejectedQuantity: input.rejectedQuantity,
    scrapQuantity: input.scrapQuantity,
    remarks: input.remarks,
    idempotencyKey: input.idempotencyKey,
  })

  const totalPosted = toDecimal(input.goodQuantity)
    .plus(toDecimal(input.reworkQuantity))
    .plus(toDecimal(input.rejectedQuantity))
    .plus(toDecimal(input.scrapQuantity))

  await prisma.$transaction(async (tx) => {
    await endOpenAssignmentDowntime(tx, tenantId, id, userId)
    await tx.productionAssignment.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        completedQuantity: totalPosted,
        updatedBy: userId,
      },
    })
    if (assignment.machineId) await releaseMachineIfIdle(tx, tenantId, assignment.machineId, userId)
    await syncStageAssignmentIndicators(tx, tenantId, assignment.stageId)
    await logProductionActivity(
      {
        tenantId,
        productionOrderId: assignment.productionOrderId,
        activityType: 'TASK_COMPLETED',
        userId,
        message: `Production task completed: good ${input.goodQuantity}`,
        sourceTransactionId: progress.ledgerEntry.id,
      },
      tx,
    )
  })

  return { assignment: await repo.getAssignment(tenantId, id), progress }
}

export async function listByWorkOrder(tenantId: string, workOrderId: string, query: ListAssignmentsQuery) {
  return repo.listAssignments(tenantId, { ...query, workOrderId })
}

export async function listByWorkCentre(tenantId: string, workCentreId: string, query: ListAssignmentsQuery) {
  return repo.listAssignments(tenantId, { ...query, workCentreId })
}

export async function listAssignments(tenantId: string, query: ListAssignmentsQuery) {
  return repo.listAssignments(tenantId, query)
}

export async function listHistory(tenantId: string, assignmentId: string) {
  return repo.listAssignmentHistory(tenantId, assignmentId)
}

export async function getAssignment(tenantId: string, id: string) {
  return repo.getAssignment(tenantId, id)
}
