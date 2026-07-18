import { fieldErrorsToMessages, firstInvalidFieldKey, normalizeFieldErrors } from './normalizeErrors'
import { pickFocusable, resolveFieldElement } from './resolveFieldElement'
import type { FieldErrorMap, FocusScrollOptions, InvalidSubmitErrors } from './types'

export interface FocusFirstInvalidFieldOptions extends FocusScrollOptions {
  errors: InvalidSubmitErrors | FieldErrorMap
  fieldOrder?: string[]
  /** When true, also scroll into view (default true). */
  scroll?: boolean
}

/**
 * Focus the first invalid field control. Optionally scrolls it into view.
 * Returns the focused element, or null if none found.
 */
export function focusFirstInvalidField(
  options: FocusFirstInvalidFieldOptions,
): HTMLElement | null {
  const {
    errors,
    fieldOrder,
    root = null,
    behavior = 'smooth',
    block = 'center',
    delayMs = 0,
    scroll = true,
  } = options

  const map = normalizeFieldErrors(errors as InvalidSubmitErrors)
  const firstKey = firstInvalidFieldKey(map, fieldOrder)

  const run = (): HTMLElement | null => {
    let el: HTMLElement | null = firstKey
      ? resolveFieldElement(firstKey, root)
      : null

    if (!el && root) {
      el = (root as ParentNode).querySelector(
        '.erp-field-row--error input:not([type="hidden"]), .erp-field-row--error textarea, .erp-field-row--error select, .erp-field-row--error [role="combobox"], [aria-invalid="true"]',
      ) as HTMLElement | null
    }
    if (!el) {
      el = document.querySelector(
        '.erp-field-row--error input:not([type="hidden"]), .erp-field-row--error textarea, .erp-field-row--error select, .erp-field-row--error [role="combobox"], [aria-invalid="true"]',
      ) as HTMLElement | null
    }
    if (!el) return null

    const target = pickFocusable(el)
    if (scroll) target.scrollIntoView({ behavior, block })
    try {
      target.focus({ preventScroll: true })
    } catch {
      /* ignore focus failures on non-focusable hosts */
    }
    return target
  }

  if (delayMs > 0) {
    window.requestAnimationFrame(() => {
      window.setTimeout(run, delayMs)
    })
    return firstKey ? resolveFieldElement(firstKey, root) : null
  }

  return run()
}

/** Convenience: messages for toast / ValidationSummary from any error shape. */
export function invalidSubmitMessages(
  errors: InvalidSubmitErrors,
  fieldOrder?: string[],
): string[] {
  return fieldErrorsToMessages(normalizeFieldErrors(errors), fieldOrder)
}
