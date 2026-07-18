import { pickFocusable, resolveFieldElement } from './resolveFieldElement'
import type { FocusScrollOptions } from './types'

const HIGHLIGHT_CLASS = 'erp-nba-highlight'
const HIGHLIGHT_MS = 2200

export interface FocusAndHighlightOptions extends FocusScrollOptions {
  /** How long the highlight pulse stays visible (ms). Default 2200. */
  highlightMs?: number
  /** When false, scroll/highlight only — do not focus. Default true. */
  focus?: boolean
}

/**
 * Scroll to a form field, focus it, and briefly highlight it so Next Best Action
 * CTAs (and similar guides) show the user exactly where to update.
 *
 * Resolves via `[data-field]`, `#id`, `[name]`, then `[data-nba-target]`.
 */
export function focusAndHighlightField(
  fieldKey: string,
  options: FocusAndHighlightOptions = {},
): HTMLElement | null {
  if (!fieldKey) return null

  const {
    root = null,
    behavior = 'smooth',
    block = 'center',
    delayMs = 80,
    highlightMs = HIGHLIGHT_MS,
    focus = true,
  } = options

  const run = (): HTMLElement | null => {
    const scope: ParentNode = root ?? document
    let host =
      resolveFieldElement(fieldKey, scope)
      ?? (scope.querySelector(`[data-nba-target="${cssEscape(fieldKey)}"]`) as HTMLElement | null)

    if (!host) return null

    const focusable = pickFocusable(host)
    const paintTarget = findHighlightHost(host, focusable)

    focusable.scrollIntoView({ behavior, block })

    if (focus) {
      try {
        focusable.focus({ preventScroll: true })
      } catch {
        /* non-focusable hosts are fine — highlight still guides the eye */
      }
    }

    applyHighlight(paintTarget, highlightMs)
    return focusable
  }

  if (delayMs > 0) {
    window.requestAnimationFrame(() => {
      window.setTimeout(run, delayMs)
    })
    return resolveFieldElement(fieldKey, root)
      ?? (document.querySelector(`[data-nba-target="${cssEscape(fieldKey)}"]`) as HTMLElement | null)
  }

  return run()
}

function findHighlightHost(host: HTMLElement, focusable: HTMLElement): HTMLElement {
  const row =
    host.closest('.erp-field-row')
    ?? focusable.closest('.erp-field-row')
    ?? host.closest('[data-nba-target]')
    ?? host.closest('.erp-card-section')
  return (row as HTMLElement | null) ?? host
}

function applyHighlight(el: HTMLElement, highlightMs: number) {
  el.classList.remove(HIGHLIGHT_CLASS)
  // Force reflow so re-clicking the same CTA restarts the animation.
  void el.offsetWidth
  el.classList.add(HIGHLIGHT_CLASS)
  window.setTimeout(() => {
    el.classList.remove(HIGHLIGHT_CLASS)
  }, highlightMs)
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value)
  return value.replace(/["\\]/g, '\\$&')
}
