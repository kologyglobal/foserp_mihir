import type { Request } from 'express'
import { prisma } from '../../../../config/database.js'
import { auditTreasuryCheque } from './treasury-cheque-audit.js'
import { recalculateTreasuryCheque } from './treasury-cheque-draft.service.js'
import * as repo from './treasury-cheque.repository.js'
import {
  TreasuryChequeApprovalRequiredError,
  TreasuryChequeInvalidStatusError,
  TreasuryChequeNotReadyError,
  TreasuryChequeStaleVersionError,
} from './treasury-cheque.errors.js'
import type {
  ApproveTreasuryChequeInput,
  CancelTreasuryChequeInput,
  MarkReadyTreasuryChequeInput,
  RejectTreasuryChequeInput,
  ReviseTreasuryChequeInput,
  SubmitTreasuryChequeInput,
} from './treasury-cheque.schemas.js'
import type { TreasuryChequeRow } from './treasury-cheque.types.js'
import { serializeTreasuryCheque } from './treasury-cheque-read.service.js'

function assertExpectedUpdatedAt(cheque: TreasuryChequeRow, expectedUpdatedAt?: string): void {
  if (!expectedUpdatedAt) return
  if (cheque.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) throw new TreasuryChequeStaleVersionError()
}

async function assertReadyForWorkflow(tenantId: string, cheque: TreasuryChequeRow, userId?: string | null) {
  const result = await recalculateTreasuryCheque(tenantId, cheque)
  if (!result.validation.isValid) {
    throw new TreasuryChequeNotReadyError(
      result.validation.errors[0]?.message ?? 'Treasury cheque failed validation',
      result.validation.errors.map((e) => ({ field: e.field ?? 'cheque', message: e.message })),
    )
  }
  await repo.persistCalculatedFields(tenantId, cheque.id, result, userId)
  return result
}

export async function submitTreasuryCheque(req: Request, tenantId: string, id: string, input: SubmitTreasuryChequeInput) {
  const cheque = await repo.findTreasuryChequeByIdOrThrow(tenantId, id)
  if (cheque.status !== 'DRAFT' || !cheque.approvalRequired) {
    throw new TreasuryChequeInvalidStatusError('Only approval-required draft treasury cheques can be submitted')
  }
  assertExpectedUpdatedAt(cheque, input.expectedUpdatedAt)
  const userId = req.context?.userId
  const result = await assertReadyForWorkflow(tenantId, cheque, userId)

  const cycleNumber =
    (await prisma.financeApprovalRequest.count({
      where: { tenantId, legalEntityId: cheque.legalEntityId, documentType: 'TREASURY_CHEQUE', documentId: id },
    })) + 1

  await prisma.$transaction(async (tx) => {
    const approval = await tx.financeApprovalRequest.create({
      data: {
        tenantId,
        legalEntityId: cheque.legalEntityId,
        documentType: 'TREASURY_CHEQUE',
        documentId: id,
        documentNumberSnapshot: cheque.draftReference,
        documentStatusSnapshot: 'PENDING_APPROVAL',
        cycleNumber,
        status: 'PENDING',
        amountBasis: result.baseAmount,
        currencyCode: cheque.currencyCode,
        currentLevel: 1,
        totalLevels: 1,
        requestedBy: userId,
        workflowSnapshotJson: input.comments ? { comments: input.comments } : undefined,
      },
    })
    await tx.treasuryCheque.update({
      where: { id, tenantId },
      data: { status: 'PENDING_APPROVAL', approvalRequestId: approval.id, submittedAt: new Date(), submittedById: userId, updatedById: userId },
    })
  })

  await auditTreasuryCheque(req, tenantId, id, 'TREASURY_CHEQUE_SUBMITTED')
  return serializeTreasuryCheque(req, await repo.findTreasuryChequeByIdOrThrow(tenantId, id))
}

export async function markTreasuryChequeReady(req: Request, tenantId: string, id: string, input: MarkReadyTreasuryChequeInput) {
  const cheque = await repo.findTreasuryChequeByIdOrThrow(tenantId, id)
  if (cheque.status !== 'DRAFT' || cheque.approvalRequired) {
    throw new TreasuryChequeInvalidStatusError('Only non-approval draft treasury cheques can be marked ready')
  }
  assertExpectedUpdatedAt(cheque, input.expectedUpdatedAt)
  const userId = req.context?.userId
  await assertReadyForWorkflow(tenantId, cheque, userId)

  await prisma.treasuryCheque.update({
    where: { id, tenantId },
    data: { status: 'READY', readyAt: new Date(), readyById: userId, updatedById: userId },
  })

  await auditTreasuryCheque(req, tenantId, id, 'TREASURY_CHEQUE_READY')
  return serializeTreasuryCheque(req, await repo.findTreasuryChequeByIdOrThrow(tenantId, id))
}

