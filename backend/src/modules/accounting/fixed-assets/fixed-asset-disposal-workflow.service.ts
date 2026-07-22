import type { Request } from 'express'
import { prisma } from '../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import { recalculateDisposal } from './fixed-asset-disposal-draft.service.js'
import * as repo from './fixed-asset-disposal.repository.js'
import {
  FixedAssetDisposalApprovalRequiredError,
  FixedAssetDisposalInvalidStatusError,
  FixedAssetDisposalNotReadyError,
} from './fixed-asset-disposal.errors.js'
import { serializeFixedAssetDisposal } from './fixed-asset-disposal-read.service.js'
import type {
  ApproveFixedAssetDisposalInput,
  CancelFixedAssetDisposalInput,
  MarkFixedAssetDisposalReadyInput,
  RejectFixedAssetDisposalInput,
  ReviseFixedAssetDisposalInput,
  SubmitFixedAssetDisposalInput,
} from './fixed-assets.schemas.js'
import type { FixedAssetDisposalWithAsset } from './fixed-asset-disposal.types.js'

function assertExpectedUpdatedAt(disposal: FixedAssetDisposalWithAsset, expectedUpdatedAt?: string): void {
  if (!expectedUpdatedAt) return
  repo.assertExpectedUpdatedAt(disposal, expectedUpdatedAt)
}

async function assertReadyForWorkflow(tenantId: string, disposal: FixedAssetDisposalWithAsset, userId?: string | null) {
  const calc = await recalculateDisposal(tenantId, disposal)
  if (!calc.validation.isValid) {
    throw new FixedAssetDisposalNotReadyError(
      calc.validation.errors[0]?.message ?? 'Fixed asset disposal failed validation',
      calc.validation.errors.map((e) => ({ field: e.field ?? 'disposal', message: e.message })),
    )
  }
  await repo.persistCalculatedFields(tenantId, disposal.id, calc, userId)
  return calc
}

async function audit(req: Request, tenantId: string, disposalId: string, action: string, newValues?: unknown) {
  const meta = auditFromRequest(req)
  await createAuditLog({
    tenantId,
    userId: meta.userId,
    module: 'finance',
    entity: 'fixed_asset_disposal',
    entityId: disposalId,
    action,
    newValues,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  })
}

export async function submitFixedAssetDisposal(req: Request, tenantId: string, id: string, input: SubmitFixedAssetDisposalInput) {
  const disposal = await repo.findDisposalByIdOrThrow(tenantId, id)
  if (disposal.status !== 'DRAFT' || !disposal.approvalRequired) {
    throw new FixedAssetDisposalInvalidStatusError('Only approval-required draft disposals can be submitted')
  }
  assertExpectedUpdatedAt(disposal, input.expectedUpdatedAt)
  const userId = req.context?.userId
  const calc = await assertReadyForWorkflow(tenantId, disposal, userId)

  const cycleNumber =
    (await prisma.financeApprovalRequest.count({
      where: { tenantId, legalEntityId: disposal.legalEntityId, documentType: 'FIXED_ASSET_DISPOSAL', documentId: id },
    })) + 1

  await prisma.$transaction(async (tx) => {
    const approval = await tx.financeApprovalRequest.create({
      data: {
        tenantId,
        legalEntityId: disposal.legalEntityId,
        documentType: 'FIXED_ASSET_DISPOSAL',
        documentId: id,
        documentNumberSnapshot: disposal.draftReference,
        documentStatusSnapshot: 'PENDING_APPROVAL',
        cycleNumber,
        status: 'PENDING',
        amountBasis: calc.totalProceeds,
        currencyCode: disposal.currencyCode,
        currentLevel: 1,
        totalLevels: 1,
        requestedBy: userId,
        workflowSnapshotJson: input.comments ? { comments: input.comments } : undefined,
      },
    })
    await tx.fixedAssetDisposal.update({
      where: { id, tenantId },
      data: { status: 'PENDING_APPROVAL', approvalRequestId: approval.id, submittedAt: new Date(), submittedById: userId, updatedById: userId },
    })
  })

  await audit(req, tenantId, id, 'FIXED_ASSET_DISPOSAL_SUBMITTED')
  return serializeFixedAssetDisposal(req, await repo.findDisposalByIdOrThrow(tenantId, id))
}

export async function markFixedAssetDisposalReady(
  req: Request,
  tenantId: string,
  id: string,
  input: MarkFixedAssetDisposalReadyInput,
) {
  const disposal = await repo.findDisposalByIdOrThrow(tenantId, id)
  if (disposal.status !== 'DRAFT' || disposal.approvalRequired) {
    throw new FixedAssetDisposalInvalidStatusError('Only non-approval draft disposals can be marked ready')
  }
  assertExpectedUpdatedAt(disposal, input.expectedUpdatedAt)
  const userId = req.context?.userId
  await assertReadyForWorkflow(tenantId, disposal, userId)

  await prisma.fixedAssetDisposal.update({
    where: { id, tenantId },
    data: { status: 'READY_TO_POST', readyAt: new Date(), readyById: userId, updatedById: userId },
  })

  await audit(req, tenantId, id, 'FIXED_ASSET_DISPOSAL_READY')
  return serializeFixedAssetDisposal(req, await repo.findDisposalByIdOrThrow(tenantId, id))
}

