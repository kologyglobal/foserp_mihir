/**
 * Builds a balanced PostingRequest from the Phase 4B2 accounting preview (Phase 4B3).
 * Side-effect free — same balanced lines as the ready-to-post preview (debit/credit taken
 * directly from the preview, which already reconciles any base-currency FX residual).
 */
import { compare, isZero, sumDecimals } from '../../../shared/finance-decimal.js'
import type { PostingRequest, PostingRequestLine } from '../../../posting/posting.types.js'
import type { VendorPaymentAccountingPreview } from '../calculation/vendor-payment-calculation.types.js'
import type { VendorPaymentWithLines } from '../vendor-payment.types.js'
import { buildVendorPaymentPostEventKey } from './vendor-payment-posting.types.js'
import {
  VendorPaymentAccountingPreviewUnbalancedError,
  VendorPaymentBasePreviewUnbalancedError,
} from './vendor-payment-posting.errors.js'

export interface BuildVendorPaymentPostingRequestInput {
  payment: VendorPaymentWithLines
  preview: VendorPaymentAccountingPreview
}

export function buildVendorPaymentPostingRequest(input: BuildVendorPaymentPostingRequestInput): PostingRequest {
  const { payment, preview } = input
  if (!preview.isBalanced || !preview.isBaseBalanced || preview.issues.length > 0) {
    throw new VendorPaymentAccountingPreviewUnbalancedError(
      preview.issues[0]?.message ?? 'Vendor payment accounting preview is unbalanced',
    )
  }

  const exchangeRate = payment.exchangeRate.toString()
  const currencyCode = payment.currencyCode
  const postingDate = (payment.proposedPostingDate ?? payment.paymentDate).toISOString().slice(0, 10)
  const documentDate = payment.documentDate.toISOString().slice(0, 10)

  const lines: PostingRequestLine[] = []
  let lineNumber = 0

  for (const previewLine of preview.lines) {
    if (!previewLine.accountId) {
      throw new VendorPaymentAccountingPreviewUnbalancedError(
        `Preview line ${previewLine.sequence} (${previewLine.component}) has no accountId`,
      )
    }
    if (isZero(previewLine.debitAmount) && isZero(previewLine.creditAmount)) continue

    lineNumber += 1
    lines.push({
      lineNumber,
      accountId: previewLine.accountId,
      partyType: previewLine.partyType === 'VENDOR' ? 'VENDOR' : null,
      partyId: previewLine.partyType === 'VENDOR' ? previewLine.partyId : null,
      partyNameSnapshot: previewLine.partyType === 'VENDOR' ? payment.vendorNameSnapshot : null,
      debitAmount: previewLine.debitAmount,
      creditAmount: previewLine.creditAmount,
      baseDebitAmount: previewLine.baseDebitAmount,
      baseCreditAmount: previewLine.baseCreditAmount,
      currencyCode,
      exchangeRate,
      costCentreId: previewLine.costCentreId ?? null,
      referenceDocumentType: 'VENDOR_PAYMENT',
      referenceDocumentId: payment.id,
      referenceDocumentLineId: previewLine.adjustmentLineId ?? null,
      dueDate: null,
      lineNarration: previewLine.narration,
    })
  }

  const totalDebit = sumDecimals(lines.map((l) => l.debitAmount))
  const totalCredit = sumDecimals(lines.map((l) => l.creditAmount))
  if (compare(totalDebit, totalCredit) !== 0) {
    throw new VendorPaymentAccountingPreviewUnbalancedError(
      `Vendor payment posting request is unbalanced: debit=${totalDebit.toString()} credit=${totalCredit.toString()}`,
    )
  }

  const baseTotalDebit = sumDecimals(lines.map((l) => l.baseDebitAmount ?? '0'))
  const baseTotalCredit = sumDecimals(lines.map((l) => l.baseCreditAmount ?? '0'))
  if (compare(baseTotalDebit, baseTotalCredit) !== 0) {
    throw new VendorPaymentBasePreviewUnbalancedError(
      `Vendor payment base posting request is unbalanced: debit=${baseTotalDebit.toString()} credit=${baseTotalCredit.toString()}`,
    )
  }

  return {
    legalEntityId: payment.legalEntityId,
    eventKey: buildVendorPaymentPostEventKey(payment.id),
    eventType: 'VENDOR_PAYMENT_POSTED',
    eventVersion: 1,
    postingPurpose: 'SYSTEM_DOCUMENT',
    voucherType: 'SYSTEM',
    documentDate,
    postingDate,
    branchId: payment.branchId,
    referenceNumber: payment.draftReference,
    externalReference: payment.paymentReference ?? payment.bankReference ?? payment.chequeNumber ?? null,
    narration: `Vendor payment ${payment.draftReference}`,
    currencyCode,
    exchangeRate,
    sourceModule: 'ACCOUNTING',
    sourceDocumentType: 'VENDOR_PAYMENT',
    sourceDocumentId: payment.id,
    lines,
  }
}
