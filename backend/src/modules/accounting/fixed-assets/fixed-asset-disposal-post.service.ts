import type { Request } from 'express'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import { AuthorizationError } from '../../../utils/errors.js'
import { parseDateOnly } from '../shared/finance.helpers.js'
import { buildPostedResult, post } from '../posting/posting.service.js'
import type { PostingContext } from '../posting/posting.types.js'
import { nextDisposalNumber } from './fixed-asset-number.service.js'
import * as assetRepo from './fixed-assets.repository.js'
import * as repo from './fixed-asset-disposal.repository.js'
import { buildDisposeEventKey, buildDisposePostingRequest } from './fixed-asset-disposal-posting-builder.service.js'
import { validateFixedAssetDisposalForPostAction } from './fixed-asset-disposal-posting-validation.service.js'
import { FixedAssetDisposalConcurrentPostError, mapPostingErrorToFixedAssetDisposalError } from './fixed-asset-disposal.errors.js'
import { serializeFixedAssetDisposal } from './fixed-asset-disposal-read.service.js'
import type { PostFixedAssetDisposalInput } from './fixed-assets.schemas.js'

function hasPerm(req: Request, permission: string): boolean {
  const perms = req.context?.permissions ?? []
  return perms.includes('tenant.manage') || perms.includes(permission)
}

export function assertPostPermission(req: Request): void {
  if (!hasPerm(req, 'finance.fa.dispose')) {
    throw new AuthorizationError('Missing permission: finance.fa.dispose')
  }
}

/** READY_TO_POST → POSTED. Posts the disposal JE and finalizes the asset via the central posting engine. */
export async function postFixedAssetDisposal(req: Request, tenantId: string, disposalId: string, body: PostFixedAssetDisposalInput) {
  assertPostPermission(req)
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')
  const audit = auditFromRequest(req)

  const existing = await repo.findDisposalByIdOrThrow(tenantId, disposalId)
  if (existing.status === 'POSTED') {
    if (existing.postingEventId && existing.voucherId) {
      const posting = await buildPostedResult(tenantId, existing.postingEventId, existing.voucherId, true)
      return { disposal: await serializeFixedAssetDisposal(req, existing), posting, idempotentReplay: true }
    }
    return { disposal: await serializeFixedAssetDisposal(req, existing), posting: null, idempotentReplay: true }
  }

  const postingDate = body.postingDate ?? new Date().toISOString().slice(0, 10)
  const validated = await validateFixedAssetDisposalForPostAction(tenantId, disposalId, body.expectedUpdatedAt, postingDate)
  const { disposal, calc } = validated

  const postingRequest = buildDisposePostingRequest({
    disposalId,
    legalEntityId: disposal.legalEntityId,
    branchId: disposal.branchId,
    assetNumber: disposal.asset.assetNumber,
    assetName: disposal.asset.name,
    disposalNumber: disposal.disposalNumber ?? disposal.draftReference,
    disposalType: disposal.disposalType,
    disposalDate: disposal.disposalDate.toISOString().slice(0, 10),
    postingDate,
    currencyCode: disposal.currencyCode,
    lines: calc.accountingPreview.lines,
    eventKey: buildDisposeEventKey(disposalId),
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
      afterAccounting: async ({ tx, context: txContext, eventId, voucherId }) => {
        const disposalNumber = disposal.disposalNumber ?? (await nextDisposalNumber(tenantId, disposal.legalEntityId))

        const updated = await repo.finalizeDisposalLifecycleTransition(
          {
            tenantId: txContext.tenantId,
            disposalId,
            fromStatuses: ['READY_TO_POST'],
            toStatus: 'POSTED',
            expectedUpdatedAt: body.expectedUpdatedAt,
            data: {
              disposalNumber,
              postingDate: parseDateOnly(postingDate),
              voucherId,
              postingEventId: eventId,
              preDisposalAssetStatus: disposal.asset.status,
              postedAt: new Date(),
              postedById: txContext.userId ?? null,
              updatedById: txContext.userId ?? null,
              uniquenessKey: null,
            },
          },
          tx,
        )
        if (updated.count !== 1) throw new FixedAssetDisposalConcurrentPostError()

        await assetRepo.finalizeAssetDisposal(
          {
            tenantId: txContext.tenantId,
            assetId: disposal.assetId,
            fromStatuses: ['ACTIVE', 'IDLE', 'FULLY_DEPRECIATED'],
            disposalType: disposal.disposalType,
            disposalDate: disposal.disposalDate,
            disposalProceeds: calc.totalProceeds,
            disposalGainLoss: calc.gainLoss,
            disposalProceedsAccountId: calc.proceedsAccountId,
            disposalBuyerName: disposal.buyerName,
            disposalReason: disposal.reason,
            voucherId,
            postingEventId: eventId,
            userId: txContext.userId ?? userId,
            disposalDocumentId: disposalId,
          },
          tx,
        )
      },
    })

    if (posting.idempotentReplay) {
      const refreshed = await repo.findDisposalByIdOrThrow(tenantId, disposalId)
      return { disposal: await serializeFixedAssetDisposal(req, refreshed), posting, idempotentReplay: true }
    }

    await createAuditLog({
      tenantId,
      userId,
      module: 'finance',
      entity: 'fixed_asset_disposal',
      entityId: disposalId,
      action: 'FIXED_ASSET_DISPOSAL_POSTED',
      newValues: { voucherNumber: posting.voucherNumber, postingEventId: posting.postingEventId },
      ipAddress: audit.ipAddress ?? null,
      userAgent: audit.userAgent ?? null,
    })
    const refreshed = await repo.findDisposalByIdOrThrow(tenantId, disposalId)
    return { disposal: await serializeFixedAssetDisposal(req, refreshed), posting, idempotentReplay: false }
  } catch (error) {
    mapPostingErrorToFixedAssetDisposalError(error)
  }
}
