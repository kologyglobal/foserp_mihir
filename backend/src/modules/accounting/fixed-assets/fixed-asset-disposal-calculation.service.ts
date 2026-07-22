import type { FixedAssetDisposalType } from '@prisma/client'
import { add, compare, formatForPersistence, subtract, sumDecimals } from '../shared/finance-decimal.js'
import { buildDisposalAccountingLines, buildDisposalAccountingPreview } from './fixed-asset-disposal-posting-builder.service.js'
import * as repo from './fixed-asset-disposal.repository.js'
import type { FixedAssetDisposalCalculationResult, FixedAssetDisposalValidationIssue } from './fixed-asset-disposal.types.js'

export interface CalculateFixedAssetDisposalParams {
  tenantId: string
  legalEntityId: string
  assetName: string
  assetAccountId: string
  accumDepAccountId: string
  acquisitionCost: string
  accumulatedDepreciation: string
  netBookValue: string
  disposalType: FixedAssetDisposalType
  proceeds: string
  gstApplicable: boolean
  cgstAmount: string
  sgstAmount: string
  igstAmount: string
  cessAmount: string
  proceedsAccountId: string | null
}

/**
 * Computes the taxable/GST split, gain/loss (on **taxable** proceeds vs live NBV), and the balanced
 * proposed JE — reused by draft create/update/recalculate, preview, and the pre-transition workflow
 * gates. Never re-derives GST rates — cgst/sgst/igst/cess are caller-supplied amounts, only summed
 * when `gstApplicable && disposalType === 'SALE'`.
 */
export async function calculateFixedAssetDisposal(
  params: CalculateFixedAssetDisposalParams,
): Promise<FixedAssetDisposalCalculationResult> {
  const errors: FixedAssetDisposalValidationIssue[] = []
  const warnings: FixedAssetDisposalValidationIssue[] = []

  const disposedCost = formatForPersistence(params.acquisitionCost, 4)
  const disposedAccumDep = formatForPersistence(params.accumulatedDepreciation, 4)
  const disposedNbv = formatForPersistence(params.netBookValue, 4)

  const gstActive = params.gstApplicable && params.disposalType === 'SALE'
  const cgstAmount = gstActive ? formatForPersistence(params.cgstAmount, 4) : '0.0000'
  const sgstAmount = gstActive ? formatForPersistence(params.sgstAmount, 4) : '0.0000'
  const igstAmount = gstActive ? formatForPersistence(params.igstAmount, 4) : '0.0000'
  const cessAmount = gstActive ? formatForPersistence(params.cessAmount, 4) : '0.0000'
  const totalTaxAmount = gstActive
    ? formatForPersistence(sumDecimals([cgstAmount, sgstAmount, igstAmount, cessAmount]), 4)
    : '0.0000'

  const taxableAmount = formatForPersistence(params.proceeds, 4)
  const totalProceeds = gstActive ? formatForPersistence(add(taxableAmount, totalTaxAmount), 4) : taxableAmount
  const gainLoss = formatForPersistence(subtract(taxableAmount, disposedNbv), 4)

  if (params.disposalType === 'SALE' && compare(taxableAmount, '0') <= 0) {
    errors.push({ field: 'proceeds', code: 'PROCEEDS_REQUIRED', message: 'SALE disposal requires proceeds > 0' })
  }
  if (compare(totalProceeds, '0') > 0 && !params.proceedsAccountId) {
    errors.push({
      field: 'proceedsAccountId',
      code: 'PROCEEDS_ACCOUNT_REQUIRED',
      message: 'proceedsAccountId is required when proceeds > 0',
    })
  }

  if (compare(gainLoss, '0') < 0) {
    const lossAccount = await repo.findMappingAccount(params.tenantId, params.legalEntityId, 'ASSET_DISPOSAL_LOSS')
    if (!lossAccount) {
      errors.push({
        field: 'gainLoss',
        code: 'ASSET_DISPOSAL_LOSS_MAPPING_MISSING',
        message: 'ASSET_DISPOSAL_LOSS default account mapping is not configured',
      })
    }
  }
  if (compare(gainLoss, '0') > 0) {
    const gainAccount = await repo.findMappingAccount(params.tenantId, params.legalEntityId, 'ASSET_DISPOSAL_GAIN')
    if (!gainAccount) {
      errors.push({
        field: 'gainLoss',
        code: 'ASSET_DISPOSAL_GAIN_MAPPING_MISSING',
        message: 'ASSET_DISPOSAL_GAIN default account mapping is not configured',
      })
    }
  }

  const gstChecks: Array<{ amount: string; mappingKey: 'GST_OUTPUT_CGST' | 'GST_OUTPUT_SGST' | 'GST_OUTPUT_IGST' | 'GST_OUTPUT_CESS'; label: string }> = [
    { amount: cgstAmount, mappingKey: 'GST_OUTPUT_CGST', label: 'CGST' },
    { amount: sgstAmount, mappingKey: 'GST_OUTPUT_SGST', label: 'SGST' },
    { amount: igstAmount, mappingKey: 'GST_OUTPUT_IGST', label: 'IGST' },
    { amount: cessAmount, mappingKey: 'GST_OUTPUT_CESS', label: 'Cess' },
  ]
  for (const check of gstChecks) {
    if (compare(check.amount, '0') > 0) {
      const account = await repo.findMappingAccount(params.tenantId, params.legalEntityId, check.mappingKey)
      if (!account) {
        errors.push({
          field: check.mappingKey,
          code: 'GST_MAPPING_MISSING',
          message: `${check.mappingKey} default account mapping is not configured for output ${check.label}`,
        })
      }
    }
  }

  const lines = buildDisposalAccountingLines({
    assetName: params.assetName,
    acquisitionCost: disposedCost,
    accumulatedDepreciation: disposedAccumDep,
    totalProceeds,
    proceedsAccountId: params.proceedsAccountId,
    cgstAmount,
    sgstAmount,
    igstAmount,
    cessAmount,
    gainLoss,
    assetAccountId: params.assetAccountId,
    accumDepAccountId: params.accumDepAccountId,
  })
  const accountingPreview = buildDisposalAccountingPreview(lines)
  if (!accountingPreview.isBalanced) {
    errors.push({ code: 'ACCOUNTING_NOT_BALANCED', message: 'Proposed disposal journal entry is not balanced' })
  }

  return {
    acquisitionCostSnapshot: disposedCost,
    accumulatedDepreciationSnapshot: disposedAccumDep,
    netBookValueSnapshot: disposedNbv,
    disposedCost,
    disposedAccumDep,
    disposedNbv,
    taxableAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    cessAmount,
    totalTaxAmount,
    totalProceeds,
    gainLoss,
    proceedsAccountId: params.proceedsAccountId,
    validation: { isValid: errors.length === 0, errors, warnings },
    accountingPreview,
    calculationVersion: 1,
  }
}
