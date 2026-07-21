import type { FieldErrorMap } from '../../formValidation/types'
import { validateCrmCalendarDate } from '../crmDatePolicy'

export interface SalesOrderCreateValidationInput {
  createMode: 'quotation' | 'direct' | string
  fromOpportunity?: boolean
  opportunitySoGateEnabled?: boolean
  opportunitySoGateReason?: string | null
  quotationDocumentId: string | null
  opportunityPrefillQuotationDocumentId?: string | null
  customerId: string
  lines: Array<{ productId: string; qty: number; unitPrice: number }>
  customerPoNumber: string
  paymentTerms: string
  deliveryTerms: string
}

export interface SalesOrderDraftValidationInput {
  paymentTerms: string
  deliveryTerms: string
  expectedDeliveryDate?: string
  customerPoDate?: string
}

/**
 * Sales order create validation with typed field keys.
 */
export function validateSalesOrderCreate(input: SalesOrderCreateValidationInput): {
  fieldErrors: FieldErrorMap
  messages: string[]
} {
  const fieldErrors: FieldErrorMap = {}
  const messages: string[] = []
  const effectiveQuoteId = input.quotationDocumentId || input.opportunityPrefillQuotationDocumentId || null

  if (input.fromOpportunity && input.createMode === 'quotation' && input.opportunitySoGateEnabled === false) {
    const msg = input.opportunitySoGateReason ?? 'Available after quotation approval.'
    fieldErrors.quotationDocumentId = msg
    messages.push(msg)
  }

  if (input.createMode === 'quotation' && !effectiveQuoteId) {
    fieldErrors.quotationDocumentId = 'Select an approved quotation.'
    messages.push(fieldErrors.quotationDocumentId)
  }
  if (!input.customerId) {
    fieldErrors.customerId = 'Select a customer.'
    messages.push(fieldErrors.customerId)
  }
  if (!input.lines.length) {
    fieldErrors.lines = 'Add at least one product line.'
    messages.push(fieldErrors.lines)
  } else {
    if (input.lines.some((l) => !l.productId)) {
      fieldErrors.lines = 'Every line needs a product.'
      messages.push(fieldErrors.lines)
    }
    if (input.lines.some((l) => !l.qty || l.qty < 1)) {
      fieldErrors.lines = 'Line quantities must be at least 1.'
      messages.push(fieldErrors.lines)
    }
    if (input.lines.some((l) => l.unitPrice <= 0)) {
      fieldErrors.lines = 'Line unit prices must be greater than zero.'
      messages.push(fieldErrors.lines)
    }
  }
  if (!input.customerPoNumber.trim()) {
    fieldErrors.customerPoNumber = 'Customer PO number is required.'
    messages.push(fieldErrors.customerPoNumber)
  }
  if (!input.paymentTerms.trim()) {
    fieldErrors.paymentTerms = 'Payment terms are required.'
    messages.push(fieldErrors.paymentTerms)
  }
  if (!input.deliveryTerms.trim()) {
    fieldErrors.deliveryTerms = 'Delivery terms are required.'
    messages.push(fieldErrors.deliveryTerms)
  }

  return { fieldErrors, messages }
}

/** Draft SO edit (header terms / dates). */
export function validateSalesOrderDraft(input: SalesOrderDraftValidationInput): {
  fieldErrors: FieldErrorMap
  messages: string[]
} {
  const fieldErrors: FieldErrorMap = {}
  const messages: string[] = []

  if (!input.paymentTerms.trim()) {
    fieldErrors.paymentTerms = 'Payment terms are required.'
    messages.push(fieldErrors.paymentTerms)
  }
  if (!input.deliveryTerms.trim()) {
    fieldErrors.deliveryTerms = 'Delivery terms are required.'
    messages.push(fieldErrors.deliveryTerms)
  }
  if (input.expectedDeliveryDate) {
    const err = validateCrmCalendarDate(input.expectedDeliveryDate, { label: 'Expected delivery date' })
    if (err) {
      fieldErrors.expectedDeliveryDate = err
      messages.push(err)
    }
  }
  if (input.customerPoDate) {
    const err = validateCrmCalendarDate(input.customerPoDate, { label: 'Customer PO date' })
    if (err) {
      fieldErrors.customerPoDate = err
      messages.push(err)
    }
  }

  return { fieldErrors, messages }
}
