import type { AccountingVoucher, AccountingVoucherLine } from '@prisma/client'
import { formatForPersistence } from '../../../shared/finance-decimal.js'
import type { PostingRequest, PostingRequestLine } from '../../../posting/posting.types.js'
import type { TreasuryChequeAccountingPreview, TreasuryChequeRow } from '../treasury-cheque.types.js'

export function buildTreasuryChequeIssueEventKey(chequeId: string): string {
  return `TREASURY_CHEQUE_ISSUE:${chequeId}:V1`
}

export function buildTreasuryChequeDepositEventKey(chequeId: string): string {
  return `TREASURY_CHEQUE_DEPOSIT:${chequeId}:V1`
}

export function buildTreasuryChequeBounceReversalEventKey(chequeId: string): string {
  return `TREASURY_CHEQUE_BOUNCE_REVERSE:${chequeId}:V1`
}

export function buildTreasuryChequeStopReversalEventKey(chequeId: string): string {
  return `TREASURY_CHEQUE_STOP_REVERSE:${chequeId}:V1`
}

export function buildTreasuryChequeReversalEventKey(chequeId: string): string {
  return `TREASURY_CHEQUE_REVERSE:${chequeId}:V1`
}

function previewToLines(preview: TreasuryChequeAccountingPreview, currencyCode: string): PostingRequestLine[] {
  return preview.lines.map((line) => ({
    lineNumber: line.lineNumber,
    accountId: line.accountId,
    debitAmount: line.direction === 'DEBIT' ? line.amount : '0',
    creditAmount: line.direction === 'CREDIT' ? line.amount : '0',
    currencyCode,
    lineNarration: line.lineNarration.slice(0, 500),
  }))
}

export function buildTreasuryChequePostingRequest(params: {
  cheque: TreasuryChequeRow
  preview: TreasuryChequeAccountingPreview
  eventKey: string
  eventType: string
  postingDate: string
}): PostingRequest {
  const { cheque, preview } = params
  const label = cheque.direction === 'ISSUED' ? 'Cheque issued' : 'Cheque deposited'
  return {
    legalEntityId: cheque.legalEntityId,
    eventKey: params.eventKey,
    eventType: params.eventType,
    postingPurpose: 'SYSTEM_DOCUMENT',
    voucherType: 'SYSTEM',
    documentDate: cheque.chequeDate.toISOString().slice(0, 10),
    postingDate: params.postingDate,
    branchId: cheque.branchId,
    referenceNumber: cheque.chequeNumber,
    narration: (cheque.narration ?? `${label} — ${cheque.chequeNumber} (${cheque.payeeOrDrawerName})`).slice(0, 500),
    currencyCode: cheque.currencyCode,
    exchangeRate: cheque.exchangeRate.toString(),
    sourceModule: 'ACCOUNTING',
    sourceDocumentType: 'TREASURY_CHEQUE',
    sourceDocumentId: cheque.id,
    lines: previewToLines(preview, cheque.currencyCode),
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

export function buildTreasuryChequeReversalRequest(params: {
  cheque: TreasuryChequeRow
  originalVoucher: AccountingVoucher
  lines: AccountingVoucherLine[]
  eventKey: string
  eventType: string
  reversalDate: string
  reason: string
  narrationPrefix: string
}): PostingRequest {
  const { cheque, originalVoucher } = params
  return {
    legalEntityId: cheque.legalEntityId,
    eventKey: params.eventKey,
    eventType: params.eventType,
    postingPurpose: 'REVERSAL',
    voucherType: 'REVERSAL',
    documentDate: originalVoucher.documentDate.toISOString().slice(0, 10),
    postingDate: params.reversalDate,
    branchId: originalVoucher.branchId,
    referenceNumber: originalVoucher.referenceNumber,
    narration: `${params.narrationPrefix} of cheque ${cheque.chequeRegisterNumber ?? cheque.chequeNumber}: ${params.reason}`.slice(0, 500),
    currencyCode: originalVoucher.currencyCode,
    exchangeRate: originalVoucher.exchangeRate.toString(),
    sourceModule: 'ACCOUNTING',
    sourceDocumentType: 'TREASURY_CHEQUE',
    sourceDocumentId: cheque.id,
    lines: buildReversalLines(params.lines, params.narrationPrefix),
  }
}
