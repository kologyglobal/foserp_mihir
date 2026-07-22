import type { PostingRequest, PostingRequestLine } from '../../../posting/posting.types.js'
import type { TreasuryTransferAccountingPreview } from '../treasury-transfer.types.js'
import type { TreasuryTransferRow } from '../treasury-transfer.types.js'

export function buildTreasuryTransferDirectEventKey(transferId: string): string {
  return `TREASURY_TRANSFER_DIRECT:${transferId}:V1`
}

export function buildTreasuryTransferDispatchEventKey(transferId: string): string {
  return `TREASURY_TRANSFER_DISPATCH:${transferId}:V1`
}

export function buildTreasuryTransferReceiveEventKey(transferId: string): string {
  return `TREASURY_TRANSFER_RECEIVE:${transferId}:V1`
}

export function buildTreasuryTransferReversalDispatchEventKey(transferId: string): string {
  return `TREASURY_TRANSFER_REVERSE_DISPATCH:${transferId}:V1`
}

export function buildTreasuryTransferReversalReceiveEventKey(transferId: string): string {
  return `TREASURY_TRANSFER_REVERSE_RECEIVE:${transferId}:V1`
}

export function buildTreasuryTransferReversalDirectEventKey(transferId: string): string {
  return `TREASURY_TRANSFER_REVERSE_DIRECT:${transferId}:V1`
}

function previewToLines(preview: TreasuryTransferAccountingPreview, currencyCode: string): PostingRequestLine[] {
  return preview.lines.map((line) => ({
    lineNumber: line.lineNumber,
    accountId: line.accountId,
    debitAmount: line.direction === 'DEBIT' ? line.amount : '0',
    creditAmount: line.direction === 'CREDIT' ? line.amount : '0',
    currencyCode,
    lineNarration: line.lineNarration.slice(0, 500),
  }))
}

export function buildTreasuryTransferPostingRequest(params: {
  transfer: TreasuryTransferRow
  preview: TreasuryTransferAccountingPreview
  eventKey: string
  eventType: string
  postingDate: string
}): PostingRequest {
  const { transfer, preview } = params
  return {
    legalEntityId: transfer.legalEntityId,
    eventKey: params.eventKey,
    eventType: params.eventType,
    postingPurpose: 'SYSTEM_DOCUMENT',
    voucherType: 'SYSTEM',
    documentDate: transfer.transferDate.toISOString().slice(0, 10),
    postingDate: params.postingDate,
    branchId: transfer.sourceBranchId,
    referenceNumber: transfer.draftReference,
    externalReference: transfer.externalReference,
    narration: (transfer.narration ?? `Internal treasury transfer ${transfer.draftReference}`).slice(0, 500),
    currencyCode: transfer.currencyCode,
    exchangeRate: transfer.exchangeRate.toString(),
    sourceModule: 'ACCOUNTING',
    sourceDocumentType: 'TREASURY_TRANSFER',
    sourceDocumentId: transfer.id,
    lines: previewToLines(preview, transfer.currencyCode),
  }
}
