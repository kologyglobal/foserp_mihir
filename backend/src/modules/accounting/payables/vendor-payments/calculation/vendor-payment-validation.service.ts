import type { VendorPaymentMethod } from '@prisma/client'
import { calcError, calcWarning, VENDOR_PAYMENT_CALC_CODES } from './vendor-payment-calculation.errors.js'
import type {
  VendorPaymentAccountReadiness,
  VendorPaymentAccountingPreview,
  VendorPaymentCalculationConfiguration,
  VendorPaymentCalculationInput,
  VendorPaymentCalculationValidation,
  VendorPaymentValidationIssue,
} from './vendor-payment-calculation.types.js'

const SEVERITY_ORDER = { ERROR: 0, WARNING: 1, INFO: 2 } as const

function sortIssues(issues: VendorPaymentValidationIssue[]): VendorPaymentValidationIssue[] {
  return [...issues].sort((a, b) => {
    const s = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    if (s !== 0) return s
    const ln = (a.lineNumber ?? 0) - (b.lineNumber ?? 0)
    if (ln !== 0) return ln
    return a.code.localeCompare(b.code)
  })
}

export function validateVendorPaymentMethod(
  input: VendorPaymentCalculationInput,
  configuration?: VendorPaymentCalculationConfiguration,
): VendorPaymentValidationIssue[] {
  const issues: VendorPaymentValidationIssue[] = []
  const method = input.paymentMethod as VendorPaymentMethod
  const requireRef = configuration?.requirePaymentReferenceByMethod ?? false
  const requireCheque = configuration?.requireChequeDetailsForCheque ?? true

  switch (method) {
    case 'BANK_TRANSFER':
      if (requireRef && !input.paymentReference?.trim() && !input.bankReference?.trim()) {
        issues.push(
          calcError(
            VENDOR_PAYMENT_CALC_CODES.REFERENCE_REQUIRED,
            'Bank transfer requires payment reference or bank reference',
            'paymentReference',
          ),
        )
      }
      break
    case 'CHEQUE':
      if (requireCheque && (!input.chequeNumber?.trim() || !input.chequeDate?.trim())) {
        issues.push(
          calcError(
            VENDOR_PAYMENT_CALC_CODES.CHEQUE_DETAILS_REQUIRED,
            'Cheque payment requires cheque number and cheque date',
            'chequeNumber',
          ),
        )
      }
      break
    case 'UPI':
    case 'CARD':
      if (requireRef && !input.instrumentReference?.trim() && !input.paymentReference?.trim()) {
        issues.push(
          calcWarning(
            VENDOR_PAYMENT_CALC_CODES.REFERENCE_REQUIRED,
            `${method} payment should include instrument or payment reference`,
            'instrumentReference',
          ),
        )
      }
      break
    case 'OTHER':
      if (requireRef && !input.paymentReference?.trim()) {
        issues.push(
          calcError(VENDOR_PAYMENT_CALC_CODES.REFERENCE_REQUIRED, 'OTHER payment method requires a payment reference', 'paymentReference'),
        )
      }
      break
    case 'CASH':
    default:
      break
  }

  return issues
}

export function validateVendorPaymentBasics(input: VendorPaymentCalculationInput): VendorPaymentValidationIssue[] {
  const issues: VendorPaymentValidationIssue[] = []
  if (!input.vendorId?.trim()) {
    issues.push(calcError(VENDOR_PAYMENT_CALC_CODES.VENDOR_REQUIRED, 'Vendor is required', 'vendorId'))
  }
  if (!input.currencyCode?.trim()) {
    issues.push(calcError(VENDOR_PAYMENT_CALC_CODES.CURRENCY_INVALID, 'Currency is required', 'currencyCode'))
  }
  if (!input.paymentPurpose) {
    issues.push(calcError(VENDOR_PAYMENT_CALC_CODES.PURPOSE_INVALID, 'Payment purpose is required', 'paymentPurpose'))
  }
  if (!input.paymentMethod) {
    issues.push(calcError(VENDOR_PAYMENT_CALC_CODES.METHOD_INVALID, 'Payment method is required', 'paymentMethod'))
  }
  return issues
}

export function mergeVendorPaymentValidation(params: {
  input: VendorPaymentCalculationInput
  accountReadiness: VendorPaymentAccountReadiness
  accountingPreview: VendorPaymentAccountingPreview
  extraErrors?: VendorPaymentValidationIssue[]
  extraWarnings?: VendorPaymentValidationIssue[]
  extraInformation?: VendorPaymentValidationIssue[]
}): VendorPaymentCalculationValidation {
  const { input, accountReadiness, accountingPreview, extraErrors = [], extraWarnings = [], extraInformation = [] } =
    params

  const errors = sortIssues([
    ...validateVendorPaymentBasics(input),
    ...validateVendorPaymentMethod(input, input.configuration).filter((i) => i.severity === 'ERROR'),
    ...accountReadiness.issues.filter((i) => i.severity === 'ERROR'),
    ...accountingPreview.issues.filter((i) => i.severity === 'ERROR'),
    ...extraErrors,
  ])

  const warnings = sortIssues([
    ...validateVendorPaymentMethod(input, input.configuration).filter((i) => i.severity === 'WARNING'),
    ...accountReadiness.issues.filter((i) => i.severity === 'WARNING'),
    ...accountingPreview.issues.filter((i) => i.severity === 'WARNING'),
    ...extraWarnings,
  ])

  const information = sortIssues([...extraInformation])

  // Unbalanced preview means not ready — already in errors from preview
  return {
    isValid: errors.length === 0 && accountReadiness.isReady && accountingPreview.isBalanced && accountingPreview.isBaseBalanced,
    errors,
    warnings,
    information,
  }
}
