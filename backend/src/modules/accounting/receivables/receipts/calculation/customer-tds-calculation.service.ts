import { Prisma } from '@prisma/client'
import {
  divide,
  isNegative,
  isPositive,
  isZero,
  multiply,
  roundAmount,
  roundPercentage,
  toDecimal,
} from '../../../shared/finance-decimal.js'
import type {
  CustomerReceiptTdsSummary,
  CustomerTdsInput,
  ReceiptValidationIssue,
} from './customer-receipt-calculation.types.js'
import {
  CONTROLLED_TDS_PERCENTAGES,
  DEFAULT_MAX_TDS_PERCENTAGE,
  RECEIPT_ERROR_CODES,
  RECEIPT_WARNING_CODES,
  receiptError,
  receiptWarning,
} from './customer-receipt-calculation.errors.js'

function format4(value: Prisma.Decimal): string {
  return roundAmount(value, 4).toFixed(4)
}

export interface CustomerTdsCalculationOptions {
  maxTdsPercentage?: string
  allowCustomTdsRates?: boolean
  /** Resolved TDS account from input or mapping (optional at pure-calc stage). */
  resolvedAccountId?: string | null
}

export interface CustomerTdsCalculationResult {
  amount: Prisma.Decimal
  summary: CustomerReceiptTdsSummary | null
  errors: ReceiptValidationIssue[]
  warnings: ReceiptValidationIssue[]
}

/**
 * Customer TDS calculation (side-effect free).
 * Amount mode: TDS = supplied value.
 * Percentage mode: TDS = calculationBase × percentage ÷ 100.
 * Calculation base is always user-supplied in Phase 3B2 (warning emitted).
 */
