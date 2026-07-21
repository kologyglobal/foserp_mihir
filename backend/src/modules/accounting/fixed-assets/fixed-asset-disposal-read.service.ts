import type { Request } from 'express'
import type { FixedAssetDisposalStatus, FixedAssetDisposalType } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { formatForPersistence } from '../shared/finance-decimal.js'
import { resolveFixedAssetDisposalAllowedActions } from './fixed-asset-disposal-allowed-actions.js'
import * as repo from './fixed-asset-disposal.repository.js'
import type { FixedAssetDisposalCalculationResult, FixedAssetDisposalDto, FixedAssetDisposalWithAsset } from './fixed-asset-disposal.types.js'
import type { ListFixedAssetDisposalsQueryInput } from './fixed-assets.schemas.js'

const STATUS_LABELS: Record<FixedAssetDisposalStatus, FixedAssetDisposalDto['status']> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  REJECTED: 'Rejected',
  READY_TO_POST: 'Ready to Post',
  POSTED: 'Posted',
  CANCELLED: 'Cancelled',
  REVERSED: 'Reversed',
}

const TYPE_LABELS: Record<FixedAssetDisposalType, FixedAssetDisposalDto['disposalType']> = {
  SALE: 'Sale',
  SCRAP: 'Scrap',
  WRITE_OFF: 'Write-off',
}

async function hasActiveReconciliationMatch(disposal: FixedAssetDisposalWithAsset): Promise<boolean> {
  if (!disposal.voucherId) return false
  const glEntries = await prisma.generalLedgerEntry.findMany({
    where: { tenantId: disposal.tenantId, voucherId: disposal.voucherId },
    select: { id: true },
  })
  if (glEntries.length === 0) return false
  const activeAllocation = await prisma.bankReconciliationLedgerAllocation.findFirst({
    where: {
      tenantId: disposal.tenantId,
      generalLedgerEntryId: { in: glEntries.map((e) => e.id) },
      reconciliationMatch: { matchStatus: 'ACTIVE' },
    },
    select: { id: true },
  })
  return !!activeAllocation
}

async function loadApprovalSummary(disposal: FixedAssetDisposalWithAsset) {
  if (!disposal.approvalRequestId) return null
  return prisma.financeApprovalRequest.findFirst({
    where: { id: disposal.approvalRequestId, tenantId: disposal.tenantId },
    select: {
      id: true,
      status: true,
      currentLevel: true,
      totalLevels: true,
      requestedBy: true,
      requestedAt: true,
      completedAt: true,
      completedBy: true,
      documentStatusSnapshot: true,
    },
  })
}

