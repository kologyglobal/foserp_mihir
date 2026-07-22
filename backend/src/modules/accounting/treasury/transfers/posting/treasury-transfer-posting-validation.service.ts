import { prisma } from '../../../../../config/database.js'
import { getLegalEntityOrThrow } from '../../../shared/finance.helpers.js'
import { resolvePostingPeriod } from '../../../posting/posting-period.service.js'
import { PostingError } from '../../../posting/posting.errors.js'
import { recalculateTreasuryTransfer } from '../treasury-transfer-draft.service.js'
import * as repo from '../treasury-transfer.repository.js'
import {
  TreasuryTransferAccountingAlreadyLinkedError,
  TreasuryTransferAlreadyPostedError,
  TreasuryTransferAlreadyReversedError,
  TreasuryTransferApprovalIncompleteError,
  TreasuryTransferBalanceBlockedError,
  TreasuryTransferNotFoundError,
  TreasuryTransferNotInTransitError,
  TreasuryTransferNotReadyToPostError,
  TreasuryTransferPostingPeriodClosedError,
  TreasuryTransferPostingPeriodUnderReviewError,
  TreasuryTransferStaleVersionError,
  TreasuryTransferValidationFailedError,
  TreasuryTransferWrongPostingModeError,
} from '../treasury-transfer.errors.js'
import type { TreasuryTransferCalculationResult } from '../treasury-transfer.types.js'
import type { TreasuryTransferRow } from '../treasury-transfer.types.js'

export interface ValidatedTreasuryTransferAction {
  transfer: TreasuryTransferRow
  calc: TreasuryTransferCalculationResult
  financialYearId: string
  postingDate: string
}

async function assertApprovalState(transfer: TreasuryTransferRow): Promise<void> {
  if (!transfer.approvalRequired) {
    const pending = await prisma.financeApprovalRequest.findFirst({
      where: {
        tenantId: transfer.tenantId,
        legalEntityId: transfer.legalEntityId,
        documentType: 'TREASURY_TRANSFER',
        documentId: transfer.id,
        status: 'PENDING',
      },
    })
    if (pending) throw new TreasuryTransferApprovalIncompleteError('A pending approval request exists for this transfer')
    return
  }
  if (!transfer.approvalRequestId) throw new TreasuryTransferApprovalIncompleteError()

  const approval = await prisma.financeApprovalRequest.findFirst({
    where: {
      id: transfer.approvalRequestId,
      tenantId: transfer.tenantId,
      documentType: 'TREASURY_TRANSFER',
      documentId: transfer.id,
    },
  })
  if (!approval) throw new TreasuryTransferApprovalIncompleteError()
  if (approval.status !== 'APPROVED') {
    throw new TreasuryTransferApprovalIncompleteError(`Approval request status is ${approval.status}`)
  }
}

async function resolvePeriodOrThrow(tenantId: string, legalEntityId: string, postingDate: string) {
  try {
    return await resolvePostingPeriod(tenantId, legalEntityId, postingDate)
  } catch (error) {
    if (error instanceof PostingError) {
      if (error.code === 'ACCOUNTING_PERIOD_CLOSED' || error.code === 'BACKDATED_POSTING_NOT_ALLOWED') {
        throw new TreasuryTransferPostingPeriodClosedError(error.message)
      }
      if (error.code === 'ACCOUNTING_PERIOD_UNDER_REVIEW') {
        throw new TreasuryTransferPostingPeriodUnderReviewError(error.message)
      }
    }
    throw error
  }
}

/** Shared pre-post checks for the READY_TO_POST → (direct post | dispatch) transitions. */
export async function validateTreasuryTransferForReadyToPostAction(
  tenantId: string,
  transferId: string,
  expectedUpdatedAt: string,
  expectedPostingMode: 'DIRECT' | 'IN_TRANSIT',
): Promise<ValidatedTreasuryTransferAction> {
  let transfer: TreasuryTransferRow
  try {
    transfer = await repo.findTreasuryTransferByIdOrThrow(tenantId, transferId)
  } catch {
    throw new TreasuryTransferNotFoundError()
  }

  if (transfer.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) {
    throw new TreasuryTransferStaleVersionError()
  }
  if (transfer.status === 'COMPLETED' || transfer.status === 'IN_TRANSIT') {
    throw new TreasuryTransferAlreadyPostedError()
  }
  if (transfer.status !== 'READY_TO_POST') {
    throw new TreasuryTransferNotReadyToPostError()
  }
  if (transfer.postingMode !== expectedPostingMode) {
    throw new TreasuryTransferWrongPostingModeError(
      `Transfer posting mode is ${transfer.postingMode}, expected ${expectedPostingMode}`,
    )
  }
  if (transfer.transferNumber || transfer.sourceVoucherId) {
    throw new TreasuryTransferAccountingAlreadyLinkedError()
  }
  if (transfer.reversedAt) {
    throw new TreasuryTransferAlreadyReversedError()
  }

  await getLegalEntityOrThrow(tenantId, transfer.legalEntityId)
  await assertApprovalState(transfer)

  const calc = await recalculateTreasuryTransfer(tenantId, transfer)
  if (!calc.validation.isValid) {
    throw new TreasuryTransferValidationFailedError(
      calc.validation.errors[0]?.message ?? 'Treasury transfer failed fresh validation',
      calc.validation.errors.map((e) => ({ field: e.field ?? 'transfer', message: e.message })),
    )
  }
  if (calc.balanceCheck.isBlocking) {
    throw new TreasuryTransferBalanceBlockedError(calc.balanceCheck.warnings[0] ?? undefined)
  }

  const postingDate = transfer.sourcePostingDate.toISOString().slice(0, 10)
  const resolvedPeriod = await resolvePeriodOrThrow(tenantId, transfer.legalEntityId, postingDate)

  return { transfer, calc, financialYearId: resolvedPeriod.financialYear.id, postingDate }
}

/** Shared pre-post checks for the IN_TRANSIT → receive transition. */
export async function validateTreasuryTransferForReceiveAction(
  tenantId: string,
  transferId: string,
  expectedUpdatedAt: string,
): Promise<ValidatedTreasuryTransferAction> {
  let transfer: TreasuryTransferRow
  try {
    transfer = await repo.findTreasuryTransferByIdOrThrow(tenantId, transferId)
  } catch {
    throw new TreasuryTransferNotFoundError()
  }

  if (transfer.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) {
    throw new TreasuryTransferStaleVersionError()
  }
  if (transfer.status === 'COMPLETED') {
    throw new TreasuryTransferAlreadyPostedError()
  }
  if (transfer.status !== 'IN_TRANSIT') {
    throw new TreasuryTransferNotInTransitError()
  }
  if (!transfer.transferNumber || !transfer.sourceVoucherId) {
    throw new TreasuryTransferNotReadyToPostError('Transfer has not been dispatched yet')
  }
  if (transfer.destinationVoucherId) {
    throw new TreasuryTransferAccountingAlreadyLinkedError()
  }
  if (transfer.reversedAt) {
    throw new TreasuryTransferAlreadyReversedError()
  }

  await getLegalEntityOrThrow(tenantId, transfer.legalEntityId)

  const calc = await recalculateTreasuryTransfer(tenantId, transfer)

  const postingDate = transfer.destinationPostingDate
    ? transfer.destinationPostingDate.toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10)
  const resolvedPeriod = await resolvePeriodOrThrow(tenantId, transfer.legalEntityId, postingDate)

  return { transfer, calc, financialYearId: resolvedPeriod.financialYear.id, postingDate }
}
