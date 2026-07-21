import { prisma } from '../../../../../config/database.js'
import { getLegalEntityOrThrow } from '../../../shared/finance.helpers.js'
import { compare, isPositive, isZero } from '../../../shared/finance-decimal.js'
import { resolvePostingPeriod } from '../../../posting/posting-period.service.js'
import { PostingError } from '../../../posting/posting.errors.js'
import type { PostingRequest } from '../../../posting/posting.types.js'
import {
  VENDOR_ADJUSTMENT_CALCULATION_VERSION,
  type VendorAdjustmentAccountingPreview,
} from '../calculation/vendor-adjustment-calculation.types.js'
import { recalculateVendorAdjustment } from '../vendor-adjustment-draft.service.js'
import { buildSupplierReferenceUniquenessKey } from '../vendor-adjustment-number-normalization.js'
import * as repo from '../vendor-adjustment.repository.js'
import {
  VendorAdjustmentExactDuplicateError,
  VendorAdjustmentNotFoundError,
  VendorAdjustmentStaleVersionError,
  VendorAdjustmentUniquenessKeyConflictError,
  VendorAdjustmentVendorNotFoundError,
} from '../vendor-adjustment.errors.js'
import type { VendorAdjustmentWithLines } from '../vendor-adjustment.types.js'
import { findPayableOpenItemBySourceVendorAdjustment } from '../../open-items/payable-open-item.repository.js'
import { buildVendorAdjustmentPostingRequest } from './vendor-adjustment-accounting-builder.service.js'
import {
  accountMissingErrorForComponent,
  VendorAdjustmentAccountingAlreadyLinkedError,
  VendorAdjustmentAccountingPreviewChangedError,
  VendorAdjustmentAccountingPreviewUnbalancedError,
  VendorAdjustmentAlreadyPostedError,
  VendorAdjustmentApprovalIncompleteError,
  VendorAdjustmentApprovalInvalidatedError,
  VendorAdjustmentApprovalMismatchError,
  VendorAdjustmentCalculationVersionChangedError,
  VendorAdjustmentChangedAfterReadyError,
  VendorAdjustmentNotReadyToPostError,
  VendorAdjustmentNumberAlreadyAssignedError,
  VendorAdjustmentPayableOpenItemAlreadyExistsError,
  VendorAdjustmentPostingPeriodClosedError,
  VendorAdjustmentPostingPeriodUnderReviewError,
  VendorAdjustmentUniquenessKeyMissingError,
  VendorAdjustmentVendorInactiveError,
} from './vendor-adjustment-posting.errors.js'
import type { VendorAdjustmentPostingValidationContext } from './vendor-adjustment-posting.types.js'

export interface ValidatedVendorAdjustmentPosting {
  invoice: VendorAdjustmentWithLines
  postingRequest: PostingRequest
  context: VendorAdjustmentPostingValidationContext
  preview: VendorAdjustmentAccountingPreview
}

function amountsDrift(invoice: VendorAdjustmentWithLines, calc: Awaited<ReturnType<typeof recalculateVendorAdjustment>>): boolean {
  const t = calc.totals
  return (
    compare(invoice.adjustmentGrandTotal, t.adjustmentGrandTotal) !== 0 ||
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
    compare(invoice.baseAdjustmentGrandTotal, calc.baseTotals.adjustmentGrandTotal) !== 0 ||
    compare(invoice.baseVendorPayableAmount, calc.baseTotals.vendorPayableAmount) !== 0
  )
}

function previewSignature(preview: VendorAdjustmentAccountingPreview): string {
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
  fresh: VendorAdjustmentAccountingPreview,
): boolean {
  if (!stored || typeof stored !== 'object') return true
  const storedPreview = stored as VendorAdjustmentAccountingPreview
  return previewSignature(storedPreview) !== previewSignature(fresh)
}

async function assertVendorEligible(tenantId: string, vendorId: string): Promise<void> {
  const vendor = await prisma.masterVendor.findFirst({
    where: { id: vendorId, tenantId, deletedAt: null },
  })
  if (!vendor) throw new VendorAdjustmentVendorNotFoundError()
  if (vendor.status !== 'ACTIVE' || vendor.isBlocked) {
    throw new VendorAdjustmentVendorInactiveError()
  }
}

async function assertApprovalState(invoice: VendorAdjustmentWithLines): Promise<void> {
  if (!invoice.approvalRequired) {
    const pending = await prisma.financeApprovalRequest.findFirst({
      where: {
        tenantId: invoice.tenantId,
        legalEntityId: invoice.legalEntityId,
        documentType: 'VENDOR_ADJUSTMENT',
        documentId: invoice.id,
        status: 'PENDING',
      },
    })
    if (pending) throw new VendorAdjustmentApprovalIncompleteError('A pending approval request exists for this invoice')
    return
  }

  if (!invoice.approvalRequestId) {
    throw new VendorAdjustmentApprovalIncompleteError()
  }

  const approval = await prisma.financeApprovalRequest.findFirst({
    where: {
      id: invoice.approvalRequestId,
      tenantId: invoice.tenantId,
      documentType: 'VENDOR_ADJUSTMENT',
      documentId: invoice.id,
    },
  })

  if (!approval) throw new VendorAdjustmentApprovalIncompleteError()
  if (approval.status === 'PENDING') throw new VendorAdjustmentApprovalIncompleteError()
  if (approval.status === 'REJECTED' || approval.status === 'CANCELLED') {
    throw new VendorAdjustmentApprovalInvalidatedError(`Approval request is ${approval.status}`)
  }
  if (approval.status !== 'APPROVED') {
    throw new VendorAdjustmentApprovalIncompleteError(`Approval request status is ${approval.status}`)
  }
  if (compare(approval.amountBasis, invoice.vendorPayableAmount) !== 0) {
    throw new VendorAdjustmentApprovalMismatchError()
  }
}

