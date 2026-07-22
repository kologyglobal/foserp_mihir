# Production UI/UX Guidelines

> Implementer rules for Manufacturing / Production modernisation.  
> Full inventory: [`PRODUCTION_UIUX_AUDIT.md`](PRODUCTION_UIUX_AUDIT.md) · Page map: [`PRODUCTION_UIUX_COMPONENT_MAP.md`](PRODUCTION_UIUX_COMPONENT_MAP.md) · Progress: [`PRODUCTION_UIUX_REFACTOR_REPORT.md`](PRODUCTION_UIUX_REFACTOR_REPORT.md)  
> Companions: [`PURCHASE_UI_CONSISTENCY.md`](../PURCHASE_UI_CONSISTENCY.md) · [`UI_VIEW_PAGE_STANDARD.md`](../UI_VIEW_PAGE_STANDARD.md)

**Status:** active for Phase A–B (2026-07-20). Expand with screenshots as pages ship.

---

## 1. North star

| Do | Don’t |
|----|--------|
| Flat Dynamics / BC surfaces (`dynamics-tokens.css`) | Purple/indigo gradients, glow, glassmorphism |
| Reuse Accounting workspace + CRM register patterns | Invent a Production-only page shell |
| One status chip system via `manufacturing/ui/productionStatus.ts` | Ad-hoc badge colours per page |
| `appConfirm` / `appPromptNote` / `notify` | `window.alert` / `confirm` / `prompt` |
| Dual-mode via bridges / `isApiMode()` | Mix demo seed rows into API lists |

Visual system = existing Dynamics + ERP components. **No Ant Design / MUI / Bootstrap / new theme.**

---

## 2. Preference order (sources to copy)

1. **Accounting** — Money In/Out shells, Journals, Bank & Cash drawers, posting badges, `DynamicsTabs`
2. **CRM** — lead register (filter drawer + saved views + KPI strip), 360 headers, activity timeline
3. **Shared** — `OperationalPageShell`, `ErpCommandBar`, `DataTable`, confirms, toasts, permissions

Do **not** redesign CRM or Accounting to “help” Production. Backend/schema/workflow changes are out of scope unless fixing an API contract defect.

---

## 3. Page template (list / ops)

Use `ProductionPageHeader` (wraps `OperationalPageShell` + `ErpCommandBar`):

1. Breadcrumbs: `Manufacturing & Production › {Page}`
2. Title + one-line description (`showDescription`)
3. Primary CTA top-right; secondary actions left of primary
4. Optional `EnterpriseKpiStrip` (max **6** tiles on Today / registers)
5. Filters: segmented view pills and/or `DynamicsFilterRow` — not a third custom filter UI
6. Body: table or queue sections
7. Empty / loading via `ProductionEmptyState` / `LoadingState`

### View / detail

1. In-page **Back** via shell `backLink` (not command-bar Back)
2. Document number + status in header (`WorkOrderStatusBadge` / health)
3. Secondary commands left, primary lifecycle right
4. Tabs for ops / materials / quality / changes / history
5. Destructive → `appConfirm`; reason → `appPromptNote`

### Edit / create

1. Sticky commands + validation summary
2. Prefer FastTabs; collapse secondary sections
3. `notify` on save success/failure

**Forbidden shells for new work:** raw `PageHeader` + marketing `Card` stacks; `CrmPageShell`.

---

## 4. Status badges & tones

All Production statuses map through **`productionStatus.ts`**:

| Domain | Helper | Chip component |
|--------|--------|----------------|
| Work order status | `workOrderStatusMeta` | `WorkOrderStatusBadge` |
| Work order health | `workOrderHealthMeta` | `WorkOrderHealthBadge` |
| Stage / operation | `stageStatusMeta` | `DynamicsStatusChip` |
| Quality (production) | `qualityStatusMeta` | same |
| Material control / line | `materialControlMeta` / `materialLineMeta` | same |
| Job work | `jobWorkStatusMeta` | same |
| Issue | `issueStatusMeta` | same (migrate `IssueStatusBadge`) |

- Prefer **DynamicsStatusChip** tones: `success` | `warning` | `critical` | `info` | `neutral` | `live` | `pending`
- Legacy `StatusDot` callers may use `toStatusDotTone()` from the same module
- Do not hardcode Tailwind colour classes for status on new pages

---

## 5. Terminology (user-facing)

| API / internal | UI label (preferred) |
|----------------|----------------------|
| `READY` (WO) | Ready / Ready to Start (KPI) |
| `IN_PROGRESS` | Running |
| `ON_HOLD` | On Hold |
| `DELAYED` (health) | Delayed |
| `ON_TRACK` | On Track |
| `ATTENTION` | Needs Attention |
| `BLOCKED` | Blocked |
| FactBox | **Smart context** |
| Control tower | Control Room |

Lifecycle verbs match backend: Release, Start, Hold, Resume, Complete, Cancel.

Register columns (default): **WO, Product, Source/Customer, Qty, Current Stage, Completion %, Due, Supervisor, Status, Health**.  
Do **not** dump Good / Rework / Reject / Scrap as default list columns.

---

## 6. Tables & forms

- Host tables with shared `DataTable` (or Dynamics grid when aligning Accounting)
- Dense enterprise density; mono for document numbers
- Row actions via `EnterpriseRowActionsMenu`
- Forms: shared `Inputs` / `FormField`; card-form FastTabs for multi-section documents

---

## 7. Navigation (role-aware simplification)

**Primary (daily ops):** Today · Work Orders · Control Room · Daily Update · My Work  

**More:** Issues · Job Work · Reports · Settings · Shopfloor (demo)  

**Setup:** Setup hub · Profiles · Work Centres · Machines · BOM Setup · Routing Setup · legacy demo BOM / Routes / Production Plan  

Hub redirect: `/manufacturing` → `/manufacturing/today`.

---

## 8. Dual-mode rules

| Rule | Detail |
|------|--------|
| Single source of data | Demo store **or** API — never both on one table |
| Banners | Demo banner only when truly demo-only |
| Permissions | `useManufacturing*Permissions` / `PermissionGate` |
| Preserve demo | `VITE_USE_API=false` must keep interactive flows |
| API mode | Never present mock seed as live data |

---

## 9. Anti-patterns (reject in review)

- New UI library or theme for Production screens
- Gradient hero / emoji empty states / pill clouds in headers
- Duplicate titles (workspace tab + H1 + eyebrow)
- Custom confirm modals when `appConfirm` suffices
- Copy-pasting Accounting business widgets into Production without need
- Backend/schema changes “for polish”

---

## 10. Testing expectations (when a page is modernised)

- [ ] Dynamics density matches Money In / journals / WO register
- [ ] Demo mode smoke still works
- [ ] API mode: permissions hide disallowed actions
- [ ] Confirms use `appConfirm` / `appPromptNote`
- [ ] No demo/API data mix
- [ ] `cd frontend && npm run typecheck`

---

## 11. Open guideline TODOs

- [ ] Screenshot appendix (Today / WO register before/after)
- [ ] Operator vs desktop breakpoint rules (detail)
- [ ] When to graduate WO filters to CRM filter drawer + saved views
