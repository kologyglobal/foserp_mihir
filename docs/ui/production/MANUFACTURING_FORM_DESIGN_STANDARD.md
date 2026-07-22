# Manufacturing Form Design Standard

Status: **Active** (Form UX 10/10 modernisation, Wave FORM-A–D shipped)
Scope: every Manufacturing create, edit, review and detail form.

## Non-negotiable rule

Manufacturing forms reuse the existing CRM/ERP shared component library. No page-specific
theme hacks, no separate Manufacturing design system. The gold-path composition is:

```
OperationalPageShell (variant="dynamics", layout="enterprise", badge="Manufacturing")
  └─ ErpCommandBar (inline, sticky) — one primary lifecycle action + More menu
  └─ NextBestActionBanner            — C. alert & guidance area
  └─ DocumentSummaryStrip            — B. operational summary (4–6 facts)
  └─ main content (8 cols) + DocumentInfoPanel / ReadinessChecklist (4 cols)
  └─ drawers/modals for postings     — Modal / CrmDrawerShell + PostingImpactPanel
```

Wrappers: `ProductionPageHeader` (list/ops pages) and `ManufacturingDocumentShell`
(document pages) in `frontend/src/modules/manufacturing/ui/`.

## The five questions

Every form must answer immediately:

1. **What is this document?** — breadcrumb + document number + product subtitle.
2. **What is its current status?** — `WorkOrderStatusBadge` / `DynamicsStatusChip` with human labels from `productionStatus.ts`.
3. **What requires attention?** — `ValidationSummary` (blockers/warnings) + quality blocker strip.
4. **What is the next action?** — single primary action in `ErpCommandBar` + `NextBestActionBanner`.
5. **What happened previously?** — Timeline tab / activity feed.

## Progressive disclosure

- **ESSENTIAL** — visible immediately (product, quantity, due date, priority).
- **RECOMMENDED** — shown after main selection with "Recommended from Manufacturing Profile" hints.
- **ADVANCED** — inside `AdvancedSection` (collapsed by default).
- **SYSTEM** — read-only, only in `DocumentInfoPanel` or the timeline.

## Field presentation

- Business labels only ("Planned Quantity", "Source Warehouse"). Never `Ref ID`, `Tx Type`, `Qty Val`.
- Technical UUIDs are never shown or typed by users (daily update add-line now uses
  Work Order / Stage selectors, not raw ID inputs).
- Every field uses `FormField` with `label`, `required`, `hint`, `error`.
- Large tap-friendly quantity inputs on posting drawers (`text-[15px] font-semibold`).

## Validation experience

Three levels, all human-readable:

1. **Field** — inline `FormField error` ("Cannot exceed returnable balance (12)").
2. **Section** — hints and section-level warnings.
3. **Document** — `ValidationSummary` before lifecycle actions (release/complete/post),
   fed by server readiness endpoints (`getProfileReadiness`, `getWorkOrderMaterialsReadiness`,
   `getCloseReadiness`, `getFgEligibility`, `previewFgReceipt`).

Red borders alone are never the only signal.

## Status and next action

- Primary actions derive from backend status + permission hooks
  (`useManufacturingWorkOrderPermissions` etc.). Only the most relevant action is primary:
  Draft → **Release Work Order**; Ready → **Start Production**; Running → **Record Production**;
  Completed → **Receive Finished Goods**; read-only → **Review**.
- All other actions live in the "More" overflow of `ErpCommandBar`.

## Posting actions (Accounting-style)

Every stock-affecting action uses an explicit posting drawer with:

- current position strip (required / reserved / issued / remaining / available),
- entry fields with validation against the position,
- `PostingImpactPanel` result preview,
- immutability warning ("This action posts an Inventory transaction and cannot be
  directly edited. Use a correction to reverse."),
- idempotency key on submit, duplicate-click protection via `busy` state.

Implemented: Material Issue, Material Return, Finished Goods Receipt, WIP Transfer
(existing), Job Work dispatch/receive (existing dialogs).

## Corrections

Never "Delete Transaction". Corrections use `CorrectionDrawer` with compensating entries
(Original → Reversal → Corrected Result), preview before apply.

## Loading / empty / error / permission states

- Loading: `LoadingState` variant matching the final layout.
- Empty: `ProductionEmptyState` (wraps shared `EmptyState`) with one next action.
- Error: toast + inline message, retry available, **no mock fallback in API mode**.
- Permission denied: explicit `EmptyState` naming the missing permission.

## Responsive

- Desktop: 12-col grid — main form 8 cols, contextual panel 4 cols.
- Tablet: single column, panels stack, sticky bottom action bars (daily update),
  large touch targets on posting drawers.
- Mobile: read + basic actions; BOM/Routing editors remain desktop-first.

## What this standard forbids

- Separate Manufacturing visual language, gradients, decorative KPI cards.
- More than one primary button per view.
- Generic "Are you sure?" confirmations for lifecycle actions (use readiness dialogs).
- Frontend-computed authoritative readiness/eligibility/costs.
- Raw enum labels (`WAITING_FOR_QUALITY`) — always map via `productionStatus.ts`.
