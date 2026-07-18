import { pickFocusable, resolveFieldElement } from './resolveFieldElement'
import type { FocusScrollOptions } from './types'

/**
 * Scroll an invalid field into view (by field key or element).
 * Does not focus — pair with `focusFirstInvalidField` / `handleInvalidSubmit`.
 */
export function scrollToInvalidField(
  fieldKeyOrEl: string | HTMLElement,
  options: FocusScrollOptions = {},
): HTMLElement | null {
  const {
    root = null,
    behavior = 'smooth',
    block = 'center',
    delayMs = 0,
  } = options

  const run = (): HTMLElement | null => {
    const el =
      typeof fieldKeyOrEl === 'string'
        ? resolveFieldElement(fieldKeyOrEl, root)
        : fieldKeyOrEl
    if (!el) return null
    const target = pickFocusable(el)
    target.scrollIntoView({ behavior, block })
    return target
  }

  if (delayMs > 0) {
    window.setTimeout(() => {
      run()
    }, delayMs)
    return typeof fieldKeyOrEl === 'string'
      ? resolveFieldElement(fieldKeyOrEl, root)
      : fieldKeyOrEl
  }

  return run()
}
