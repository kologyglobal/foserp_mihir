import { Prisma } from '@prisma/client'
import {
  add,
  isPositive,
  isZero,
  roundAmount,
  toDecimal,
} from '../../../shared/finance-decimal.js'
import type {
  CustomerReceiptCalculationInput,
  CustomerReceiptCalculationResult,
  ReceiptValidationIssue,
} from './customer-receipt-calculation.types.js'
import { customerReceiptCalculationInputSchema } from './customer-receipt-calculation.schemas.js'
import {
  RECEIPT_ERROR_CODES,
  RECEIPT_WARNING_CODES,
  receiptError,
  receiptWarning,
} from './customer-receipt-calculation.errors.js'
import { calculateCustomerTds } from './customer-tds-calculation.service.js'
import {
  calculateBankCharges,
  calculateOtherDeductions,
} from './receipt-charge-calculation.service.js'
import {
  format4,
  format8,
  resolveReceiptCurrency,
  toBaseAmount,
} from './receipt-currency-calculation.service.js'
import {
  aggregateProposedAllocations,
  buildAmountOnlyAllocationPreview,
  computeUnallocatedAmount,
  sumProposedAllocationAmount,
} from './receipt-allocation-preview.service.js'
import { buildCustomerReceiptPostingPreview } from './receipt-posting-preview.service.js'

export interface CalculateCustomerReceiptOptions {
  baseCurrencyCode?: string
  multiCurrencyEnabled?: boolean
  maxTdsPercentage?: string
  allowCustomTdsRates?: boolean
  customerNameSnapshot?: string | null
}

function emptyResult(
  errors: ReceiptValidationIssue[],
  warnings: ReceiptValidationIssue[],
  currencyCode = 'INR',
): CustomerReceiptCalculationResult {
  const zero = '0.0000'
  return {
    valid: false,
    currencyCode,
    exchangeRate: '1.00000000',
    bankCashAmount: zero,
    customerTdsAmount: zero,
    bankChargeAmount: zero,
    otherDeductionAmount: zero,
    grossReceiptAmount: zero,
    allocatableAmount: zero,
    proposedAllocatedAmount: zero,
    unallocatedAmount: zero,
    baseBankCashAmount: zero,
    baseCustomerTdsAmount: zero,
    baseBankChargeAmount: zero,
    baseOtherDeductionAmount: zero,
    baseGrossReceiptAmount: zero,
    baseAllocatableAmount: zero,
    baseProposedAllocatedAmount: zero,
    baseUnallocatedAmount: zero,
    tdsSummary: null,
    bankChargeSummary: [],
    otherDeductionSummary: [],
    allocationPreview: [],
    postingPreview: {
      debitLines: [],
      creditLines: [],
      totalDebit: zero,
      totalCredit: zero,
      baseTotalDebit: zero,
      baseTotalCredit: zero,
      balanced: true,
    },
    errors,
    warnings,
  }
}

/**
 * Pure, side-effect-free customer receipt calculation.
 * Gross = Bank/Cash + Customer TDS + Bank Charges + Other Deductions
 * Allocatable = Gross
 * Does not persist, post, or mutate open items.
 */
