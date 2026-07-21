/**
 * Shared CRM / ErpCardForm validation helpers.
 *
 * CRM display policy (`crmValidationDisplay.ts`):
 * 1. Inline field error  2. Toast via `handleInvalidSubmit`  3. Summary card only for
 *    rare non-field multi-errors  4. Smart Context = coaching, not duplicate validation
 *
 * Pair field keys with `data-field` on `ErpFieldRow` and `sectionByField` +
 * `ErpCardSection.forceOpenKey` for expand.
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
export { focusAndHighlightField } from './focusAndHighlightField'
export type { FocusAndHighlightOptions } from './focusAndHighlightField'
export { handleInvalidSubmit } from './handleInvalidSubmit'
export {
  crmFieldErrorsToGuideItems,
  crmNonFieldGuideItems,
  crmShowCompletenessHints,
} from './crmValidationDisplay'
export {
  zodErrorToFieldMap,
  isZodError,
  safeParseToFieldErrors,
  firstZodMessage,
} from './zodFieldErrors'
