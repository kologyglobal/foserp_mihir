import type { Request } from 'express'
import type { Prisma, ProductionRuntimeChangeType } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { AuthorizationError } from '../../../utils/errors.js'
import { logProductionActivity } from '../shared/activity.service.js'
import * as repo from './runtime-change.repository.js'
import { runtimeChangeInclude, type RuntimeChangeRow } from './runtime-change.repository.js'
import { buildRuntimeChangeContext } from './runtime-change-impact.service.js'
import { determineRuntimeChangeRisk } from './runtime-change-risk.service.js'
import { applyRuntimeChange } from './runtime-change-apply.service.js'
import { APPLIABLE_STATUSES, EDITABLE_STATUSES, RUNTIME_CHANGE_TYPE_PERMISSION } from './runtime-change.enums.js'
import {
  RuntimeChangeAlreadyAppliedError,
  RuntimeChangeInvalidStateError,
  RuntimeChangeStaleOrderError,
} from './runtime-change.errors.js'
import type {
  ApplyRuntimeChangeInput,
  ApproveRuntimeChangeInput,
  CancelRuntimeChangeInput,
  CreateRuntimeChangeInput,
  ListRuntimeChangesQuery,
  PreviewRuntimeChangeInput,
  RejectRuntimeChangeInput,
  UpdateRuntimeChangeInput,
} from './runtime-change.schemas.js'

function userOf(req: Request): string {
  return req.context?.userId ?? ''
}

/** Requesting/applying a specific change type additionally requires its dedicated fine-grained permission. */
function assertTypePermission(req: Request, changeType: ProductionRuntimeChangeType): void {
  const required = RUNTIME_CHANGE_TYPE_PERMISSION[changeType]
  const permissions = req.context?.permissions ?? []
  if (!permissions.includes(required) && !permissions.includes('tenant.manage')) {
    throw new AuthorizationError(`Missing permission: ${required}`)
  }
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return (value ?? {}) as Prisma.InputJsonValue
}

export async function list(tenantId: string, workOrderId: string, query: ListRuntimeChangesQuery) {
  await repo.getWorkOrderOrThrow(tenantId, workOrderId)
  return repo.listChanges(tenantId, workOrderId, query)
}

export async function getById(tenantId: string, workOrderId: string, changeId: string): Promise<RuntimeChangeRow> {
  await repo.getWorkOrderOrThrow(tenantId, workOrderId)
  return repo.findChange(tenantId, workOrderId, changeId)
}

export async function preview(req: Request, tenantId: string, workOrderId: string, input: PreviewRuntimeChangeInput) {
  assertTypePermission(req, input.changeType)
  const context = await buildRuntimeChangeContext(tenantId, workOrderId, {
    changeType: input.changeType,
    stageId: input.stageId,
    operationId: input.operationId,
    assignmentId: input.assignmentId,
    proposedValue: input.proposedValue,
  })
  const risk = await determineRuntimeChangeRisk(tenantId, context)
  return {
    changeType: context.changeType,
    impact: context.impact,
    risk,
    original: context.original,
    proposed: context.proposed,
  }
}

