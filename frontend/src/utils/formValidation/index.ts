/**
 * Shared CRM / ErpCardForm validation helpers.
 *
 * Use `handleInvalidSubmit` on failed save; pair field keys with `data-field` on
 * `ErpFieldRow` and `sectionByField` + `ErpCardSection.forceOpenKey` for expand.
 *
 * @see ValidationSummary — optional inline error list (toast is primary UX)
 */
export type {
  FieldErrorMap,
  InvalidSubmitErrors,
  HandleInvalidSubmitOptions,
  HandleInvalidSubmitResult,
  FocusScrollOptions,
} from './types'

export {
  normalizeFieldErrors,
  fieldErrorsToMessages,
  firstInvalidFieldKey,
  rhfErrorsToFieldMap,
} from './normalizeErrors'

export {
  formatRequiredFieldsNotifyMessage,
  toRequiredFieldLabel,
} from './formatRequiredFieldsNotify'

export { resolveFieldElement, pickFocusable } from './resolveFieldElement'
export { scrollToInvalidField } from './scrollToInvalidField'
export { focusFirstInvalidField, invalidSubmitMessages } from './focusFirstInvalidField'
export { handleInvalidSubmit } from './handleInvalidSubmit'
