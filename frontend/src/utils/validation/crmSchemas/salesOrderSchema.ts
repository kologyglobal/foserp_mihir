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
  lines: Array<{ itemId?: string | null; productId?: string | null; qty: number; unitPrice: number }>
  customerPoNumber: string
  paymentTerms: string
  deliveryTerms: string
  deliveryTime: string
}

export interface SalesOrderDraftValidationInput {
  paymentTerms: string
  deliveryTerms: string
  deliveryTime: string
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
    fieldErrors.lines = 'Add at least one item line.'
    messages.push(fieldErrors.lines)
  } else {
    if (input.lines.some((l) => !l.itemId && !l.productId)) {
      fieldErrors.lines = 'Every line needs an item.'
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
  // Customer PO number, payment terms, delivery terms, and delivery time are
  // optional at create/draft time — they are enforced later at SO confirmation
  // (see backend sales-order.workflow.ts assertConfirmable).

  return { fieldErrors, messages }
}

/** Draft SO edit (header terms / dates). */
export function validateSalesOrderDraft(input: SalesOrderDraftValidationInput): {
  fieldErrors: FieldErrorMap
  messages: string[]
} {
  const fieldErrors: FieldErrorMap = {}
  const messages: string[] = []

  // Payment/delivery terms and delivery time are optional while the order is
  // still a draft — required only at confirmation (assertConfirmable).
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
