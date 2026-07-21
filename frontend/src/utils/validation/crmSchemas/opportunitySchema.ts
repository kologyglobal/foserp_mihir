import type { FieldErrorMap } from '../../formValidation/types'
import { getDateInputMin, validateCrmCalendarDate } from '../crmDatePolicy'
import { validateOpportunityLines } from '../../opportunityLineCalc'
import { opportunityRowErrorsToFieldMap } from '../../opportunityLineValidationFocus'
import type { OpportunityLine } from '../../../types/crm'

export interface OpportunityHeaderInput {
  customerId: string
  opportunityName: string
  ownerId: string
  stage: string
  probability: string
  expectedCloseDate: string
  lines: OpportunityLine[]
}

/**
 * Typed opportunity create/edit validation — replaces string-array + regex field maps.
 */
export function validateOpportunityForm(input: OpportunityHeaderInput): {
  fieldErrors: FieldErrorMap
  rowErrors: Record<string, string[]>
} {
  const { errors, rowErrors } = validateOpportunityLines(input.lines, {
    customerId: input.customerId,
    ownerId: input.ownerId,
    stage: input.stage,
    probability: input.probability,
  })

  const fieldErrors: FieldErrorMap = {}

  if (!input.customerId.trim()) {
    fieldErrors.customerId = 'Company is required.'
  }
  if (!input.opportunityName.trim()) {
    fieldErrors.opportunityName = 'Opportunity name is required.'
  }
  if (!input.ownerId.trim() && !fieldErrors.ownerId) {
    // validateOpportunityLines may already set owner via errors list
  }

  const closeDateError = validateCrmCalendarDate(input.expectedCloseDate, {
    label: 'Expected Close Date',
    required: true,
    notBefore: getDateInputMin(),
    notBeforeMessage: 'Expected Close Date cannot be in the past',
  })
  if (closeDateError) fieldErrors.expectedCloseDate = closeDateError

  for (const err of errors) {
    if (/company|customer/i.test(err) && !fieldErrors.customerId) fieldErrors.customerId = err
    else if (/owner/i.test(err) && !fieldErrors.ownerId) fieldErrors.ownerId = err
    else if (/^stage/i.test(err) && !fieldErrors.stage) fieldErrors.stage = err
    else if (/probability/i.test(err) && !fieldErrors.probability) fieldErrors.probability = err
    else if (/unit price|form validation|product \/ item line/i.test(err)) {
      /* line-level — covered by rowErrors */
    } else if (!Object.values(fieldErrors).includes(err) && !/close date|expected close/i.test(err)) {
      fieldErrors[`_msg_${Object.keys(fieldErrors).length}`] = err
    }
  }

  Object.assign(fieldErrors, opportunityRowErrorsToFieldMap(rowErrors))
  return { fieldErrors, rowErrors }
}
