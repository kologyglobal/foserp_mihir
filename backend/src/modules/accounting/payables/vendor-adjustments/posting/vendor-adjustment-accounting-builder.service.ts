/**
 * Builds a balanced PostingRequest from the Phase 4A2 accounting preview (Phase 4A4).
 * Side-effect free — same formula as the ready-to-post preview.
 */
import {
  compare,
  convertToBase,
  formatForPersistence,
  isZero,
  sumDecimals,
} from '../../../shared/finance-decimal.js'
import type { PostingRequest, PostingRequestLine } from '../../../posting/posting.types.js'
import type { VendorAdjustmentAccountingPreview } from '../calculation/vendor-adjustment-calculation.types.js'
import type { VendorAdjustmentWithLines } from '../vendor-adjustment.types.js'
import { buildVendorAdjustmentPostEventKey } from './vendor-adjustment-posting.types.js'
import { VendorAdjustmentAccountingPreviewUnbalancedError, VendorAdjustmentBasePreviewUnbalancedError } from './vendor-adjustment-posting.errors.js'

export interface BuildVendorAdjustmentPostingRequestInput {
  invoice: VendorAdjustmentWithLines
  preview: VendorAdjustmentAccountingPreview
}

function lineByNumber(invoice: VendorAdjustmentWithLines, sourceLineNumber: number | null) {
  if (sourceLineNumber == null) return null
  return invoice.lines.find((l) => l.lineNumber === sourceLineNumber) ?? null
}

export function buildVendorAdjustmentPostingRequest(input: BuildVendorAdjustmentPostingRequestInput): PostingRequest {
  const { invoice, preview } = input
  if (!preview.isBalanced || preview.issues.length > 0) {
    throw new VendorAdjustmentAccountingPreviewUnbalancedError(
      preview.issues[0]?.message ?? 'Vendor invoice accounting preview is unbalanced',
    )
  }

  const exchangeRate = invoice.exchangeRate.toString()
  const currencyCode = invoice.currencyCode
  const postingDate = (invoice.postingDate ?? invoice.documentDate).toISOString().slice(0, 10)
  const documentDate = invoice.documentDate.toISOString().slice(0, 10)

  const lines: PostingRequestLine[] = []

  for (const previewLine of preview.lines) {
    if (!previewLine.accountId) {
      throw new VendorAdjustmentAccountingPreviewUnbalancedError(
        `Preview line ${previewLine.lineNumber} has no accountId`,
      )
    }
    if (isZero(previewLine.debitAmount) && isZero(previewLine.creditAmount)) continue

    const debit = formatForPersistence(previewLine.debitAmount)
    const credit = formatForPersistence(previewLine.creditAmount)
    const baseDebit = formatForPersistence(convertToBase(debit, exchangeRate))
    const baseCredit = formatForPersistence(convertToBase(credit, exchangeRate))
    const sourceLine = lineByNumber(invoice, previewLine.sourceLineNumber ?? null)

    lines.push({
      lineNumber: previewLine.lineNumber,
      accountId: previewLine.accountId,
      partyType: previewLine.partyType === 'VENDOR' ? 'VENDOR' : null,
      partyId: previewLine.partyType === 'VENDOR' ? previewLine.partyId : null,
      partyNameSnapshot:
        previewLine.partyType === 'VENDOR' ? invoice.vendorNameSnapshot : null,
      debitAmount: debit,
      creditAmount: credit,
      baseDebitAmount: baseDebit,
      baseCreditAmount: baseCredit,
      currencyCode,
      exchangeRate,
      costCentreId: previewLine.costCentreId ?? sourceLine?.costCentreId ?? null,
      projectReference: sourceLine?.projectReference ?? null,
      departmentReference: sourceLine?.departmentReference ?? null,
      referenceDocumentType: sourceLine ? 'VENDOR_ADJUSTMENT_LINE' : 'VENDOR_ADJUSTMENT',
      referenceDocumentId: invoice.id,
      referenceDocumentLineId: sourceLine?.id ?? null,
      dueDate: previewLine.component === 'VENDOR_PAYABLE' && invoice.dueDate
        ? invoice.dueDate.toISOString().slice(0, 10)
        : null,
      lineNarration: previewLine.description,
    })
  }

  const totalDebit = sumDecimals(lines.map((l) => l.debitAmount))
  const totalCredit = sumDecimals(lines.map((l) => l.creditAmount))
  if (compare(totalDebit, totalCredit) !== 0) {
    throw new VendorAdjustmentAccountingPreviewUnbalancedError(
      `Vendor invoice posting request is unbalanced: debit=${totalDebit.toString()} credit=${totalCredit.toString()}`,
    )
  }

  const baseTotalDebit = sumDecimals(lines.map((l) => l.baseDebitAmount ?? '0'))
  const baseTotalCredit = sumDecimals(lines.map((l) => l.baseCreditAmount ?? '0'))
  if (compare(baseTotalDebit, baseTotalCredit) !== 0) {
    throw new VendorAdjustmentBasePreviewUnbalancedError(
      `Vendor invoice base posting request is unbalanced: debit=${baseTotalDebit.toString()} credit=${baseTotalCredit.toString()}`,
    )
  }

  return {
    legalEntityId: invoice.legalEntityId,
    eventKey: buildVendorAdjustmentPostEventKey(invoice.id),
    eventType: 'VENDOR_ADJUSTMENT_POSTED',
    eventVersion: 1,
    postingPurpose: 'SYSTEM_DOCUMENT',
    voucherType: 'SYSTEM',
    documentDate,
    postingDate,
    branchId: invoice.branchId,
    referenceNumber: invoice.draftReference,
    externalReference: invoice.supplierReferenceNumber,
    narration: `Vendor invoice ${invoice.draftReference} / ${invoice.supplierReferenceNumber}`,
    currencyCode,
    exchangeRate,
    sourceModule: 'ACCOUNTING',
    sourceDocumentType: 'VENDOR_ADJUSTMENT',
    sourceDocumentId: invoice.id,
    lines,
  }
}
