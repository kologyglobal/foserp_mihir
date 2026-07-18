import { prisma } from '../../../../../config/database.js'
import { getLegalEntityOrThrow } from '../../../shared/finance.helpers.js'
import { compare, isPositive, isZero, sumDecimals } from '../../../shared/finance-decimal.js'
import { validateReceiptInput } from '../calculation/customer-receipt-validation-preview.service.js'
import { requireActiveCustomerParty } from '../../customer-party/customer-party.service.js'
import { resolvePostingPeriod } from '../../../posting/posting-period.service.js'
import { PostingError } from '../../../posting/posting.errors.js'
import * as repo from '../customer-receipt.repository.js'
import { buildCalculationInputFromStoredReceipt } from '../customer-receipt-validation.service.js'
import { CustomerReceiptNotFoundError, CustomerReceiptNotReadyError } from '../customer-receipt.errors.js'
import {
  CustomerReceiptAlreadyPostedError,
  CustomerReceiptChangedAfterReadyError,
  CustomerReceiptPostingAccountNotReadyError,
  CustomerReceiptPostingPeriodClosedError,
  CustomerReceiptPostingPeriodUnderReviewError,
  CustomerReceiptPostingValidationFailedError,
} from './customer-receipt-posting.errors.js'
import type { CustomerReceiptPostingValidationContext } from './customer-receipt-posting.types.js'
import type { CustomerReceiptWithDeductions } from '../customer-receipt.types.js'
import type { CustomerReceiptCalculationResult } from '../calculation/customer-receipt-calculation.types.js'
import { buildCustomerReceiptPostingRequest } from './customer-receipt-accounting-builder.service.js'
import type { PostingRequest } from '../../../posting/posting.types.js'

function amountsDrift(receipt: CustomerReceiptWithDeductions, calc: CustomerReceiptCalculationResult): boolean {
  return (
    compare(receipt.grossReceiptAmount, calc.grossReceiptAmount) !== 0 ||
    compare(receipt.bankCashAmount, calc.bankCashAmount) !== 0 ||
    compare(receipt.customerTdsAmount, calc.customerTdsAmount) !== 0 ||
    compare(receipt.bankChargeAmount, calc.bankChargeAmount) !== 0 ||
    compare(receipt.otherDeductionAmount, calc.otherDeductionAmount) !== 0
  )
}

function assertDeductionLineSumsMatchHeader(receipt: CustomerReceiptWithDeductions): void {
  const bankChargeSum = sumDecimals(
    receipt.deductionLines.filter((l) => l.type === 'BANK_CHARGE').map((l) => l.amount),
  )
  if (compare(bankChargeSum, receipt.bankChargeAmount) !== 0) {
    throw new CustomerReceiptPostingValidationFailedError(
      'Bank charge deduction line total does not match header bankChargeAmount',
      [{ field: 'bankCharges', message: 'Deduction line sum mismatch' }],
    )
  }
  const otherDeductionSum = sumDecimals(
    receipt.deductionLines.filter((l) => l.type === 'OTHER_DEDUCTION').map((l) => l.amount),
  )
  if (compare(otherDeductionSum, receipt.otherDeductionAmount) !== 0) {
    throw new CustomerReceiptPostingValidationFailedError(
      'Other deduction line total does not match header otherDeductionAmount',
      [{ field: 'otherDeductions', message: 'Deduction line sum mismatch' }],
    )
  }
}

export interface ValidatedCustomerReceiptPosting {
  receipt: CustomerReceiptWithDeductions
  postingRequest: PostingRequest
  context: CustomerReceiptPostingValidationContext
}

