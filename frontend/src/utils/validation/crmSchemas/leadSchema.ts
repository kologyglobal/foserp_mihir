import type { FieldErrorMap } from '../../formValidation/types'
import { validateEmail } from '../email'
import { validateMobileForCountry } from '../mobilePhone'
import {
  getDateInputMin,
  suggestFollowUpDueTime,
  validateCrmCalendarDate,
  validateFollowUpAt,
} from '../crmDatePolicy'
import type { LeadStage } from '../../../types/sales'

export interface LeadFormValidationInput {
  prospectName: string
  customerId: string | null | undefined
  leadOwnerId: string
  priority: string
  createdDate: string
  email: string
  mobile: string
  mobileCountry: string | null | undefined
  remarks: string
  leadStage: LeadStage
  requirementText: string
  hasRequirementLines: boolean
  expectedCloseDate: string
  nextFollowUpDate: string
  activityStatus: string
  inactiveReason: string
  notQualifiedReason: string
  closedDate: string
  closedReason: string
  isEdit: boolean
}

/**
 * Shared Lead form validation — same rules as CrmLeadFormPage.validate().
 * Returns a field → message map for handleInvalidSubmit.
 */
export function validateLeadForm(input: LeadFormValidationInput): FieldErrorMap {
  const errors: FieldErrorMap = {}
  const today = getDateInputMin()
  const prospect = input.prospectName.trim()
  if (!prospect) errors.prospectName = 'Company / Prospect is required'
  if (!String(input.leadOwnerId ?? '').trim()) errors.leadOwnerId = 'Lead Owner is required'
  if (!input.priority) errors.priority = 'Priority is required'

  const createdDateError = validateCrmCalendarDate(input.createdDate, {
    label: 'Created Date',
    required: true,
    notAfter: today,
    notAfterMessage: 'Created Date cannot be in the future',
  })
  if (createdDateError) errors.createdDate = createdDateError

  const emailError = validateEmail(input.email)
  if (emailError) errors.email = emailError
  if (input.mobile.trim()) {
    const mobileError = validateMobileForCountry(input.mobile, input.mobileCountry)
    if (mobileError) errors.mobile = mobileError
  }

  if (!input.remarks.trim()) {
    errors.remarks = 'Notes are required'
  }

  const reqStages: LeadStage[] = ['requirement_collected', 'qualified']
  if (
    reqStages.includes(input.leadStage)
    && !input.requirementText
    && !input.hasRequirementLines
  ) {
    errors.productRequirement = 'Add at least one product / requirement line for this stage'
  }

  if (
    !input.mobile.trim()
    && !input.email.trim()
    && (input.leadStage === 'new' || input.leadStage === 'contacted')
  ) {
    if (!input.customerId && !errors.mobile) {
      errors.mobile = 'Provide a mobile number or email (or link a company)'
    }
  }

  const expectedCloseError = validateCrmCalendarDate(input.expectedCloseDate, {
    label: 'Expected Closing Date',
    notBefore: input.isEdit ? undefined : today,
    notBeforeMessage: 'Expected Closing Date cannot be in the past',
  })
  if (expectedCloseError) errors.expectedCloseDate = expectedCloseError

  if (input.nextFollowUpDate.trim()) {
    const followUpDateError = validateCrmCalendarDate(input.nextFollowUpDate, {
      label: 'Next Follow-up Date',
      notBefore: today,
      notBeforeMessage: 'Next Follow-up Date cannot be in the past',
    })
    if (followUpDateError) {
      errors.nextFollowUpDate = followUpDateError
    } else {
      const dueTime = suggestFollowUpDueTime(input.nextFollowUpDate)
      const dueError = validateFollowUpAt({ dueDate: input.nextFollowUpDate, dueTime })
      if (dueError) errors.nextFollowUpDate = dueError
    }
  }

  if (input.activityStatus === 'inactive' && !input.inactiveReason) {
    errors.inactiveReason = 'Inactive Reason is required when lead is inactive.'
  }
  if (input.leadStage === 'not_qualified' && !input.notQualifiedReason) {
    errors.notQualifiedReason = 'Not Qualified Reason is required.'
  }
  if (input.leadStage === 'closed') {
    const closedDateError = validateCrmCalendarDate(input.closedDate, {
      label: 'Closed Date',
      required: true,
      notAfter: today,
      notAfterMessage: 'Closed Date cannot be in the future',
      notBefore: input.createdDate.trim() || undefined,
      notBeforeMessage: 'Closed Date cannot be before Created Date',
    })
    if (closedDateError) errors.closedDate = closedDateError
    if (!input.closedReason) {
      errors.closedReason = 'Closed Reason is required when lead stage is Closed.'
    }
  }

  return errors
}
