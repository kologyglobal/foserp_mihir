import { prisma } from '../../../../../config/database.js'
import { getLegalEntityOrThrow } from '../../../shared/finance.helpers.js'
import { resolvePostingPeriod } from '../../../posting/posting-period.service.js'
import { PostingError } from '../../../posting/posting.errors.js'
import { recalculateTreasuryAdjustment } from '../treasury-adjustment-draft.service.js'
import * as repo from '../treasury-adjustment.repository.js'
import {
  TreasuryAdjustmentAccountingAlreadyLinkedError,
  TreasuryAdjustmentAlreadyPostedError,
  TreasuryAdjustmentAlreadyReversedError,
  TreasuryAdjustmentApprovalIncompleteError,
  TreasuryAdjustmentNotFoundError,
  TreasuryAdjustmentNotReadyToPostError,
  TreasuryAdjustmentPostingPeriodClosedError,
  TreasuryAdjustmentPostingPeriodUnderReviewError,
  TreasuryAdjustmentStaleVersionError,
  TreasuryAdjustmentValidationFailedError,
} from '../treasury-adjustment.errors.js'
import type { TreasuryAdjustmentCalculationResult, TreasuryAdjustmentWithLines } from '../treasury-adjustment.types.js'

export interface ValidatedTreasuryAdjustmentAction {
  adjustment: TreasuryAdjustmentWithLines
  calc: TreasuryAdjustmentCalculationResult
  financialYearId: string
  postingDate: string
}

async function assertApprovalState(adjustment: TreasuryAdjustmentWithLines): Promise<void> {
  if (!adjustment.approvalRequired) {
    const pending = await prisma.financeApprovalRequest.findFirst({
      where: { tenantId: adjustment.tenantId, legalEntityId: adjustment.legalEntityId, documentType: 'TREASURY_ADJUSTMENT', documentId: adjustment.id, status: 'PENDING' },
    })
    if (pending) throw new TreasuryAdjustmentApprovalIncompleteError('A pending approval request exists for this treasury adjustment')
    return
  }
  if (!adjustment.approvalRequestId) throw new TreasuryAdjustmentApprovalIncompleteError()
  const approval = await prisma.financeApprovalRequest.findFirst({
    where: { id: adjustment.approvalRequestId, tenantId: adjustment.tenantId, documentType: 'TREASURY_ADJUSTMENT', documentId: adjustment.id },
  })
  if (!approval) throw new TreasuryAdjustmentApprovalIncompleteError()
  if (approval.status !== 'APPROVED') throw new TreasuryAdjustmentApprovalIncompleteError(`Approval request status is ${approval.status}`)
}

async function resolvePeriodOrThrow(tenantId: string, legalEntityId: string, postingDate: string) {
  try {
    return await resolvePostingPeriod(tenantId, legalEntityId, postingDate)
  } catch (error) {
    if (error instanceof PostingError) {
      if (error.code === 'ACCOUNTING_PERIOD_CLOSED' || error.code === 'BACKDATED_POSTING_NOT_ALLOWED') {
        throw new TreasuryAdjustmentPostingPeriodClosedError(error.message)
      }
      if (error.code === 'ACCOUNTING_PERIOD_UNDER_REVIEW') {
        throw new TreasuryAdjustmentPostingPeriodUnderReviewError(error.message)
      }
    }
    throw error
  }
}

/** Shared pre-post checks for the READY_TO_POST → POSTED transition. */
export async function validateTreasuryAdjustmentForPostAction(
  tenantId: string,
  adjustmentId: string,
  expectedUpdatedAt: string,
  postingDate: string,
): Promise<ValidatedTreasuryAdjustmentAction> {
  let adjustment: TreasuryAdjustmentWithLines
  try {
    adjustment = await repo.findTreasuryAdjustmentByIdOrThrow(tenantId, adjustmentId)
  } catch {
    throw new TreasuryAdjustmentNotFoundError()
  }

  if (adjustment.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) {
    throw new TreasuryAdjustmentStaleVersionError()
  }
  if (adjustment.status === 'POSTED') throw new TreasuryAdjustmentAlreadyPostedError()
  if (adjustment.status === 'REVERSED') throw new TreasuryAdjustmentAlreadyReversedError()
  if (adjustment.status !== 'READY_TO_POST') throw new TreasuryAdjustmentNotReadyToPostError()
  if (adjustment.voucherId) throw new TreasuryAdjustmentAccountingAlreadyLinkedError()

  await getLegalEntityOrThrow(tenantId, adjustment.legalEntityId)
  await assertApprovalState(adjustment)

  const calc = await recalculateTreasuryAdjustment(tenantId, adjustment)
  if (!calc.validation.isValid) {
    throw new TreasuryAdjustmentValidationFailedError(
      calc.validation.errors[0]?.message ?? 'Treasury adjustment failed fresh validation',
      calc.validation.errors.map((e) => ({ field: e.field ?? 'adjustment', message: e.message })),
    )
  }

  const resolvedPeriod = await resolvePeriodOrThrow(tenantId, adjustment.legalEntityId, postingDate)
  return { adjustment, calc, financialYearId: resolvedPeriod.financialYear.id, postingDate }
}
