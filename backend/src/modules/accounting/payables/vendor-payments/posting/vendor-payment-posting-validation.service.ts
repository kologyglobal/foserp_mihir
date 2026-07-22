import { prisma } from '../../../../../config/database.js'
import { getLegalEntityOrThrow } from '../../../shared/finance.helpers.js'
import { compare, isPositive } from '../../../shared/finance-decimal.js'
import { resolvePostingPeriod } from '../../../posting/posting-period.service.js'
import { PostingError } from '../../../posting/posting.errors.js'
import type { PostingRequest } from '../../../posting/posting.types.js'
import {
  VENDOR_PAYMENT_CALCULATION_VERSION,
  type VendorPaymentAccountingPreview,
} from '../calculation/vendor-payment-calculation.types.js'
import { recalculateVendorPayment } from '../vendor-payment-draft.service.js'
import { resolvePaymentUniquenessKey } from '../vendor-payment-reference-normalization.js'
import * as repo from '../vendor-payment.repository.js'
import {
  VendorPaymentNotFoundError,
  VendorPaymentStaleVersionError,
  VendorPaymentUniquenessKeyConflictError,
  VendorPaymentVendorNotFoundError,
} from '../vendor-payment.errors.js'
import type { VendorPaymentWithLines } from '../vendor-payment.types.js'
import { findPayableOpenItemBySourceVendorPayment } from '../../open-items/payable-open-item.repository.js'
import { buildVendorPaymentPostingRequest } from './vendor-payment-accounting-builder.service.js'
import {
  accountMissingErrorForComponent,
  VendorPaymentAccountingAlreadyLinkedError,
  VendorPaymentAccountingPreviewChangedError,
  VendorPaymentAccountingPreviewUnbalancedError,
  VendorPaymentAlreadyPostedError,
  VendorPaymentApprovalIncompleteError,
  VendorPaymentApprovalInvalidatedError,
  VendorPaymentApprovalMismatchError,
  VendorPaymentCalculationVersionChangedError,
  VendorPaymentChangedAfterReadyError,
  VendorPaymentNotReadyToPostError,
  VendorPaymentNumberAlreadyAssignedError,
  VendorPaymentPayableOpenItemAlreadyExistsError,
  VendorPaymentPostingPeriodClosedError,
  VendorPaymentPostingPeriodUnderReviewError,
  VendorPaymentUniquenessKeyMissingError,
  VendorPaymentVendorInactiveError,
} from './vendor-payment-posting.errors.js'
import type { VendorPaymentPostingValidationContext } from './vendor-payment-posting.types.js'

export interface ValidatedVendorPaymentPosting {
  payment: VendorPaymentWithLines
  postingRequest: PostingRequest
  context: VendorPaymentPostingValidationContext
  preview: VendorPaymentAccountingPreview
}

function amountsDrift(payment: VendorPaymentWithLines, calc: Awaited<ReturnType<typeof recalculateVendorPayment>>): boolean {
  const t = calc.totals
  const b = calc.baseTotals
  return (
    compare(payment.paymentAmount, t.paymentAmount) !== 0 ||
    compare(payment.settlementAdjustmentAmount, t.settlementAdjustmentAmount) !== 0 ||
    compare(payment.paymentExpenseAmount, t.paymentExpenseAmount) !== 0 ||
    compare(payment.vendorSettlementAmount, t.vendorSettlementAmount) !== 0 ||
    compare(payment.cashOutflowAmount, t.cashOutflowAmount) !== 0 ||
    compare(payment.tdsAmount, t.tdsAmount) !== 0 ||
    compare(payment.roundOffAmount, t.netRoundOffAmount) !== 0 ||
    compare(payment.baseVendorSettlementAmount, b.baseVendorSettlementAmount) !== 0 ||
    compare(payment.baseCashOutflowAmount, b.baseCashOutflowAmount) !== 0
  )
}

