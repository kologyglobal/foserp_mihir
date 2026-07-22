import { isPositive, toDecimal } from '../../../shared/finance-decimal.js'
import { calcError, calcWarning, VENDOR_PAYMENT_CALC_CODES } from './vendor-payment-calculation.errors.js'
import type {
  VendorPaymentAdjustmentInput,
  VendorPaymentCalculationConfiguration,
  VendorPaymentValidationIssue,
} from './vendor-payment-calculation.types.js'

/**
 * TDS-at-payment policy checks (Phase 4B2).
 * Exact invoice-level TDS settlement requires allocation context (4B4) — without it we
 * validate payment-level TDS input and surface review / double-recognition warnings.
 */
export function validateVendorPaymentTds(
  adjustments: VendorPaymentAdjustmentInput[],
  configuration: VendorPaymentCalculationConfiguration | undefined,
): { errors: VendorPaymentValidationIssue[]; warnings: VendorPaymentValidationIssue[] } {
  const errors: VendorPaymentValidationIssue[] = []
  const warnings: VendorPaymentValidationIssue[] = []

  const tdsLines = adjustments.filter((a) => a.adjustmentType === 'TDS' && a.accountingRole !== 'INFORMATION_ONLY')
  if (tdsLines.length === 0) return { errors, warnings }

  const tdsEnabled = configuration?.tdsEnabled ?? true
  const tdsAtPaymentEnabled = configuration?.tdsAtPaymentEnabled ?? true

  if (!tdsEnabled || !tdsAtPaymentEnabled) {
    errors.push(
      calcError(
        VENDOR_PAYMENT_CALC_CODES.TDS_CONFIGURATION_MISSING,
        'TDS at payment is not enabled for this legal entity',
        'adjustments',
      ),
    )
  }

  if (configuration?.tdsAlreadyRecognisedAtInvoice) {
    errors.push(
      calcError(
        VENDOR_PAYMENT_CALC_CODES.TDS_DOUBLE_RECOGNITION,
        'TDS was already recognised at invoice — payment-stage TDS is not allowed',
        'adjustments',
      ),
    )
  }

  for (const line of tdsLines) {
    if (!line.sectionCode?.trim()) {
      warnings.push(
        calcWarning(
          VENDOR_PAYMENT_CALC_CODES.TDS_SECTION_MISSING,
          `TDS line ${line.lineNumber}: section code is recommended for statutory reporting`,
          'sectionCode',
          { lineNumber: line.lineNumber },
        ),
      )
    }

    if (line.rate != null && line.rate !== '' && toDecimal(line.rate).isNegative()) {
      errors.push(
        calcError(VENDOR_PAYMENT_CALC_CODES.TDS_RATE_INVALID, `TDS line ${line.lineNumber}: rate must be >= 0`, 'rate', {
          lineNumber: line.lineNumber,
        }),
      )
    }

    if (line.calculationBaseAmount != null && line.calculationBaseAmount !== '' && toDecimal(line.calculationBaseAmount).isNegative()) {
      errors.push(
        calcError(VENDOR_PAYMENT_CALC_CODES.TDS_BASE_INVALID, `TDS line ${line.lineNumber}: base must be >= 0`, 'calculationBaseAmount', {
          lineNumber: line.lineNumber,
        }),
      )
    }

    const hasAmount = line.amount != null && line.amount !== '' && isPositive(toDecimal(line.amount))
    const hasRateBase =
      line.rate != null &&
      line.rate !== '' &&
      line.calculationBaseAmount != null &&
      line.calculationBaseAmount !== ''

    if (!hasAmount && !hasRateBase) {
      errors.push(
        calcError(
          VENDOR_PAYMENT_CALC_CODES.TDS_AMOUNT_INVALID,
          `TDS line ${line.lineNumber}: require amount or rate with calculation base`,
          'amount',
          { lineNumber: line.lineNumber },
        ),
      )
    }
  }

  warnings.push(
    calcWarning(
      VENDOR_PAYMENT_CALC_CODES.TDS_REVIEW_REQUIRED,
      'TDS at payment is payment-level input — confirm eligibility against AT_PAYMENT liabilities at allocation',
      'adjustments',
    ),
  )

  return { errors, warnings }
}
