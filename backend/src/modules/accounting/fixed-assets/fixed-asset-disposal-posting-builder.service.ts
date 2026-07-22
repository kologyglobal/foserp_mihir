import type { AccountingVoucher, AccountingVoucherLine } from '@prisma/client'
import { compare, formatForPersistence, subtract, sumDecimals } from '../shared/finance-decimal.js'
import type { PostingRequest, PostingRequestLine } from '../posting/posting.types.js'
import type {
  FixedAssetDisposalAccountingLine,
  FixedAssetDisposalAccountingPreview,
} from './fixed-asset-disposal.types.js'

/** Document-keyed — one disposal document posts exactly once. */
export function buildDisposeEventKey(disposalId: string): string {
  return `FIXED_ASSET_DISPOSE:${disposalId}:V1`
}

/** Legacy asset-keyed idempotency for the one-shot wrapper endpoint (Phase 2 pre-document dispose). */
export function buildDisposeEventKeyForAsset(assetId: string): string {
  return `FIXED_ASSET_DISPOSE:${assetId}:V1`
}

export function buildDisposeReversalEventKey(disposalId: string): string {
  return `FIXED_ASSET_DISPOSE_REVERSE:${disposalId}:V1`
}

/**
 * Builds the balanced accounting lines for a full-exit disposal (SALE/SCRAP/WRITE_OFF).
 * Gain/loss uses **taxable** proceeds (before GST) against NBV — GST output tax is a pass-through
 * liability, not part of the disposal gain/loss.
 */
export function buildDisposalAccountingLines(args: {
  assetName: string
  acquisitionCost: string
  accumulatedDepreciation: string
  totalProceeds: string
  proceedsAccountId?: string | null
  cgstAmount: string
  sgstAmount: string
  igstAmount: string
  cessAmount: string
  gainLoss: string
  assetAccountId: string
  accumDepAccountId: string
}): FixedAssetDisposalAccountingLine[] {
  const lines: FixedAssetDisposalAccountingLine[] = []
  let lineNumber = 1

  const accum = formatForPersistence(args.accumulatedDepreciation, 4)
  if (compare(accum, '0') > 0) {
    lines.push({
      lineNumber: lineNumber++,
      role: 'ACCUM_DEP',
      accountId: args.accumDepAccountId,
      direction: 'DEBIT',
      amount: accum,
      lineNarration: `Clear accum. dep. — ${args.assetName}`,
    })
  }

  const totalProceeds = formatForPersistence(args.totalProceeds, 4)
  if (compare(totalProceeds, '0') > 0 && args.proceedsAccountId) {
    lines.push({
      lineNumber: lineNumber++,
      role: 'PROCEEDS',
      accountId: args.proceedsAccountId,
      direction: 'DEBIT',
      amount: totalProceeds,
      lineNarration: `Disposal proceeds — ${args.assetName}`,
    })
  }

  const gstLines: Array<{ role: FixedAssetDisposalAccountingLine['role']; mappingKey: string; amount: string; label: string }> = [
    { role: 'GST_CGST', mappingKey: 'GST_OUTPUT_CGST', amount: args.cgstAmount, label: 'CGST' },
    { role: 'GST_SGST', mappingKey: 'GST_OUTPUT_SGST', amount: args.sgstAmount, label: 'SGST' },
    { role: 'GST_IGST', mappingKey: 'GST_OUTPUT_IGST', amount: args.igstAmount, label: 'IGST' },
    { role: 'GST_CESS', mappingKey: 'GST_OUTPUT_CESS', amount: args.cessAmount, label: 'Cess' },
  ]
  for (const gst of gstLines) {
    const amount = formatForPersistence(gst.amount, 4)
    if (compare(amount, '0') > 0) {
      lines.push({
        lineNumber: lineNumber++,
        role: gst.role,
        accountMappingKey: gst.mappingKey,
        direction: 'CREDIT',
        amount,
        lineNarration: `Output ${gst.label} on disposal — ${args.assetName}`,
      })
    }
  }

  const gainLoss = formatForPersistence(args.gainLoss, 4)
  if (compare(gainLoss, '0') < 0) {
    lines.push({
      lineNumber: lineNumber++,
      role: 'LOSS',
      accountMappingKey: 'ASSET_DISPOSAL_LOSS',
      direction: 'DEBIT',
      amount: formatForPersistence(subtract('0', gainLoss), 4),
      lineNarration: `Loss on disposal — ${args.assetName}`,
    })
  }

  lines.push({
    lineNumber: lineNumber++,
    role: 'ASSET_COST',
    accountId: args.assetAccountId,
    direction: 'CREDIT',
    amount: formatForPersistence(args.acquisitionCost, 4),
    lineNarration: `Remove asset cost — ${args.assetName}`,
  })

  if (compare(gainLoss, '0') > 0) {
    lines.push({
      lineNumber: lineNumber++,
      role: 'GAIN',
      accountMappingKey: 'ASSET_DISPOSAL_GAIN',
      direction: 'CREDIT',
      amount: gainLoss,
      lineNarration: `Gain on disposal — ${args.assetName}`,
    })
  }

  return lines
}

