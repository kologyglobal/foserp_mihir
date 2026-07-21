import type { Request } from 'express'
import { prisma } from '../../../../config/database.js'
import { auditTreasuryAdjustment } from './treasury-adjustment-audit.js'
import { recalculateTreasuryAdjustment } from './treasury-adjustment-draft.service.js'
import * as repo from './treasury-adjustment.repository.js'
import {
  TreasuryAdjustmentApprovalRequiredError,
  TreasuryAdjustmentInvalidStatusError,
  TreasuryAdjustmentNotReadyError,
  TreasuryAdjustmentStaleVersionError,
} from './treasury-adjustment.errors.js'
import type {
  ApproveTreasuryAdjustmentInput,
  CancelTreasuryAdjustmentInput,
  MarkReadyTreasuryAdjustmentInput,
  RejectTreasuryAdjustmentInput,
  ReviseTreasuryAdjustmentInput,
  SubmitTreasuryAdjustmentInput,
} from './treasury-adjustment.schemas.js'
import type { TreasuryAdjustmentRow } from './treasury-adjustment.types.js'
import { serializeTreasuryAdjustment } from './treasury-adjustment-read.service.js'

function assertExpectedUpdatedAt(adjustment: TreasuryAdjustmentRow, expectedUpdatedAt?: string): void {
  if (!expectedUpdatedAt) return
  if (adjustment.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) throw new TreasuryAdjustmentStaleVersionError()
}

async function assertReadyForWorkflow(tenantId: string, adjustment: Awaited<ReturnType<typeof repo.findTreasuryAdjustmentByIdOrThrow>>, userId?: string | null) {
  const result = await recalculateTreasuryAdjustment(tenantId, adjustment)
  if (!result.validation.isValid) {
    throw new TreasuryAdjustmentNotReadyError(
      result.validation.errors[0]?.message ?? 'Treasury adjustment failed validation',
      result.validation.errors.map((e) => ({ field: e.field ?? 'adjustment', message: e.message })),
    )
  }
  await repo.persistCalculatedFields(tenantId, adjustment.id, result, userId)
  return result
}

export async function submitTreasuryAdjustment(req: Request, tenantId: string, id: string, input: SubmitTreasuryAdjustmentInput) {
  const adjustment = await repo.findTreasuryAdjustmentByIdOrThrow(tenantId, id)
  if (adjustment.status !== 'DRAFT' || !adjustment.approvalRequired) {
    throw new TreasuryAdjustmentInvalidStatusError('Only approval-required draft treasury adjustments can be submitted')
  }
  assertExpectedUpdatedAt(adjustment, input.expectedUpdatedAt)
  const userId = req.context?.userId
  const result = await assertReadyForWorkflow(tenantId, adjustment, userId)

  const cycleNumber =
    (await prisma.financeApprovalRequest.count({
      where: { tenantId, legalEntityId: adjustment.legalEntityId, documentType: 'TREASURY_ADJUSTMENT', documentId: id },
    })) + 1

  await prisma.$transaction(async (tx) => {
    const approval = await tx.financeApprovalRequest.create({
      data: {
        tenantId,
        legalEntityId: adjustment.legalEntityId,
        documentType: 'TREASURY_ADJUSTMENT',
        documentId: id,
        documentNumberSnapshot: adjustment.draftReference,
        documentStatusSnapshot: 'PENDING_APPROVAL',
        cycleNumber,
        status: 'PENDING',
        amountBasis: result.bankAmount,
        currencyCode: adjustment.currencyCode,
        currentLevel: 1,
        totalLevels: 1,
        requestedBy: userId,
        workflowSnapshotJson: input.comments ? { comments: input.comments } : undefined,
      },
    })
    await tx.treasuryAdjustment.update({
      where: { id, tenantId },
      data: { status: 'PENDING_APPROVAL', approvalRequestId: approval.id, submittedAt: new Date(), submittedById: userId, updatedById: userId },
    })
  })

  await auditTreasuryAdjustment(req, tenantId, id, 'TREASURY_ADJUSTMENT_SUBMITTED')
  return serializeTreasuryAdjustment(req, await repo.findTreasuryAdjustmentByIdOrThrow(tenantId, id))
}

