import { prisma } from '../../../../../config/database.js'
import { getLegalEntityOrThrow } from '../../../shared/finance.helpers.js'
import { compare, isPositive, isZero } from '../../../shared/finance-decimal.js'
import { resolvePostingPeriod } from '../../../posting/posting-period.service.js'
import { PostingError } from '../../../posting/posting.errors.js'
import type { PostingRequest } from '../../../posting/posting.types.js'
import {
  VENDOR_INVOICE_CALCULATION_VERSION,
  type VendorInvoiceAccountingPreview,
} from '../calculation/vendor-invoice-calculation.types.js'
import { recalculateVendorInvoice } from '../vendor-invoice-draft.service.js'
import { buildSupplierInvoiceUniquenessKey } from '../vendor-invoice-number-normalization.js'
import * as repo from '../vendor-invoice.repository.js'
import {
  VendorInvoiceExactDuplicateError,
  VendorInvoiceNotFoundError,
  VendorInvoiceStaleVersionError,
  VendorInvoiceUniquenessKeyConflictError,
  VendorInvoiceVendorNotFoundError,
} from '../vendor-invoice.errors.js'
import type { VendorInvoiceWithLines } from '../vendor-invoice.types.js'
import { findPayableOpenItemBySourceVendorInvoice } from '../../open-items/payable-open-item.repository.js'
import { buildVendorInvoicePostingRequest } from './vendor-invoice-accounting-builder.service.js'
import {
  accountMissingErrorForComponent,
  VendorInvoiceAccountingAlreadyLinkedError,
  VendorInvoiceAccountingPreviewChangedError,
  VendorInvoiceAccountingPreviewUnbalancedError,
  VendorInvoiceAlreadyPostedError,
  VendorInvoiceApprovalIncompleteError,
  VendorInvoiceApprovalInvalidatedError,
  VendorInvoiceApprovalMismatchError,
  VendorInvoiceCalculationVersionChangedError,
  VendorInvoiceChangedAfterReadyError,
  VendorInvoiceNotReadyToPostError,
  VendorInvoiceNumberAlreadyAssignedError,
  VendorInvoicePayableOpenItemAlreadyExistsError,
  VendorInvoicePostingPeriodClosedError,
  VendorInvoicePostingPeriodUnderReviewError,
  VendorInvoiceUniquenessKeyMissingError,
  VendorInvoiceVendorInactiveError,
} from './vendor-invoice-posting.errors.js'
import type { VendorInvoicePostingValidationContext } from './vendor-invoice-posting.types.js'

export interface ValidatedVendorInvoicePosting {
  invoice: VendorInvoiceWithLines
  postingRequest: PostingRequest
  context: VendorInvoicePostingValidationContext
  preview: VendorInvoiceAccountingPreview
}

function amountsDrift(invoice: VendorInvoiceWithLines, calc: Awaited<ReturnType<typeof recalculateVendorInvoice>>): boolean {
  const t = calc.totals
  return (
    compare(invoice.invoiceGrandTotal, t.invoiceGrandTotal) !== 0 ||
    compare(invoice.vendorPayableAmount, t.vendorPayableAmount) !== 0 ||
    compare(invoice.taxableAmount, t.taxableAmount) !== 0 ||
    compare(invoice.tdsAmount, t.tdsAmount) !== 0 ||
    compare(invoice.inputCgstAmount, t.inputCgstAmount) !== 0 ||
    compare(invoice.inputSgstAmount, t.inputSgstAmount) !== 0 ||
    compare(invoice.inputIgstAmount, t.inputIgstAmount) !== 0 ||
    compare(invoice.inputCessAmount, t.inputCessAmount) !== 0 ||
    compare(invoice.nonRecoverableTaxAmount, t.nonRecoverableTaxAmount) !== 0 ||
    compare(invoice.freightAmount, t.freightAmount) !== 0 ||
    compare(invoice.otherChargeAmount, t.otherChargeAmount) !== 0 ||
    compare(invoice.roundOffAmount, t.roundOffAmount) !== 0 ||
    compare(invoice.baseInvoiceGrandTotal, calc.baseTotals.invoiceGrandTotal) !== 0 ||
    compare(invoice.baseVendorPayableAmount, calc.baseTotals.vendorPayableAmount) !== 0
  )
}

