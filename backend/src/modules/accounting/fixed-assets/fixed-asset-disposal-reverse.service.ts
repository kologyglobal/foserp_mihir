import type { Request } from 'express'
import { prisma } from '../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import { AuthorizationError } from '../../../utils/errors.js'
import { validateReversalEligibility } from '../ledger/ledger.validators.js'
import { post } from '../posting/posting.service.js'
import type { PostingContext } from '../posting/posting.types.js'
import { parseDateOnly } from '../shared/finance.helpers.js'
import * as assetRepo from './fixed-assets.repository.js'
import * as repo from './fixed-asset-disposal.repository.js'
import { buildDisposeReversalEventKey, buildDisposeReversalRequest } from './fixed-asset-disposal-posting-builder.service.js'
import {
  FixedAssetDisposalActiveReconciliationMatchError,
  FixedAssetDisposalConcurrentPostError,
  FixedAssetDisposalReversalNotAllowedError,
  FixedAssetDisposalReversalNotEligibleError,
  mapPostingErrorToFixedAssetDisposalReversalError,
} from './fixed-asset-disposal.errors.js'
import { serializeFixedAssetDisposal } from './fixed-asset-disposal-read.service.js'
import type { ReverseFixedAssetDisposalInput } from './fixed-assets.schemas.js'

function hasPerm(req: Request, permission: string): boolean {
  const perms = req.context?.permissions ?? []
  return perms.includes('tenant.manage') || perms.includes(permission)
}

export function assertReversePermission(req: Request): void {
  if (!hasPerm(req, 'finance.fa.dispose.reverse')) {
    throw new FixedAssetDisposalReversalNotAllowedError()
  }
}

/** Blocks reversal while an ACTIVE bank reconciliation match still references the disposal voucher's GL entries. */
async function findActiveBankReconLock(tenantId: string, voucherId: string | null): Promise<string | null> {
  if (!voucherId) return null
  const glEntries = await prisma.generalLedgerEntry.findMany({
    where: { tenantId, voucherId },
    select: { id: true },
  })
  if (glEntries.length === 0) return null

  const activeAllocation = await prisma.bankReconciliationLedgerAllocation.findFirst({
    where: {
      tenantId,
      generalLedgerEntryId: { in: glEntries.map((e) => e.id) },
      reconciliationMatch: { matchStatus: 'ACTIVE' },
    },
    select: { reconciliationMatchId: true },
  })
  return activeAllocation?.reconciliationMatchId ?? null
}