export async function markTreasuryAdjustmentReady(req: Request, tenantId: string, id: string, input: MarkReadyTreasuryAdjustmentInput) {
  const adjustment = await repo.findTreasuryAdjustmentByIdOrThrow(tenantId, id)
  if (adjustment.status !== 'DRAFT' || adjustment.approvalRequired) {
    throw new TreasuryAdjustmentInvalidStatusError('Only non-approval draft treasury adjustments can be marked ready')
  }
  assertExpectedUpdatedAt(adjustment, input.expectedUpdatedAt)
  const userId = req.context?.userId
  await assertReadyForWorkflow(tenantId, adjustment, userId)

  await prisma.treasuryAdjustment.update({
    where: { id, tenantId },
    data: { status: 'READY_TO_POST', readyAt: new Date(), readyById: userId, updatedById: userId },
  })

  await auditTreasuryAdjustment(req, tenantId, id, 'TREASURY_ADJUSTMENT_READY')
  return serializeTreasuryAdjustment(req, await repo.findTreasuryAdjustmentByIdOrThrow(tenantId, id))
}

export async function reviseTreasuryAdjustment(req: Request, tenantId: string, id: string, input: ReviseTreasuryAdjustmentInput) {
  const adjustment = await repo.findTreasuryAdjustmentByIdOrThrow(tenantId, id)
  if (!['REJECTED', 'READY_TO_POST'].includes(adjustment.status)) {
    throw new TreasuryAdjustmentInvalidStatusError('Only rejected or ready treasury adjustments can be revised')
  }
  assertExpectedUpdatedAt(adjustment, input.expectedUpdatedAt)
  const userId = req.context?.userId

  await prisma.treasuryAdjustment.update({
    where: { id, tenantId },
    data: {
      status: 'DRAFT',
      readyAt: null,
      readyById: null,
      rejectedAt: null,
      rejectedById: null,
      rejectionReason: null,
      approvalRequestId: null,
      updatedById: userId,
    },
  })

  await auditTreasuryAdjustment(req, tenantId, id, 'TREASURY_ADJUSTMENT_REVISED', { reason: input.reason })
  return serializeTreasuryAdjustment(req, await repo.findTreasuryAdjustmentByIdOrThrow(tenantId, id))
}

export async function cancelTreasuryAdjustment(req: Request, tenantId: string, id: string, input: CancelTreasuryAdjustmentInput) {
  const adjustment = await repo.findTreasuryAdjustmentByIdOrThrow(tenantId, id)
  if (!['DRAFT', 'REJECTED', 'READY_TO_POST', 'PENDING_APPROVAL'].includes(adjustment.status)) {
    throw new TreasuryAdjustmentInvalidStatusError('Treasury adjustment cannot be cancelled in its current status')
  }
  assertExpectedUpdatedAt(adjustment, input.expectedUpdatedAt)
  const userId = req.context?.userId

  await prisma.$transaction(async (tx) => {
    if (adjustment.status === 'PENDING_APPROVAL' && adjustment.approvalRequestId) {
      await tx.financeApprovalRequest.updateMany({
        where: { id: adjustment.approvalRequestId, tenantId, status: 'PENDING' },
        data: { status: 'CANCELLED', completedAt: new Date(), completedBy: userId, documentStatusSnapshot: 'CANCELLED' },
      })
    }
    await tx.treasuryAdjustment.update({
      where: { id, tenantId },
      data: {
        status: 'CANCELLED',
        cancellationReason: input.reason,
        cancelledAt: new Date(),
        cancelledById: userId,
        updatedById: userId,
        uniquenessKey: null,
      },
    })
  })

  await auditTreasuryAdjustment(req, tenantId, id, 'TREASURY_ADJUSTMENT_CANCELLED', { reason: input.reason })
  return serializeTreasuryAdjustment(req, await repo.findTreasuryAdjustmentByIdOrThrow(tenantId, id))
}

