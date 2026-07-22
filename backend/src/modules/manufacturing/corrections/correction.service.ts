import type { Request } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { AuthorizationError } from '../../../utils/errors.js'
import { logProductionActivity } from '../shared/activity.service.js'
import {
  APPLIABLE_CORRECTION_STATUSES,
  CORRECTION_TYPE_PERMISSION,
  EDITABLE_CORRECTION_STATUSES,
  type CorrectionTransactionType,
} from './correction.enums.js'
import {
  CorrectionAlreadyAppliedError,
  CorrectionInvalidStateError,
  CorrectionStalePreviewError,
} from './correction.errors.js'
import { getCorrectionHandler } from './handlers/handler-registry.js'
import * as repo from './correction.repository.js'
import type {
  ApplyCorrectionInput,
  CancelCorrectionInput,
  CreateCorrectionInput,
  ListCorrectionsQuery,
  PreviewCorrectionInput,
  RejectCorrectionInput,
  UpdateCorrectionInput,
} from './correction.schemas.js'

function userOf(req: Request) {
  return req.context?.userId ?? ''
}

function assertTypePermission(req: Request, transactionType: CorrectionTransactionType) {
  const key = CORRECTION_TYPE_PERMISSION[transactionType]
  if (!key) return
  const perms = req.context?.permissions ?? []
  if (!perms.includes(key) && !perms.includes('tenant.manage') && !perms.includes('manufacturing.correction.admin')) {
    // Soft: still allow if user has manufacturing.correction.apply / request
    if (!perms.includes('manufacturing.correction.apply') && !perms.includes('manufacturing.correction.request')) {
      throw new AuthorizationError(`Missing permission ${key}`)
    }
  }
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

function mapCorrection(row: repo.CorrectionRow) {
  return {
    id: row.id,
    correctionNumber: row.correctionNumber,
    transactionType: row.transactionType,
    correctionType: row.correctionType,
    status: row.status,
    riskLevel: row.riskLevel,
    sourceEntityType: row.sourceEntityType,
    sourceEntityId: row.sourceEntityId,
    productionOrderId: row.productionOrderId,
    productionOrderNumber: row.productionOrder?.orderNumber ?? null,
    requestedAction: row.requestedAction,
    reason: row.reason,
    businessJustification: row.businessJustification,
    approvalRequired: row.approvalRequired,
    previewToken: row.previewToken,
    sourceVersion: row.sourceVersion,
    originalValues: row.originalValuesJson,
    requestedValues: row.requestedValuesJson,
    impact: row.impactSummaryJson,
    dependencies: row.dependencySummaryJson,
    validation: row.validationSummaryJson,
    reversalTransactionId: row.reversalTransactionId,
    replacementTransactionId: row.replacementTransactionId,
    failureReason: row.failureReason,
    requestedBy: row.requestedBy,
    requestedAt: row.requestedAt?.toISOString() ?? null,
    approvedBy: row.approvedBy,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    rejectedBy: row.rejectedBy,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    rejectionReason: row.rejectionReason,
    appliedBy: row.appliedBy,
    appliedAt: row.appliedAt?.toISOString() ?? null,
    links: row.links.map((l) => ({
      id: l.id,
      sourceEntityType: l.sourceEntityType,
      sourceEntityId: l.sourceEntityId,
      reversalEntityType: l.reversalEntityType,
      reversalEntityId: l.reversalEntityId,
      replacementEntityType: l.replacementEntityType,
      replacementEntityId: l.replacementEntityId,
      quantityReversed: l.quantityReversed?.toString() ?? null,
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    allowedActions: {
      update: row.status === 'DRAFT',
      submit: row.status === 'DRAFT',
      approve: row.status === 'PENDING_APPROVAL',
      reject: row.status === 'PENDING_APPROVAL',
      apply: row.status === 'DRAFT' || row.status === 'APPROVED',
      cancel: row.status === 'DRAFT',
    },
  }
}

function assertStatus(row: repo.CorrectionRow, allowed: string[], action: string) {
  if (!allowed.includes(row.status)) {
    if (row.status === 'APPLIED') throw new CorrectionAlreadyAppliedError()
    throw new CorrectionInvalidStateError(
      `Cannot ${action} a correction in ${row.status} status (expected ${allowed.join(', ')})`,
    )
  }
}

export async function preview(req: Request, tenantId: string, input: PreviewCorrectionInput) {
  assertTypePermission(req, input.transactionType)
  const handler = getCorrectionHandler(input.transactionType)
  const impact = await handler.preview({
    tenantId,
    userId: userOf(req),
    transactionType: input.transactionType,
    correctionType: input.correctionType,
    sourceEntityType: input.sourceEntityType,
    sourceEntityId: input.sourceEntityId,
    productionOrderId: input.productionOrderId,
    requestedAction: input.requestedAction,
    requestedValues: input.requestedValues as Record<string, unknown> | undefined,
    reason: 'preview',
  })
  return {
    transactionType: input.transactionType,
    correctionType: input.correctionType,
    ...impact,
  }
}

export async function create(req: Request, tenantId: string, input: CreateCorrectionInput) {
  const userId = userOf(req)
  assertTypePermission(req, input.transactionType)

  if (input.idempotencyKey) {
    const existing = await repo.findByIdempotency(tenantId, input.idempotencyKey)
    if (existing) return mapCorrection(existing)
  }

  const handler = getCorrectionHandler(input.transactionType)
  const impact = await handler.preview({
    tenantId,
    userId,
    transactionType: input.transactionType,
    correctionType: input.correctionType,
    sourceEntityType: input.sourceEntityType,
    sourceEntityId: input.sourceEntityId,
    productionOrderId: input.productionOrderId,
    requestedAction: input.requestedAction,
    requestedValues: input.requestedValues as Record<string, unknown> | undefined,
    reason: input.reason,
  })

  if (input.previewToken && input.previewToken !== impact.previewToken) {
    throw new CorrectionStalePreviewError()
  }

  const productionOrderId =
    input.productionOrderId ??
    (typeof impact.original.productionOrderId === 'string' ? impact.original.productionOrderId : null) ??
    (typeof impact.original.workOrderId === 'string' ? impact.original.workOrderId : null)

  const created = await prisma.$transaction(async (tx) => {
    const correctionNumber = await nextCode(tenantId, 'MANUFACTURING_CORRECTION', tx)
    return tx.manufacturingTransactionCorrection.create({
      data: {
        tenantId,
        correctionNumber,
        transactionType: input.transactionType,
        correctionType: input.correctionType,
        status: 'DRAFT',
        riskLevel: impact.riskLevel as never,
        sourceEntityType: input.sourceEntityType,
        sourceEntityId: input.sourceEntityId,
        sourceTransactionId: input.sourceEntityId,
        productionOrderId,
        productionLedgerId:
          input.transactionType === 'PRODUCTION_PROGRESS' ? input.sourceEntityId : null,
        inventoryMovementId: ['MATERIAL_ISSUE', 'MATERIAL_RETURN', 'FG_RECEIPT', 'ADDITIONAL_MATERIAL_ISSUE'].includes(
          input.transactionType,
        )
          ? input.sourceEntityId
          : null,
        wipMovementId:
          input.transactionType === 'WIP_MOVEMENT' || input.transactionType === 'MATERIAL_TRANSFER'
            ? input.sourceEntityId
            : null,
        jobWorkOrderId: null,
        qualityInspectionId: input.transactionType === 'QUALITY_DECISION' ? input.sourceEntityId : null,
        requestedAction: input.requestedAction,
        requestedValuesJson: toJson(input.requestedValues ?? impact.proposed),
        originalValuesJson: toJson(impact.original),
        impactSummaryJson: toJson(impact),
        dependencySummaryJson: toJson(impact.dependencies),
        reason: input.reason,
        businessJustification: input.businessJustification ?? null,
        approvalRequired: impact.approvalRequired,
        previewToken: impact.previewToken,
        sourceVersion: impact.sourceVersion,
        requestedBy: userId,
        requestedAt: new Date(),
        idempotencyKey: input.idempotencyKey ?? null,
        createdBy: userId,
        updatedBy: userId,
      },
      include: repo.correctionInclude,
    })
  })

  if (productionOrderId) {
    await logProductionActivity({
      tenantId,
      productionOrderId,
      activityType: 'CORRECTION_REQUESTED',
      userId,
      message: `Correction ${created.correctionNumber} drafted for ${input.transactionType}`,
      reason: input.reason,
      sourceTransactionId: created.id,
    })
  }

  return mapCorrection(created)
}

export async function list(tenantId: string, query: ListCorrectionsQuery) {
  const result = await repo.listCorrections(tenantId, query)
  return {
    total: result.total,
    page: result.page,
    limit: result.limit,
    items: result.data.map(mapCorrection),
  }
}

export async function get(tenantId: string, correctionId: string) {
  return mapCorrection(await repo.findCorrection(tenantId, correctionId))
}

export async function update(
  req: Request,
  tenantId: string,
  correctionId: string,
  input: UpdateCorrectionInput,
) {
  const existing = await repo.findCorrection(tenantId, correctionId)
  assertStatus(existing, EDITABLE_CORRECTION_STATUSES, 'update')
  const updated = await prisma.manufacturingTransactionCorrection.update({
    where: { id: correctionId },
    data: {
      reason: input.reason ?? existing.reason,
      businessJustification: input.businessJustification ?? existing.businessJustification,
      correctionType: (input.correctionType as never) ?? existing.correctionType,
      requestedAction: input.requestedAction ?? existing.requestedAction,
      requestedValuesJson: input.requestedValues
        ? toJson(input.requestedValues)
        : existing.requestedValuesJson ?? undefined,
      updatedBy: userOf(req),
    },
    include: repo.correctionInclude,
  })
  return mapCorrection(updated)
}

export async function submit(req: Request, tenantId: string, correctionId: string) {
  const existing = await repo.findCorrection(tenantId, correctionId)
  assertStatus(existing, EDITABLE_CORRECTION_STATUSES, 'submit')
  const nextStatus = existing.approvalRequired ? 'PENDING_APPROVAL' : 'APPROVED'
  const updated = await prisma.manufacturingTransactionCorrection.update({
    where: { id: correctionId },
    data: {
      status: nextStatus,
      ...(nextStatus === 'APPROVED'
        ? { approvedBy: userOf(req), approvedAt: new Date() }
        : {}),
      updatedBy: userOf(req),
    },
    include: repo.correctionInclude,
  })
  return mapCorrection(updated)
}

export async function approve(req: Request, tenantId: string, correctionId: string) {
  const existing = await repo.findCorrection(tenantId, correctionId)
  assertStatus(existing, ['PENDING_APPROVAL'], 'approve')
  const updated = await prisma.manufacturingTransactionCorrection.update({
    where: { id: correctionId },
    data: {
      status: 'APPROVED',
      approvedBy: userOf(req),
      approvedAt: new Date(),
      updatedBy: userOf(req),
    },
    include: repo.correctionInclude,
  })
  if (existing.productionOrderId) {
    await logProductionActivity({
      tenantId,
      productionOrderId: existing.productionOrderId,
      activityType: 'CORRECTION_APPROVED',
      userId: userOf(req),
      message: `Correction ${existing.correctionNumber} approved`,
      sourceTransactionId: correctionId,
    })
  }
  return mapCorrection(updated)
}

export async function reject(
  req: Request,
  tenantId: string,
  correctionId: string,
  input: RejectCorrectionInput,
) {
  const existing = await repo.findCorrection(tenantId, correctionId)
  assertStatus(existing, ['PENDING_APPROVAL'], 'reject')
  const updated = await prisma.manufacturingTransactionCorrection.update({
    where: { id: correctionId },
    data: {
      status: 'REJECTED',
      rejectedBy: userOf(req),
      rejectedAt: new Date(),
      rejectionReason: input.reason,
      updatedBy: userOf(req),
    },
    include: repo.correctionInclude,
  })
  if (existing.productionOrderId) {
    await logProductionActivity({
      tenantId,
      productionOrderId: existing.productionOrderId,
      activityType: 'CORRECTION_REJECTED',
      userId: userOf(req),
      message: `Correction ${existing.correctionNumber} rejected`,
      reason: input.reason,
      sourceTransactionId: correctionId,
    })
  }
  return mapCorrection(updated)
}

export async function apply(
  req: Request,
  tenantId: string,
  correctionId: string,
  input: ApplyCorrectionInput,
) {
  const userId = userOf(req)
  const existing = await repo.findCorrection(tenantId, correctionId)
  assertTypePermission(req, existing.transactionType as CorrectionTransactionType)
  assertStatus(existing, APPLIABLE_CORRECTION_STATUSES, 'apply')

  if (existing.status === 'DRAFT' && existing.approvalRequired) {
    throw new CorrectionInvalidStateError('This correction requires approval before apply')
  }

  const handler = getCorrectionHandler(existing.transactionType as CorrectionTransactionType)
  const fresh = await handler.preview({
    tenantId,
    userId,
    transactionType: existing.transactionType,
    correctionType: existing.correctionType,
    sourceEntityType: existing.sourceEntityType,
    sourceEntityId: existing.sourceEntityId,
    productionOrderId: existing.productionOrderId,
    requestedAction: existing.requestedAction,
    requestedValues: (existing.requestedValuesJson as Record<string, unknown>) ?? undefined,
    reason: existing.reason,
  })

  if (existing.sourceVersion && fresh.sourceVersion !== existing.sourceVersion) {
    throw new CorrectionStalePreviewError()
  }
  if (input.previewToken && input.previewToken !== fresh.previewToken) {
    throw new CorrectionStalePreviewError()
  }
  if (fresh.blockers.length) {
    throw new CorrectionInvalidStateError(fresh.blockers[0]!)
  }

  try {
    const applied = await prisma.$transaction(async (tx) => {
      await tx.manufacturingTransactionCorrection.update({
        where: { id: correctionId },
        data: { status: 'APPLYING', updatedBy: userId },
      })

      const result = await handler.apply(
        {
          tenantId,
          userId,
          transactionType: existing.transactionType,
          correctionType: existing.correctionType,
          sourceEntityType: existing.sourceEntityType,
          sourceEntityId: existing.sourceEntityId,
          productionOrderId: existing.productionOrderId,
          requestedAction: existing.requestedAction,
          requestedValues: (existing.requestedValuesJson as Record<string, unknown>) ?? undefined,
          reason: existing.reason,
        },
        tx,
      )

      await tx.manufacturingTransactionReversalLink.create({
        data: {
          tenantId,
          correctionId,
          sourceEntityType: existing.sourceEntityType,
          sourceEntityId: existing.sourceEntityId,
          reversalEntityType: result.reversalEntityType,
          reversalEntityId: result.reversalEntityId,
          replacementEntityType: result.replacementEntityType ?? null,
          replacementEntityId: result.replacementEntityId ?? null,
          quantityReversed: result.quantityReversed ? new Prisma.Decimal(result.quantityReversed) : null,
          createdBy: userId,
        },
      })

      return tx.manufacturingTransactionCorrection.update({
        where: { id: correctionId },
        data: {
          status: 'APPLIED',
          appliedBy: userId,
          appliedAt: new Date(),
          reversalTransactionId: result.reversalEntityId,
          replacementTransactionId: result.replacementEntityId ?? null,
          impactSummaryJson: toJson(fresh),
          updatedBy: userId,
        },
        include: repo.correctionInclude,
      })
    })

    if (existing.productionOrderId) {
      await logProductionActivity({
        tenantId,
        productionOrderId: existing.productionOrderId,
        activityType: 'CORRECTION_APPLIED',
        userId,
        message: `Correction ${existing.correctionNumber} applied`,
        sourceTransactionId: correctionId,
      })
    }

    return mapCorrection(applied)
  } catch (error) {
    const failureReason = error instanceof Error ? error.message : 'Unknown apply failure'
    await prisma.manufacturingTransactionCorrection.update({
      where: { id: correctionId },
      data: { status: 'FAILED', failureReason, updatedBy: userId },
    })
    if (existing.productionOrderId) {
      await logProductionActivity({
        tenantId,
        productionOrderId: existing.productionOrderId,
        activityType: 'CORRECTION_FAILED',
        userId,
        message: `Correction ${existing.correctionNumber} failed: ${failureReason}`,
        sourceTransactionId: correctionId,
      })
    }
    throw error
  }
}

export async function cancel(
  req: Request,
  tenantId: string,
  correctionId: string,
  _input: CancelCorrectionInput,
) {
  const existing = await repo.findCorrection(tenantId, correctionId)
  assertStatus(existing, EDITABLE_CORRECTION_STATUSES, 'cancel')
  const updated = await prisma.manufacturingTransactionCorrection.update({
    where: { id: correctionId },
    data: { status: 'CANCELLED', updatedBy: userOf(req) },
    include: repo.correctionInclude,
  })
  return mapCorrection(updated)
}

export async function dependencies(tenantId: string, correctionId: string) {
  const existing = await repo.findCorrection(tenantId, correctionId)
  return existing.dependencySummaryJson ?? []
}

export async function history(tenantId: string, entityType: string, entityId: string) {
  const rows = await repo.listHistory(tenantId, entityType, entityId)
  return rows.map(mapCorrection)
}