export async function reverseFixedAssetDisposal(
  req: Request,
  tenantId: string,
  disposalId: string,
  body: ReverseFixedAssetDisposalInput,
) {
  assertReversePermission(req)
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')
  const audit = auditFromRequest(req)

  const disposal = await repo.findDisposalByIdOrThrow(tenantId, disposalId)

  if (disposal.status === 'REVERSED') {
    return { disposal: await serializeFixedAssetDisposal(req, disposal), idempotentReplay: true }
  }
  if (disposal.status !== 'POSTED') {
    throw new FixedAssetDisposalReversalNotEligibleError(`Disposal must be POSTED to reverse (current status: ${disposal.status})`)
  }
  repo.assertExpectedUpdatedAt(disposal, body.expectedUpdatedAt)
  if (!disposal.voucherId) throw new FixedAssetDisposalReversalNotEligibleError('Original disposal voucher is missing')

  const lockedMatchId = await findActiveBankReconLock(tenantId, disposal.voucherId)
  if (lockedMatchId) throw new FixedAssetDisposalActiveReconciliationMatchError()

  const reversalDateValue = parseDateOnly(body.reversalDate)
  if (disposal.postingDate && reversalDateValue < disposal.postingDate) {
    throw new FixedAssetDisposalReversalNotEligibleError('Reversal date must not precede the original posting date')
  }

  const originalVoucher = await prisma.accountingVoucher.findFirst({ where: { id: disposal.voucherId, tenantId } })
  if (!originalVoucher) throw new FixedAssetDisposalReversalNotEligibleError('Original voucher is missing')
  if (originalVoucher.status !== 'POSTED' || originalVoucher.reversedByVoucherId) {
    throw new FixedAssetDisposalReversalNotEligibleError('Original voucher has already been reversed or is not posted')
  }
  const lines = await prisma.accountingVoucherLine.findMany({ where: { voucherId: disposal.voucherId, tenantId } })

  const postingRequest = buildDisposeReversalRequest({
    disposalId,
    legalEntityId: disposal.legalEntityId,
    disposalNumber: disposal.disposalNumber,
    originalVoucher,
    lines,
    eventKey: buildDisposeReversalEventKey(disposalId),
    reversalDate: body.reversalDate,
    reason: body.reason,
  })

  const postingContext: PostingContext = {
    tenantId,
    userId,
    authorization: { permissionChecked: true },
    workflow: { workflowSatisfied: true },
    ipAddress: audit.ipAddress ?? null,
    userAgent: audit.userAgent ?? null,
  }

  try {
    const posting = await post(postingRequest, postingContext, {
      afterAccounting: async ({ tx, context: txContext, eventId, voucherId: reversalVoucherId }) => {
        const eligibility = validateReversalEligibility(originalVoucher, reversalVoucherId, txContext.tenantId, disposal.legalEntityId)
        if (!eligibility.valid) {
          throw new FixedAssetDisposalReversalNotEligibleError(eligibility.errors.map((e) => e.message).join('; '))
        }

        const linked = await tx.accountingVoucher.updateMany({
          where: { id: originalVoucher.id, tenantId: txContext.tenantId, status: 'POSTED', reversedByVoucherId: null },
          data: { status: 'REVERSED', reversedByVoucherId: reversalVoucherId, reversedAt: new Date(), reversedBy: txContext.userId ?? null, reversalReason: body.reason },
        })
        if (linked.count !== 1) throw new FixedAssetDisposalConcurrentPostError()
        await tx.accountingVoucher.update({
          where: { id: reversalVoucherId, tenantId: txContext.tenantId },
          data: { reversalOfVoucherId: originalVoucher.id, reversalReason: body.reason },
        })

        const updated = await repo.finalizeDisposalLifecycleTransition(
          {
            tenantId: txContext.tenantId,
            disposalId,
            fromStatuses: ['POSTED'],
            toStatus: 'REVERSED',
            expectedUpdatedAt: body.expectedUpdatedAt,
            data: {
              reversalVoucherId: reversalVoucherId,
              reversalPostingEventId: eventId,
              reversalDate: reversalDateValue,
              reversalReason: body.reason,
              reversedAt: new Date(),
              reversedById: txContext.userId ?? null,
              updatedById: txContext.userId ?? null,
              uniquenessKey: null,
            },
          },
          tx,
        )
        if (updated.count !== 1) throw new FixedAssetDisposalConcurrentPostError()

        if (disposal.preDisposalAssetStatus) {
          await assetRepo.restoreAssetFromDisposalReversal(
            {
              tenantId: txContext.tenantId,
              assetId: disposal.assetId,
              disposalDocumentId: disposalId,
              restoreStatus: disposal.preDisposalAssetStatus,
              acquisitionCost: disposal.acquisitionCostSnapshot?.toString() ?? disposal.asset.acquisitionCost.toString(),
              accumulatedDepreciation: disposal.accumulatedDepreciationSnapshot?.toString() ?? '0',
              netBookValue: disposal.netBookValueSnapshot?.toString() ?? '0',
              userId: txContext.userId ?? userId,
            },
            tx,
          )
        }
      },
    })

    if (posting.idempotentReplay) {
      const refreshed = await repo.findDisposalByIdOrThrow(tenantId, disposalId)
      return { disposal: await serializeFixedAssetDisposal(req, refreshed), idempotentReplay: true }
    }

    await createAuditLog({
      tenantId,
      userId,
      module: 'finance',
      entity: 'fixed_asset_disposal',
      entityId: disposalId,
      action: 'FIXED_ASSET_DISPOSAL_REVERSED',
      newValues: { reason: body.reason, reversalDate: body.reversalDate },
      ipAddress: audit.ipAddress ?? null,
      userAgent: audit.userAgent ?? null,
    })

    const refreshed = await repo.findDisposalByIdOrThrow(tenantId, disposalId)
    return { disposal: await serializeFixedAssetDisposal(req, refreshed), idempotentReplay: false }
  } catch (error) {
    mapPostingErrorToFixedAssetDisposalReversalError(error)
  }
}
