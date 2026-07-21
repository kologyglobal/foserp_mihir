import { Prisma } from '@prisma/client'
import type { TdsRecognitionMode } from '@prisma/client'
import { compare, divide, isNegative, multiply, roundTax, subtract, toDecimal } from '../../../shared/finance-decimal.js'
import type { VendorAdjustmentValidationIssue } from './vendor-adjustment-calculation.types.js'
import { calcError, calcWarning, VENDOR_ADJUSTMENT_CALC_CODES } from './vendor-adjustment-calculation.errors.js'

const ZERO = new Prisma.Decimal(0)

export interface TdsCalculationInput {
  mode: TdsRecognitionMode
  rate?: string
  baseOverride?: string
  taxableAmount: Prisma.Decimal
  adjustmentGrandTotal: Prisma.Decimal
}

export interface TdsCalculationResult {
  tdsBaseAmount: Prisma.Decimal
  /** Amount actually withheld for posting purposes — zero for AT_PAYMENT. */
  tdsAmount: Prisma.Decimal
  /** Informational figure for AT_PAYMENT — same as tdsAmount for AT_INVOICE. */
  estimatedTdsAmount: Prisma.Decimal
  vendorPayableAmount: Prisma.Decimal
}

/**
 * - NOT_APPLICABLE: tds = 0, payable = grandTotal
 * - AT_INVOICE: tds = base × rate/100, payable = grandTotal − tds
 * - AT_PAYMENT: tdsAmount = 0 for posting (withheld later at payment), estimatedTds informational, payable = grandTotal
 *
 * Default TDS base = taxableAmount (excludes GST) when no baseOverride is supplied.
 */
export function calculateTds(
  input: TdsCalculationInput,
  errors: VendorAdjustmentValidationIssue[],
  warnings: VendorAdjustmentValidationIssue[],
): TdsCalculationResult {
  const { mode, taxableAmount, adjustmentGrandTotal } = input

  if (mode === 'NOT_APPLICABLE') {
    return { tdsBaseAmount: ZERO, tdsAmount: ZERO, estimatedTdsAmount: ZERO, vendorPayableAmount: adjustmentGrandTotal }
  }

  const rate = toDecimal(input.rate ?? '0')
  if (isNegative(rate) || compare(rate, 100) > 0) {
    errors.push(calcError(VENDOR_ADJUSTMENT_CALC_CODES.TDS_RATE_INVALID, 'TDS rate must be between 0 and 100', 'tdsRate'))
  }

  let base = taxableAmount
  if (input.baseOverride != null && input.baseOverride !== '') {
    base = toDecimal(input.baseOverride)
    if (isNegative(base)) {
      errors.push(calcError(VENDOR_ADJUSTMENT_CALC_CODES.TDS_BASE_INVALID, 'TDS base override cannot be negative', 'tdsBaseOverride'))
      base = taxableAmount
    }
  }

  const computedTds = roundTax(multiply(base, divide(rate, 100)))

  if (mode === 'AT_INVOICE') {
    const vendorPayableAmount = roundTax(subtract(adjustmentGrandTotal, computedTds))
    if (isNegative(vendorPayableAmount)) {
      errors.push(
        calcError(VENDOR_ADJUSTMENT_CALC_CODES.TDS_EXCEEDS_GRAND_TOTAL, 'TDS amount cannot exceed the invoice grand total', 'tdsAmount'),
      )
      return { tdsBaseAmount: base, tdsAmount: ZERO, estimatedTdsAmount: ZERO, vendorPayableAmount: adjustmentGrandTotal }
    }
    return { tdsBaseAmount: base, tdsAmount: computedTds, estimatedTdsAmount: computedTds, vendorPayableAmount }
  }

  // AT_PAYMENT
  warnings.push(
    calcWarning(
      VENDOR_ADJUSTMENT_CALC_CODES.TDS_AT_PAYMENT_NOTICE,
      'TDS is withheld at payment time — invoice posting will not reduce the vendor payable amount',
      'tdsRecognitionMode',
    ),
  )
  return { tdsBaseAmount: base, tdsAmount: ZERO, estimatedTdsAmount: computedTds, vendorPayableAmount: adjustmentGrandTotal }
}
