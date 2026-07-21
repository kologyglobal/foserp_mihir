import type { Request } from 'express'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import { getLegalEntityOrThrow } from '../shared/finance.helpers.js'
import { calculateFixedAssetDisposal } from './fixed-asset-disposal-calculation.service.js'
import * as repo from './fixed-asset-disposal.repository.js'
import {
  FixedAssetDisposalEditNotAllowedError,
  FixedAssetDisposalInvalidStatusError,
  FixedAssetDisposalOpenExistsError,
  FixedAssetDisposalValidationFailedError,
} from './fixed-asset-disposal.errors.js'
import * as assetRepo from './fixed-assets.repository.js'
import { nextDisposalDraftReference } from './fixed-asset-number.service.js'
import { serializeFixedAssetDisposal } from './fixed-asset-disposal-read.service.js'
import type { CreateFixedAssetDisposalInput, UpdateFixedAssetDisposalInput } from './fixed-assets.schemas.js'
import type { FixedAssetDisposalCalculationResult, FixedAssetDisposalWithAsset } from './fixed-asset-disposal.types.js'

const DISPOSABLE_STATUSES = ['ACTIVE', 'IDLE', 'FULLY_DEPRECIATED'] as const

async function resolveProceedsAccountId(
  tenantId: string,
  legalEntityId: string,
  proceedsTreasuryAccountId?: string | null,
  proceedsAccountIdInput?: string | null,
): Promise<string | null> {
  if (proceedsTreasuryAccountId) {
    const treasury = await repo.findTreasuryAccountInLegalEntity(tenantId, legalEntityId, proceedsTreasuryAccountId)
    if (!treasury) {
      throw new FixedAssetDisposalValidationFailedError('Proceeds treasury account not found for this legal entity')
    }
    return treasury.glAccountId
  }
  if (proceedsAccountIdInput) {
    const account = await repo.findAccountInLegalEntity(tenantId, legalEntityId, proceedsAccountIdInput)
    if (!account || account.isGroup || !account.isActive) {
      throw new FixedAssetDisposalValidationFailedError('Proceeds account is invalid for disposal')
    }
    return proceedsAccountIdInput
  }
  return null
}

function assertAssetDisposable(asset: { status: string }): void {
  if (asset.status === 'DISPOSED') {
    throw new FixedAssetDisposalInvalidStatusError('Asset is already disposed')
  }
  if (!DISPOSABLE_STATUSES.includes(asset.status as (typeof DISPOSABLE_STATUSES)[number])) {
    throw new FixedAssetDisposalInvalidStatusError('Only active, idle, or fully depreciated assets can be disposed')
  }
}

/** Recomputes from the disposal's persisted fields against the **live** asset (fresh BV, GST split unchanged). */
export async function recalculateDisposal(
  tenantId: string,
  disposal: FixedAssetDisposalWithAsset,
): Promise<FixedAssetDisposalCalculationResult> {
  return calculateFixedAssetDisposal({
    tenantId,
    legalEntityId: disposal.legalEntityId,
    assetName: disposal.asset.name,
    assetAccountId: disposal.asset.category.assetAccountId,
    accumDepAccountId: disposal.asset.category.accumDepAccountId,
    acquisitionCost: disposal.asset.acquisitionCost.toString(),
    accumulatedDepreciation: disposal.asset.accumulatedDepreciation.toString(),
    netBookValue: disposal.asset.netBookValue.toString(),
    disposalType: disposal.disposalType,
    proceeds: disposal.proceeds.toString(),
    gstApplicable: disposal.gstApplicable,
    cgstAmount: disposal.cgstAmount.toString(),
    sgstAmount: disposal.sgstAmount.toString(),
    igstAmount: disposal.igstAmount.toString(),
    cessAmount: disposal.cessAmount.toString(),
    proceedsAccountId: disposal.proceedsAccountId,
  })
}