export function calculateCustomerTds(
  input: CustomerTdsInput | null | undefined,
  options: CustomerTdsCalculationOptions = {},
): CustomerTdsCalculationResult {
  const errors: ReceiptValidationIssue[] = []
  const warnings: ReceiptValidationIssue[] = []
  const maxPct = toDecimal(options.maxTdsPercentage ?? DEFAULT_MAX_TDS_PERCENTAGE)
  const allowCustom = options.allowCustomTdsRates !== false

  if (!input || input.mode === 'NONE') {
    return {
      amount: new Prisma.Decimal(0),
      summary: {
        mode: 'NONE',
        value: null,
        calculationBase: null,
        sectionCode: input?.sectionCode ?? null,
        certificateReference: input?.certificateReference ?? null,
        accountId: options.resolvedAccountId ?? input?.accountId ?? null,
        amount: format4(new Prisma.Decimal(0)),
        baseAmount: format4(new Prisma.Decimal(0)),
      },
      errors,
      warnings,
    }
  }

  let amount = new Prisma.Decimal(0)

  if (input.mode === 'AMOUNT') {
    if (input.value == null || input.value === '') {
      errors.push(
        receiptError(
          RECEIPT_ERROR_CODES.CUSTOMER_TDS_AMOUNT_INVALID,
          'TDS amount is required when mode is AMOUNT',
          'customerTds.value',
        ),
      )
    } else {
      const v = toDecimal(input.value)
      if (isNegative(v)) {
        errors.push(
          receiptError(
            RECEIPT_ERROR_CODES.CUSTOMER_TDS_AMOUNT_INVALID,
            'Customer TDS amount cannot be negative',
            'customerTds.value',
          ),
        )
      } else {
        amount = roundAmount(v, 4)
      }
    }
  } else if (input.mode === 'PERCENTAGE') {
    if (input.value == null || input.value === '') {
      errors.push(
        receiptError(
          RECEIPT_ERROR_CODES.CUSTOMER_TDS_PERCENTAGE_INVALID,
          'TDS percentage is required when mode is PERCENTAGE',
          'customerTds.value',
        ),
      )
    }
    if (input.calculationBase == null || input.calculationBase === '') {
      errors.push(
        receiptError(
          RECEIPT_ERROR_CODES.CUSTOMER_TDS_BASE_REQUIRED,
          'Calculation base is required for percentage-mode customer TDS',
          'customerTds.calculationBase',
        ),
      )
    } else {
      const base = toDecimal(input.calculationBase)
      if (!isPositive(base)) {
        errors.push(
          receiptError(
            RECEIPT_ERROR_CODES.CUSTOMER_TDS_BASE_REQUIRED,
            'TDS calculation base must be positive',
            'customerTds.calculationBase',
          ),
        )
      } else if (input.value != null && input.value !== '') {
        const pct = toDecimal(input.value)
        if (isNegative(pct)) {
          errors.push(
            receiptError(
              RECEIPT_ERROR_CODES.CUSTOMER_TDS_PERCENTAGE_INVALID,
              'TDS percentage cannot be negative',
              'customerTds.value',
            ),
          )
        } else if (pct.gt(maxPct)) {
          errors.push(
            receiptError(
              RECEIPT_ERROR_CODES.CUSTOMER_TDS_PERCENTAGE_INVALID,
              `TDS percentage cannot exceed ${maxPct.toFixed(4)}`,
              'customerTds.value',
            ),
          )
        } else {
          const normalized = roundPercentage(pct).toFixed(4).replace(/\.?0+$/, '') || '0'
          const controlled = (CONTROLLED_TDS_PERCENTAGES as readonly string[]).some(
            (c) => toDecimal(c).eq(pct),
          )
          if (!controlled) {
            if (!allowCustom) {
              errors.push(
                receiptError(
                  RECEIPT_ERROR_CODES.CUSTOMER_TDS_PERCENTAGE_INVALID,
                  'Custom TDS rates are not permitted by finance configuration',
                  'customerTds.value',
                ),
              )
            } else {
              warnings.push(
                receiptWarning(
                  RECEIPT_WARNING_CODES.CUSTOM_TDS_RATE_USED,
                  `Non-standard TDS rate ${normalized}% used`,
                  'customerTds.value',
                ),
              )
            }
          }
          warnings.push(
            receiptWarning(
              RECEIPT_WARNING_CODES.CUSTOMER_TDS_BASE_USER_SUPPLIED,
              'TDS calculation base is user-supplied — not verified against tax law',
              'customerTds.calculationBase',
            ),
          )
          amount = roundAmount(divide(multiply(base, pct), 100), 4)
        }
      }
    }
  } else {
    errors.push(
      receiptError(
        RECEIPT_ERROR_CODES.CUSTOMER_TDS_CALCULATION_INVALID,
        `Unsupported TDS mode`,
        'customerTds.mode',
      ),
    )
  }

  if (isPositive(amount) && !input.sectionCode) {
    warnings.push(
      receiptWarning(
        RECEIPT_WARNING_CODES.CUSTOMER_TDS_SECTION_NOT_PROVIDED,
        'TDS section code not provided (metadata only in this phase)',
        'customerTds.sectionCode',
      ),
    )
  }

  // Account mandatory when amount > 0 is enforced in account-readiness (may resolve via mapping).
  // Pure calc only flags missing input account as soft signal when no resolved account.
  if (isPositive(amount) && !input.accountId && !options.resolvedAccountId) {
    // Defer hard error to account readiness; keep calc soft so mapping fallback can apply.
  }

  return {
    amount,
    summary: {
      mode: input.mode,
      value: input.value ?? null,
      calculationBase: input.calculationBase ?? null,
      sectionCode: input.sectionCode ?? null,
      certificateReference: input.certificateReference ?? null,
      accountId: options.resolvedAccountId ?? input.accountId ?? null,
      amount: format4(amount),
      baseAmount: format4(amount), // overwritten by currency layer
    },
    errors,
    warnings,
  }
}

export function tdsAccountRequired(tdsAmount: Prisma.Decimal | string): boolean {
  return isPositive(tdsAmount) && !isZero(tdsAmount)
}
