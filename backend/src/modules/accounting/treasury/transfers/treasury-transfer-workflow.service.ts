import type { Request } from 'express'
import { prisma } from '../../../../config/database.js'
import { auditTreasuryTransfer } from './treasury-transfer-audit.js'
import { recalculateTreasuryTransfer } from './treasury-transfer-draft.service.js'
import * as repo from './treasury-transfer.repository.js'
import {
  TreasuryTransferApprovalRequiredError,
  TreasuryTransferInvalidStatusError,
  TreasuryTransferNotReadyError,
  TreasuryTransferStaleVersionError,
} from './treasury-transfer.errors.js'
import type {
  ApproveTreasuryTransferInput,
  CancelTreasuryTransferInput,
  MarkReadyTreasuryTransferInput,
  RejectTreasuryTransferInput,
  ReviseTreasuryTransferInput,
  SubmitTreasuryTransferInput,
} from './treasury-transfer.schemas.js'
import type { TreasuryTransferRow } from './treasury-transfer.types.js'
import { serializeTreasuryTransfer } from './treasury-transfer-read.service.js'

function assertExpectedUpdatedAt(transfer: TreasuryTransferRow, expectedUpdatedAt?: string): void {
  if (!expectedUpdatedAt) return
  if (transfer.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) throw new TreasuryTransferStaleVersionError()
}

async function assertReadyForWorkflow(tenantId: string, transfer: TreasuryTransferRow, userId?: string | null) {
  const result = await recalculateTreasuryTransfer(tenantId, transfer)
  if (!result.validation.isValid) {
    throw new TreasuryTransferNotReadyError(
      result.validation.errors[0]?.message ?? 'Treasury transfer failed validation',
      result.validation.errors.map((e) => ({ field: e.field ?? 'transfer', message: e.message })),
    )
  }
  await repo.persistCalculatedFields(tenantId, transfer.id, result, userId)
  return result
}

export async function submitTreasuryTransfer(req: Request, tenantId: string, id: string, input: SubmitTreasuryTransferInput) {
  const transfer = await repo.findTreasuryTransferByIdOrThrow(tenantId, id)
  if (transfer.status !== 'DRAFT' || !transfer.approvalRequired) {
    throw new TreasuryTransferInvalidStatusError('Only approval-required draft treasury transfers can be submitted')
  }
  assertExpectedUpdatedAt(transfer, input.expectedUpdatedAt)
  const userId = req.context?.userId
  const result = await assertReadyForWorkflow(tenantId, transfer, userId)

  const cycleNumber =
    (await prisma.financeApprovalRequest.count({
      where: { tenantId, legalEntityId: transfer.legalEntityId, documentType: 'TREASURY_TRANSFER', documentId: id },
    })) + 1

  await prisma.$transaction(async (tx) => {
    const approval = await tx.financeApprovalRequest.create({
      data: {
        tenantId,
        legalEntityId: transfer.legalEntityId,
        documentType: 'TREASURY_TRANSFER',
        documentId: id,
        documentNumberSnapshot: transfer.draftReference,
        documentStatusSnapshot: 'PENDING_APPROVAL',
        cycleNumber,
        status: 'PENDING',
        amountBasis: result.baseTransferAmount,
        currencyCode: transfer.currencyCode,
        currentLevel: 1,
        totalLevels: 1,
        requestedBy: userId,
        workflowSnapshotJson: input.comments ? { comments: input.comments } : undefined,
      },
    })
    await tx.treasuryTransfer.update({
      where: { id, tenantId },
      data: {
        status: 'PENDING_APPROVAL',
        approvalRequestId: approval.id,
        submittedAt: new Date(),
        submittedById: userId,
        updatedById: userId,
      },
    })
  })

  await auditTreasuryTransfer(req, tenantId, id, 'TREASURY_TRANSFER_SUBMITTED')
  return serializeTreasuryTransfer(req, await repo.findTreasuryTransferByIdOrThrow(tenantId, id))
}

