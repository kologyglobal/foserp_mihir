# Structure Reference Analysis

**Date:** 2026-07-11  
**Reference pattern:** DhurandharERPUI (layered module-oriented ERP frontend)  
**Target application:** FOS ERP (`trailer-erp/`)

> The DhurandharERPUI repository is not present in this workspace. This analysis is derived from the target structure specification provided in the migration brief and comparison with the current FOS ERP codebase.

---

## Reference principles (target pattern)

| Layer | Responsibility | Must NOT contain |
|-------|----------------|------------------|
| `modules/` | Route-level pages, dashboards, 360 workspaces, module hubs | Reusable widgets used across modules |
| `components/` | Domain-reusable UI (tables, drawers, forms, dialogs) | Route composition, fetch logic |
| `design-system/` | Business-agnostic enterprise shells, grids, workspace frameworks | CRM/purchase-specific logic |
| `data/` | Static seeds, fixtures, sample templates | API services, React components |
| `demo/` | Bootstrap, factories, scenario generation | Production runtime in API mode |
| `services/` | HTTP client, resource APIs, bridges, exports | Zustand state |
| `store/` | Zustand slices, selectors, persist rules | Raw `fetch` calls |
| `bootstrap/` | App startup, demo seed, API hydration | Page-level side effects |
| `config/` | Typed env, feature flags | Scattered `import.meta.env` |
| `routes/` | Module-split route files composed in `index.tsx` | Business logic |
| `hooks/` | Reusable React orchestration | Stateless pure helpers |
| `utils/` | Generic stateless helpers | React hooks, API calls |
| `types/` | Shared domain types | Duplicated page-local interfaces |
| `scripts/` | Integrity, regression, domain tests | Application runtime code |

---

## Reference vs FOS ERP — alignment score

| Area | Reference | FOS ERP today | Gap |
|------|-----------|---------------|-----|
| Route pages in `modules/` | ✓ | ✓ (~90%) | `pages/auth/` orphan; quotation pages under `modules/crm/` |
| Reusable UI in `components/` | ✓ | ✓ (~80%) | Some shells in `modules/crm/`; duplicate UI stacks |
| Design system separation | ✓ | Partial | `components/design-system/` AND root `design-system/` |
| Demo data isolation | ✓ | Partial | `data/` exists; no top-level `demo/`; root `data/*.ts` legacy |
| API in `services/api/` | ✓ | ✓ | Bridges co-located with APIs, not `services/bridges/` |
| Bootstrap centralized | ✓ | Partial | Split: `bootstrap/erpStartup.ts`, `store/bootstrap/crmBootstrap.ts`, `AppShell` hooks |
| Config centralized | ✓ | No | Only `services/api/config.ts` |
| Path aliases | ✓ | No | Deep relative imports (`../../..`) everywhere |
| Routes split by module | ✓ | No | Single 611-line `routes/index.tsx`, ~282 paths |
| Backend module pattern | entity layers | ✓ | Already strong; minor `shared/` consolidation possible |

---

## Reference module ↔ FOS domain mapping

| Reference module | FOS current location | Notes |
|------------------|---------------------|-------|
| `modules/auth/` | `pages/auth/LoginPage.tsx` + `context/AuthProvider.tsx` | Move page; keep or merge auth context |
| `modules/crm/` | `modules/crm/` | Good; extract quotation submodule |
| `modules/quotations/` | `modules/crm/*Quotation*` + `components/crm/Quotation*` | Split when stable |
| `modules/masters/` | `modules/masters/` + `modules/admin/` | Admin user masters overlap |
| `modules/sales/` | `modules/sales/` | Exists |
| `modules/purchase/` | `modules/purchase/` | Exists |
| `modules/inventory/` | `modules/inventory/` | Exists |
| `modules/production/` | `modules/mrp/`, `modules/execution-layer/` | Split naming |
| `modules/quality/` | `modules/quality/` | Exists |
| `modules/entity360/` | `modules/entity360/` | Matches reference 360 pattern |
| `modules/workspaces/` | `modules/workspaces/` | Role landing dashboards |
| `modules/mobile/` | `modules/mobile/` | Exists |

---

## Duplicate UI stacks (reference says consolidate later)

FOS ERP accumulated multiple parallel design vocabularies:

| Folder | Files (approx) | Role |
|--------|----------------|------|
| `design-system/` (root) | ~40+ | Canonical enterprise shells (preferred) |
| `components/design-system/` | ~15 | Legacy overlap — KPI, drawers, grids |
| `components/dynamics/` | ~10 | Dynamics 365 status chips, panels |
| `components/erp/` | ~20 | ERP buttons, command bar, card forms |
| `components/fiori/` | small | Fiori-style elements |
| `components/premium/` | ~25 | Executive dashboards, command palette |
| `components/saas/` | small | SaaS chrome |
| `components/live-erp/` | small | Live ERP widgets |

**Reference rule:** Document first, consolidate only proven duplicates. Do not delete in Phase 1.

---

## Backend reference alignment

Reference suggests `backend/src/modules/quotations/` as peer to CRM. **FOS decision (ADR, keep):** quotations remain under `backend/src/modules/crm/quotations/` — nested CRM submodule matches existing router mount at `/crm/quotations`.

Backend already follows reference entity pattern:

```
entity.routes.ts → entity.controller.ts → entity.service.ts → entity.repository.ts → entity.validation.ts → entity.types.ts
```

Optional future alignment: move `utils/`, `middleware/` helpers into `shared/` without changing routes.

---

## Key reference behaviours to preserve in FOS

1. **Dual mode** — demo seeds never hydrate in API mode (reference has same pattern).
2. **Bridge layer** — pages → stores → bridges → API (reference: services/bridges).
3. **Domain-colocated tests** — reference uses `scripts/{domain}/`; FOS has flat `scripts/test-*.ts` (organize in Phase 15).
4. **Route integrity** — reference maintains route manifest tests; FOS needs `test:folder-structure`.

---

## Verdict

FOS ERP is **partially aligned** with the reference pattern. The largest gaps are:

1. Monolithic routes file  
2. Missing `config/` and unified `bootstrap/`  
3. No path aliases  
4. Bridges mixed into `services/api/`  
5. Quotation ownership split across `modules/crm`, `components/crm`, `salesStore`  
6. Duplicate design-system locations  
7. Legacy root-level `data/*.ts` files  

**Recommended approach:** Incremental domain migration per Phase 18 order; no big-bang rewrite.
