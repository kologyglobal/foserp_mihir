/**
 * Resolve a field's focusable control in the DOM.
 *
 * Lookup order:
 * 1. `[data-field="{key}"]` (ErpFieldRow / wrappers)
 * 2. `#` id match (element or first focusable descendant)
 * 3. `[name="{key}"]`
 * 4. Within an error-marked row: `.erp-field-row--error` + matching data-field
 */
export function resolveFieldElement(
  fieldKey: string,
  root?: ParentNode | null,
): HTMLElement | null {
  if (!fieldKey || fieldKey.startsWith('_')) return null
  const scope: ParentNode = root ?? document

  const byData = scope.querySelector(`[data-field="${cssEscape(fieldKey)}"]`) as HTMLElement | null
  if (byData) return pickFocusable(byData)

  const byId = scope.querySelector(`#${cssEscape(fieldKey)}`) as HTMLElement | null
  if (byId) return pickFocusable(byId)

  const byName = scope.querySelector(`[name="${cssEscape(fieldKey)}"]`) as HTMLElement | null
  if (byName) return pickFocusable(byName)

  // Fallback: first error-marked row in scope
  const errorRow = scope.querySelector(
    '.erp-field-row--error, [aria-invalid="true"]',
  ) as HTMLElement | null
  if (errorRow) return pickFocusable(errorRow)

  return null
}

/** First focusable control inside a field row wrapper, or the element itself. */
export function pickFocusable(el: HTMLElement): HTMLElement {
  if (isFocusable(el)) return el
  const inner = el.querySelector(
    'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [role="combobox"], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
  ) as HTMLElement | null
  return inner ?? el
}

function isFocusable(el: HTMLElement): boolean {
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return true
  if (el.getAttribute('role') === 'combobox') return true
  const tab = el.getAttribute('tabindex')
  return tab != null && tab !== '-1'
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value)
  return value.replace(/["\\]/g, '\\$&')
}