function previewSignature(preview: VendorPaymentAccountingPreview): string {
  return JSON.stringify({
    isBalanced: preview.isBalanced,
    debitTotal: preview.debitTotal,
    creditTotal: preview.creditTotal,
    vendorPayableDebitAmount: preview.vendorPayableDebitAmount,
    paymentAccountCreditAmount: preview.paymentAccountCreditAmount,
    lines: preview.lines.map((l) => ({
      component: l.component,
      direction: l.direction,
      accountId: l.accountId,
      debitAmount: l.debitAmount,
      creditAmount: l.creditAmount,
      partyType: l.partyType,
      partyId: l.partyId,
      costCentreId: l.costCentreId ?? null,
    })),
  })
}

function previewChanged(stored: unknown, fresh: VendorPaymentAccountingPreview): boolean {
  if (!stored || typeof stored !== 'object') return true
  return previewSignature(stored as VendorPaymentAccountingPreview) !== previewSignature(fresh)
}

async function assertVendorEligible(tenantId: string, vendorId: string): Promise<void> {
  const vendor = await prisma.masterVendor.findFirst({
    where: { id: vendorId, tenantId, deletedAt: null },
  })
  if (!vendor) throw new VendorPaymentVendorNotFoundError()
  if (vendor.status !== 'ACTIVE' || vendor.isBlocked) {
    throw new VendorPaymentVendorInactiveError()
  }
}

async function assertApprovalState(payment: VendorPaymentWithLines): Promise<void> {
  if (!payment.approvalRequired) {
    const pending = await prisma.financeApprovalRequest.findFirst({
      where: {
        tenantId: payment.tenantId,
        legalEntityId: payment.legalEntityId,
        documentType: 'VENDOR_PAYMENT',
        documentId: payment.id,
        status: 'PENDING',
      },
    })
    if (pending) throw new VendorPaymentApprovalIncompleteError('A pending approval request exists for this payment')
    return
  }

  if (!payment.approvalRequestId) {
    throw new VendorPaymentApprovalIncompleteError()
  }

  const approval = await prisma.financeApprovalRequest.findFirst({
    where: {
      id: payment.approvalRequestId,
      tenantId: payment.tenantId,
      documentType: 'VENDOR_PAYMENT',
      documentId: payment.id,
    },
  })

  if (!approval) throw new VendorPaymentApprovalIncompleteError()
  if (approval.status === 'PENDING') throw new VendorPaymentApprovalIncompleteError()
  if (approval.status === 'REJECTED' || approval.status === 'CANCELLED') {
    throw new VendorPaymentApprovalInvalidatedError(`Approval request is ${approval.status}`)
  }
  if (approval.status !== 'APPROVED') {
    throw new VendorPaymentApprovalIncompleteError(`Approval request status is ${approval.status}`)
  }
  if (compare(approval.amountBasis, payment.baseCashOutflowAmount) !== 0) {
    throw new VendorPaymentApprovalMismatchError()
  }
}

async function assertUniquenessKey(payment: VendorPaymentWithLines): Promise<void> {
  const expected = resolvePaymentUniquenessKey({
    tenantId: payment.tenantId,
    legalEntityId: payment.legalEntityId,
    payment,
  })
  // CASH (and reference-less methods) legitimately carry no key — nothing to enforce.
  if (!expected) return

  if (!payment.paymentUniquenessKey) {
    throw new VendorPaymentUniquenessKeyMissingError()
  }
  if (payment.paymentUniquenessKey !== expected) {
    throw new VendorPaymentUniquenessKeyConflictError('Payment uniqueness key does not match current payment identity')
  }

  const owner = await prisma.vendorPayment.findFirst({
    where: {
      tenantId: payment.tenantId,
      paymentUniquenessKey: payment.paymentUniquenessKey,
      id: { not: payment.id },
    },
    select: { id: true },
  })
  if (owner) throw new VendorPaymentUniquenessKeyConflictError()
}