export async function approveTreasuryAdjustment(req: Request, tenantId: string, id: string, input: ApproveTreasuryAdjustmentInput) {
  const adjustment = await repo.findTreasuryAdjustmentByIdOrThrow(tenantId, id)
  if (adjustment.status !== 'PENDING_APPROVAL' || !adjustment.approvalRequestId) {
    throw new TreasuryAdjustmentInvalidStatusError('Treasury adjustment is not pending approval')
  }
  assertExpectedUpdatedAt(adjustment, input.expectedUpdatedAt)
  const userId = req.context?.userId

  const settings = await prisma.financeSettings.findFirst({ where: { tenantId, legalEntityId: adjustment.legalEntityId } })
  if (settings?.treasuryAdjustmentPreventSelfApprove && adjustment.submittedById && adjustment.submittedById === userId) {
    throw new TreasuryAdjustmentApprovalRequiredError('The submitter cannot approve their own treasury adjustment')
  }

  const result = await recalculateTreasuryAdjustment(tenantId, adjustment)
  await repo.persistCalculatedFields(tenantId, id, result, userId)

  await prisma.$transaction(async (tx) => {
    const approved = await tx.financeApprovalRequest.updateMany({
      where: { id: adjustment.approvalRequestId!, tenantId, documentType: 'TREASURY_ADJUSTMENT', documentId: id, status: 'PENDING' },
      data: {
        status: 'APPROVED',
        completedAt: new Date(),
        completedBy: userId,
        documentStatusSnapshot: 'READY_TO_POST',
        workflowSnapshotJson: input.comments ? { comments: input.comments } : undefined,
      },
    })
    if (approved.count !== 1) throw new TreasuryAdjustmentApprovalRequiredError()
    await tx.treasuryAdjustment.update({
      where: { id, tenantId },
      data: { status: 'READY_TO_POST', approvedAt: new Date(), approvedById: userId, readyAt: new Date(), readyById: userId, updatedById: userId },
    })
  })

  await auditTreasuryAdjustment(req, tenantId, id, 'TREASURY_ADJUSTMENT_APPROVED')
  return serializeTreasuryAdjustment(req, await repo.findTreasuryAdjustmentByIdOrThrow(tenantId, id))
}

export async function rejectTreasuryAdjustment(req: Request, tenantId: string, id: string, input: RejectTreasuryAdjustmentInput) {
  const adjustment = await repo.findTreasuryAdjustmentByIdOrThrow(tenantId, id)
  if (adjustment.status !== 'PENDING_APPROVAL' || !adjustment.approvalRequestId) {
    throw new TreasuryAdjustmentInvalidStatusError('Treasury adjustment is not pending approval')
  }
  assertExpectedUpdatedAt(adjustment, input.expectedUpdatedAt)
  const userId = req.context?.userId

  await prisma.$transaction(async (tx) => {
    await tx.financeApprovalRequest.update({
      where: { id: adjustment.approvalRequestId! },
      data: { status: 'REJECTED', completedAt: new Date(), completedBy: userId, documentStatusSnapshot: 'REJECTED', workflowSnapshotJson: { reason: input.reason } },
    })
    await tx.treasuryAdjustment.update({
      where: { id, tenantId },
      data: { status: 'REJECTED', rejectedAt: new Date(), rejectedById: userId, rejectionReason: input.reason, updatedById: userId },
    })
  })

  await auditTreasuryAdjustment(req, tenantId, id, 'TREASURY_ADJUSTMENT_REJECTED', { reason: input.reason })
  return serializeTreasuryAdjustment(req, await repo.findTreasuryAdjustmentByIdOrThrow(tenantId, id))
}

export async function getTreasuryAdjustmentApproval(_req: Request, tenantId: string, id: string) {
  const adjustment = await repo.findTreasuryAdjustmentByIdOrThrow(tenantId, id)
  if (!adjustment.approvalRequestId) return { approvalRequest: null, steps: [] }
  const approvalRequest = await prisma.financeApprovalRequest.findFirst({ where: { id: adjustment.approvalRequestId, tenantId } })
  const steps = approvalRequest
    ? await prisma.financeApprovalStep.findMany({ where: { approvalRequestId: approvalRequest.id, tenantId }, orderBy: [{ level: 'asc' }, { sequence: 'asc' }] })
    : []
  return { approvalRequest, steps }
}
