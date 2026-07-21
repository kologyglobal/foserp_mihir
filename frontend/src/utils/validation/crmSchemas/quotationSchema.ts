import type { FieldErrorMap } from '../../formValidation/types'
import { validateOpportunityLines } from '../../opportunityLineCalc'
import { opportunityRowErrorsToFieldMap } from '../../opportunityLineValidationFocus'
import { validateCrmCalendarDate } from '../crmDatePolicy'
import type { OpportunityLine } from '../../../types/crm'

export interface QuotationCreateValidationInput {
  createMode: 'opportunity' | 'standalone' | string
  opportunityId: string
  customerId: string
  templateId: string
  validUntil: string
  paymentTerms: string
  deliveryTerms: string
  lines: OpportunityLine[]
  ownerId: string
  stage: string
  probability: string
}

/**
 * Quotation create validation with typed field keys (no regex-only maps for headers).
 */
export function validateQuotationCreate(input: QuotationCreateValidationInput): {
  fieldErrors: FieldErrorMap
  rowErrors: Record<string, string[]>
  messages: string[]
} {
  const fieldErrors: FieldErrorMap = {}
  const messages: string[] = []

  if (input.createMode === 'opportunity') {
    if (!input.opportunityId) {
      fieldErrors.opportunityId = 'Select an opportunity to link this quotation.'
      messages.push(fieldErrors.opportunityId)
    }
  } else if (!input.customerId) {
    fieldErrors.customerId = 'Select a client / company for this quotation.'
    messages.push(fieldErrors.customerId)
  }

  if (!input.templateId) {
    fieldErrors.templateId = 'Select a quotation template.'
    messages.push(fieldErrors.templateId)
  }
  if (!input.validUntil) {
    fieldErrors.validUntil = 'Set a valid-until date for this quotation.'
    messages.push(fieldErrors.validUntil)
  } else {
    const dateErr = validateCrmCalendarDate(input.validUntil, { label: 'Valid until' })
    if (dateErr) {
      fieldErrors.validUntil = dateErr
      messages.push(dateErr)
    }
  }
  if (!input.paymentTerms.trim()) {
    fieldErrors.paymentTerms = 'Select payment terms.'
    messages.push(fieldErrors.paymentTerms)
  }
  if (!input.deliveryTerms.trim()) {
    fieldErrors.deliveryTerms = 'Select delivery terms / timeline.'
    messages.push(fieldErrors.deliveryTerms)
  }

  const lineValidation = validateOpportunityLines(input.lines, {
    customerId: input.customerId,
    ownerId: input.ownerId,
    stage: input.stage,
    probability: input.probability,
  })

  if (!input.lines.some((l) => l.productOrItem?.trim() && l.qty > 0 && l.unitPrice > 0)) {
    const msg = 'Add at least one product line with quantity and unit price.'
    fieldErrors.lines = msg
    messages.push(msg)
  }

  for (const e of lineValidation.errors) {
    if (!e.includes('customer') && !e.includes('owner')) messages.push(e)
  }

  const rowErrors = lineValidation.rowErrors
  Object.assign(fieldErrors, opportunityRowErrorsToFieldMap(rowErrors))

  return { fieldErrors, rowErrors, messages }
}
