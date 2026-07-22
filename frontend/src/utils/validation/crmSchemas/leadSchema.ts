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
  /** Primary contact display name (free-text or selected contact). */
  contactPerson?: string
  /** Linked CRM contact id when company is selected. */
  contactId?: string | null
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
 * Also used by store/bridge create guards so API/demo paths cannot bypass the form.
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

  // Optional contact fields: validate format only when a value is entered.
  const emailError = validateEmail(input.email)
  if (emailError) errors.email = emailError
  if (input.mobile.trim()) {
    const mobileError = validateMobileForCountry(input.mobile, input.mobileCountry)
    if (mobileError) errors.mobile = mobileError
  }

  if (!input.remarks.trim()) {
    errors.remarks = 'Notes are required'
  }

  // Lead stage must never make optional / collapsed fields mandatory.
  // Invalid entered optional dates still surface errors below.

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

  // Inactive / Not Qualified / Closed reasons are optional — empty is valid.
  if (input.closedDate.trim()) {
    const closedDateError = validateCrmCalendarDate(input.closedDate, {
      label: 'Closed Date',
      notAfter: today,
      notAfterMessage: 'Closed Date cannot be in the future',
      notBefore: input.createdDate.trim() || undefined,
      notBeforeMessage: 'Closed Date cannot be before Created Date',
    })
    if (closedDateError) errors.closedDate = closedDateError
  }

  return errors
}

/**
 * Guard for store / API bridge createLead — maps a create payload into validateLeadForm.
 * Returns the first error message, or null when valid.
 */
export function getLeadCreateValidationError(input: Record<string, unknown>): string | null {
  const stage = (input.stage as LeadStage | undefined) ?? 'new'
  const productRequirement = String(input.productRequirement ?? '')
  const errors = validateLeadForm({
    prospectName: String(input.prospectName ?? ''),
    customerId: (input.customerId as string | null | undefined) ?? null,
    leadOwnerId: String(input.leadOwnerId ?? ''),
    priority: String(input.priority ?? ''),
    createdDate: String(input.createdDate ?? '').slice(0, 10),
    email: String(input.email ?? ''),
    mobile: String(input.mobile ?? ''),
    mobileCountry: null,
    contactPerson: String(input.contactPerson ?? ''),
    contactId: (input.contactId as string | null | undefined) ?? null,
    remarks: String(input.remarks ?? ''),
    leadStage: stage,
    requirementText: productRequirement.trim(),
    hasRequirementLines: productRequirement.trim().length > 0,
    expectedCloseDate: String(input.expectedCloseDate ?? '').slice(0, 10),
    nextFollowUpDate: String(input.nextFollowUpDate ?? '').slice(0, 10),
    activityStatus: String(input.activityStatus ?? 'active'),
    inactiveReason: String(input.inactiveReason ?? ''),
    notQualifiedReason: String(input.notQualifiedReason ?? ''),
    closedDate: String(input.closedDate ?? '').slice(0, 10),
    closedReason: String(input.closedReason ?? ''),
    isEdit: false,
  })
  const first = Object.values(errors)[0]
  return first ?? null
}