export async function validateCustomerReceiptForPosting(
  tenantId: string,
  receiptId: string,
): Promise<ValidatedCustomerReceiptPosting> {
  let receipt: CustomerReceiptWithDeductions
  try {
    receipt = await repo.findCustomerReceiptWithDeductionsOrThrow(tenantId, receiptId)
  } catch {
    throw new CustomerReceiptNotFoundError()
  }

  if (receipt.status === 'POSTED') {
    throw new CustomerReceiptAlreadyPostedError()
  }
  if (receipt.status !== 'READY_TO_POST') {
    throw new CustomerReceiptNotReadyError('Only receipts in READY_TO_POST status can be posted')
  }
  if (receipt.receiptNumber || receipt.accountingVoucherId || receipt.postingEventId || receipt.creditOpenItemId) {
    throw new CustomerReceiptAlreadyPostedError()
  }

  if (!isZero(receipt.allocatedAmount)) {
    throw new CustomerReceiptPostingValidationFailedError(
      'Receipt has allocated amount and cannot be posted in this phase',
      [{ field: 'allocatedAmount', message: 'Must be zero' }],
    )
  }
  const allocationCount = await prisma.customerReceiptAllocation.count({ where: { tenantId, receiptId: receipt.id } })
  if (allocationCount > 0) {
    throw new CustomerReceiptPostingValidationFailedError(
      'Receipt has allocation rows and cannot be posted in this phase',
      [{ field: 'allocations', message: 'Allocation persistence is not supported by this posting phase' }],
    )
  }

  await requireActiveCustomerParty(tenantId, receipt.customerId)
  await getLegalEntityOrThrow(tenantId, receipt.legalEntityId)

  const calcInput = buildCalculationInputFromStoredReceipt(receipt, tenantId)
  if (!calcInput) {
    throw new CustomerReceiptPostingValidationFailedError('Receipt calculation context is missing')
  }

  const preview = await validateReceiptInput(calcInput, {
    tenantId,
    customerNameSnapshot: receipt.customerNameSnapshot,
  })
  if (!preview.valid || !preview.calculation) {
    throw new CustomerReceiptPostingValidationFailedError(
      preview.errors[0]?.message ?? 'Receipt validation failed',
      preview.errors.map((e) => ({ field: e.field ?? 'receipt', message: e.message })),
    )
  }

  const calc = preview.calculation
  if (amountsDrift(receipt, calc)) {
    throw new CustomerReceiptChangedAfterReadyError()
  }
  assertDeductionLineSumsMatchHeader(receipt)

  const postingDate = (receipt.postingDate ?? receipt.receiptDate).toISOString().slice(0, 10)
  try {
    await resolvePostingPeriod(tenantId, receipt.legalEntityId, postingDate)
  } catch (error) {
    if (error instanceof PostingError) {
      if (error.code === 'ACCOUNTING_PERIOD_CLOSED' || error.code === 'BACKDATED_POSTING_NOT_ALLOWED') {
        throw new CustomerReceiptPostingPeriodClosedError(error.message)
      }
      if (error.code === 'ACCOUNTING_PERIOD_UNDER_REVIEW') {
        throw new CustomerReceiptPostingPeriodUnderReviewError(error.message)
      }
    }
    throw error
  }

  const { bankCash, customerReceivable, customerTds, bankCharges, otherDeductions } = preview.accountReadiness

  if (!bankCash.valid || !bankCash.accountId) {
    throw new CustomerReceiptPostingAccountNotReadyError(
      'Bank/cash account is not configured or not postable',
      [{ field: 'bankCashAccountId', message: bankCash.issues[0]?.message ?? 'Bank/cash account is not ready' }],
    )
  }
  if (!customerReceivable.valid || !customerReceivable.accountId) {
    throw new CustomerReceiptPostingAccountNotReadyError(
      'Customer receivable account is not configured or not postable',
      [{ field: 'customerReceivableAccountId', message: 'Configure CUSTOMER_RECEIVABLE mapping' }],
    )
  }
  if (isPositive(calc.customerTdsAmount) && (!customerTds.valid || !customerTds.accountId)) {
    throw new CustomerReceiptPostingAccountNotReadyError(
      'TDS receivable account is not configured or not postable',
      [{ field: 'customerTdsReceivableAccountId', message: 'Configure TDS_RECEIVABLE mapping' }],
    )
  }
  const invalidCharges = bankCharges.filter((a) => !a.valid || !a.accountId)
  if (invalidCharges.length > 0) {
    throw new CustomerReceiptPostingAccountNotReadyError(
      invalidCharges[0]?.issues[0]?.message ?? 'Bank charge account is not ready for posting',
      invalidCharges.flatMap((a) => a.issues.map((i) => ({ field: a.mappingKey, message: i.message }))),
    )
  }
  const invalidDeductions = otherDeductions.filter((a) => !a.valid || !a.accountId)
  if (invalidDeductions.length > 0) {
    throw new CustomerReceiptPostingAccountNotReadyError(
      invalidDeductions[0]?.issues[0]?.message ?? 'Other deduction account is not ready for posting',
      invalidDeductions.flatMap((a) => a.issues.map((i) => ({ field: a.mappingKey, message: i.message }))),
    )
  }

  const resolvedPeriod = await resolvePostingPeriod(tenantId, receipt.legalEntityId, postingDate)

  const postingRequest = buildCustomerReceiptPostingRequest({
    receipt,
    accounts: {
      bankCashAccountId: bankCash.accountId,
      customerReceivableAccountId: customerReceivable.accountId,
      customerTdsAccountId: customerTds.accountId,
    },
  })

  return {
    receipt,
    postingRequest,
    context: {
      bankCashAccountId: bankCash.accountId,
      customerReceivableAccountId: customerReceivable.accountId,
      customerTdsAccountId: customerTds.accountId,
      financialYearId: resolvedPeriod.financialYear.id,
    },
  }
}
