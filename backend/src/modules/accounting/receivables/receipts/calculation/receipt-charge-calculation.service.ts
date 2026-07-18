import { Prisma } from '@prisma/client'
import {
  isNegative,
  isPositive,
  isZero,
  roundAmount,
  sumDecimals,
  toDecimal,
} from '../../../shared/finance-decimal.js'
import type {
  ReceiptBankChargeInput,
  ReceiptChargeSummaryRow,
  ReceiptOtherDeductionInput,
  ReceiptValidationIssue,
} from './customer-receipt-calculation.types.js'
import {
  RECEIPT_ERROR_CODES,
  RECEIPT_WARNING_CODES,
  receiptError,
  receiptWarning,
} from './customer-receipt-calculation.errors.js'

function format4(value: Prisma.Decimal): string {
  return roundAmount(value, 4).toFixed(4)
}

export interface ChargeCalculationResult {
  total: Prisma.Decimal
  rows: ReceiptChargeSummaryRow[]
  errors: ReceiptValidationIssue[]
  warnings: ReceiptValidationIssue[]
}

export function calculateBankCharges(
  charges: ReceiptBankChargeInput[] | null | undefined,
): ChargeCalculationResult {
  const errors: ReceiptValidationIssue[] = []
  const warnings: ReceiptValidationIssue[] = []
  const rows: ReceiptChargeSummaryRow[] = []

  if (!charges?.length) {
    return { total: new Prisma.Decimal(0), rows, errors, warnings }
  }

  const amounts: Prisma.Decimal[] = []
  charges.forEach((charge, rowIndex) => {
    const amount = toDecimal(charge.amount)
    if (isNegative(amount) || isZero(amount)) {
      errors.push(
        receiptError(
          RECEIPT_ERROR_CODES.BANK_CHARGE_AMOUNT_INVALID,
          'Bank charge amount must be greater than zero',
          'bankCharges.amount',
          { rowIndex },
        ),
      )
      return
    }
    if (!charge.description?.trim()) {
      errors.push(
        receiptError(
          RECEIPT_ERROR_CODES.BANK_CHARGE_AMOUNT_INVALID,
          'Bank charge description is required',
          'bankCharges.description',
          { rowIndex },
        ),
      )
    }
    // Account required when amount > 0 — enforced in account readiness (mapping fallback allowed).
    const rounded = roundAmount(amount, 4)
    amounts.push(rounded)
    rows.push({
      rowIndex,
      description: charge.description,
      amount: format4(rounded),
      baseAmount: format4(rounded),
      accountId: charge.accountId ?? null,
    })
  })

  return {
    total: roundAmount(sumDecimals(amounts), 4),
    rows,
    errors,
    warnings,
  }
}

export function calculateOtherDeductions(
  deductions: ReceiptOtherDeductionInput[] | null | undefined,
): ChargeCalculationResult {
  const errors: ReceiptValidationIssue[] = []
  const warnings: ReceiptValidationIssue[] = []
  const rows: ReceiptChargeSummaryRow[] = []

  if (!deductions?.length) {
    return { total: new Prisma.Decimal(0), rows, errors, warnings }
  }

  const amounts: Prisma.Decimal[] = []
  deductions.forEach((deduction, rowIndex) => {
    const amount = toDecimal(deduction.amount)
    if (isNegative(amount) || isZero(amount)) {
      errors.push(
        receiptError(
          RECEIPT_ERROR_CODES.OTHER_DEDUCTION_AMOUNT_INVALID,
          'Other deduction amount must be greater than zero',
          'otherDeductions.amount',
          { rowIndex },
        ),
      )
      return
    }
    if (!deduction.description?.trim()) {
      errors.push(
        receiptError(
          RECEIPT_ERROR_CODES.OTHER_DEDUCTION_AMOUNT_INVALID,
          'Other deduction description is required',
          'otherDeductions.description',
          { rowIndex },
        ),
      )
    }
    if (!deduction.code?.trim()) {
      errors.push(
        receiptError(
          RECEIPT_ERROR_CODES.OTHER_DEDUCTION_AMOUNT_INVALID,
          'Other deduction code is required',
          'otherDeductions.code',
          { rowIndex },
        ),
      )
    }

    warnings.push(
      receiptWarning(
        RECEIPT_WARNING_CODES.OTHER_DEDUCTION_REVIEW_REQUIRED,
        `Other deduction "${deduction.code}" requires commercial review`,
        'otherDeductions',
        { rowIndex, details: { code: deduction.code } },
      ),
    )

    // Non-zero deduction without account → blocking error (no automatic mapping for unknown codes).
    if (!deduction.accountId) {
      errors.push(
        receiptError(
          RECEIPT_ERROR_CODES.OTHER_DEDUCTION_ACCOUNT_MISSING,
          'Other deduction account is required when amount is non-zero',
          'otherDeductions.accountId',
          { rowIndex },
        ),
      )
    }

    const rounded = roundAmount(amount, 4)
    amounts.push(rounded)
    rows.push({
      rowIndex,
      code: deduction.code,
      description: deduction.description,
      amount: format4(rounded),
      baseAmount: format4(rounded),
      accountId: deduction.accountId ?? null,
    })
  })

  return {
    total: roundAmount(sumDecimals(amounts), 4),
    rows,
    errors,
    warnings,
  }
}

export function bankChargeAccountRequired(total: Prisma.Decimal | string): boolean {
  return isPositive(total)
}
