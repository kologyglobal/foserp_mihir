import type { Request } from 'express'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import { AuthorizationError } from '../../../utils/errors.js'
import { divide, formatForPersistence, multiply } from '../shared/finance-decimal.js'
import { parseDateOnly } from '../shared/finance.helpers.js'
import { buildPostedResult, post } from '../posting/posting.service.js'
import type { PostingContext, PostingRequest } from '../posting/posting.types.js'
import {
  FixedAssetInvalidStatusError,
  FixedAssetValidationFailedError,
  mapPostingErrorToFixedAssetError,
} from './fixed-assets.errors.js'
import * as repo from './fixed-assets.repository.js'
import { buildCapitalizeEventKey } from './fixed-asset-number.service.js'
import { serializeAsset } from './fixed-asset-serialize.js'
import type { CapitalizeFixedAssetInput } from './fixed-assets.schemas.js'
import type { FixedAssetCapitalizeResultDto } from './fixed-assets.types.js'

function hasPerm(req: Request, permission: string): boolean {
  const perms = req.context?.permissions ?? []
  return perms.includes('tenant.manage') || perms.includes(permission)
}

function assertCapitalizePermission(req: Request): void {
  if (!hasPerm(req, 'finance.fa.capitalize')) {
    throw new AuthorizationError('Missing permission: finance.fa.capitalize')
  }
}

function computeCapitalizationResidual(acquisitionCost: string, residualPercent: string): string {
  const residual = multiply(acquisitionCost, divide(residualPercent, '100'))
  return formatForPersistence(residual, 4)
}

function buildCapitalizePostingRequest(args: {
  assetId: string
  legalEntityId: string
  assetNumber: string
  assetName: string
  acquisitionCost: string
  assetAccountId: string
  creditAccountId?: string
  postingDate: string
  capitalizationDate: string
}): PostingRequest {
  const amount = formatForPersistence(args.acquisitionCost, 4)
  return {
    legalEntityId: args.legalEntityId,
    eventKey: buildCapitalizeEventKey(args.assetId),
    eventType: 'FIXED_ASSET_CAPITALIZED',
    postingPurpose: 'SYSTEM_DOCUMENT',
    voucherType: 'SYSTEM',
    documentDate: args.capitalizationDate,
    postingDate: args.postingDate,
    referenceNumber: args.assetNumber,
    narration: `Capitalize fixed asset ${args.assetNumber} — ${args.assetName}`,
    sourceModule: 'FIXED_ASSETS',
    sourceDocumentType: 'FIXED_ASSET',
    sourceDocumentId: args.assetId,
    lines: [
      {
        lineNumber: 1,
        accountId: args.assetAccountId,
        debitAmount: amount,
        creditAmount: '0',
        lineNarration: `Capitalize ${args.assetName}`,
      },
      {
        lineNumber: 2,
        ...(args.creditAccountId
          ? { accountId: args.creditAccountId }
          : { accountMappingKey: 'FIXED_ASSET_CLEARING' }),
        debitAmount: '0',
        creditAmount: amount,
        lineNarration: `Capitalize ${args.assetName}`,
      },
    ],
  }
}

export async function capitalizeAsset(
  req: Request,
  tenantId: string,
  assetId: string,
  body: CapitalizeFixedAssetInput,
): Promise<FixedAssetCapitalizeResultDto> {
  assertCapitalizePermission(req)
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')
  const audit = auditFromRequest(req)

  const asset = await repo.findAssetByIdOrThrow(tenantId, assetId)

  if (asset.status === 'ACTIVE' && asset.capitalizationPostingEventId && asset.capitalizationVoucherId) {
    const posting = await buildPostedResult(
      tenantId,
      asset.capitalizationPostingEventId,
      asset.capitalizationVoucherId,
      true,
    )
    return { asset: serializeAsset(asset, req), posting, idempotentReplay: true }
  }

  if (asset.status !== 'DRAFT' && asset.status !== 'PENDING_CAPITALIZATION') {
    throw new FixedAssetInvalidStatusError('Only draft or pending capitalization assets can be capitalized')
  }

  const postingDate = body.postingDate ?? new Date().toISOString().slice(0, 10)
  const capitalizationDate = postingDate

  if (body.creditAccountId) {
    const creditAccount = await repo.findAccountInLegalEntity(tenantId, asset.legalEntityId, body.creditAccountId)
    if (!creditAccount || creditAccount.isGroup || !creditAccount.isActive) {
      throw new FixedAssetValidationFailedError('Credit account is invalid for capitalization')
    }
  } else {
    const clearing = await repo.findDefaultMappingAccount(tenantId, asset.legalEntityId, 'FIXED_ASSET_CLEARING')
    if (!clearing) {
      throw new FixedAssetValidationFailedError('FIXED_ASSET_CLEARING default account mapping is not configured')
    }
  }

  const residualValue = computeCapitalizationResidual(
    asset.acquisitionCost.toString(),
    asset.category.residualPercent.toString(),
  )
  const netBookValue = formatForPersistence(asset.acquisitionCost, 4)

  const postingRequest = buildCapitalizePostingRequest({
    assetId: asset.id,
    legalEntityId: asset.legalEntityId,
    assetNumber: asset.assetNumber,
    assetName: asset.name,
    acquisitionCost: asset.acquisitionCost.toString(),
    assetAccountId: asset.category.assetAccountId,
    creditAccountId: body.creditAccountId,
    postingDate,
    capitalizationDate,
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
      afterAccounting: async ({ tx, context, eventId, voucherId }) => {
        await repo.finalizeAssetCapitalization(
          {
            tenantId: context.tenantId,
            assetId,
            fromStatuses: ['DRAFT', 'PENDING_CAPITALIZATION'],
            capitalizationDate: parseDateOnly(capitalizationDate),
            residualValue,
            netBookValue,
            voucherId,
            postingEventId: eventId,
            userId: context.userId ?? userId,
            expectedUpdatedAt: body.expectedUpdatedAt,
          },
          tx,
        )
      },
    })

    if (!posting.idempotentReplay) {
      await createAuditLog({
        tenantId,
        userId,
        module: 'finance',
        entity: 'fixed_asset',
        entityId: assetId,
        action: 'FIXED_ASSET_CAPITALIZED',
        newValues: { voucherNumber: posting.voucherNumber, postingEventId: posting.postingEventId },
        ipAddress: audit.ipAddress ?? null,
        userAgent: audit.userAgent ?? null,
      })
    }

    const refreshed = await repo.findAssetByIdOrThrow(tenantId, assetId)
    return { asset: serializeAsset(refreshed, req), posting, idempotentReplay: posting.idempotentReplay }
  } catch (error) {
    mapPostingErrorToFixedAssetError(error)
  }
}
