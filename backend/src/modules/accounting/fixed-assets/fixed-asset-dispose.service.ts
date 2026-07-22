import type { Request } from 'express'
import type { FixedAsset, FixedAssetCategory, FixedAssetDisposalType } from '@prisma/client'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import { AuthorizationError } from '../../../utils/errors.js'
import { compare, divide, formatForPersistence, multiply, subtract } from '../shared/finance-decimal.js'
import { parseDateOnly } from '../shared/finance.helpers.js'
import { buildPostedResult, post } from '../posting/posting.service.js'
import type { PostingContext, PostingRequest, PostingRequestLine } from '../posting/posting.types.js'
import {
  FixedAssetInvalidStatusError,
  FixedAssetValidationFailedError,
  mapPostingErrorToFixedAssetError,
} from './fixed-assets.errors.js'
import * as repo from './fixed-assets.repository.js'
import { buildPartialDisposeEventKey, nextDisposalNumber } from './fixed-asset-number.service.js'
import { buildDisposeEventKeyForAsset } from './fixed-asset-disposal-posting-builder.service.js'
import { createFixedAssetDisposalDraft } from './fixed-asset-disposal-draft.service.js'
import { markFixedAssetDisposalReady } from './fixed-asset-disposal-workflow.service.js'
import { postFixedAssetDisposal } from './fixed-asset-disposal-post.service.js'
import type { CreateFixedAssetDisposalInput } from './fixed-assets.schemas.js'
import { serializeAsset } from './fixed-asset-serialize.js'
import type { DisposeFixedAssetInput, DisposePreviewInput } from './fixed-assets.schemas.js'
import type {
  FixedAssetDisposalPreviewDto,
  FixedAssetDisposalTypeApi,
  FixedAssetDisposeResultDto,
} from './fixed-assets.types.js'

const DISPOSABLE_STATUSES = ['ACTIVE', 'IDLE', 'FULLY_DEPRECIATED'] as const

const DISPOSAL_TYPE_LABELS: Record<FixedAssetDisposalType, FixedAssetDisposalTypeApi> = {
  SALE: 'Sale',
  SCRAP: 'Scrap',
  WRITE_OFF: 'Write-off',
}

function hasPerm(req: Request, permission: string): boolean {
  const perms = req.context?.permissions ?? []
  return perms.includes('tenant.manage') || perms.includes(permission)
}

function assertDisposePermission(req: Request): void {
  if (!hasPerm(req, 'finance.fa.dispose')) {
    throw new AuthorizationError('Missing permission: finance.fa.dispose')
  }
}

export function buildDisposalPreview(
  asset: FixedAsset & { category: Pick<FixedAssetCategory, 'name'> },
  disposalType: FixedAssetDisposalType,
  proceedsInput: string,
  disposeCostAmount?: string,
): FixedAssetDisposalPreviewDto {
  const proceeds = formatForPersistence(proceedsInput, 4)
  const fullCost = formatForPersistence(asset.acquisitionCost, 4)
  const fullAccum = formatForPersistence(asset.accumulatedDepreciation, 4)
  const fullNbv = formatForPersistence(asset.netBookValue, 4)

  const isPartial =
    !!disposeCostAmount &&
    compare(disposeCostAmount, '0') > 0 &&
    compare(disposeCostAmount, fullCost) < 0

  if (!isPartial) {
    const gainLoss = formatForPersistence(subtract(proceeds, fullNbv), 4)
    return {
      assetId: asset.id,
      assetNumber: asset.assetNumber,
      assetName: asset.name,
      disposalType: DISPOSAL_TYPE_LABELS[disposalType],
      acquisitionCost: fullCost,
      accumulatedDepreciation: fullAccum,
      netBookValue: fullNbv,
      proceeds,
      gainLoss,
      isGain: compare(gainLoss, '0') >= 0,
      currencyCode: asset.currencyCode,
      isPartial: false,
      disposeCostAmount: null,
      disposedAccumDep: fullAccum,
      disposedNbv: fullNbv,
      remainingCost: '0.0000',
      remainingNbv: '0.0000',
    }
  }

  const ratio = divide(disposeCostAmount!, fullCost)
  const disposedCost = formatForPersistence(disposeCostAmount!, 4)
  const disposedAccum = formatForPersistence(multiply(fullAccum, ratio), 4)
  const disposedNbv = formatForPersistence(subtract(disposedCost, disposedAccum), 4)
  const remainingCost = formatForPersistence(subtract(fullCost, disposedCost), 4)
  const remainingNbv = formatForPersistence(subtract(fullNbv, disposedNbv), 4)
  const gainLoss = formatForPersistence(subtract(proceeds, disposedNbv), 4)

  return {
    assetId: asset.id,
    assetNumber: asset.assetNumber,
    assetName: asset.name,
    disposalType: DISPOSAL_TYPE_LABELS[disposalType],
    acquisitionCost: fullCost,
    accumulatedDepreciation: fullAccum,
    netBookValue: fullNbv,
    proceeds,
    gainLoss,
    isGain: compare(gainLoss, '0') >= 0,
    currencyCode: asset.currencyCode,
    isPartial: true,
    disposeCostAmount: disposedCost,
    disposedAccumDep: disposedAccum,
    disposedNbv,
    remainingCost,
    remainingNbv,
  }
}