export async function validateVendorPaymentForPosting(
  tenantId: string,
  vendorPaymentId: string,
  expectedUpdatedAt: string,
): Promise<ValidatedVendorPaymentPosting> {
  let payment: VendorPaymentWithLines
  try {
    payment = await repo.findVendorPaymentWithLinesOrThrow(tenantId, vendorPaymentId)
  } catch {
    throw new VendorPaymentNotFoundError()
  }

  if (payment.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) {
    throw new VendorPaymentStaleVersionError()
  }

  if (payment.status === 'POSTED') {
    throw new VendorPaymentAlreadyPostedError()
  }
  if (payment.status !== 'READY_TO_POST') {
    throw new VendorPaymentNotReadyToPostError()
  }
  if (payment.vendorPaymentNumber) {
    throw new VendorPaymentNumberAlreadyAssignedError()
  }
  if (payment.accountingVoucherId || payment.postingEventId || payment.payableOpenItemId) {
    throw new VendorPaymentAccountingAlreadyLinkedError()
  }
  if (payment.cancelledAt) {
    throw new VendorPaymentNotReadyToPostError('Cancelled vendor payments cannot be posted')
  }
  if (payment.reversedAt) {
    throw new VendorPaymentNotReadyToPostError('Reversed vendor payments cannot be posted')
  }
  if (!isPositive(payment.vendorSettlementAmount)) {
    throw new VendorPaymentNotReadyToPostError('Vendor settlement amount must be positive to create a payable open item')
  }
  if (!isPositive(payment.cashOutflowAmount)) {
    throw new VendorPaymentNotReadyToPostError('Cash outflow amount must be positive')
  }

  const existingOpenItem = await findPayableOpenItemBySourceVendorPayment(
    tenantId,
    payment.legalEntityId,
    payment.id,
  )
  if (existingOpenItem) {
    throw new VendorPaymentPayableOpenItemAlreadyExistsError()
  }

  await getLegalEntityOrThrow(tenantId, payment.legalEntityId)
  await assertVendorEligible(tenantId, payment.vendorId)
  await assertUniquenessKey(payment)
  await assertApprovalState(payment)

  if (payment.calculationVersion !== VENDOR_PAYMENT_CALCULATION_VERSION) {
    throw new VendorPaymentCalculationVersionChangedError()
  }

  const calc = await recalculateVendorPayment(tenantId, payment)
  if (!calc.validation.isValid) {
    throw new VendorPaymentChangedAfterReadyError(
      calc.validation.errors[0]?.message ?? 'Vendor payment failed fresh validation',
    )
  }
  if (amountsDrift(payment, calc)) {
    throw new VendorPaymentChangedAfterReadyError()
  }
  if (!calc.accountingPreview.isBalanced || !calc.accountingPreview.isBaseBalanced) {
    throw new VendorPaymentAccountingPreviewUnbalancedError()
  }
  if (previewChanged(payment.accountingPreviewSnapshot, calc.accountingPreview)) {
    throw new VendorPaymentAccountingPreviewChangedError()
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

  const postingDate = (payment.proposedPostingDate ?? payment.paymentDate).toISOString().slice(0, 10)
  try {
    await resolvePostingPeriod(tenantId, payment.legalEntityId, postingDate)
  } catch (error) {
    if (error instanceof PostingError) {
      if (error.code === 'ACCOUNTING_PERIOD_CLOSED' || error.code === 'BACKDATED_POSTING_NOT_ALLOWED') {
        throw new VendorPaymentPostingPeriodClosedError(error.message)
      }
      if (error.code === 'ACCOUNTING_PERIOD_UNDER_REVIEW') {
        throw new VendorPaymentPostingPeriodUnderReviewError(error.message)
      }
    }
    throw error
  }

  const resolvedPeriod = await resolvePostingPeriod(tenantId, payment.legalEntityId, postingDate)
  const postingRequest = buildVendorPaymentPostingRequest({ payment, preview: calc.accountingPreview })

  return {
    payment,
    postingRequest,
    preview: calc.accountingPreview,
    context: {
      vendorPayableAccountId: vendorPayable.accountId,
      financialYearId: resolvedPeriod.financialYear.id,
      expectedUpdatedAt,
    },
  }
}