export async function createDraft(req: Request, tenantId: string, workOrderId: string, input: CreateRuntimeChangeInput) {
  const userId = userOf(req)
  assertTypePermission(req, input.changeType)

  if (input.idempotencyKey) {
    const existing = await repo.findChangeByIdempotencyKey(tenantId, input.idempotencyKey)
    if (existing && existing.productionOrderId === workOrderId) return existing
  }

  const context = await buildRuntimeChangeContext(tenantId, workOrderId, {
    changeType: input.changeType,
    stageId: input.stageId,
    operationId: input.operationId,
    assignmentId: input.assignmentId,
    proposedValue: input.proposedValue,
  })
  const risk = await determineRuntimeChangeRisk(tenantId, context)

  const created = await prisma.$transaction(async (tx) => {
    const changeNumber = await nextCode(tenantId, 'PRODUCTION_RUNTIME_CHANGE', tx)
    return tx.productionRuntimeChange.create({
      data: {
        tenantId,
        changeNumber,
        productionOrderId: workOrderId,
        stageId: context.stage?.id ?? null,
        operationId: context.operation?.id ?? null,
        assignmentId: context.assignment?.id ?? null,
        changeType: input.changeType,
        status: 'DRAFT',
        riskLevel: risk.riskLevel,
        approvalRequired: risk.approvalRequired,
        approvalRuleId: risk.approvalRuleId,
        requestedBy: userId,
        requestedAt: new Date(),
        reason: input.reason,
        businessJustification: input.businessJustification ?? null,
        effectiveDate: input.effectiveDate ? new Date(input.effectiveDate) : null,
        originalValueJson: toJson(context.original),
        proposedValueJson: toJson(context.proposedValue),
        impactSummaryJson: toJson(context.impact),
        orderUpdatedAtAtRequest: context.order.updatedAt,
        idempotencyKey: input.idempotencyKey ?? null,
        createdBy: userId,
        updatedBy: userId,
      },
      include: runtimeChangeInclude,
    })
  })

  await logProductionActivity({
    tenantId,
    productionOrderId: workOrderId,
    activityType: 'RUNTIME_CHANGE_REQUESTED',
    userId,
    message: `Runtime change ${created.changeNumber} (${created.changeType}) drafted`,
    reason: input.reason,
    sourceTransactionId: created.id,
  })

  return created
}

function assertStatus(change: RuntimeChangeRow, allowed: string[], action: string) {
  if (!allowed.includes(change.status)) {
    if (change.status === 'APPLIED') throw new RuntimeChangeAlreadyAppliedError()
    throw new RuntimeChangeInvalidStateError(
      `Cannot ${action} a runtime change in ${change.status} status (expected one of: ${allowed.join(', ')})`,
    )
  }
}

async function rebuildContext(tenantId: string, workOrderId: string, change: RuntimeChangeRow) {
  return buildRuntimeChangeContext(tenantId, workOrderId, {
    changeType: change.changeType,
    stageId: change.stageId ?? undefined,
    operationId: change.operationId ?? undefined,
    assignmentId: change.assignmentId ?? undefined,
    proposedValue: change.proposedValueJson,
  })
}

export async function updateDraft(
  req: Request,
  tenantId: string,
  workOrderId: string,
  changeId: string,
  input: UpdateRuntimeChangeInput,
) {
  const userId = userOf(req)
  const existing = await repo.findChange(tenantId, workOrderId, changeId)
  assertStatus(existing, EDITABLE_STATUSES, 'update')

  const context = await buildRuntimeChangeContext(tenantId, workOrderId, {
    changeType: existing.changeType,
    stageId: input.stageId ?? existing.stageId ?? undefined,
    operationId: input.operationId ?? existing.operationId ?? undefined,
    assignmentId: input.assignmentId ?? existing.assignmentId ?? undefined,
    proposedValue: input.proposedValue ?? existing.proposedValueJson,
  })
  const risk = await determineRuntimeChangeRisk(tenantId, context)

  return prisma.productionRuntimeChange.update({
    where: { id: changeId },
    data: {
      stageId: context.stage?.id ?? null,
      operationId: context.operation?.id ?? null,
      assignmentId: context.assignment?.id ?? null,
      riskLevel: risk.riskLevel,
      approvalRequired: risk.approvalRequired,
      approvalRuleId: risk.approvalRuleId,
      reason: input.reason ?? existing.reason,
      businessJustification: input.businessJustification ?? existing.businessJustification,
      effectiveDate: input.effectiveDate ? new Date(input.effectiveDate) : existing.effectiveDate,
      originalValueJson: toJson(context.original),
      proposedValueJson: toJson(context.proposedValue),
      impactSummaryJson: toJson(context.impact),
      orderUpdatedAtAtRequest: context.order.updatedAt,
      updatedBy: userId,
    },
    include: runtimeChangeInclude,
  })
}