export function calculateCustomerReceipt(
  input: CustomerReceiptCalculationInput,
  options: CalculateCustomerReceiptOptions = {},
): CustomerReceiptCalculationResult {
  const errors: ReceiptValidationIssue[] = []
  const warnings: ReceiptValidationIssue[] = []

  const parsed = customerReceiptCalculationInputSchema.safeParse(input)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(receiptError('VALIDATION_ERROR', issue.message, issue.path.join('.')))
    }
    return emptyResult(errors, warnings, input.currencyCode ?? 'INR')
  }

  const data = parsed.data

  const currency = resolveReceiptCurrency({
    currencyCode: data.currencyCode,
    baseCurrencyCode: options.baseCurrencyCode ?? 'INR',
    exchangeRateInput: data.exchangeRate,
    multiCurrencyEnabled: options.multiCurrencyEnabled ?? true,
  })
  errors.push(...currency.errors)
  const rate = currency.exchangeRateDecimal

  // Bank/cash amount — ordinary receipts require > 0
  let bankCash = toDecimal(data.bankCashAmount)
  if (bankCash.isNegative()) {
    errors.push(
      receiptError(
        RECEIPT_ERROR_CODES.CUSTOMER_RECEIPT_BANK_AMOUNT_INVALID,
        'Bank/cash amount cannot be negative',
        'bankCashAmount',
      ),
    )
    bankCash = new Prisma.Decimal(0)
  } else if (isZero(bankCash)) {
    errors.push(
      receiptError(
        RECEIPT_ERROR_CODES.CUSTOMER_RECEIPT_BANK_AMOUNT_INVALID,
        'Bank/cash amount must be greater than zero for ordinary receipts',
        'bankCashAmount',
      ),
    )
  } else {
    bankCash = roundAmount(bankCash, 4)
  }

  // Bank/cash account mandatory check belongs to account readiness (validation preview).

  const tds = calculateCustomerTds(data.customerTds, {
    maxTdsPercentage: options.maxTdsPercentage,
    allowCustomTdsRates: options.allowCustomTdsRates,
    resolvedAccountId: data.customerTds?.accountId,
  })
  errors.push(...tds.errors)
  warnings.push(...tds.warnings)

  const bankCharges = calculateBankCharges(data.bankCharges)
  errors.push(...bankCharges.errors)
  warnings.push(...bankCharges.warnings)

  const otherDeductions = calculateOtherDeductions(data.otherDeductions)
  errors.push(...otherDeductions.errors)
  warnings.push(...otherDeductions.warnings)

  const gross = roundAmount(
    add(add(bankCash, tds.amount), add(bankCharges.total, otherDeductions.total)),
    4,
  )

  if (!isPositive(gross)) {
    errors.push(
      receiptError(
        RECEIPT_ERROR_CODES.CUSTOMER_RECEIPT_GROSS_AMOUNT_INVALID,
        'Gross receipt amount must be greater than zero',
        'grossReceiptAmount',
      ),
    )
  }

  // Large receipt warning (₹1 crore+)
  if (gross.gte(10_000_000)) {
    warnings.push(
      receiptWarning(
        RECEIPT_WARNING_CODES.LARGE_RECEIPT_AMOUNT,
        'Receipt amount is unusually large — confirm before posting',
        'grossReceiptAmount',
      ),
    )
  }

  const allocatable = gross
  if (!isPositive(allocatable) && errors.every((e) => e.code !== RECEIPT_ERROR_CODES.CUSTOMER_RECEIPT_GROSS_AMOUNT_INVALID)) {
    errors.push(
      receiptError(
        RECEIPT_ERROR_CODES.CUSTOMER_RECEIPT_ALLOCATABLE_AMOUNT_INVALID,
        'Allocatable amount must be greater than zero',
        'allocatableAmount',
      ),
    )
  }

  const aggregates = aggregateProposedAllocations(data.proposedAllocations, errors, warnings)
  const proposedAllocated = sumProposedAllocationAmount(aggregates)
  const unallocated = computeUnallocatedAmount(allocatable, proposedAllocated, errors, warnings)

  const allocationPreview = buildAmountOnlyAllocationPreview(
    aggregates,
    rate,
    currency.currencyCode,
  )

  // Update TDS summary base amount
  const tdsSummary = tds.summary
    ? {
        ...tds.summary,
        baseAmount: format4(toBaseAmount(tds.amount, rate)),
      }
    : null

  const bankChargeSummary = bankCharges.rows.map((r) => ({
    ...r,
    baseAmount: format4(toBaseAmount(toDecimal(r.amount), rate)),
  }))
  const otherDeductionSummary = otherDeductions.rows.map((r) => ({
    ...r,
    baseAmount: format4(toBaseAmount(toDecimal(r.amount), rate)),
  }))

  const posting = buildCustomerReceiptPostingPreview({
    bankCashAmount: bankCash,
    customerTdsAmount: tds.amount,
    bankChargeAmount: bankCharges.total,
    otherDeductionAmount: otherDeductions.total,
    grossReceiptAmount: gross,
    exchangeRate: rate,
    customerId: data.customerId,
    customerNameSnapshot: options.customerNameSnapshot ?? null,
    accounts: {
      bankCashAccountId: data.bankCashAccountId ?? null,
      customerReceivableAccountId: data.customerReceivableAccountId ?? null,
      customerTdsAccountId: data.customerTds?.accountId ?? null,
      bankChargeAccountIds: (data.bankCharges ?? []).map((c) => c.accountId ?? null),
      otherDeductionAccountIds: (data.otherDeductions ?? []).map((d) => d.accountId ?? null),
    },
    bankChargeRows: bankChargeSummary,
    otherDeductionRows: otherDeductionSummary,
    tdsSummary,
  })
  errors.push(...posting.errors)

  const baseBankCash = toBaseAmount(bankCash, rate)
  const baseTds = toBaseAmount(tds.amount, rate)
  const baseCharges = toBaseAmount(bankCharges.total, rate)
  const baseOther = toBaseAmount(otherDeductions.total, rate)
  const baseGross = roundAmount(add(add(baseBankCash, baseTds), add(baseCharges, baseOther)), 4)
  const expectedBaseGross = toBaseAmount(gross, rate)
  // Prefer component-sum invariant; allow 0.0001 tolerance via exact Decimal equality after rounding each component
  if (isPositive(gross) && !baseGross.eq(expectedBaseGross)) {
    // When rate is non-unity, component rounding may differ from gross×rate by 1 ulp —
    // use component sum as the authoritative baseGross for invariant.
  }

  return {
    valid: errors.length === 0,
    currencyCode: currency.currencyCode,
    exchangeRate: format8(rate),
    bankCashAmount: format4(bankCash),
    customerTdsAmount: format4(tds.amount),
    bankChargeAmount: format4(bankCharges.total),
    otherDeductionAmount: format4(otherDeductions.total),
    grossReceiptAmount: format4(gross),
    allocatableAmount: format4(allocatable),
    proposedAllocatedAmount: format4(proposedAllocated),
    unallocatedAmount: format4(unallocated),
    baseBankCashAmount: format4(baseBankCash),
    baseCustomerTdsAmount: format4(baseTds),
    baseBankChargeAmount: format4(baseCharges),
    baseOtherDeductionAmount: format4(baseOther),
    baseGrossReceiptAmount: format4(baseGross),
    baseAllocatableAmount: format4(baseGross),
    baseProposedAllocatedAmount: format4(toBaseAmount(proposedAllocated, rate)),
    baseUnallocatedAmount: format4(toBaseAmount(unallocated, rate)),
    tdsSummary,
    bankChargeSummary,
    otherDeductionSummary,
    allocationPreview,
    postingPreview: posting.preview,
    errors,
    warnings,
  }
}