function previewSignature(preview: VendorInvoiceAccountingPreview): string {
  return JSON.stringify({
    isBalanced: preview.isBalanced,
    totalDebit: preview.totalDebit,
    totalCredit: preview.totalCredit,
    vendorPayableCreditAmount: preview.vendorPayableCreditAmount,
    lines: preview.lines.map((l) => ({
      lineNumber: l.lineNumber,
      component: l.component,
      direction: l.direction,
      accountId: l.accountId,
      debitAmount: l.debitAmount,
      creditAmount: l.creditAmount,
      partyType: l.partyType,
      partyId: l.partyId,
      costCentreId: l.costCentreId,
      sourceLineNumber: l.sourceLineNumber,
    })),
  })
}

function previewChanged(
  stored: unknown,
  fresh: VendorInvoiceAccountingPreview,
): boolean {
  if (!stored || typeof stored !== 'object') return true
  const storedPreview = stored as VendorInvoiceAccountingPreview
  return previewSignature(storedPreview) !== previewSignature(fresh)
}

async function assertVendorEligible(tenantId: string, vendorId: string): Promise<void> {
  const vendor = await prisma.masterVendor.findFirst({
    where: { id: vendorId, tenantId, deletedAt: null },
  })
  if (!vendor) throw new VendorInvoiceVendorNotFoundError()
  if (vendor.status !== 'ACTIVE' || vendor.isBlocked) {
    throw new VendorInvoiceVendorInactiveError()
  }
}

async function assertApprovalState(invoice: VendorInvoiceWithLines): Promise<void> {
  if (!invoice.approvalRequired) {
    const pending = await prisma.financeApprovalRequest.findFirst({
      where: {
        tenantId: invoice.tenantId,
        legalEntityId: invoice.legalEntityId,
        documentType: 'VENDOR_INVOICE',
        documentId: invoice.id,
        status: 'PENDING',
      },
    })
    if (pending) throw new VendorInvoiceApprovalIncompleteError('A pending approval request exists for this invoice')
    return
  }

  if (!invoice.approvalRequestId) {
    throw new VendorInvoiceApprovalIncompleteError()
  }

  const approval = await prisma.financeApprovalRequest.findFirst({
    where: {
      id: invoice.approvalRequestId,
      tenantId: invoice.tenantId,
      documentType: 'VENDOR_INVOICE',
      documentId: invoice.id,
    },
  })

  if (!approval) throw new VendorInvoiceApprovalIncompleteError()
  if (approval.status === 'PENDING') throw new VendorInvoiceApprovalIncompleteError()
  if (approval.status === 'REJECTED' || approval.status === 'CANCELLED') {
    throw new VendorInvoiceApprovalInvalidatedError(`Approval request is ${approval.status}`)
  }
  if (approval.status !== 'APPROVED') {
    throw new VendorInvoiceApprovalIncompleteError(`Approval request status is ${approval.status}`)
  }
  if (compare(approval.amountBasis, invoice.vendorPayableAmount) !== 0) {
    throw new VendorInvoiceApprovalMismatchError()
  }
}

async function assertUniquenessKey(invoice: VendorInvoiceWithLines): Promise<void> {
  if (!invoice.supplierInvoiceUniquenessKey) {
    throw new VendorInvoiceUniquenessKeyMissingError()
  }
  const expected = buildSupplierInvoiceUniquenessKey({
    tenantId: invoice.tenantId,
    legalEntityId: invoice.legalEntityId,
    vendorId: invoice.vendorId,
    financialYearId: invoice.financialYearId,
    supplierInvoiceNumberNormalized: invoice.supplierInvoiceNumberNormalized,
  })
  if (invoice.supplierInvoiceUniquenessKey !== expected) {
    throw new VendorInvoiceUniquenessKeyConflictError('Supplier uniqueness key does not match current invoice identity')
  }

  const owner = await prisma.vendorInvoice.findFirst({
    where: {
      tenantId: invoice.tenantId,
      supplierInvoiceUniquenessKey: invoice.supplierInvoiceUniquenessKey,
      id: { not: invoice.id },
    },
    select: { id: true },
  })
  if (owner) throw new VendorInvoiceUniquenessKeyConflictError()
}