function buildDisposePostingRequest(args: {
  assetId: string
  legalEntityId: string
  assetNumber: string
  assetName: string
  acquisitionCost: string
  accumulatedDepreciation: string
  proceeds: string
  gainLoss: string
  assetAccountId: string
  accumDepAccountId: string
  proceedsAccountId?: string
  disposalDate: string
  postingDate: string
  disposalType: FixedAssetDisposalType
}): PostingRequest {
  const lines: PostingRequestLine[] = []
  let lineNumber = 1

  const accum = formatForPersistence(args.accumulatedDepreciation, 4)
  if (compare(accum, '0') > 0) {
    lines.push({
      lineNumber: lineNumber++,
      accountId: args.accumDepAccountId,
      debitAmount: accum,
      creditAmount: '0',
      lineNarration: `Clear accum. dep. — ${args.assetName}`,
    })
  }

  if (compare(args.proceeds, '0') > 0 && args.proceedsAccountId) {
    lines.push({
      lineNumber: lineNumber++,
      accountId: args.proceedsAccountId,
      debitAmount: formatForPersistence(args.proceeds, 4),
      creditAmount: '0',
      lineNarration: `Disposal proceeds — ${args.assetName}`,
    })
  }

  if (compare(args.gainLoss, '0') < 0) {
    lines.push({
      lineNumber: lineNumber++,
      accountMappingKey: 'ASSET_DISPOSAL_LOSS',
      debitAmount: formatForPersistence(subtract('0', args.gainLoss), 4),
      creditAmount: '0',
      lineNarration: `Loss on disposal — ${args.assetName}`,
    })
  }

  lines.push({
    lineNumber: lineNumber++,
    accountId: args.assetAccountId,
    debitAmount: '0',
    creditAmount: formatForPersistence(args.acquisitionCost, 4),
    lineNarration: `Remove asset cost — ${args.assetName}`,
  })

  if (compare(args.gainLoss, '0') > 0) {
    lines.push({
      lineNumber: lineNumber++,
      accountMappingKey: 'ASSET_DISPOSAL_GAIN',
      debitAmount: '0',
      creditAmount: formatForPersistence(args.gainLoss, 4),
      lineNarration: `Gain on disposal — ${args.assetName}`,
    })
  }

  return {
    legalEntityId: args.legalEntityId,
    eventKey: buildDisposeEventKeyForAsset(args.assetId),
    eventType: 'FIXED_ASSET_DISPOSED',
    postingPurpose: 'SYSTEM_DOCUMENT',
    voucherType: 'SYSTEM',
    documentDate: args.disposalDate,
    postingDate: args.postingDate,
    referenceNumber: args.assetNumber,
    narration: `Dispose fixed asset ${args.assetNumber} (${args.disposalType}) — ${args.assetName}`,
    sourceModule: 'FIXED_ASSETS',
    sourceDocumentType: 'FIXED_ASSET',
    sourceDocumentId: args.assetId,
    lines,
  }
}

export async function previewDisposal(
  req: Request,
  tenantId: string,
  assetId: string,
  body: DisposePreviewInput,
): Promise<FixedAssetDisposalPreviewDto> {
  assertDisposePermission(req)
  const asset = await repo.findAssetByIdOrThrow(tenantId, assetId)
  if (!DISPOSABLE_STATUSES.includes(asset.status as (typeof DISPOSABLE_STATUSES)[number])) {
    throw new FixedAssetInvalidStatusError('Only active, idle, or fully depreciated assets can be disposed')
  }
  return buildDisposalPreview(asset, body.disposalType, body.proceeds, body.disposeCostAmount)
}

