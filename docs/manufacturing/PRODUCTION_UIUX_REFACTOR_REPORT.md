# Production UI/UX Refactor Report

> Living progress log for Manufacturing Production UI modernisation.  
> Specs: [`PRODUCTION_UIUX_AUDIT.md`](PRODUCTION_UIUX_AUDIT.md) · [`PRODUCTION_UIUX_COMPONENT_MAP.md`](PRODUCTION_UIUX_COMPONENT_MAP.md) · [`PRODUCTION_UIUX_GUIDELINES.md`](PRODUCTION_UIUX_GUIDELINES.md)

---

## Session 2026-07-21 — Phase D (dual-mode polish + a11y)

### Done

| ID | Item | Notes |
|----|------|-------|
| D1 | Dual-mode chrome | `ManufacturingDemoBanner` / `ManufacturingAiAssist` gated with `isApiMode()`; Control Room AI rail removed; status chips on WO lists; Issues demo empty state with CTAs (no demo/API mix) |
| D2 | Demo registers + legacy hub | BOM / Routes / Production Plan registers → `ProductionPageHeader` + dense table; plan form/detail AI rails removed; `/production` + `ProductionPage` → `/manufacturing/today` |
| D3 | a11y pass | Favorite `aria-label`; Today/Shopfloor/Control Room open-WO labels; QC action labels; lane tabs; `DynamicsStatusChip` `role="status"`; operator card label; drawers/modals already Escape-capable |

### Explicitly not done (remaining debt)

| Phase | Item |
|-------|------|
| Follow-on | Issues / Job Work saved views; Quality SPA; setup BOM/Routings API masters chrome |
| — | Unifying all manufacturing into one page+bridge (future ADR) |
| — | Phase 5C / MRP / costing / scheduling — **out of scope** |

### Constraints honoured

- No CRM/Accounting redesign; no backend/schema/workflow changes; dual-mode preserved; no demo seed on API lists

### Verification

- `npx tsc --noEmit` in `frontend/` — **passed** (2026-07-21, Phase D)

### PRODUCTION UI READINESS (Phase D close)

**READY WITH CONDITIONS** — C+ + D chrome/a11y complete for daily-ops and demoted demo registers. Remaining: Issues/JW saved views, Quality SPA, optional screenshots, full page+bridge dual-mode unification.

---

## Session 2026-07-21 — Phase C+ (WO saved views → Shopfloor → Reports)

### Done

| ID | Item | Notes |
|----|------|-------|
| C+1 | WO register filter drawer + saved views | API register: `CrmListFilterBar` + `CrmFilterDrawer` + `useSavedViews` (`WORK_ORDER_REGISTER_PRESETS`); KPI strip syncs `filters.view`; product filter maps to existing `productItemId` list param; no new backend |
| C+2 | Shopfloor kit alignment | `ProductionPageHeader`, KPI strip (≤6 lane counts), search/plant filter bar; AI assist + demo banner removed; Live / Line / Summary kept; demo actions unchanged; stays under More |
| C+3 | Reports kit alignment | `ProductionPageHeader` + empty/loading kit; quieter catalog cards; demo banner removed; no new report engines |

### Explicitly not done (remaining debt)

| Phase | Item |
|-------|------|
| C+ follow-on | Issues / Job Work saved views (copy WO pattern) |
| C+ | Setup BOM/Routings list chrome; full CRM-master shell parity (`EnterpriseMasterShell`) |
| C+ | Quality queue pages; optional screenshot appendix |
| D | ~~Dual-mode parity polish; a11y pass~~ → **done 2026-07-21** |
| — | Demo WO register still uses inline filters (API register is gold path) |
| — | Phase 5C / MRP / costing / scheduling — **out of scope** for UI modernisation |

### Constraints honoured

- No CRM/Accounting page redesign
- No backend / schema / workflow changes
- No Ant Design / MUI / Bootstrap / new theme
- Dual-mode preserved

### Verification

- `npx tsc --noEmit` in `frontend/` — **passed** (2026-07-21, Phase C+)

### PRODUCTION UI READINESS (Phase C+ close)

**READY WITH CONDITIONS** — daily ops + WO saved views + Shopfloor/Reports chrome aligned to the kit. Conditions: demo WO register not on CRM filter drawer; Issues/JW saved views not yet; Quality SPA not restyled; dual-mode Issues still API-only; screenshots optional.

---

## Session 2026-07-20 — Phase C (supporting ops + light setup)

### Done

| ID | Item | Notes |
|----|------|-------|
| C2 | Job Work register | `ProductionPageHeader`, KPI strip, status tabs + search, columns JW#/WO/vendor/operation/sent·received/expected return/status via `JobWorkStatusBadge`; AI rail removed |
| C2b | Job Work detail | One primary CTA + More; qty summary strip; primary tabs + More overflow; kit status badge; AI rail / demo banner removed; UUID-free primary fields |
| C2c | Job Work form | `ProductionPageHeader` + back link; quieter info strip (no demo banner chrome) |
| C3 | Issues queue | `ProductionPageHeader` + filter bar; severity border + `IssueSeverityBadge`; `IssueStatusBadge` → `DynamicsStatusChip` via `issueStatusMeta`; Acknowledge/Start/Resolve/Cancel unchanged (already wired) |
| C4 | Setup masters | WC / Machines / Profiles denser `erp-table` + Active chips; UUID labels demoted to "—"; shell nav tightened |
| C5 | Status kit | `issueSeverityMeta`, quality inspection/NCR status+severity metas; `JobWorkStatusBadge`, `IssueSeverityBadge` |