export async function markTreasuryTransferReady(req: Request, tenantId: string, id: string, input: MarkReadyTreasuryTransferInput) {
  const transfer = await repo.findTreasuryTransferByIdOrThrow(tenantId, id)
  if (transfer.status !== 'DRAFT' || transfer.approvalRequired) {
    throw new TreasuryTransferInvalidStatusError('Only non-approval draft treasury transfers can be marked ready to post')
  }
  assertExpectedUpdatedAt(transfer, input.expectedUpdatedAt)
  const userId = req.context?.userId
  await assertReadyForWorkflow(tenantId, transfer, userId)

  await prisma.treasuryTransfer.update({
    where: { id, tenantId },
    data: { status: 'READY_TO_POST', readyToPostAt: new Date(), readyToPostById: userId, updatedById: userId },
  })

  await auditTreasuryTransfer(req, tenantId, id, 'TREASURY_TRANSFER_READY_TO_POST')
  return serializeTreasuryTransfer(req, await repo.findTreasuryTransferByIdOrThrow(tenantId, id))
}

export async function reviseTreasuryTransfer(req: Request, tenantId: string, id: string, input: ReviseTreasuryTransferInput) {
  const transfer = await repo.findTreasuryTransferByIdOrThrow(tenantId, id)
  if (!['REJECTED', 'READY_TO_POST'].includes(transfer.status)) {
    throw new TreasuryTransferInvalidStatusError('Only rejected or ready-to-post treasury transfers can be revised')
  }
  assertExpectedUpdatedAt(transfer, input.expectedUpdatedAt)
  const userId = req.context?.userId

  await prisma.treasuryTransfer.update({
    where: { id, tenantId },
    data: {
      status: 'DRAFT',
      readyToPostAt: null,
      readyToPostById: null,
      rejectedAt: null,
      rejectedById: null,
      rejectionReason: null,
      approvalRequestId: null,
      updatedById: userId,
    },
  })

  await auditTreasuryTransfer(req, tenantId, id, 'TREASURY_TRANSFER_REVISED', { reason: input.reason })
  return serializeTreasuryTransfer(req, await repo.findTreasuryTransferByIdOrThrow(tenantId, id))
}

export async function cancelTreasuryTransfer(req: Request, tenantId: string, id: string, input: CancelTreasuryTransferInput) {
  const transfer = await repo.findTreasuryTransferByIdOrThrow(tenantId, id)
  if (!['DRAFT', 'REJECTED', 'READY_TO_POST', 'PENDING_APPROVAL'].includes(transfer.status)) {
    throw new TreasuryTransferInvalidStatusError('Treasury transfer cannot be cancelled in its current status')
  }
  assertExpectedUpdatedAt(transfer, input.expectedUpdatedAt)
  const userId = req.context?.userId

  await prisma.$transaction(async (tx) => {
    if (transfer.status === 'PENDING_APPROVAL' && transfer.approvalRequestId) {
      await tx.financeApprovalRequest.updateMany({
        where: { id: transfer.approvalRequestId, tenantId, status: 'PENDING' },
        data: { status: 'CANCELLED', completedAt: new Date(), completedBy: userId, documentStatusSnapshot: 'CANCELLED' },
      })
    }
    await tx.treasuryTransfer.update({
      where: { id, tenantId },
      data: {
        status: 'CANCELLED',
        cancellationReason: input.reason,
        cancelledAt: new Date(),
        cancelledById: userId,
        updatedById: userId,
      },
    })
  })

  await auditTreasuryTransfer(req, tenantId, id, 'TREASURY_TRANSFER_CANCELLED', { reason: input.reason })
  return serializeTreasuryTransfer(req, await repo.findTreasuryTransferByIdOrThrow(tenantId, id))
}

