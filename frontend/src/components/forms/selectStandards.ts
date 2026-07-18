/**
 * System-wide dropdown empty-state copy.
 * Closed control shows this (or a field-specific “Select …” label).
 * Option lists open only on click/focus — never dump choices as static text.
 */
export const SELECT_PLACEHOLDER = '— Select —'

/** Empty-value labels that mean “no filter” in register / report bars. */
export function isFilterAllLabel(label: string): boolean {
  const t = label.trim().toLowerCase()
  if (!t) return false
  return (
    t === 'all' ||
    t.startsWith('all ') ||
    t === 'any' ||
    t.startsWith('any ') ||
    t === '—' ||
    t === '-' ||
    t === '–'
  )
}

/**
 * Resolve closed-state placeholder for a select.
 * - Bare “Select…” / “Choose…” → standard `— Select —`
 * - Filter “All / Any …” → keep as written
 * - Field-specific “Select vendor…” → keep for clarity
 */
export function resolveSelectPlaceholder(
  emptyLabel?: string | null,
  opts?: { inFilterBar?: boolean },
): string {
  const raw = emptyLabel?.trim()
  if (!raw) {
    return opts?.inFilterBar ? 'All' : SELECT_PLACEHOLDER
  }
  if (isFilterAllLabel(raw)) return raw
  if (/^(select|choose|pick)[.…\s]*$/i.test(raw)) return SELECT_PLACEHOLDER
  if (/^[—–\-]\s*(select|choose)[.…\s—–\-]*$/i.test(raw)) return SELECT_PLACEHOLDER
  return raw
}
