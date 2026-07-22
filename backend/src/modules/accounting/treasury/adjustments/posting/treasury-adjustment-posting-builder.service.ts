import type { AccountingVoucher, AccountingVoucherLine } from '@prisma/client'
import { formatForPersistence } from '../../../shared/finance-decimal.js'
import type { PostingRequest, PostingRequestLine } from '../../../posting/posting.types.js'
import type { TreasuryAdjustmentAccountingPreview, TreasuryAdjustmentWithLines } from '../treasury-adjustment.types.js'

export function buildTreasuryAdjustmentPostEventKey(adjustmentId: string): string {
  return `TREASURY_ADJUSTMENT_POST:${adjustmentId}:V1`
}

export function buildTreasuryAdjustmentReversalEventKey(adjustmentId: string): string {
  return `TREASURY_ADJUSTMENT_REVERSE:${adjustmentId}:V1`
}

function previewToLines(preview: TreasuryAdjustmentAccountingPreview, currencyCode: string): PostingRequestLine[] {
  return preview.lines.map((line) => ({
    lineNumber: line.lineNumber,
    accountId: line.accountId,
    debitAmount: line.direction === 'DEBIT' ? line.amount : '0',
    creditAmount: line.direction === 'CREDIT' ? line.amount : '0',
    currencyCode,
    lineNarration: line.lineNarration.slice(0, 500),
  }))
}

export function buildTreasuryAdjustmentPostingRequest(params: {
  adjustment: TreasuryAdjustmentWithLines
  preview: TreasuryAdjustmentAccountingPreview
  eventKey: string
  postingDate: string
}): PostingRequest {
  const { adjustment, preview } = params
  return {
    legalEntityId: adjustment.legalEntityId,
    eventKey: params.eventKey,
    eventType: 'TREASURY_ADJUSTMENT_POSTED',
    postingPurpose: 'SYSTEM_DOCUMENT',
    voucherType: 'SYSTEM',
    documentDate: adjustment.adjustmentDate.toISOString().slice(0, 10),
    postingDate: params.postingDate,
    branchId: adjustment.branchId,
    referenceNumber: adjustment.draftReference,
    narration: (adjustment.narration ?? `Treasury adjustment — ${adjustment.adjustmentType}`).slice(0, 500),
    currencyCode: adjustment.currencyCode,
    exchangeRate: adjustment.exchangeRate.toString(),
    sourceModule: 'ACCOUNTING',
    sourceDocumentType: 'TREASURY_ADJUSTMENT',
    sourceDocumentId: adjustment.id,
    lines: previewToLines(preview, adjustment.currencyCode),
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

export function buildTreasuryAdjustmentReversalRequest(params: {
  adjustment: TreasuryAdjustmentWithLines
  originalVoucher: AccountingVoucher
  lines: AccountingVoucherLine[]
  eventKey: string
  reversalDate: string
  reason: string
}): PostingRequest {
  const { adjustment, originalVoucher } = params
  return {
    legalEntityId: adjustment.legalEntityId,
    eventKey: params.eventKey,
    eventType: 'TREASURY_ADJUSTMENT_REVERSED',
    postingPurpose: 'REVERSAL',
    voucherType: 'REVERSAL',
    documentDate: originalVoucher.documentDate.toISOString().slice(0, 10),
    postingDate: params.reversalDate,
    branchId: originalVoucher.branchId,
    referenceNumber: originalVoucher.referenceNumber,
    narration: `Reversal of treasury adjustment ${adjustment.adjustmentNumber ?? adjustment.draftReference}: ${params.reason}`.slice(0, 500),
    currencyCode: originalVoucher.currencyCode,
    exchangeRate: originalVoucher.exchangeRate.toString(),
    sourceModule: 'ACCOUNTING',
    sourceDocumentType: 'TREASURY_ADJUSTMENT',
    sourceDocumentId: adjustment.id,
    lines: buildReversalLines(params.lines, 'Reversal'),
  }
}
