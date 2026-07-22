# Manufacturing Form Components

Shared form primitives for Manufacturing (Wave FORM-A). All live in
`frontend/src/modules/manufacturing/ui/` and are exported from the barrel `./index.ts`.

## Shells

### `ProductionPageHeader`
List/ops page wrapper. Composes `OperationalPageShell` + `ErpCommandBar`.
Props: `title`, `description?`, `breadcrumbs?`, `primaryAction?`, `secondaryActions?`,
`kpiStrip?`, `filterBar?`, `backLink?`, `badge?` (default "Manufacturing").

### `ManufacturingDocumentShell`
Document page architecture (create/detail/review). Adds to the shell:
- `statusArea?: ReactNode` — badges next to title
- `alerts?: ReactNode` — blocker/warning/next-action banners
- `summary?: DocumentSummaryItem[]` — operational summary strip
- `sidePanel?: ReactNode` — 4-col contextual panel (8+4 grid, stacks on tablet)
- `primaryAction` / `secondaryActions` / `moreActions` — sticky `ErpCommandBar`

## Content primitives

### `DocumentSummaryStrip`
`items: DocumentSummaryItem[]` — `{ id, label, value, tone?, helper? }`.
4–6 facts (Planned / Good / Remaining / Due / Material / Quality). Not decorative KPIs.

### `DocumentFormSection`
Section card: `title`, `subtitle?`, `children`.

### `AdvancedSection`
Collapsed-by-default section for ADVANCED fields. `title?`, `subtitle?`, `defaultOpen?`.

### `DocumentInfoPanel`
Collapsible CRM-style information panel. `sections: InfoPanelSection[]` —
each `{ title, fields: { label, value }[] }`. Standard sections: General, Dates, Source, Setup, Audit.

## Guidance & validation

### `ReadinessChecklist`
`items: ReadinessItem[]` — `{ id, label, state, detail? }` with states
`ready | missing | warning | recommended | overridden | pending`. Server-derived only.

### `ValidationSummary`
`blockers: string[]`, `warnings: string[]`. Rendered before lifecycle actions.

### `NextBestActionBanner`
`nba: NextBestAction` — `{ label, description?, tone?, action? }`. One guided next step.

### `PostingImpactPanel`
Accounting-style result preview for posting drawers.
`rows: { label, value, tone? }[]`, `warning?` (immutability notice).

## Posting drawers (Wave FORM-C)

Under `frontend/src/modules/manufacturing/work-orders/components/`:

- `MaterialIssueDrawer` — position strip, validated quantity, impact preview, idempotent post.
- `MaterialReturnDrawer` — returnable balance, mandatory reason, impact preview.
- `FgReceiptDrawer` — server eligibility (`getFgEligibility`), preview (`previewFgReceipt`), post (`postFgReceipt`).
- `CompleteWorkOrderDialog` — close-readiness (`getCloseReadiness?allowInProgress=true`) with blockers/warnings.
- `RecordProgressDrawer`, `AssignmentDrawer`, `RuntimeChangeDrawer`, `WipTransferDrawer`, `CorrectionDrawer` — pre-existing, kept.

## Status language

`productionStatus.ts` is the single source for human labels + tones
(`workOrderStatusMeta`, `stageStatusMeta`, `materialLineMeta`, `jobWorkStatusMeta`, …).
Never map enum → color in a page.