export async function approveTreasuryTransfer(req: Request, tenantId: string, id: string, input: ApproveTreasuryTransferInput) {
  const transfer = await repo.findTreasuryTransferByIdOrThrow(tenantId, id)
  if (transfer.status !== 'PENDING_APPROVAL' || !transfer.approvalRequestId) {
    throw new TreasuryTransferInvalidStatusError('Treasury transfer is not pending approval')
  }
  assertExpectedUpdatedAt(transfer, input.expectedUpdatedAt)
  const userId = req.context?.userId

  const settings = await prisma.financeSettings.findFirst({ where: { tenantId, legalEntityId: transfer.legalEntityId } })
  if (settings?.treasuryTransferPreventSelfApprove && transfer.submittedById && transfer.submittedById === userId) {
    throw new TreasuryTransferApprovalRequiredError('The submitter cannot approve their own treasury transfer')
  }

  const result = await recalculateTreasuryTransfer(tenantId, transfer)
  await repo.persistCalculatedFields(tenantId, id, result, userId)

  await prisma.$transaction(async (tx) => {
    const approved = await tx.financeApprovalRequest.updateMany({
      where: { id: transfer.approvalRequestId!, tenantId, documentType: 'TREASURY_TRANSFER', documentId: id, status: 'PENDING' },
      data: {
        status: 'APPROVED',
        completedAt: new Date(),
        completedBy: userId,
        documentStatusSnapshot: 'READY_TO_POST',
        workflowSnapshotJson: input.comments ? { comments: input.comments } : undefined,
      },
    })
    if (approved.count !== 1) throw new TreasuryTransferApprovalRequiredError()
    await tx.treasuryTransfer.update({
      where: { id, tenantId },
      data: {
        status: 'READY_TO_POST',
        approvedAt: new Date(),
        approvedById: userId,
        readyToPostAt: new Date(),
        readyToPostById: userId,
        updatedById: userId,
      },
    })
  })

  await auditTreasuryTransfer(req, tenantId, id, 'TREASURY_TRANSFER_APPROVED')
  return serializeTreasuryTransfer(req, await repo.findTreasuryTransferByIdOrThrow(tenantId, id))
}

export async function rejectTreasuryTransfer(req: Request, tenantId: string, id: string, input: RejectTreasuryTransferInput) {
  const transfer = await repo.findTreasuryTransferByIdOrThrow(tenantId, id)
  if (transfer.status !== 'PENDING_APPROVAL' || !transfer.approvalRequestId) {
    throw new TreasuryTransferInvalidStatusError('Treasury transfer is not pending approval')
  }
  assertExpectedUpdatedAt(transfer, input.expectedUpdatedAt)
  const userId = req.context?.userId

  await prisma.$transaction(async (tx) => {
    await tx.financeApprovalRequest.update({
      where: { id: transfer.approvalRequestId! },
      data: {
        status: 'REJECTED',
        completedAt: new Date(),
        completedBy: userId,
        documentStatusSnapshot: 'REJECTED',
        workflowSnapshotJson: { reason: input.reason },
      },
    })
    await tx.treasuryTransfer.update({
      where: { id, tenantId },
      data: { status: 'REJECTED', rejectedAt: new Date(), rejectedById: userId, rejectionReason: input.reason, updatedById: userId },
    })
  })

  await auditTreasuryTransfer(req, tenantId, id, 'TREASURY_TRANSFER_REJECTED', { reason: input.reason })
  return serializeTreasuryTransfer(req, await repo.findTreasuryTransferByIdOrThrow(tenantId, id))
}

export async function getTreasuryTransferApproval(_req: Request, tenantId: string, id: string) {
  const transfer = await repo.findTreasuryTransferByIdOrThrow(tenantId, id)
  if (!transfer.approvalRequestId) return { approvalRequest: null, steps: [] }
  const approvalRequest = await prisma.financeApprovalRequest.findFirst({ where: { id: transfer.approvalRequestId, tenantId } })
  const steps = approvalRequest
    ? await prisma.financeApprovalStep.findMany({
        where: { approvalRequestId: approvalRequest.id, tenantId },
        orderBy: [{ level: 'asc' }, { sequence: 'asc' }],
      })
    : []
  return { approvalRequest, steps }
}
