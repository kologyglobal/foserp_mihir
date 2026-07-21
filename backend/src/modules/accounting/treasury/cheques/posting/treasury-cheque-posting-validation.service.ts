import { prisma } from '../../../../../config/database.js'
import { getLegalEntityOrThrow } from '../../../shared/finance.helpers.js'
import { resolvePostingPeriod } from '../../../posting/posting-period.service.js'
import { PostingError } from '../../../posting/posting.errors.js'
import { recalculateTreasuryCheque } from '../treasury-cheque-draft.service.js'
import * as repo from '../treasury-cheque.repository.js'
import {
  TreasuryChequeAccountingAlreadyLinkedError,
  TreasuryChequeAlreadyPostedError,
  TreasuryChequeAlreadyReversedError,
  TreasuryChequeApprovalIncompleteError,
  TreasuryChequeNotFoundError,
  TreasuryChequeNotReadyToPostError,
  TreasuryChequePostingPeriodClosedError,
  TreasuryChequePostingPeriodUnderReviewError,
  TreasuryChequeStaleVersionError,
  TreasuryChequeValidationFailedError,
  TreasuryChequeWrongDirectionError,
} from '../treasury-cheque.errors.js'
import type { TreasuryChequeCalculationResult, TreasuryChequeRow } from '../treasury-cheque.types.js'

export interface ValidatedTreasuryChequeAction {
  cheque: TreasuryChequeRow
  calc: TreasuryChequeCalculationResult
  financialYearId: string
  postingDate: string
}

async function assertApprovalState(cheque: TreasuryChequeRow): Promise<void> {
  if (!cheque.approvalRequired) {
    const pending = await prisma.financeApprovalRequest.findFirst({
      where: { tenantId: cheque.tenantId, legalEntityId: cheque.legalEntityId, documentType: 'TREASURY_CHEQUE', documentId: cheque.id, status: 'PENDING' },
    })
    if (pending) throw new TreasuryChequeApprovalIncompleteError('A pending approval request exists for this cheque')
    return
  }
  if (!cheque.approvalRequestId) throw new TreasuryChequeApprovalIncompleteError()
  const approval = await prisma.financeApprovalRequest.findFirst({
    where: { id: cheque.approvalRequestId, tenantId: cheque.tenantId, documentType: 'TREASURY_CHEQUE', documentId: cheque.id },
  })
  if (!approval) throw new TreasuryChequeApprovalIncompleteError()
  if (approval.status !== 'APPROVED') throw new TreasuryChequeApprovalIncompleteError(`Approval request status is ${approval.status}`)
}

async function resolvePeriodOrThrow(tenantId: string, legalEntityId: string, postingDate: string) {
  try {
    return await resolvePostingPeriod(tenantId, legalEntityId, postingDate)
  } catch (error) {
    if (error instanceof PostingError) {
      if (error.code === 'ACCOUNTING_PERIOD_CLOSED' || error.code === 'BACKDATED_POSTING_NOT_ALLOWED') {
        throw new TreasuryChequePostingPeriodClosedError(error.message)
      }
      if (error.code === 'ACCOUNTING_PERIOD_UNDER_REVIEW') {
        throw new TreasuryChequePostingPeriodUnderReviewError(error.message)
      }
    }
    throw error
  }
}

/** Shared pre-post checks for the READY → (issue | deposit) transitions. */
export async function validateTreasuryChequeForReadyToPostAction(
  tenantId: string,
  chequeId: string,
  expectedUpdatedAt: string,
  expectedDirection: 'ISSUED' | 'RECEIVED',
  postingDate: string,
): Promise<ValidatedTreasuryChequeAction> {
  let cheque: TreasuryChequeRow
  try {
    cheque = await repo.findTreasuryChequeByIdOrThrow(tenantId, chequeId)
  } catch {
    throw new TreasuryChequeNotFoundError()
  }

  if (cheque.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) {
    throw new TreasuryChequeStaleVersionError()
  }
  if (['ISSUED', 'DEPOSITED', 'CLEARED', 'BOUNCED', 'STOPPED', 'REVERSED'].includes(cheque.status)) {
    throw new TreasuryChequeAlreadyPostedError()
  }
  if (cheque.status !== 'READY') {
    throw new TreasuryChequeNotReadyToPostError()
  }
  if (cheque.direction !== expectedDirection) {
    throw new TreasuryChequeWrongDirectionError(
      `Cheque direction is ${cheque.direction}; this action requires ${expectedDirection}`,
    )
  }
  if (cheque.voucherId || cheque.chequeRegisterNumber) {
    throw new TreasuryChequeAccountingAlreadyLinkedError()
  }
  if (cheque.reversedAt) {
    throw new TreasuryChequeAlreadyReversedError()
  }

  await getLegalEntityOrThrow(tenantId, cheque.legalEntityId)
  await assertApprovalState(cheque)

  const calc = await recalculateTreasuryCheque(tenantId, cheque)
  if (!calc.validation.isValid) {
    throw new TreasuryChequeValidationFailedError(
      calc.validation.errors[0]?.message ?? 'Treasury cheque failed fresh validation',
      calc.validation.errors.map((e) => ({ field: e.field ?? 'cheque', message: e.message })),
    )
  }
  if (!calc.isTrackOnly && !calc.counterpart.counterpartGlAccountId) {
    throw new TreasuryChequeValidationFailedError('No counterpart GL account is resolved for this cheque')
  }

  const resolvedPeriod = await resolvePeriodOrThrow(tenantId, cheque.legalEntityId, postingDate)
  return { cheque, calc, financialYearId: resolvedPeriod.financialYear.id, postingDate }
}
