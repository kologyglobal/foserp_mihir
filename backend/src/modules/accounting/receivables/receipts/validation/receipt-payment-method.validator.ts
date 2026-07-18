import type { CustomerReceiptPaymentMethod } from '../customer-receipt.types.js'
import type {
  CustomerReceiptCalculationInput,
  ReceiptValidationIssue,
} from '../calculation/customer-receipt-calculation.types.js'
import {
  RECEIPT_ERROR_CODES,
  RECEIPT_WARNING_CODES,
  receiptError,
  receiptWarning,
} from '../calculation/customer-receipt-calculation.errors.js'

export interface PaymentMethodReadiness {
  paymentMethod: CustomerReceiptPaymentMethod
  valid: boolean
  missingFields: string[]
  issues: ReceiptValidationIssue[]
}

/**
 * Payment-method instrument validation (foundation only — no clearing workflows).
 */
export function validateReceiptPaymentMethod(
  input: Pick<
    CustomerReceiptCalculationInput,
    | 'paymentMethod'
    | 'instrumentNumber'
    | 'instrumentDate'
    | 'bankReference'
    | 'transactionReference'
    | 'narration'
  >,
): PaymentMethodReadiness {
  const issues: ReceiptValidationIssue[] = []
  const missingFields: string[] = []
  const method = input.paymentMethod

  switch (method) {
    case 'BANK_TRANSFER': {
      if (!input.bankReference?.trim() && !input.transactionReference?.trim()) {
        missingFields.push('bankReference', 'transactionReference')
        issues.push(
          receiptWarning(
            RECEIPT_WARNING_CODES.RECEIPT_REFERENCE_MISSING,
            'Bank transfer should include a bank or transaction reference',
            'bankReference',
          ),
        )
      }
      break
    }
    case 'CASH':
      // Instrument fields not required; cash account category checked in account readiness.
      break
    case 'CHEQUE': {
      if (!input.instrumentNumber?.trim()) {
        missingFields.push('instrumentNumber')
        issues.push(
          receiptError(
            RECEIPT_ERROR_CODES.RECEIPT_INSTRUMENT_NUMBER_REQUIRED,
            'Cheque number (instrumentNumber) is required',
            'instrumentNumber',
          ),
        )
      }
      if (!input.instrumentDate) {
        missingFields.push('instrumentDate')
        issues.push(
          receiptError(
            RECEIPT_ERROR_CODES.RECEIPT_INSTRUMENT_DATE_REQUIRED,
            'Cheque date (instrumentDate) is required',
            'instrumentDate',
          ),
        )
      }
      issues.push(
        receiptWarning(
          RECEIPT_WARNING_CODES.CHEQUE_CLEARING_NOT_TRACKED,
          'Cheque clearing lifecycle is not tracked in this phase',
          'paymentMethod',
        ),
      )
      break
    }
    case 'UPI': {
      if (!input.transactionReference?.trim()) {
        missingFields.push('transactionReference')
        issues.push(
          receiptWarning(
            RECEIPT_WARNING_CODES.RECEIPT_REFERENCE_MISSING,
            'UPI receipts should include a transaction reference',
            'transactionReference',
          ),
        )
      }
      break
    }
    case 'CARD': {
      if (!input.transactionReference?.trim()) {
        missingFields.push('transactionReference')
        issues.push(
          receiptWarning(
            RECEIPT_WARNING_CODES.RECEIPT_REFERENCE_MISSING,
            'Card receipts should include a transaction reference',
            'transactionReference',
          ),
        )
      }
      break
    }
    case 'OTHER': {
      issues.push(
        receiptWarning(
          RECEIPT_WARNING_CODES.CUSTOM_PAYMENT_METHOD_USED,
          'Custom payment method used — provide narration or reference',
          'paymentMethod',
        ),
      )
      if (!input.narration?.trim() && !input.bankReference?.trim() && !input.transactionReference?.trim()) {
        missingFields.push('narration')
        issues.push(
          receiptWarning(
            RECEIPT_WARNING_CODES.RECEIPT_REFERENCE_MISSING,
            'OTHER payment method should include narration or a reference',
            'narration',
          ),
        )
      }
      break
    }
    default:
      issues.push(
        receiptError(
          RECEIPT_ERROR_CODES.RECEIPT_PAYMENT_METHOD_INVALID,
          `Unsupported payment method: ${String(method)}`,
          'paymentMethod',
        ),
      )
  }

  const hasErrors = issues.some((i) => i.severity === 'ERROR')
  return {
    paymentMethod: method,
    valid: !hasErrors,
    missingFields,
    issues,
  }
}
