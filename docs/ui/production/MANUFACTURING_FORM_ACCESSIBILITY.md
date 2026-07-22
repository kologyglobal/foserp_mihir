# Manufacturing Form Accessibility (WCAG 2.1 AA — practical)

Verified patterns across modernised forms:

## Keyboard & focus

- All actions are native `<button>` / `<a>` elements (shared `Button`, `CommandBarButton`).
- Drawers/modals (`Modal`, `CrmDrawerShell`) trap scroll, close on Escape, and use
  `role="dialog"` + `aria-modal` + labelled titles.
- Tab strips use `role="tablist"` / `role="tab"` / `aria-selected`
  (WO create source tabs, WO detail tabs); overflow menus use `aria-expanded` /
  `aria-haspopup`.
- Collapsible sections (`AdvancedSection`, `DocumentInfoPanel`) expose `aria-expanded`.

## Labels & structure

- Every input is wrapped in `FormField` with a visible label; required markers rendered
  in text (asterisk) not colour alone.
- Icons are decorative (`aria-hidden`) with adjacent text labels; icon-only actions carry
  `aria-label`.
- Status chips (`DynamicsStatusChip`) use `role="status"` + `aria-label` and pair colour
  with a text label — status is never colour-only.

## Errors & guidance

- Field errors render as text under the field (`FormField error`), not just red borders.
- `ValidationSummary` renders with `role="alert"` and lists blockers/warnings as text.
- Read-only and on-hold states announced with `role="status"` banners.

## Touch / tablet

- Posting drawers use enlarged quantity inputs (15px semibold, full-width).
- Sticky action bars (daily update) with 36px+ targets; `role="toolbar"` + label.
- Two-column grids collapse to single column below `lg`.

## Known gaps (tracked)

- Full screen-reader audit (NVDA/VoiceOver pass) not yet executed — visual/AT smoke only.
- Some legacy demo pages (`WorkOrderFormPage`, demo shopfloor) predate this standard and
  are outside API-mode gold path.
- Reduced-motion audit pending; current animations are limited to width transitions.