async function assertUniquenessKey(invoice: VendorAdjustmentWithLines): Promise<void> {
  if (!invoice.supplierReferenceUniquenessKey) {
    throw new VendorAdjustmentUniquenessKeyMissingError()
  }
  const expected = buildSupplierReferenceUniquenessKey({
    tenantId: invoice.tenantId,
    legalEntityId: invoice.legalEntityId,
    vendorId: invoice.vendorId,
    financialYearId: invoice.financialYearId,
    supplierReferenceNumberNormalized: invoice.supplierReferenceNumberNormalized,
  })
  if (invoice.supplierReferenceUniquenessKey !== expected) {
    throw new VendorAdjustmentUniquenessKeyConflictError('Supplier uniqueness key does not match current invoice identity')
  }

  const owner = await prisma.vendorAdjustment.findFirst({
    where: {
      tenantId: invoice.tenantId,
      supplierReferenceUniquenessKey: invoice.supplierReferenceUniquenessKey,
      id: { not: invoice.id },
    },
    select: { id: true },
  })
  if (owner) throw new VendorAdjustmentUniquenessKeyConflictError()
}

export async function validateVendorAdjustmentForPosting(
  tenantId: string,
  vendorAdjustmentId: string,
  expectedUpdatedAt: string,
): Promise<ValidatedVendorAdjustmentPosting> {
  let invoice: VendorAdjustmentWithLines
  try {
    invoice = await repo.findVendorAdjustmentWithLinesOrThrow(tenantId, vendorAdjustmentId)
  } catch {
    throw new VendorAdjustmentNotFoundError()
  }

  if (invoice.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) {
    throw new VendorAdjustmentStaleVersionError()
  }

  if (invoice.status === 'POSTED') {
    throw new VendorAdjustmentAlreadyPostedError()
  }
  if (invoice.status !== 'READY_TO_POST') {
    throw new VendorAdjustmentNotReadyToPostError()
  }
  if (invoice.vendorAdjustmentNumber) {
    throw new VendorAdjustmentNumberAlreadyAssignedError()
  }
  if (invoice.accountingVoucherId || invoice.postingEventId) {
    throw new VendorAdjustmentAccountingAlreadyLinkedError()
  }
  if (invoice.cancelledAt) {
    throw new VendorAdjustmentNotReadyToPostError('Cancelled vendor invoices cannot be posted')
  }
  if (invoice.reversedAt) {
    throw new VendorAdjustmentNotReadyToPostError('Reversed vendor invoices cannot be posted')
  }
  if (!invoice.lines.length) {
    throw new VendorAdjustmentNotReadyToPostError('Vendor invoice has no lines')
  }
  if (!isPositive(invoice.adjustmentGrandTotal) || !isPositive(invoice.vendorPayableAmount)) {
    throw new VendorAdjustmentNotReadyToPostError('Invoice grand total and vendor payable amount must be positive')
  }

  const existingOpenItem = await findPayableOpenItemBySourceVendorAdjustment(
    tenantId,
    invoice.legalEntityId,
    invoice.id,
  )
  if (existingOpenItem) {
    throw new VendorAdjustmentPayableOpenItemAlreadyExistsError()
  }

  await getLegalEntityOrThrow(tenantId, invoice.legalEntityId)
  await assertVendorEligible(tenantId, invoice.vendorId)
  await assertUniquenessKey(invoice)
  await assertApprovalState(invoice)

  if (invoice.calculationVersion !== VENDOR_ADJUSTMENT_CALCULATION_VERSION) {
    throw new VendorAdjustmentCalculationVersionChangedError()
  }

  const calc = await recalculateVendorAdjustment(tenantId, invoice)
  if (calc.duplicateAssessment.isBlocking) {
    throw new VendorAdjustmentExactDuplicateError()
  }
  if (!calc.validation.isValid) {
    throw new VendorAdjustmentChangedAfterReadyError(
      calc.validation.errors[0]?.message ?? 'Vendor invoice failed fresh validation',
    )
  }
  if (amountsDrift(invoice, calc)) {
    throw new VendorAdjustmentChangedAfterReadyError()
  }
  if (!calc.accountingPreview.isBalanced) {
    throw new VendorAdjustmentAccountingPreviewUnbalancedError()
  }
  if (previewChanged(invoice.accountingPreviewSnapshot, calc.accountingPreview)) {
    throw new VendorAdjustmentAccountingPreviewChangedError()
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
        throw new VendorAdjustmentPostingPeriodClosedError(error.message)
      }
      if (error.code === 'ACCOUNTING_PERIOD_UNDER_REVIEW') {
        throw new VendorAdjustmentPostingPeriodUnderReviewError(error.message)
      }
    }
    throw error
  }

  const resolvedPeriod = await resolvePostingPeriod(tenantId, invoice.legalEntityId, postingDate)
  const postingRequest = buildVendorAdjustmentPostingRequest({
    invoice,
    preview: calc.accountingPreview,
  })

  // Ensure no zero-amount drift on payable GL vs open item basis.
  if (isZero(calc.totals.vendorPayableAmount)) {
    throw new VendorAdjustmentNotReadyToPostError('Vendor payable amount must be positive')
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