export async function serializeFixedAssetDisposal(
  req: Request,
  disposal: FixedAssetDisposalWithAsset,
  calculation?: FixedAssetDisposalCalculationResult,
): Promise<FixedAssetDisposalDto> {
  const [approvalRequest, activeMatch, voucher] = await Promise.all([
    loadApprovalSummary(disposal),
    hasActiveReconciliationMatch(disposal),
    disposal.voucherId
      ? prisma.accountingVoucher.findFirst({ where: { id: disposal.voucherId, tenantId: disposal.tenantId }, select: { voucherNumber: true } })
      : Promise.resolve(null),
  ])
  void approvalRequest

  const gainLoss = disposal.gainLoss != null ? formatForPersistence(disposal.gainLoss, 4) : null

  return {
    id: disposal.id,
    tenantId: disposal.tenantId,
    legalEntityId: disposal.legalEntityId,
    branchId: disposal.branchId,
    assetId: disposal.assetId,
    assetNumber: disposal.asset.assetNumber,
    assetName: disposal.asset.name,
    disposalNumber: disposal.disposalNumber,
    draftReference: disposal.draftReference,
    status: STATUS_LABELS[disposal.status],
    disposalType: TYPE_LABELS[disposal.disposalType],
    isPartial: disposal.isPartial,
    disposalDate: disposal.disposalDate.toISOString().slice(0, 10),
    postingDate: disposal.postingDate ? disposal.postingDate.toISOString().slice(0, 10) : null,
    currencyCode: disposal.currencyCode,
    proceeds: formatForPersistence(disposal.proceeds, 4),
    buyerName: disposal.buyerName,
    reason: disposal.reason,
    preDisposalAssetStatus: disposal.preDisposalAssetStatus,
    acquisitionCostSnapshot: disposal.acquisitionCostSnapshot != null ? formatForPersistence(disposal.acquisitionCostSnapshot, 4) : null,
    accumulatedDepreciationSnapshot:
      disposal.accumulatedDepreciationSnapshot != null ? formatForPersistence(disposal.accumulatedDepreciationSnapshot, 4) : null,
    netBookValueSnapshot: disposal.netBookValueSnapshot != null ? formatForPersistence(disposal.netBookValueSnapshot, 4) : null,
    disposedCost: disposal.disposedCost != null ? formatForPersistence(disposal.disposedCost, 4) : null,
    disposedAccumDep: disposal.disposedAccumDep != null ? formatForPersistence(disposal.disposedAccumDep, 4) : null,
    disposedNbv: disposal.disposedNbv != null ? formatForPersistence(disposal.disposedNbv, 4) : null,
    gainLoss,
    isGain: gainLoss != null ? Number(gainLoss) >= 0 : null,
    proceedsTreasuryAccountId: disposal.proceedsTreasuryAccountId,
    proceedsAccountId: disposal.proceedsAccountId,
    gstApplicable: disposal.gstApplicable,
    placeOfSupply: disposal.placeOfSupply,
    partyGstin: disposal.partyGstin,
    taxableAmount: formatForPersistence(disposal.taxableAmount, 4),
    cgstAmount: formatForPersistence(disposal.cgstAmount, 4),
    sgstAmount: formatForPersistence(disposal.sgstAmount, 4),
    igstAmount: formatForPersistence(disposal.igstAmount, 4),
    cessAmount: formatForPersistence(disposal.cessAmount, 4),
    totalTaxAmount: formatForPersistence(disposal.totalTaxAmount, 4),
    totalProceeds: formatForPersistence(disposal.totalProceeds, 4),
    approvalRequired: disposal.approvalRequired,
    approvalRequestId: disposal.approvalRequestId,
    postingEventId: disposal.postingEventId,
    voucherId: disposal.voucherId,
    voucherNumber: voucher?.voucherNumber ?? null,
    reversalPostingEventId: disposal.reversalPostingEventId,
    reversalVoucherId: disposal.reversalVoucherId,
    validation: calculation
      ? { isValid: calculation.validation.isValid, errors: calculation.validation.errors, warnings: calculation.validation.warnings }
      : (disposal.validationSnapshot as FixedAssetDisposalDto['validation']) ?? null,
    accountingPreview: calculation?.accountingPreview ?? (disposal.accountingPreviewSnapshot as FixedAssetDisposalDto['accountingPreview']) ?? null,
    submittedAt: disposal.submittedAt ? disposal.submittedAt.toISOString() : null,
    approvedAt: disposal.approvedAt ? disposal.approvedAt.toISOString() : null,
    rejectedAt: disposal.rejectedAt ? disposal.rejectedAt.toISOString() : null,
    rejectionReason: disposal.rejectionReason,
    readyAt: disposal.readyAt ? disposal.readyAt.toISOString() : null,
    postedAt: disposal.postedAt ? disposal.postedAt.toISOString() : null,
    cancelledAt: disposal.cancelledAt ? disposal.cancelledAt.toISOString() : null,
    cancellationReason: disposal.cancellationReason,
    reversedAt: disposal.reversedAt ? disposal.reversedAt.toISOString() : null,
    reversalDate: disposal.reversalDate ? disposal.reversalDate.toISOString().slice(0, 10) : null,
    reversalReason: disposal.reversalReason,
    allowedActions: resolveFixedAssetDisposalAllowedActions(req, disposal.status, disposal.approvalRequired, activeMatch),
    createdAt: disposal.createdAt.toISOString(),
    updatedAt: disposal.updatedAt.toISOString(),
  }
}

export async function getFixedAssetDisposal(req: Request, tenantId: string, id: string) {
  return serializeFixedAssetDisposal(req, await repo.findDisposalByIdOrThrow(tenantId, id))
}

export async function listFixedAssetDisposals(req: Request, tenantId: string, query: ListFixedAssetDisposalsQueryInput) {
  const result = await repo.listDisposals(tenantId, query)
  return {
    ...result,
    items: await Promise.all(result.items.map((d) => serializeFixedAssetDisposal(req, d))),
  }
}