export async function disposeAsset(
  req: Request,
  tenantId: string,
  assetId: string,
  body: DisposeFixedAssetInput,
): Promise<FixedAssetDisposeResultDto> {
  assertDisposePermission(req)
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')
  const audit = auditFromRequest(req)

  const asset = await repo.findAssetByIdOrThrow(tenantId, assetId)

  if (asset.status === 'DISPOSED' && asset.disposalPostingEventId && asset.disposalVoucherId) {
    const posting = await buildPostedResult(
      tenantId,
      asset.disposalPostingEventId,
      asset.disposalVoucherId,
      true,
    )
    const preview = buildDisposalPreview(
      asset,
      asset.disposalType ?? body.disposalType,
      asset.disposalProceeds?.toString() ?? body.proceeds,
    )
    return {
      asset: serializeAsset(asset, req),
      preview,
      posting,
      idempotentReplay: true,
      isPartial: false,
      disposalId: null,
    }
  }

  if (!DISPOSABLE_STATUSES.includes(asset.status as (typeof DISPOSABLE_STATUSES)[number])) {
    throw new FixedAssetInvalidStatusError('Only active, idle, or fully depreciated assets can be disposed')
  }

  const postingDate = body.postingDate ?? body.disposalDate ?? new Date().toISOString().slice(0, 10)
  const disposalDate = body.disposalDate ?? postingDate
  const preview = buildDisposalPreview(asset, body.disposalType, body.proceeds, body.disposeCostAmount)

  if (body.disposeCostAmount && compare(body.disposeCostAmount, asset.acquisitionCost.toString()) >= 0) {
    throw new FixedAssetValidationFailedError(
      'disposeCostAmount must be less than acquisition cost for partial dispose; omit it for full dispose',
    )
  }

  if (compare(preview.proceeds, '0') > 0) {
    if (!body.proceedsAccountId) {
      throw new FixedAssetValidationFailedError('proceedsAccountId is required when proceeds > 0')
    }
    const proceedsAccount = await repo.findAccountInLegalEntity(
      tenantId,
      asset.legalEntityId,
      body.proceedsAccountId,
    )
    if (!proceedsAccount || proceedsAccount.isGroup || !proceedsAccount.isActive) {
      throw new FixedAssetValidationFailedError('Proceeds account is invalid for disposal')
    }
  }

  if (compare(preview.gainLoss, '0') < 0) {
    const loss = await repo.findDefaultMappingAccount(tenantId, asset.legalEntityId, 'ASSET_DISPOSAL_LOSS')
    if (!loss) {
      throw new FixedAssetValidationFailedError('ASSET_DISPOSAL_LOSS default account mapping is not configured')
    }
  }
  if (compare(preview.gainLoss, '0') > 0) {
    const gain = await repo.findDefaultMappingAccount(tenantId, asset.legalEntityId, 'ASSET_DISPOSAL_GAIN')
    if (!gain) {
      throw new FixedAssetValidationFailedError('ASSET_DISPOSAL_GAIN default account mapping is not configured')
    }
  }

  if (preview.isPartial) {
    return disposePartial(req, tenantId, asset, body, preview, postingDate, disposalDate, userId, audit)
  }

  // Full-exit dispose — Phase FA2 routes through the disposal DOCUMENT workflow
  // (create draft → mark ready → post) rather than posting a one-shot journal directly.
  const createInput: CreateFixedAssetDisposalInput = {
    legalEntityId: asset.legalEntityId,
    branchId: null,
    assetId: asset.id,
    disposalType: body.disposalType,
    disposalDate,
    currencyCode: asset.currencyCode,
    proceeds: preview.proceeds,
    proceedsTreasuryAccountId: null,
    proceedsAccountId: body.proceedsAccountId ?? null,
    buyerName: body.buyerName ?? null,
    reason: body.reason,
    approvalRequiredOverride: false,
    gstApplicable: false,
    placeOfSupply: null,
    partyGstin: null,
    cgstAmount: '0',
    sgstAmount: '0',
    igstAmount: '0',
    cessAmount: '0',
  }

  const created = await createFixedAssetDisposalDraft(req, tenantId, createInput)
  const ready = await markFixedAssetDisposalReady(req, tenantId, created.id, {
    expectedUpdatedAt: created.updatedAt,
  })
  const { posting, idempotentReplay } = await postFixedAssetDisposal(req, tenantId, created.id, {
    expectedUpdatedAt: ready.updatedAt,
    postingDate,
  })

  const refreshed = await repo.findAssetByIdOrThrow(tenantId, assetId)
  return {
    asset: serializeAsset(refreshed, req),
    preview,
    posting,
    idempotentReplay,
    isPartial: false,
    disposalId: created.id,
  }
}