export async function validateChange(tenantId: string, workOrderId: string, changeId: string) {
  const existing = await repo.findChange(tenantId, workOrderId, changeId)
  assertStatus(existing, ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'], 'validate')

  const context = await rebuildContext(tenantId, workOrderId, existing)
  const risk = await determineRuntimeChangeRisk(tenantId, context)

  await prisma.productionRuntimeChange.update({
    where: { id: changeId },
    data: {
      riskLevel: risk.riskLevel,
      approvalRequired: risk.approvalRequired,
      approvalRuleId: risk.approvalRuleId,
      impactSummaryJson: toJson(context.impact),
      validationSummaryJson: toJson({ validatedAt: new Date().toISOString(), warnings: context.impact.warnings }),
    },
  })

  return { valid: true, impact: context.impact, risk }
}

export async function submit(req: Request, tenantId: string, workOrderId: string, changeId: string) {
  const userId = userOf(req)
  const existing = await repo.findChange(tenantId, workOrderId, changeId)
  assertStatus(existing, EDITABLE_STATUSES, 'submit')

  const context = await rebuildContext(tenantId, workOrderId, existing)
  const risk = await determineRuntimeChangeRisk(tenantId, context)

  const now = new Date()
  const updated = await prisma.productionRuntimeChange.update({
    where: { id: changeId },
    data: risk.approvalRequired
      ? {
          status: 'PENDING_APPROVAL',
          riskLevel: risk.riskLevel,
          approvalRequired: risk.approvalRequired,
          approvalRuleId: risk.approvalRuleId,
          impactSummaryJson: toJson(context.impact),
          orderUpdatedAtAtRequest: context.order.updatedAt,
          updatedBy: userId,
        }
      : {
          status: 'APPROVED',
          riskLevel: risk.riskLevel,
          approvalRequired: risk.approvalRequired,
          approvalRuleId: risk.approvalRuleId,
          impactSummaryJson: toJson(context.impact),
          approvedBy: userId,
          approvedAt: now,
          approvedValueJson: toJson(context.proposedValue),
          orderUpdatedAtAtRequest: context.order.updatedAt,
          updatedBy: userId,
        },
    include: runtimeChangeInclude,
  })

  await logProductionActivity({
    tenantId,
    productionOrderId: workOrderId,
    activityType: 'RUNTIME_CHANGE_REQUESTED',
    userId,
    message: `Runtime change ${existing.changeNumber} submitted (${updated.status})`,
    sourceTransactionId: changeId,
  })

  return updated
}

export async function approve(
  req: Request,
  tenantId: string,
  workOrderId: string,
  changeId: string,
  _input: ApproveRuntimeChangeInput,
) {
  const userId = userOf(req)
  const existing = await repo.findChange(tenantId, workOrderId, changeId)
  assertStatus(existing, ['PENDING_APPROVAL'], 'approve')

  const context = await rebuildContext(tenantId, workOrderId, existing)

  const updated = await prisma.productionRuntimeChange.update({
    where: { id: changeId },
    data: {
      status: 'APPROVED',
      approvedBy: userId,
      approvedAt: new Date(),
      approvedValueJson: toJson(context.proposedValue),
      orderUpdatedAtAtRequest: context.order.updatedAt,
      updatedBy: userId,
    },
    include: runtimeChangeInclude,
  })

  await logProductionActivity({
    tenantId,
    productionOrderId: workOrderId,
    activityType: 'RUNTIME_CHANGE_APPROVED',
    userId,
    message: `Runtime change ${existing.changeNumber} approved`,
    sourceTransactionId: changeId,
  })

  return updated
}

export async function reject(
  req: Request,
  tenantId: string,
  workOrderId: string,
  changeId: string,
  input: RejectRuntimeChangeInput,
) {
  const userId = userOf(req)
  const existing = await repo.findChange(tenantId, workOrderId, changeId)
  assertStatus(existing, ['PENDING_APPROVAL'], 'reject')

  const updated = await prisma.productionRuntimeChange.update({
    where: { id: changeId },
    data: {
      status: 'REJECTED',
      rejectedBy: userId,
      rejectedAt: new Date(),
      rejectionReason: input.reason,
      updatedBy: userId,
    },
    include: runtimeChangeInclude,
  })

  await logProductionActivity({
    tenantId,
    productionOrderId: workOrderId,
    activityType: 'RUNTIME_CHANGE_REJECTED',
    userId,
    message: `Runtime change ${existing.changeNumber} rejected`,
    reason: input.reason,
    sourceTransactionId: changeId,
  })

  return updated
}

export async function apply(
  req: Request,
  tenantId: string,
  workOrderId: string,
  changeId: string,
  _input: ApplyRuntimeChangeInput,
) {
  const userId = userOf(req)
  const existing = await repo.findChange(tenantId, workOrderId, changeId)
  assertTypePermission(req, existing.changeType)
  assertStatus(existing, APPLIABLE_STATUSES, 'apply')

  const context = await rebuildContext(tenantId, workOrderId, existing)
  const risk = await determineRuntimeChangeRisk(tenantId, context)

  if (existing.status === 'DRAFT' && risk.approvalRequired) {
    throw new RuntimeChangeInvalidStateError(
      'This change now requires approval before it can be applied — submit it for approval first',
    )
  }

  if (
    existing.orderUpdatedAtAtRequest &&
    context.order.updatedAt.getTime() !== existing.orderUpdatedAtAtRequest.getTime()
  ) {
    throw new RuntimeChangeStaleOrderError()
  }

  try {
    const result = await applyRuntimeChange(req, tenantId, existing, context)

    const updated = await prisma.productionRuntimeChange.update({
      where: { id: changeId },
      data: {
        status: 'APPLIED',
        appliedBy: userId,
        appliedAt: new Date(),
        ...(result.applicationReference ? { applicationReference: result.applicationReference } : {}),
        ...(result.jobWorkOrderId ? { jobWorkOrderId: result.jobWorkOrderId } : {}),
        updatedBy: userId,
      },
      include: runtimeChangeInclude,
    })

    await logProductionActivity({
      tenantId,
      productionOrderId: workOrderId,
      activityType: 'RUNTIME_CHANGE_APPLIED',
      userId,
      message: `Runtime change ${existing.changeNumber} (${existing.changeType}) applied`,
      sourceTransactionId: changeId,
    })

    return updated
  } catch (error) {
    const failureReason = error instanceof Error ? error.message : 'Unknown error while applying runtime change'
    await prisma.productionRuntimeChange.update({
      where: { id: changeId },
      data: { status: 'FAILED', failureReason, updatedBy: userId },
    })
    await logProductionActivity({
      tenantId,
      productionOrderId: workOrderId,
      activityType: 'RUNTIME_CHANGE_FAILED',
      userId,
      message: `Runtime change ${existing.changeNumber} failed to apply: ${failureReason}`,
      sourceTransactionId: changeId,
    })
    throw error
  }
}

export async function cancel(
  req: Request,
  tenantId: string,
  workOrderId: string,
  changeId: string,
  input: CancelRuntimeChangeInput,
) {
  const userId = userOf(req)
  const existing = await repo.findChange(tenantId, workOrderId, changeId)
  assertStatus(existing, EDITABLE_STATUSES, 'cancel')

  const updated = await prisma.productionRuntimeChange.update({
    where: { id: changeId },
    data: { status: 'CANCELLED', updatedBy: userId },
    include: runtimeChangeInclude,
  })

  await logProductionActivity({
    tenantId,
    productionOrderId: workOrderId,
    activityType: 'CANCELLED',
    userId,
    message: `Runtime change ${existing.changeNumber} cancelled`,
    reason: input.reason ?? null,
    sourceTransactionId: changeId,
  })

  return updated
}
