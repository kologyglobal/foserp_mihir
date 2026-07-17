import type { Request } from 'express'
import { prisma } from '../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import { InvalidStateError } from '../../../utils/errors.js'
import { ApprovalError } from './approval.errors.js'
import * as repo from './approval.repository.js'
import { assertJournalApprovalEligible } from './approval-eligibility.service.js'
import type { ApprovalDecisionInput, RejectInput, SendBackInput } from './approval.schemas.js'
import type { JournalWithLines } from '../journals/journal.types.js'
import * as journalRepo from '../journals/journal.repository.js'

async function loadJournalOrThrow(tenantId: string, journalId: string): Promise<JournalWithLines> {
  return journalRepo.findJournalByIdOrThrow(tenantId, journalId)
}

async function writeApprovalAudit(
  req: Request,
  tenantId: string,
  action: string,
  entityId: string,
  journalId: string,
  newValues?: unknown,
): Promise<void> {
  const audit = auditFromRequest(req)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'finance_approval_request',
    entityId,
    action,
    newValues: { journalId, ...(newValues && typeof newValues === 'object' ? newValues : {}) },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'journal',
    entityId: journalId,
    action,
    newValues,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
}

export async function approveJournal(
  req: Request,
  tenantId: string,
  journalId: string,
  input: ApprovalDecisionInput,
): Promise<void> {
  const journal = await loadJournalOrThrow(tenantId, journalId)
  const { pendingRequest, pendingStep } = await assertJournalApprovalEligible(req, tenantId, journal)
  const userId = req.context?.userId ?? ''
  const comments = input.comments?.trim() || null

  await prisma.$transaction(async (tx) => {
    const stepUpdate = await tx.financeApprovalStep.updateMany({
      where: {
        id: pendingStep.id,
        tenantId,
        status: 'PENDING',
      },
      data: {
        status: 'APPROVED',
        actedBy: userId,
        actedAt: new Date(),
        comments,
      },
    })

    if (stepUpdate.count === 0) {
      throw new ApprovalError('APPROVAL_CONCURRENT_ACTION', 'Another user already acted on this approval step')
    }

    const remainingSteps = pendingRequest.steps
      .filter((s) => s.level > pendingRequest.currentLevel)
      .sort((a, b) => a.level - b.level)

    if (remainingSteps.length > 0) {
      const nextLevel = remainingSteps[0]!.level
      await tx.financeApprovalStep.updateMany({
        where: {
          approvalRequestId: pendingRequest.id,
          tenantId,
          level: nextLevel,
          status: 'WAITING',
        },
        data: { status: 'PENDING' },
      })

      await tx.financeApprovalRequest.update({
        where: { id: pendingRequest.id, tenantId },
        data: { currentLevel: nextLevel },
      })

      await tx.accountingVoucher.update({
        where: { id: journalId, tenantId },
        data: {
          status: 'PENDING_APPROVAL',
          currentApprovalLevel: nextLevel,
          updatedBy: userId,
        },
      })
      return
    }

    const now = new Date()
    await tx.financeApprovalRequest.update({
      where: { id: pendingRequest.id, tenantId },
      data: {
        status: 'APPROVED',
        completedAt: now,
        completedBy: userId,
      },
    })

    await tx.accountingVoucher.update({
      where: { id: journalId, tenantId },
      data: {
        status: 'APPROVED',
        currentApprovalLevel: pendingRequest.totalLevels,
        updatedBy: userId,
      },
    })
  })

  const remainingAfter = pendingRequest.steps.filter((s) => s.level > pendingRequest.currentLevel)
  if (remainingAfter.length > 0) {
    await writeApprovalAudit(req, tenantId, 'APPROVE', pendingRequest.id, journalId, {
      level: pendingRequest.currentLevel,
      advanced: true,
    })
    await writeApprovalAudit(req, tenantId, 'APPROVAL_LEVEL_ADVANCED', pendingRequest.id, journalId, {
      fromLevel: pendingRequest.currentLevel,
      toLevel: remainingAfter.sort((a, b) => a.level - b.level)[0]!.level,
    })
  } else {
    await writeApprovalAudit(req, tenantId, 'APPROVE', pendingRequest.id, journalId, {
      level: pendingRequest.currentLevel,
      final: true,
    })
    await writeApprovalAudit(req, tenantId, 'APPROVAL_COMPLETED', pendingRequest.id, journalId, {
      status: 'APPROVED',
    })
  }
}