### Explicitly not done (remaining debt)

| Phase | Item |
|-------|------|
| C+ | Shopfloor; reports; filter drawer + saved views on registers; screenshot pass |
| C+ | Setup BOM/Routings list chrome; full CRM-master shell parity (`EnterpriseMasterShell`) |
| C+ | Quality queue pages (reuse kit metas when touched) |
| D | Dual-mode parity polish on remaining demo pages; a11y pass |
| — | Phase 5C / MRP / costing / accounting — **out of scope** for UI modernisation |

### Constraints honoured

- No CRM/Accounting page redesign
- No backend / schema / workflow changes
- No Ant Design / MUI / Bootstrap / new theme
- Dual-mode preserved

### Verification

- `npx tsc --noEmit` in `frontend/` — **passed** (2026-07-20, Phase C)

### PRODUCTION UI READINESS (Phase C close)

**READY WITH CONDITIONS** — daily ops chrome (Today → WO → Control Room → Daily Update → My Work → Job Work → Issues) is aligned to the kit; setup is lightly densified. Conditions: no saved views / filter drawers yet; Shopfloor & reports untouched; demo Control Room still carries AI rail; Quality SPA pages not restyled; dual-mode Issues still API-only.

---

## Session 2026-07-20 — Phase B remainder (Control Room → WO create)

### Done

| ID | Item | Notes |
|----|------|-------|
| B3 | Control Room (API) | `ProductionPageHeader`, KPI strip, Board/List toggle, search + status/health filters, compact WO cards + kit badges; aggregates restyled |
| B3b | Control Room (demo) | Same shell/description/KPI; lighter panels (no heavy shadow/oversized chips) |
| B4 | Daily Update | Header + sticky bottom Save Draft / Validate / Submit; compact `erp-table` + footer totals |
| B5 | My Work | `ProductionPageHeader`; assignment chips via `assignmentStatusMeta` / `DynamicsStatusChip`; touch actions unchanged |
| C1 | WO detail (API) | Detail header + status/health badges; one primary lifecycle CTA + More; qty summary strip; primary tabs + More overflow; stage cards; UUIDs hidden from primary fields |
| C1b | WO create (API) | `ProductionPageHeader`, sectioned form, optional details disclosure, SO convert steps 1–3 |

### Explicitly not done (later)

| Phase | Item |
|-------|------|
| C | Job Work + Issues registers; drawer shell alignment; Setup masters density |
| C+ | Shopfloor; reports; filter drawer + saved views on registers; screenshots |
| D | Full dual-mode parity polish on remaining demo pages; a11y pass |

### Constraints honoured

- No CRM/Accounting page redesign
- No backend / schema / workflow changes
- No Ant Design / MUI / Bootstrap / new theme
- Dual-mode preserved (API route vs demo register / control room)

### Verification

- `npx tsc --noEmit -p tsconfig.json` in `frontend/` — **passed** (2026-07-20, Phase B remainder)

---

## Session 2026-07-20 — Phase A + B1/B2 start

### Done

| ID | Item | Notes |
|----|------|-------|
| A1 | Docs | Component map + guidelines fleshed out; this report started |
| A2 | Production UI kit | `frontend/src/modules/manufacturing/ui/*` — status map, page header, WO status/health badges, empty state, index; `workOrderTone.ts` re-exports |
| A3 | Navigation | Primary daily-ops items; Issues/Job Work/Reports/Settings/Shopfloor + demo BOM/Routes/Plan under More/Setup; hub → `/manufacturing/today` |
| B1 | Today page | `ProductionPageHeader`, KPI strip (≤6), sections Needs Attention / Running Now / Due Today / Recently Completed, compact WO cards + kit badges |
| B2 | WO register (API) | Segmented views, cleaner columns (completion %, no scrap dump), kit badges, New WO + Create from Sales Order; demo register shell labels aligned lightly |

### Explicitly not done (later)

| Phase | Item |
|-------|------|
| B | Control Room restyle; Daily Update polish; My Work chip alignment |
| C | WO detail / create form chrome; Job Work + Issues registers; drawer shell alignment; Setup masters density |
| C+ | Shopfloor; reports; filter drawer + saved views; screenshots |

### Constraints honoured

- No CRM/Accounting page redesign
- No backend / schema / workflow changes
- No Ant Design / MUI / Bootstrap / new theme
- Dual-mode preserved (API route vs demo register)

### Verification

- `npx tsc --noEmit -p tsconfig.json` in `frontend/` — **passed** (2026-07-20)
