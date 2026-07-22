import type { Request } from 'express'
import { formatForPersistence, compare } from '../shared/finance-decimal.js'
import { recalculateDisposal } from './fixed-asset-disposal-draft.service.js'
import * as repo from './fixed-asset-disposal.repository.js'
import type { FixedAssetDisposalPreviewResultDto } from './fixed-asset-disposal.types.js'

const TYPE_LABELS = { SALE: 'Sale', SCRAP: 'Scrap', WRITE_OFF: 'Write-off' } as const

/** Read-only recompute of BV, GST split, gain/loss, and the proposed JE lines for an existing draft document. */
export async function previewFixedAssetDisposal(
  _req: Request,
  tenantId: string,
  id: string,
): Promise<FixedAssetDisposalPreviewResultDto> {
  const disposal = await repo.findDisposalByIdOrThrow(tenantId, id)
  const calc = await recalculateDisposal(tenantId, disposal)

  return {
    disposalId: disposal.id,
    assetId: disposal.assetId,
    assetNumber: disposal.asset.assetNumber,
    assetName: disposal.asset.name,
    disposalType: TYPE_LABELS[disposal.disposalType],
    acquisitionCost: calc.acquisitionCostSnapshot,
    accumulatedDepreciation: calc.accumulatedDepreciationSnapshot,
    netBookValue: calc.netBookValueSnapshot,
    proceeds: formatForPersistence(disposal.proceeds, 4),
    taxableAmount: calc.taxableAmount,
    cgstAmount: calc.cgstAmount,
    sgstAmount: calc.sgstAmount,
    igstAmount: calc.igstAmount,
    cessAmount: calc.cessAmount,
    totalTaxAmount: calc.totalTaxAmount,
    totalProceeds: calc.totalProceeds,
    gainLoss: calc.gainLoss,
    isGain: compare(calc.gainLoss, '0') >= 0,
    currencyCode: disposal.currencyCode,
    validation: calc.validation,
    accountingPreview: calc.accountingPreview,
  }
}