export async function sendBackJournal(
  req: Request,
  tenantId: string,
  journalId: string,
  input: SendBackInput,
): Promise<void> {
  const journal = await loadJournalOrThrow(tenantId, journalId)
  const { pendingRequest, pendingStep } = await assertJournalApprovalEligible(req, tenantId, journal)
  const userId = req.context?.userId ?? ''

  if (!input.comments?.trim()) {
    throw new ApprovalError('APPROVAL_COMMENTS_REQUIRED', 'Comments are required when sending back')
  }

  await prisma.$transaction(async (tx) => {
    const stepUpdate = await tx.financeApprovalStep.updateMany({
      where: { id: pendingStep.id, tenantId, status: 'PENDING' },
      data: {
        status: 'SENT_BACK',
        actedBy: userId,
        actedAt: new Date(),
        comments: input.comments.trim(),
      },
    })

    if (stepUpdate.count === 0) {
      throw new ApprovalError('APPROVAL_CONCURRENT_ACTION', 'Another user already acted on this approval step')
    }

    await tx.financeApprovalRequest.update({
      where: { id: pendingRequest.id, tenantId },
      data: { status: 'SENT_BACK', completedAt: new Date(), completedBy: userId },
    })

    await tx.accountingVoucher.update({
      where: { id: journalId, tenantId },
      data: { status: 'SENT_BACK', updatedBy: userId },
    })
  })

  await writeApprovalAudit(req, tenantId, 'SEND_BACK', pendingRequest.id, journalId, {
    level: pendingRequest.currentLevel,
    comments: input.comments.trim(),
  })
}

export async function rejectJournal(
  req: Request,
  tenantId: string,
  journalId: string,
  input: RejectInput,
): Promise<void> {
  const journal = await loadJournalOrThrow(tenantId, journalId)
  const { pendingRequest, pendingStep } = await assertJournalApprovalEligible(req, tenantId, journal)
  const userId = req.context?.userId ?? ''

  if (!input.comments?.trim()) {
    throw new ApprovalError('APPROVAL_COMMENTS_REQUIRED', 'Comments are required when rejecting')
  }

  await prisma.$transaction(async (tx) => {
    const stepUpdate = await tx.financeApprovalStep.updateMany({
      where: { id: pendingStep.id, tenantId, status: 'PENDING' },
      data: {
        status: 'REJECTED',
        actedBy: userId,
        actedAt: new Date(),
        comments: input.comments.trim(),
      },
    })

    if (stepUpdate.count === 0) {
      throw new ApprovalError('APPROVAL_CONCURRENT_ACTION', 'Another user already acted on this approval step')
    }

    await tx.financeApprovalRequest.update({
      where: { id: pendingRequest.id, tenantId },
      data: { status: 'REJECTED', completedAt: new Date(), completedBy: userId },
    })

    await tx.accountingVoucher.update({
      where: { id: journalId, tenantId },
      data: { status: 'REJECTED', updatedBy: userId },
    })
  })

  await writeApprovalAudit(req, tenantId, 'REJECT', pendingRequest.id, journalId, {
    level: pendingRequest.currentLevel,
    comments: input.comments.trim(),
  })
}

export async function cancelPendingRequestForJournal(
  tenantId: string,
  journalId: string,
  cancelledBy?: string,
): Promise<void> {
  const pending = await repo.findPendingRequestForDocument(tenantId, 'JOURNAL', journalId)
  if (!pending) return

  await prisma.$transaction(async (tx) => {
    await tx.financeApprovalStep.updateMany({
      where: { approvalRequestId: pending.id, tenantId, status: { in: ['PENDING', 'WAITING'] } },
      data: { status: 'CANCELLED' },
    })
    await tx.financeApprovalRequest.update({
      where: { id: pending.id, tenantId },
      data: { status: 'CANCELLED', completedAt: new Date(), completedBy: cancelledBy ?? null },
    })
  })
}

export async function guardJournalSubmittable(journal: JournalWithLines): Promise<void> {
  const blocked = ['PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED', 'POSTED']
  if (blocked.includes(journal.status)) {
    throw new InvalidStateError(`Journal in status ${journal.status} cannot be submitted`)
  }
}
