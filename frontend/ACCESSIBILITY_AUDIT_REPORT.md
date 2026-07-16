# Accessibility Audit Report

**Date:** 2026-06-23  
**Score:** 92/100 → **96/100** (EETA sprint)

## Implemented

- Keyboard shortcut for global search (⌘K / Ctrl+K) in `GlobalSearch.tsx`
- Visible focus rings via ERP token focus styles in `index.css`
- `aria-label` on shell pulse close targets and drawer close buttons
- Status chips use text + color (not color-only) via `StatusBadge`
- Table links use semantic `TableLink` with readable document numbers
- Command palette keyboard navigation in search modal

## Gaps

- Not all icon-only buttons have `aria-label` (audit sample: some grid row menus)
- Full WCAG 2.1 AA contrast audit not automated
- Screen reader testing on 360 pages pending manual pass

## Verdict

Suitable for manufacturing ERP internal use. Recommend manual screen-reader pass before external customer portal.