export async function reviseTreasuryCheque(req: Request, tenantId: string, id: string, input: ReviseTreasuryChequeInput) {
  const cheque = await repo.findTreasuryChequeByIdOrThrow(tenantId, id)
  if (!['REJECTED', 'READY'].includes(cheque.status)) {
    throw new TreasuryChequeInvalidStatusError('Only rejected or ready treasury cheques can be revised')
  }
  assertExpectedUpdatedAt(cheque, input.expectedUpdatedAt)
  const userId = req.context?.userId

  await prisma.treasuryCheque.update({
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

  await auditTreasuryCheque(req, tenantId, id, 'TREASURY_CHEQUE_REVISED', { reason: input.reason })
  return serializeTreasuryCheque(req, await repo.findTreasuryChequeByIdOrThrow(tenantId, id))
}

export async function cancelTreasuryCheque(req: Request, tenantId: string, id: string, input: CancelTreasuryChequeInput) {
  const cheque = await repo.findTreasuryChequeByIdOrThrow(tenantId, id)
  if (!['DRAFT', 'REJECTED', 'READY', 'PENDING_APPROVAL'].includes(cheque.status)) {
    throw new TreasuryChequeInvalidStatusError('Treasury cheque cannot be cancelled in its current status')
  }
  assertExpectedUpdatedAt(cheque, input.expectedUpdatedAt)
  const userId = req.context?.userId

  await prisma.$transaction(async (tx) => {
    if (cheque.status === 'PENDING_APPROVAL' && cheque.approvalRequestId) {
      await tx.financeApprovalRequest.updateMany({
        where: { id: cheque.approvalRequestId, tenantId, status: 'PENDING' },
        data: { status: 'CANCELLED', completedAt: new Date(), completedBy: userId, documentStatusSnapshot: 'CANCELLED' },
      })
    }
    await tx.treasuryCheque.update({
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

  await auditTreasuryCheque(req, tenantId, id, 'TREASURY_CHEQUE_CANCELLED', { reason: input.reason })
  return serializeTreasuryCheque(req, await repo.findTreasuryChequeByIdOrThrow(tenantId, id))
}

export async function approveTreasuryCheque(req: Request, tenantId: string, id: string, input: ApproveTreasuryChequeInput) {
  const cheque = await repo.findTreasuryChequeByIdOrThrow(tenantId, id)
  if (cheque.status !== 'PENDING_APPROVAL' || !cheque.approvalRequestId) {
    throw new TreasuryChequeInvalidStatusError('Treasury cheque is not pending approval')
  }
  assertExpectedUpdatedAt(cheque, input.expectedUpdatedAt)
  const userId = req.context?.userId

  const settings = await prisma.financeSettings.findFirst({ where: { tenantId, legalEntityId: cheque.legalEntityId } })
  if (settings?.treasuryChequePreventSelfApprove && cheque.submittedById && cheque.submittedById === userId) {
    throw new TreasuryChequeApprovalRequiredError('The submitter cannot approve their own treasury cheque')
  }

  const result = await recalculateTreasuryCheque(tenantId, cheque)
  await repo.persistCalculatedFields(tenantId, id, result, userId)

  await prisma.$transaction(async (tx) => {
    const approved = await tx.financeApprovalRequest.updateMany({
      where: { id: cheque.approvalRequestId!, tenantId, documentType: 'TREASURY_CHEQUE', documentId: id, status: 'PENDING' },
      data: {
        status: 'APPROVED',
        completedAt: new Date(),
        completedBy: userId,
        documentStatusSnapshot: 'READY',
        workflowSnapshotJson: input.comments ? { comments: input.comments } : undefined,
      },
    })
    if (approved.count !== 1) throw new TreasuryChequeApprovalRequiredError()
    await tx.treasuryCheque.update({
      where: { id, tenantId },
      data: { status: 'READY', approvedAt: new Date(), approvedById: userId, readyAt: new Date(), readyById: userId, updatedById: userId },
    })
  })

  await auditTreasuryCheque(req, tenantId, id, 'TREASURY_CHEQUE_APPROVED')
  return serializeTreasuryCheque(req, await repo.findTreasuryChequeByIdOrThrow(tenantId, id))
}

export async function rejectTreasuryCheque(req: Request, tenantId: string, id: string, input: RejectTreasuryChequeInput) {
  const cheque = await repo.findTreasuryChequeByIdOrThrow(tenantId, id)
  if (cheque.status !== 'PENDING_APPROVAL' || !cheque.approvalRequestId) {
    throw new TreasuryChequeInvalidStatusError('Treasury cheque is not pending approval')
  }
  assertExpectedUpdatedAt(cheque, input.expectedUpdatedAt)
  const userId = req.context?.userId

  await prisma.$transaction(async (tx) => {
    await tx.financeApprovalRequest.update({
      where: { id: cheque.approvalRequestId! },
      data: { status: 'REJECTED', completedAt: new Date(), completedBy: userId, documentStatusSnapshot: 'REJECTED', workflowSnapshotJson: { reason: input.reason } },
    })
    await tx.treasuryCheque.update({
      where: { id, tenantId },
      data: { status: 'REJECTED', rejectedAt: new Date(), rejectedById: userId, rejectionReason: input.reason, updatedById: userId },
    })
  })

  await auditTreasuryCheque(req, tenantId, id, 'TREASURY_CHEQUE_REJECTED', { reason: input.reason })
  return serializeTreasuryCheque(req, await repo.findTreasuryChequeByIdOrThrow(tenantId, id))
}

export async function getTreasuryChequeApproval(_req: Request, tenantId: string, id: string) {
  const cheque = await repo.findTreasuryChequeByIdOrThrow(tenantId, id)
  if (!cheque.approvalRequestId) return { approvalRequest: null, steps: [] }
  const approvalRequest = await prisma.financeApprovalRequest.findFirst({ where: { id: cheque.approvalRequestId, tenantId } })
  const steps = approvalRequest
    ? await prisma.financeApprovalStep.findMany({ where: { approvalRequestId: approvalRequest.id, tenantId }, orderBy: [{ level: 'asc' }, { sequence: 'asc' }] })
    : []
  return { approvalRequest, steps }
}
