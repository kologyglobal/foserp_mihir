import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { toDecimal } from '../shared/finance-decimal.js'
import { ApprovalError } from './approval.errors.js'
import * as repo from './approval.repository.js'
import { guardJournalSubmittable } from './approval-decision.service.js'
import type { JournalApprovalInfo, JournalWithLines } from '../journals/journal.types.js'

export async function createJournalApprovalRequestOnSubmit(
  tenantId: string,
  journal: JournalWithLines,
  approval: JournalApprovalInfo,
  requestedBy: string,
): Promise<{ requestId: string; cycleNumber: number }> {
  await guardJournalSubmittable(journal)

  if (!approval.required || approval.levels.length === 0) {
    throw new ApprovalError(
      'APPROVAL_WORKFLOW_INCOMPLETE',
      'Approval is required but no workflow levels were resolved',
    )
  }

  const existingPending = await repo.findPendingRequestForDocument(tenantId, 'JOURNAL', journal.id)
  if (existingPending) {
    throw new ApprovalError(
      'APPROVAL_REQUEST_ALREADY_EXISTS',
      'A pending approval request already exists for this journal',
    )
  }

  const maxCycle = await repo.getMaxCycleNumber(
    tenantId,
    journal.legalEntityId,
    'JOURNAL',
    journal.id,
  )
  const cycleNumber = maxCycle + 1
  const firstLevel = approval.levels[0]!

  const steps = approval.levels.map((level, index) => ({
    level: level.level,
    sequence: 1,
    approverRoleId: level.approverRoleId,
    approverUserId: level.approverUserId,
    status: (index === 0 ? 'PENDING' : 'WAITING') as 'PENDING' | 'WAITING',
  }))

  const created = await prisma.$transaction(async (tx) => {
    const request = await tx.financeApprovalRequest.create({
      data: {
        tenantId,
        legalEntityId: journal.legalEntityId,
        documentType: 'JOURNAL',
        documentId: journal.id,
        documentNumberSnapshot: journal.referenceNumber,
        documentStatusSnapshot: 'PENDING_APPROVAL',
        cycleNumber,
        status: 'PENDING',
        amountBasis: toDecimal(approval.amount),
        currencyCode: journal.currencyCode,
        currentLevel: firstLevel.level,
        totalLevels: approval.totalLevels,
        requestedBy,
        ruleSnapshotJson: approval.levels as unknown as Prisma.InputJsonValue,
        workflowSnapshotJson: {
          amount: approval.amount,
          totalLevels: approval.totalLevels,
          levels: approval.levels,
        } as unknown as Prisma.InputJsonValue,
        steps: {
          create: steps.map((step) => ({
            tenantId,
            legalEntityId: journal.legalEntityId,
            level: step.level,
            sequence: step.sequence,
            approverRoleId: step.approverRoleId,
            approverUserId: step.approverUserId,
            status: step.status,
          })),
        },
      },
    })

    await tx.accountingVoucher.update({
      where: { id: journal.id, tenantId },
      data: {
        status: 'PENDING_APPROVAL',
        approvalRequired: true,
        currentApprovalLevel: firstLevel.level,
        updatedBy: requestedBy,
      },
    })

    return request
  })

  return { requestId: created.id, cycleNumber }
}

export async function submitJournalWithoutApproval(
  tenantId: string,
  journalId: string,
  updatedBy?: string,
): Promise<void> {
  await prisma.accountingVoucher.update({
    where: { id: journalId, tenantId },
    data: {
      status: 'APPROVED',
      approvalRequired: false,
      currentApprovalLevel: 0,
      updatedBy: updatedBy ?? undefined,
    },
  })
}

export async function backfillApprovalRequestForJournal(
  tenantId: string,
  journal: JournalWithLines,
  approval: JournalApprovalInfo,
): Promise<{ created: boolean; reason?: string }> {
  if (journal.status !== 'PENDING_APPROVAL') {
    return { created: false, reason: `Journal status is ${journal.status}` }
  }

  const existingPending = await repo.findPendingRequestForDocument(tenantId, 'JOURNAL', journal.id)
  if (existingPending) {
    return { created: false, reason: 'Pending request already exists' }
  }

  if (!approval.required || approval.levels.length === 0) {
    return { created: false, reason: 'No approval levels resolved' }
  }

  try {
    await createJournalApprovalRequestOnSubmit(tenantId, journal, approval, journal.createdBy ?? 'system')
    return { created: true }
  } catch (e) {
    return { created: false, reason: e instanceof Error ? e.message : 'Unknown error' }
  }
}