export async function reviseFixedAssetDisposal(req: Request, tenantId: string, id: string, input: ReviseFixedAssetDisposalInput) {
  const disposal = await repo.findDisposalByIdOrThrow(tenantId, id)
  if (!['REJECTED', 'READY_TO_POST'].includes(disposal.status)) {
    throw new FixedAssetDisposalInvalidStatusError('Only rejected or ready disposals can be revised')
  }
  assertExpectedUpdatedAt(disposal, input.expectedUpdatedAt)
  const userId = req.context?.userId

  await prisma.fixedAssetDisposal.update({
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

  await audit(req, tenantId, id, 'FIXED_ASSET_DISPOSAL_REVISED', { reason: input.reason })
  return serializeFixedAssetDisposal(req, await repo.findDisposalByIdOrThrow(tenantId, id))
}

export async function cancelFixedAssetDisposal(req: Request, tenantId: string, id: string, input: CancelFixedAssetDisposalInput) {
  const disposal = await repo.findDisposalByIdOrThrow(tenantId, id)
  if (!['DRAFT', 'REJECTED', 'READY_TO_POST', 'PENDING_APPROVAL'].includes(disposal.status)) {
    throw new FixedAssetDisposalInvalidStatusError('Disposal cannot be cancelled in its current status')
  }
  assertExpectedUpdatedAt(disposal, input.expectedUpdatedAt)
  const userId = req.context?.userId

  await prisma.$transaction(async (tx) => {
    if (disposal.status === 'PENDING_APPROVAL' && disposal.approvalRequestId) {
      await tx.financeApprovalRequest.updateMany({
        where: { id: disposal.approvalRequestId, tenantId, status: 'PENDING' },
        data: { status: 'CANCELLED', completedAt: new Date(), completedBy: userId, documentStatusSnapshot: 'CANCELLED' },
      })
    }
    await tx.fixedAssetDisposal.update({
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

  await audit(req, tenantId, id, 'FIXED_ASSET_DISPOSAL_CANCELLED', { reason: input.reason })
  return serializeFixedAssetDisposal(req, await repo.findDisposalByIdOrThrow(tenantId, id))
}

export async function approveFixedAssetDisposal(req: Request, tenantId: string, id: string, input: ApproveFixedAssetDisposalInput) {
  const disposal = await repo.findDisposalByIdOrThrow(tenantId, id)
  if (disposal.status !== 'PENDING_APPROVAL' || !disposal.approvalRequestId) {
    throw new FixedAssetDisposalInvalidStatusError('Disposal is not pending approval')
  }
  assertExpectedUpdatedAt(disposal, input.expectedUpdatedAt)
  const userId = req.context?.userId

  if (disposal.submittedById && disposal.submittedById === userId) {
    throw new FixedAssetDisposalApprovalRequiredError('The submitter cannot approve their own disposal')
  }

  const calc = await recalculateDisposal(tenantId, disposal)
  await repo.persistCalculatedFields(tenantId, id, calc, userId)

  await prisma.$transaction(async (tx) => {
    const approved = await tx.financeApprovalRequest.updateMany({
      where: { id: disposal.approvalRequestId!, tenantId, documentType: 'FIXED_ASSET_DISPOSAL', documentId: id, status: 'PENDING' },
      data: {
        status: 'APPROVED',
        completedAt: new Date(),
        completedBy: userId,
        documentStatusSnapshot: 'READY_TO_POST',
        workflowSnapshotJson: input.comments ? { comments: input.comments } : undefined,
      },
    })
    if (approved.count !== 1) throw new FixedAssetDisposalApprovalRequiredError()
    await tx.fixedAssetDisposal.update({
      where: { id, tenantId },
      data: { status: 'READY_TO_POST', approvedAt: new Date(), approvedById: userId, readyAt: new Date(), readyById: userId, updatedById: userId },
    })
  })

  await audit(req, tenantId, id, 'FIXED_ASSET_DISPOSAL_APPROVED')
  return serializeFixedAssetDisposal(req, await repo.findDisposalByIdOrThrow(tenantId, id))
}

export async function rejectFixedAssetDisposal(req: Request, tenantId: string, id: string, input: RejectFixedAssetDisposalInput) {
  const disposal = await repo.findDisposalByIdOrThrow(tenantId, id)
  if (disposal.status !== 'PENDING_APPROVAL' || !disposal.approvalRequestId) {
    throw new FixedAssetDisposalInvalidStatusError('Disposal is not pending approval')
  }
  assertExpectedUpdatedAt(disposal, input.expectedUpdatedAt)
  const userId = req.context?.userId

  await prisma.$transaction(async (tx) => {
    await tx.financeApprovalRequest.update({
      where: { id: disposal.approvalRequestId! },
      data: { status: 'REJECTED', completedAt: new Date(), completedBy: userId, documentStatusSnapshot: 'REJECTED', workflowSnapshotJson: { reason: input.reason } },
    })
    await tx.fixedAssetDisposal.update({
      where: { id, tenantId },
      data: { status: 'REJECTED', rejectedAt: new Date(), rejectedById: userId, rejectionReason: input.reason, updatedById: userId },
    })
  })

  await audit(req, tenantId, id, 'FIXED_ASSET_DISPOSAL_REJECTED', { reason: input.reason })
  return serializeFixedAssetDisposal(req, await repo.findDisposalByIdOrThrow(tenantId, id))
}

export async function getFixedAssetDisposalApproval(_req: Request, tenantId: string, id: string) {
  const disposal = await repo.findDisposalByIdOrThrow(tenantId, id)
  if (!disposal.approvalRequestId) return { approvalRequest: null, steps: [] }
  const approvalRequest = await prisma.financeApprovalRequest.findFirst({ where: { id: disposal.approvalRequestId, tenantId } })
  const steps = approvalRequest
    ? await prisma.financeApprovalStep.findMany({ where: { approvalRequestId: approvalRequest.id, tenantId }, orderBy: [{ level: 'asc' }, { sequence: 'asc' }] })
    : []
  return { approvalRequest, steps }
}