export async function validateVendorInvoiceForPosting(
  tenantId: string,
  vendorInvoiceId: string,
  expectedUpdatedAt: string,
): Promise<ValidatedVendorInvoicePosting> {
  let invoice: VendorInvoiceWithLines
  try {
    invoice = await repo.findVendorInvoiceWithLinesOrThrow(tenantId, vendorInvoiceId)
  } catch {
    throw new VendorInvoiceNotFoundError()
  }

  if (invoice.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) {
    throw new VendorInvoiceStaleVersionError()
  }

  if (invoice.status === 'POSTED') {
    throw new VendorInvoiceAlreadyPostedError()
  }
  if (invoice.status !== 'READY_TO_POST') {
    throw new VendorInvoiceNotReadyToPostError()
  }
  if (invoice.vendorInvoiceNumber) {
    throw new VendorInvoiceNumberAlreadyAssignedError()
  }
  if (invoice.accountingVoucherId || invoice.postingEventId) {
    throw new VendorInvoiceAccountingAlreadyLinkedError()
  }
  if (invoice.cancelledAt) {
    throw new VendorInvoiceNotReadyToPostError('Cancelled vendor invoices cannot be posted')
  }
  if (invoice.reversedAt) {
    throw new VendorInvoiceNotReadyToPostError('Reversed vendor invoices cannot be posted')
  }
  if (!invoice.lines.length) {
    throw new VendorInvoiceNotReadyToPostError('Vendor invoice has no lines')
  }
  if (!isPositive(invoice.invoiceGrandTotal) || !isPositive(invoice.vendorPayableAmount)) {
    throw new VendorInvoiceNotReadyToPostError('Invoice grand total and vendor payable amount must be positive')
  }

  const existingOpenItem = await findPayableOpenItemBySourceVendorInvoice(
    tenantId,
    invoice.legalEntityId,
    invoice.id,
  )
  if (existingOpenItem) {
    throw new VendorInvoicePayableOpenItemAlreadyExistsError()
  }

  await getLegalEntityOrThrow(tenantId, invoice.legalEntityId)
  await assertVendorEligible(tenantId, invoice.vendorId)
  await assertUniquenessKey(invoice)
  await assertApprovalState(invoice)

  if (invoice.calculationVersion !== VENDOR_INVOICE_CALCULATION_VERSION) {
    throw new VendorInvoiceCalculationVersionChangedError()
  }

  const calc = await recalculateVendorInvoice(tenantId, invoice)
  if (calc.duplicateAssessment.isBlocking) {
    throw new VendorInvoiceExactDuplicateError()
  }
  if (!calc.validation.isValid) {
    throw new VendorInvoiceChangedAfterReadyError(
      calc.validation.errors[0]?.message ?? 'Vendor invoice failed fresh validation',
    )
  }
  if (amountsDrift(invoice, calc)) {
    throw new VendorInvoiceChangedAfterReadyError()
  }
  if (!calc.accountingPreview.isBalanced) {
    throw new VendorInvoiceAccountingPreviewUnbalancedError()
  }
  if (previewChanged(invoice.accountingPreviewSnapshot, calc.accountingPreview)) {
    throw new VendorInvoiceAccountingPreviewChangedError()
  }

  const invalidAccounts = calc.accountReadiness.resolvedAccounts.filter((a) => a.isRequired && !a.isValid)
  if (invalidAccounts.length > 0) {
    const first = invalidAccounts[0]!
    throw accountMissingErrorForComponent(
      first.component,
      first.issueMessage ?? `Required account missing for ${first.component}`,
    )
  }

  const vendorPayable = calc.accountReadiness.resolvedAccounts.find(
    (a) => a.component === 'VENDOR_PAYABLE' && a.isValid && a.accountId,
  )
  if (!vendorPayable?.accountId) {
    throw accountMissingErrorForComponent('VENDOR_PAYABLE', 'Vendor payable account is not configured')
  }

  const postingDate = (invoice.postingDate ?? invoice.documentDate).toISOString().slice(0, 10)
  try {
    await resolvePostingPeriod(tenantId, invoice.legalEntityId, postingDate)
  } catch (error) {
    if (error instanceof PostingError) {
      if (error.code === 'ACCOUNTING_PERIOD_CLOSED' || error.code === 'BACKDATED_POSTING_NOT_ALLOWED') {
        throw new VendorInvoicePostingPeriodClosedError(error.message)
      }
      if (error.code === 'ACCOUNTING_PERIOD_UNDER_REVIEW') {
        throw new VendorInvoicePostingPeriodUnderReviewError(error.message)
      }
    }
    throw error
  }

  const resolvedPeriod = await resolvePostingPeriod(tenantId, invoice.legalEntityId, postingDate)
  const postingRequest = buildVendorInvoicePostingRequest({
    invoice,
    preview: calc.accountingPreview,
  })

  // Ensure no zero-amount drift on payable GL vs open item basis.
  if (isZero(calc.totals.vendorPayableAmount)) {
    throw new VendorInvoiceNotReadyToPostError('Vendor payable amount must be positive')
  }

  return {
    invoice,
    postingRequest,
    preview: calc.accountingPreview,
    context: {
      vendorPayableAccountId: vendorPayable.accountId,
      financialYearId: resolvedPeriod.financialYear.id,
      expectedUpdatedAt,
    },
  }
}
