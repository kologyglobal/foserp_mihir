/** Purchase documents — localStorage key; value `'1'` means collapsed/hidden. */
export const PURCHASE_FACTBOX_COLLAPSED_KEY = 'purchase.factbox.collapsed'

/**
 * Resolve initial FactBox open state.
 * - Explicit storage preference wins.
 * - When unset, default **closed** (restore via ✦). User can open and preference persists.
 *
 * Supports:
 * - sessionStorage `erp-factbox:*` → `'1'` open / `'0'` closed
 * - localStorage `purchase.factbox.collapsed` → `'1'` collapsed / `'0'` open
 */
export function getFactBoxInitialOpen(storageKey: string | undefined): boolean {
  if (!storageKey) return false
  if (typeof window === 'undefined') return false

  const isPurchaseCollapsedKey = storageKey === PURCHASE_FACTBOX_COLLAPSED_KEY

  try {
    if (isPurchaseCollapsedKey) {
      const collapsed = localStorage.getItem(storageKey)
      if (collapsed === '1') return false
      if (collapsed === '0') return true
    } else {
      const stored = sessionStorage.getItem(storageKey)
      if (stored === '0') return false
      if (stored === '1') return true
    }
  } catch {
    /* ignore */
  }

  // Unset preference: keep insights / Smart Context closed by default on all viewports.
  return false
}