async function disposePartial(
  req: Request,
  tenantId: string,
  asset: Awaited<ReturnType<typeof repo.findAssetByIdOrThrow>>,
  body: DisposeFixedAssetInput,
  preview: FixedAssetDisposalPreviewDto,
  postingDate: string,
  disposalDate: string,
  userId: string,
  audit: ReturnType<typeof auditFromRequest>,
): Promise<FixedAssetDisposeResultDto> {
  const disposalNumber = await nextDisposalNumber(tenantId, asset.legalEntityId)
  // Pre-create id for idempotent event key by creating a stub... use random uuid from crypto
  const { randomUUID } = await import('node:crypto')
  const disposalId = randomUUID()

  const disposedCost = preview.disposeCostAmount!
  const disposedAccum = preview.disposedAccumDep!
  const disposedNbv = preview.disposedNbv!
  const remainingCost = preview.remainingCost!
  const remainingNbv = preview.remainingNbv!
  const remainingAccum = formatForPersistence(
    subtract(preview.accumulatedDepreciation, disposedAccum),
    4,
  )
  const remainingResidual = formatForPersistence(
    multiply(asset.residualValue.toString(), divide(remainingCost, preview.acquisitionCost)),
    4,
  )
  const remainingStatus =
    compare(remainingNbv, remainingResidual) <= 0 ? ('FULLY_DEPRECIATED' as const) : ('ACTIVE' as const)

  const postingRequest = buildDisposePostingRequest({
    assetId: asset.id,
    legalEntityId: asset.legalEntityId,
    assetNumber: asset.assetNumber,
    assetName: asset.name,
    acquisitionCost: disposedCost,
    accumulatedDepreciation: disposedAccum,
    proceeds: preview.proceeds,
    gainLoss: preview.gainLoss,
    assetAccountId: asset.category.assetAccountId,
    accumDepAccountId: asset.category.accumDepAccountId,
    proceedsAccountId: body.proceedsAccountId,
    disposalDate,
    postingDate,
    disposalType: body.disposalType,
  })
  postingRequest.eventKey = buildPartialDisposeEventKey(disposalId)
  postingRequest.eventType = 'FIXED_ASSET_PARTIAL_DISPOSED'
  postingRequest.sourceDocumentType = 'FIXED_ASSET_DISPOSAL'
  postingRequest.sourceDocumentId = disposalId
  postingRequest.narration = `Partial dispose ${asset.assetNumber} — cost ${disposedCost}`

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
        await repo.createPartialDisposalDocument(
          {
            id: disposalId,
            tenantId: context.tenantId,
            legalEntityId: asset.legalEntityId,
            assetId: asset.id,
            disposalNumber,
            disposalType: body.disposalType,
            disposalDate: parseDateOnly(disposalDate),
            disposedCost,
            disposedAccumDep: disposedAccum,
            disposedNbv,
            proceeds: preview.proceeds,
            gainLoss: preview.gainLoss,
            proceedsAccountId: body.proceedsAccountId ?? null,
            buyerName: body.buyerName ?? null,
            reason: body.reason,
            voucherId,
            postingEventId: eventId,
            userId: context.userId ?? userId,
            remainingCost,
            remainingAccum,
            remainingResidual,
            remainingNbv,
            remainingStatus,
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
        entityId: asset.id,
        action: 'FIXED_ASSET_PARTIAL_DISPOSED',
        newValues: {
          disposalId,
          disposalNumber,
          disposedCost,
          proceeds: preview.proceeds,
          gainLoss: preview.gainLoss,
          voucherNumber: posting.voucherNumber,
        },
        ipAddress: audit.ipAddress ?? null,
        userAgent: audit.userAgent ?? null,
      })
    }

    const refreshed = await repo.findAssetByIdOrThrow(tenantId, asset.id)
    return {
      asset: serializeAsset(refreshed, req),
      preview,
      posting,
      idempotentReplay: posting.idempotentReplay,
      isPartial: true,
      disposalId,
    }
  } catch (error) {
    mapPostingErrorToFixedAssetError(error)
  }
}
