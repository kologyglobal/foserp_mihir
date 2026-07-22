# Production UI/UX — Component Map

> Map of **Production pages → reusable Accounting / CRM / shared components**.  
> Source inventory: [`PRODUCTION_UIUX_AUDIT.md`](PRODUCTION_UIUX_AUDIT.md) · Guidelines: [`PRODUCTION_UIUX_GUIDELINES.md`](PRODUCTION_UIUX_GUIDELINES.md) · Progress: [`PRODUCTION_UIUX_REFACTOR_REPORT.md`](PRODUCTION_UIUX_REFACTOR_REPORT.md)  
> Preference: **Accounting → CRM → Shared**. Do not invent new kits.

**Status:** filled for Phase A + B1/B2 targets (2026-07-20). Paths marked **✅** are wired in code; others are targets.

---

## Legend

| Column | Meaning |
|--------|---------|
| Current | What the page largely uses today |
| Target shell | Page chrome to converge on |
| Target list/detail | Register / document body |
| Target actions | Commands, drawers, confirms |
| Notes | Dual-mode / phase caveats |

---

## Production UI kit (compose shared only)

| Kit file | Role | Shared building blocks |
|----------|------|------------------------|
| `frontend/src/modules/manufacturing/ui/productionStatus.ts` | Central status → tone + label map (WO / stage / quality / material / job-work / issue) | `DynamicsStatusChip` tones |
| `frontend/src/modules/manufacturing/ui/ProductionPageHeader.tsx` | Thin page wrapper | `OperationalPageShell`, `ErpCommandBar` |
| `frontend/src/modules/manufacturing/ui/WorkOrderStatusBadge.tsx` | WO status chip | `DynamicsStatusChip` + map |
| `frontend/src/modules/manufacturing/ui/WorkOrderHealthBadge.tsx` | WO health chip | `DynamicsStatusChip` + map |
| `frontend/src/modules/manufacturing/ui/ProductionEmptyState.tsx` | Empty registers / panels | `@/components/ui/EmptyState` |
| `frontend/src/modules/manufacturing/ui/index.ts` | Re-exports | — |
| `frontend/src/modules/manufacturing/work-orders/workOrderTone.ts` | Compat re-export → central map | StatusDot tones for legacy callers |

**Forbidden in kit:** custom Card/Button/Badge primitives, hardcoded hex per page, Ant Design / MUI / Bootstrap.

---

## Workspace hubs

| Page | Route | Current | Target shell | Target body | Target actions | Notes |
|------|-------|---------|--------------|-------------|----------------|-------|
| **Today** ✅ | `/manufacturing/today` | Was ad-hoc KPI grid + panels | `ProductionPageHeader` → `OperationalPageShell` dynamics/enterprise | `EnterpriseKpiStrip` + section queues + compact WO cards + kit badges | Create WO / Record Daily Update / Refresh | Phase B1 shipped |
| **Control Room** ✅ | `/manufacturing/control-room` | Custom panels; API aggregates only | `ProductionPageHeader` + Board/List + filters | Compact WO cards + status/health aggregates | Work Orders / Refresh | Phase B3 shipped |
| Daily Update ✅ | `/manufacturing/daily-update` | Shell + dense grid; sticky Save/Validate/Submit | Phase B4 shipped |
| My Work ✅ | `/manufacturing/my-work` | Mobile OK; kit assignment chips | Phase B5 shipped |
| **WO detail (API)** ✅ | `/manufacturing/work-orders/:id` | Header + one primary CTA + More; qty strip; tabs + More; stage cards | Phase C1 shipped (chrome) |
| **WO create (API)** ✅ | `/manufacturing/work-orders/new` | `ProductionPageHeader` + sections + optional disclosure | Phase C1b shipped |
| Manufacturing Dashboard | `/manufacturing/dashboard` | Demo dashboard | Demoted in nav (Setup/More) | KPI + charts sparingly | — | Lower priority |
| Setup Hub | `/manufacturing/setup` | `ManufacturingSetupShell` | Keep; align density to Finance settings | Master tiles | — | Phase 1 masters |

---

## Registers (lists)