export function buildDisposalAccountingPreview(lines: FixedAssetDisposalAccountingLine[]): FixedAssetDisposalAccountingPreview {
  const debitAmounts = lines.filter((l) => l.direction === 'DEBIT').map((l) => l.amount)
  const creditAmounts = lines.filter((l) => l.direction === 'CREDIT').map((l) => l.amount)
  const totalDebit = formatForPersistence(sumDecimals(debitAmounts), 4)
  const totalCredit = formatForPersistence(sumDecimals(creditAmounts), 4)
  return {
    isBalanced: compare(totalDebit, totalCredit) === 0,
    totalDebit,
    totalCredit,
    lines,
  }
}

function toPostingLines(lines: FixedAssetDisposalAccountingLine[]): PostingRequestLine[] {
  return lines.map((line) => ({
    lineNumber: line.lineNumber,
    ...(line.accountId ? { accountId: line.accountId } : {}),
    ...(line.accountMappingKey ? { accountMappingKey: line.accountMappingKey } : {}),
    debitAmount: line.direction === 'DEBIT' ? line.amount : '0',
    creditAmount: line.direction === 'CREDIT' ? line.amount : '0',
    lineNarration: line.lineNarration.slice(0, 500),
  }))
}

export function buildDisposePostingRequest(args: {
  disposalId: string
  legalEntityId: string
  branchId?: string | null
  assetNumber: string
  assetName: string
  disposalNumber: string
  disposalType: string
  disposalDate: string
  postingDate: string
  currencyCode: string
  lines: FixedAssetDisposalAccountingLine[]
  eventKey: string
}): PostingRequest {
  return {
    legalEntityId: args.legalEntityId,
    eventKey: args.eventKey,
    eventType: 'FIXED_ASSET_DISPOSAL_POSTED',
    postingPurpose: 'SYSTEM_DOCUMENT',
    voucherType: 'SYSTEM',
    documentDate: args.disposalDate,
    postingDate: args.postingDate,
    branchId: args.branchId ?? null,
    referenceNumber: args.disposalNumber,
    narration: `Dispose fixed asset ${args.assetNumber} (${args.disposalType}) — ${args.assetName}`.slice(0, 500),
    currencyCode: args.currencyCode,
    sourceModule: 'FIXED_ASSETS',
    sourceDocumentType: 'FIXED_ASSET_DISPOSAL',
    sourceDocumentId: args.disposalId,
    lines: toPostingLines(args.lines),
  }
}

function buildReversalLines(lines: AccountingVoucherLine[], narrationPrefix: string): PostingRequestLine[] {
  return lines
    .sort((a, b) => a.lineNumber - b.lineNumber)
    .map((line) => ({
      lineNumber: line.lineNumber,
      accountId: line.accountId,
      debitAmount: formatForPersistence(line.creditAmount),
      creditAmount: formatForPersistence(line.debitAmount),
      baseDebitAmount: formatForPersistence(line.baseCreditAmount),
      baseCreditAmount: formatForPersistence(line.baseDebitAmount),
      currencyCode: line.currencyCode,
      exchangeRate: line.exchangeRate.toString(),
      lineNarration: `${narrationPrefix}: ${line.lineNarration ?? ''}`.slice(0, 500),
    }))
}

export function buildDisposeReversalRequest(args: {
  disposalId: string
  legalEntityId: string
  disposalNumber: string | null
  originalVoucher: AccountingVoucher
  lines: AccountingVoucherLine[]
  eventKey: string
  reversalDate: string
  reason: string
}): PostingRequest {
  const { originalVoucher } = args
  return {
    legalEntityId: args.legalEntityId,
    eventKey: args.eventKey,
    eventType: 'FIXED_ASSET_DISPOSAL_REVERSED',
    postingPurpose: 'REVERSAL',
    voucherType: 'REVERSAL',
    documentDate: originalVoucher.documentDate.toISOString().slice(0, 10),
    postingDate: args.reversalDate,
    branchId: originalVoucher.branchId,
    referenceNumber: originalVoucher.referenceNumber,
    narration: `Reversal of fixed asset disposal ${args.disposalNumber ?? args.disposalId}: ${args.reason}`.slice(0, 500),
    currencyCode: originalVoucher.currencyCode,
    exchangeRate: originalVoucher.exchangeRate.toString(),
    sourceModule: 'FIXED_ASSETS',
    sourceDocumentType: 'FIXED_ASSET_DISPOSAL',
    sourceDocumentId: args.disposalId,
    lines: buildReversalLines(args.lines, 'Reversal'),
  }
}
