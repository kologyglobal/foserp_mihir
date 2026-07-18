import { notify } from '../../store/toastStore'
import {
  formatRequiredFieldsNotifyMessage,
  toRequiredFieldLabel,
} from './formatRequiredFieldsNotify'
import {
  fieldErrorsToMessages,
  firstInvalidFieldKey,
  normalizeFieldErrors,
} from './normalizeErrors'
import { focusFirstInvalidField } from './focusFirstInvalidField'
import type { HandleInvalidSubmitOptions, HandleInvalidSubmitResult } from './types'

/**
 * Shared invalid-submit handler for CRM / ErpCardForm pages.
 *
 * 1. Normalizes errors → field map
 * 2. Notifies top-right toast (`notify.warning` by default) as a bullet list of field labels
 * 3. Calls `onFieldErrors` so the page can drive `fieldError` / `fieldState`
 * 4. Expands the section containing the first invalid field (`forceOpenKey` / Additional Info)
 * 5. Scrolls to and focuses the first invalid control
 *
 * Adoption (Contact / Opportunity / masters):
 * ```ts
 * handleInvalidSubmit({
 *   errors: rhfErrorsToFieldMap(rhfErrors), // or ZodError / Record
 *   fieldOrder: ['name', 'customerId'],
 *   fieldLabels: { customerId: 'Company', opportunityName: 'Opportunity Name' },
 *   sectionByField: { name: 'contact-section-quick', department: 'contact-section-details' },
 *   expandSection: (id) => { setShowAdditional(true); bumpForceOpen(id) },
 *   root: formRootRef.current,
 *   onFieldErrors: setFieldErrors,
 * })
 * ```
 */
export function handleInvalidSubmit(
  options: HandleInvalidSubmitOptions,
): HandleInvalidSubmitResult {
  const {
    errors,
    fieldOrder,
    sectionByField,
    notifyMessage,
    fieldLabels,
    root = null,
    expandSection,
    onFieldErrors,
    delayMs,
    silentNotify = false,
    notifyVariant = 'warning',
  } = options

  const fieldErrors = normalizeFieldErrors(errors)
  const messages = fieldErrorsToMessages(fieldErrors, fieldOrder)
  const firstField = firstInvalidFieldKey(fieldErrors, fieldOrder)
  const firstSection =
    firstField && sectionByField ? sectionByField[firstField] : undefined

  onFieldErrors?.(fieldErrors)

  if (!silentNotify && messages.length > 0) {
    const message = notifyMessage ?? buildDefaultNotifyMessage(fieldErrors, fieldOrder, fieldLabels, messages)
    if (notifyVariant === 'error') notify.error(message)
    else if (notifyVariant === 'info') notify.info(message)
    else notify.warning(message)
  }

  if (firstSection && expandSection) {
    expandSection(firstSection)
  }

  const wait =
    delayMs
    ?? (firstSection && expandSection ? 120 : 0)

  // Defer so forceOpenKey / Additional Info can paint before scroll+focus
  window.requestAnimationFrame(() => {
    focusFirstInvalidField({
      errors: fieldErrors,
      fieldOrder,
      root,
      delayMs: wait,
      scroll: true,
    })
  })

  return { fieldErrors, firstField, firstSection, messages }
}

function buildDefaultNotifyMessage(
  fieldErrors: Record<string, string>,
  fieldOrder: string[] | undefined,
  fieldLabels: Record<string, string> | undefined,
  messages: string[],
): string {
  const keys = fieldOrder?.length
    ? [
        ...fieldOrder.filter((k) => fieldErrors[k]),
        ...Object.keys(fieldErrors).filter((k) => !fieldOrder.includes(k)),
      ]
    : Object.keys(fieldErrors)

  const labels = keys.map((key) => {
    if (fieldLabels?.[key]) return fieldLabels[key]
    return toRequiredFieldLabel(fieldErrors[key] ?? key)
  })

  // Prefer key-derived labels; fall back to message-derived when only synthetic `_msg_*` keys exist
  const usable = labels.filter(Boolean)
  if (usable.length) return formatRequiredFieldsNotifyMessage(usable)
  return formatRequiredFieldsNotifyMessage(messages.map(toRequiredFieldLabel))
}