| Page | Route | Current | Target shell | Target list | Target filter/KPI | Notes |
|------|-------|---------|--------------|-------------|-------------------|-------|
| **Work Orders (API)** ✅ | `/manufacturing/work-orders` | `ApiWorkOrderRegisterPage` | `ProductionPageHeader` / shell | `DataTable` + segmented status views | `EnterpriseKpiStrip`; search + status segment (All/Draft/Ready/Running/On Hold/Delayed/Completed) | Phase B2 shipped |
| **Work Orders (demo)** ✅ | same | `WorkOrderRegisterPage` | Same shell language | Same columns philosophy | Tabs already present — aligned labels | Dual-mode route split |
| Job Work | `/manufacturing/job-work` | Dual-mode register | Same as WO | Same | Kit status map for JW | Phase C |
| Issues | `/manufacturing/issues` | Queue + custom badge | Same | Register + map-driven chip | Filter row | Align `IssueStatusBadge` → kit |
| BOM / Routes / Plan | demo routes | Demo registers | Demoted under Setup/More | Enterprise register when touched | — | Do not delete routes |
| Setup masters | `/manufacturing/profiles` etc. | Setup pages | `ManufacturingSetupShell` | Master list | Search | Prefer Setup BOM/Routings over legacy demo BOM/Routes |

---

## Detail / document views (Phase C+)

| Page | Route | Target header | Target body | Target side | Notes |
|------|-------|---------------|-------------|-------------|-------|
| WO detail (API/demo) | `/manufacturing/work-orders/:id` | `DynamicsRecordHeader` / Erp card command + `backLink` | `DynamicsTabs` / `ErpCardTabs`; timeline; quality strip | Smart context | Runtime change drawer already present |
| WO create/edit | `/manufacturing/work-orders/new` | Shell + `FormActionBar` | FastTabs; SO convert mode via `?mode=sales_order` | Lookups | Dual-mode |
| Job Work detail | `/manufacturing/job-work/:id` | Same as WO detail | Lines + dispatch/receive | Vendor context | Phase 4B |

---

## Operator / daily loop

| Page | Route | Target | Notes |
|------|-------|--------|-------|
| Today ✅ | `/manufacturing/today` | Shell + KPI + Needs Attention / Running / Due / Completed | B1 |
| Daily Update | `/manufacturing/daily-update` | Shell + sticky Save/Validate/Submit; dense grid | **Phase B4 shipped** |
| My Work | `/manufacturing/my-work` | Mobile OK; kit assignment chips | **Phase B5 shipped** |
| Shopfloor | `/manufacturing/shopfloor` | Demoted nav; Dynamics tokens | Visual exception |

---

## Drawers & sheets

| Action | Current | Target | Confirm |
|--------|---------|--------|---------|
| Assign / progress / runtime | WO drawers under `work-orders/components/` | Accounting-style drawer chrome | `appConfirm` / `appPromptNote` |
| Manufacturing actions | `ManufacturingActionDrawer.tsx` | Same | — |
| Operator sheets | `QuickIssueSheet`, `ProductionCompletionSheet` | Mobile sheet OK; desktop → drawer | `notify` |

---

## Shared imports cheat-sheet

```text
Kit:       @/modules/manufacturing/ui
Shell:     OperationalPageShell (via ProductionPageHeader)
Commands:  ErpCommandBar, ErpButton
Tabs:      DynamicsTabs (workspaces); segmented pills for register views
KPI:       EnterpriseKpiStrip
Table:     DataTable (+ EnterpriseRegisterTableShell when adding CRM-style filters)
Status:    WorkOrderStatusBadge / WorkOrderHealthBadge → DynamicsStatusChip
Empty:     ProductionEmptyState → EmptyState
Loading:   LoadingState
Confirm:   appConfirm, appPromptNote
Toast:     notify
Perms:     @/utils/permissions/manufacturing
```

---

## Mapping decisions (resolved / open)

| Decision | Status |
|----------|--------|
| Filter row (Accounting density) for WO ops; CRM drawer later for advanced | **Resolved** — B2 uses search + segmented views |
| Hub landing = Today (not Control Room) | **Resolved** — redirect + `workspace: true` on Today |
| One WO register component vs route-level API/demo split | **Open** — keep split; shared kit + shell |
| Control Room: queue-first vs executive dashboard | **Resolved B3** — Board/List of live WOs + compact aggregates |
| Setup reuses `EnterpriseMasterShell` | **Open** |
