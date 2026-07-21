import { prisma } from '../../../config/database.js'
import { getLegalEntityOrThrow } from '../shared/finance.helpers.js'
import { resolvePostingPeriod } from '../posting/posting-period.service.js'
import { PostingError } from '../posting/posting.errors.js'
import { recalculateDisposal } from './fixed-asset-disposal-draft.service.js'
import * as repo from './fixed-asset-disposal.repository.js'
import {
  FixedAssetDisposalApprovalRequiredError,
  FixedAssetDisposalInvalidStatusError,
  FixedAssetDisposalNotFoundError,
  FixedAssetDisposalNotReadyError,
  FixedAssetDisposalPostingPeriodClosedError,
  FixedAssetDisposalStaleVersionError,
} from './fixed-asset-disposal.errors.js'
import type { FixedAssetDisposalCalculationResult, FixedAssetDisposalWithAsset } from './fixed-asset-disposal.types.js'

export interface ValidatedFixedAssetDisposalAction {
  disposal: FixedAssetDisposalWithAsset
  calc: FixedAssetDisposalCalculationResult
  financialYearId: string
  postingDate: string
}

async function assertApprovalState(disposal: FixedAssetDisposalWithAsset): Promise<void> {
  if (!disposal.approvalRequired) {
    const pending = await prisma.financeApprovalRequest.findFirst({
      where: { tenantId: disposal.tenantId, legalEntityId: disposal.legalEntityId, documentType: 'FIXED_ASSET_DISPOSAL', documentId: disposal.id, status: 'PENDING' },
    })
    if (pending) throw new FixedAssetDisposalApprovalRequiredError('A pending approval request exists for this disposal')
    return
  }
  if (!disposal.approvalRequestId) throw new FixedAssetDisposalApprovalRequiredError()
  const approval = await prisma.financeApprovalRequest.findFirst({
    where: { id: disposal.approvalRequestId, tenantId: disposal.tenantId, documentType: 'FIXED_ASSET_DISPOSAL', documentId: disposal.id },
  })
  if (!approval) throw new FixedAssetDisposalApprovalRequiredError()
  if (approval.status !== 'APPROVED') throw new FixedAssetDisposalApprovalRequiredError(`Approval request status is ${approval.status}`)
}

async function resolvePeriodOrThrow(tenantId: string, legalEntityId: string, postingDate: string) {
  try {
    return await resolvePostingPeriod(tenantId, legalEntityId, postingDate)
  } catch (error) {
    if (error instanceof PostingError) {
      if (error.code === 'ACCOUNTING_PERIOD_CLOSED' || error.code === 'BACKDATED_POSTING_NOT_ALLOWED' || error.code === 'ACCOUNTING_PERIOD_UNDER_REVIEW') {
        throw new FixedAssetDisposalPostingPeriodClosedError(error.message)
      }
    }
    throw error
  }
}

/** Shared pre-post checks for the READY_TO_POST → POSTED transition. */
export async function validateFixedAssetDisposalForPostAction(
  tenantId: string,
  disposalId: string,
  expectedUpdatedAt: string,
  postingDate: string,
): Promise<ValidatedFixedAssetDisposalAction> {
  let disposal: FixedAssetDisposalWithAsset
  try {
    disposal = await repo.findDisposalByIdOrThrow(tenantId, disposalId)
  } catch {
    throw new FixedAssetDisposalNotFoundError()
  }

  if (disposal.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) {
    throw new FixedAssetDisposalStaleVersionError()
  }
  if (disposal.status !== 'READY_TO_POST') throw new FixedAssetDisposalInvalidStatusError('Disposal is not ready to post')
  if (disposal.voucherId) throw new FixedAssetDisposalInvalidStatusError('Disposal is already linked to accounting')

  await getLegalEntityOrThrow(tenantId, disposal.legalEntityId)
  await assertApprovalState(disposal)

  const calc = await recalculateDisposal(tenantId, disposal)
  if (!calc.validation.isValid) {
    throw new FixedAssetDisposalNotReadyError(
      calc.validation.errors[0]?.message ?? 'Fixed asset disposal failed fresh validation',
      calc.validation.errors.map((e) => ({ field: e.field ?? 'disposal', message: e.message })),
    )
  }

  const resolvedPeriod = await resolvePeriodOrThrow(tenantId, disposal.legalEntityId, postingDate)
  return { disposal, calc, financialYearId: resolvedPeriod.financialYear.id, postingDate }
}