export async function createFixedAssetDisposalDraft(req: Request, tenantId: string, input: CreateFixedAssetDisposalInput) {
  await getLegalEntityOrThrow(tenantId, input.legalEntityId)
  const asset = await assetRepo.findAssetByIdOrThrow(tenantId, input.assetId)
  if (asset.legalEntityId !== input.legalEntityId) {
    throw new FixedAssetDisposalValidationFailedError('Asset does not belong to the specified legal entity')
  }
  assertAssetDisposable(asset)

  const openDisposal = await repo.findOpenDisposalForAsset(tenantId, input.assetId)
  if (openDisposal) {
    throw new FixedAssetDisposalOpenExistsError()
  }

  const proceedsAccountId = await resolveProceedsAccountId(
    tenantId,
    input.legalEntityId,
    input.proceedsTreasuryAccountId,
    input.proceedsAccountId,
  )

  const calc = await calculateFixedAssetDisposal({
    tenantId,
    legalEntityId: input.legalEntityId,
    assetName: asset.name,
    assetAccountId: asset.category.assetAccountId,
    accumDepAccountId: asset.category.accumDepAccountId,
    acquisitionCost: asset.acquisitionCost.toString(),
    accumulatedDepreciation: asset.accumulatedDepreciation.toString(),
    netBookValue: asset.netBookValue.toString(),
    disposalType: input.disposalType,
    proceeds: input.proceeds,
    gstApplicable: input.gstApplicable,
    cgstAmount: input.cgstAmount,
    sgstAmount: input.sgstAmount,
    igstAmount: input.igstAmount,
    cessAmount: input.cessAmount,
    proceedsAccountId,
  })

  const draftReference = await nextDisposalDraftReference(tenantId, input.legalEntityId)
  const userId = req.context?.userId

  const created = await repo.createDisposalDraft(
    {
      tenantId,
      legalEntityId: input.legalEntityId,
      branchId: input.branchId ?? null,
      assetId: input.assetId,
      disposalType: input.disposalType,
      disposalDate: repo.parseDateOnly(input.disposalDate),
      currencyCode: input.currencyCode,
      proceeds: input.proceeds,
      buyerName: input.buyerName ?? null,
      reason: input.reason,
      proceedsTreasuryAccountId: input.proceedsTreasuryAccountId ?? null,
      proceedsAccountIdInput: input.proceedsAccountId ?? null,
      gstApplicable: input.gstApplicable,
      placeOfSupply: input.placeOfSupply ?? null,
      partyGstin: input.partyGstin ?? null,
      cgstAmount: input.cgstAmount,
      sgstAmount: input.sgstAmount,
      igstAmount: input.igstAmount,
      cessAmount: input.cessAmount,
      approvalRequired: input.approvalRequiredOverride ?? false,
      draftReference,
      userId,
    },
    calc,
  )

  const audit = auditFromRequest(req)
  await createAuditLog({
    tenantId,
    userId,
    module: 'finance',
    entity: 'fixed_asset_disposal',
    entityId: created.id,
    action: 'FIXED_ASSET_DISPOSAL_CREATED',
    newValues: { draftReference: created.draftReference, assetId: input.assetId },
    ipAddress: audit.ipAddress ?? null,
    userAgent: audit.userAgent ?? null,
  })

  return serializeFixedAssetDisposal(req, created, calc)
}

export async function updateFixedAssetDisposalDraft(
  req: Request,
  tenantId: string,
  id: string,
  input: UpdateFixedAssetDisposalInput,
) {
  const existing = await repo.findDisposalByIdOrThrow(tenantId, id)
  if (!['DRAFT', 'REJECTED'].includes(existing.status)) {
    throw new FixedAssetDisposalEditNotAllowedError()
  }
  assertAssetDisposable(existing.asset)

  const proceedsAccountId = await resolveProceedsAccountId(
    tenantId,
    existing.legalEntityId,
    input.proceedsTreasuryAccountId,
    input.proceedsAccountId,
  )

  const calc = await calculateFixedAssetDisposal({
    tenantId,
    legalEntityId: existing.legalEntityId,
    assetName: existing.asset.name,
    assetAccountId: existing.asset.category.assetAccountId,
    accumDepAccountId: existing.asset.category.accumDepAccountId,
    acquisitionCost: existing.asset.acquisitionCost.toString(),
    accumulatedDepreciation: existing.asset.accumulatedDepreciation.toString(),
    netBookValue: existing.asset.netBookValue.toString(),
    disposalType: input.disposalType,
    proceeds: input.proceeds,
    gstApplicable: input.gstApplicable,
    cgstAmount: input.cgstAmount,
    sgstAmount: input.sgstAmount,
    igstAmount: input.igstAmount,
    cessAmount: input.cessAmount,
    proceedsAccountId,
  })

  const userId = req.context?.userId
  const updated = await repo.replaceDisposalDraft(
    tenantId,
    id,
    {
      tenantId,
      legalEntityId: existing.legalEntityId,
      branchId: input.branchId ?? existing.branchId,
      assetId: existing.assetId,
      disposalType: input.disposalType,
      disposalDate: repo.parseDateOnly(input.disposalDate),
      currencyCode: input.currencyCode,
      proceeds: input.proceeds,
      buyerName: input.buyerName ?? null,
      reason: input.reason,
      proceedsTreasuryAccountId: input.proceedsTreasuryAccountId ?? null,
      proceedsAccountIdInput: input.proceedsAccountId ?? null,
      gstApplicable: input.gstApplicable,
      placeOfSupply: input.placeOfSupply ?? null,
      partyGstin: input.partyGstin ?? null,
      cgstAmount: input.cgstAmount,
      sgstAmount: input.sgstAmount,
      igstAmount: input.igstAmount,
      cessAmount: input.cessAmount,
      approvalRequired: input.approvalRequiredOverride ?? existing.approvalRequired,
      draftReference: existing.draftReference,
      userId,
    },
    calc,
    input.expectedUpdatedAt,
  )

  const audit = auditFromRequest(req)
  await createAuditLog({
    tenantId,
    userId,
    module: 'finance',
    entity: 'fixed_asset_disposal',
    entityId: id,
    action: 'FIXED_ASSET_DISPOSAL_UPDATED',
    ipAddress: audit.ipAddress ?? null,
    userAgent: audit.userAgent ?? null,
  })

  return serializeFixedAssetDisposal(req, updated, calc)
}

export async function validateFixedAssetDisposalById(req: Request, tenantId: string, id: string) {
  const disposal = await repo.findDisposalByIdOrThrow(tenantId, id)
  const calc = await recalculateDisposal(tenantId, disposal)

  if (['DRAFT', 'READY_TO_POST', 'REJECTED', 'PENDING_APPROVAL'].includes(disposal.status)) {
    await repo.persistCalculatedFields(tenantId, id, calc, req.context?.userId)
  }

  return {
    valid: calc.validation.isValid,
    errors: calc.validation.errors,
    warnings: calc.validation.warnings,
    accountingPreview: calc.accountingPreview,
    calculation: calc,
  }
}
