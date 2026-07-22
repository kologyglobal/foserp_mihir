# Production Module — Phase 0 Discovery

> **Status:** Architecture complete. **Phase 1 masters shipped 2026-07-20** (see `docs/manufacturing/PRODUCTION_PHASE1_README.md`). Production Orders / execution not started.  
> **Verified:** 2026-07-20 against repository code (not chat summaries).  
> **Scope:** Discrete manufacturing Production Module for FOS ERP. Trailer (45 M³) is the first reference template only — architecture must remain generic.

---

## 1. Executive summary

FOS ERP today has a **rich manufacturing demo frontend** under `/manufacturing/*` and a permission catalog for `production.*` / `manufacturing.*`, but **no production Prisma models, no manufacturing backend module, and no real production APIs**.

| Layer | Status |
|-------|--------|
| Demo UI (`/manufacturing/*`) | Existing UI preview — interactive, in-memory |
| Legacy parallel UI (`/work-orders`, `/masters/bom`, `/shop-floor`) | Mock or demo — duplicated surfaces |
| Backend routes / services / repositories | Missing |
| Prisma production tables | Missing |
| Permissions catalog | Seeded strings only — not enforced on resources |
| Live API / tenant isolation tests | Missing |
| Transactional Purchase / Inventory / Quality backends | Deferred by design |
| CRM Sales Order Phase 1 | Full stack (confirm/close) — no SO→Production |

**Phase 0 classification:** Architecture ready (discovery complete). Implementation not yet started.

**Canonical route decision:** Keep **`/manufacturing/*`** as the production shell. Retain legacy redirects from `/production/*` hubs. Do not rename existing routes in Phase 0–1.

**Product principle carried forward:** Keep complexity inside the system; show each user only the next required action. Prefer WO-centric simple UX (`docs/MANUFACTURING_SIMPLE.md`) extended with a generic Manufacturing Profile engine — not trailer-specific hardcoding.

---

## 2. Project foundation (evidence)

| Concern | Path | Notes |
|---------|------|-------|
| Root package | `package.json` | `fos-erp`; `dev:frontend` / `dev:backend` |
| Frontend package | `frontend/package.json` | Canonical SPA (`trailer-erp`); Vite + tsx demo scripts |
| Legacy frontend | `trailer-erp/` | Parallel tree — do not extend for Production |
| Backend package | `backend/package.json` | Express 5, Prisma 6, Vitest |
| TS configs | `frontend/tsconfig*.json`, `backend/tsconfig.json` | |
| Vite | `frontend/vite.config.ts` | Port 5173; `/api` → `:5000` |
| React Router | `frontend/src/routes/index.tsx` | Composes domain route trees |
| Express bootstrap | `backend/src/app.ts`, `backend/src/server.ts` | `createApp()` / `main()` |
| Prisma schema | `backend/prisma/schema.prisma` | MySQL; UUID; soft delete; tenantId |
| MySQL env | `backend/src/config/env.ts`, `database.ts` | `DB_*` or `DATABASE_URL` via `prisma-cli.ts` |
| Auth middleware | `backend/src/middleware/auth.middleware.ts` | JWT Bearer |
| Tenant middleware | `backend/src/middleware/tenant.middleware.ts` | `resolveTenant`, `requireTenantAccess` |
| Permission middleware | `backend/src/middleware/permission.middleware.ts` | `requirePermission` |
| API responses | `backend/src/utils/response.ts` | `sendSuccess` / `sendError` / `sendPaginated` |
| Errors | `backend/src/utils/errors.ts`, `error.middleware.ts` | `AppError` hierarchy |
| Validation | `validation.middleware.ts` + Zod schemas | |
| Transactions | `prisma.$transaction` pattern (journals, AR/AP posting) | |
| Idempotency | `posting-idempotency.service.ts`, `Idempotency-Key` headers | Finance pattern to reuse |
| Number series | `codeSeries.service.ts`, `FinanceNumberSeries` | Extend; do not fork |
| Attachments | `CrmAttachment` + entity routes | Extend entity types |
| Audit | `audit.service.ts`, CRM activities/notes | |
| Approvals | `modules/accounting/approvals/*`, `FinanceApprovalRule` | Prefer extend, not fourth engine |
| Swagger | `backend/src/config/swagger.ts` → `/api/docs` (dev) | |
| Tests | Backend Vitest; FE `tsx scripts/test-*.ts` | |
| Seed | `backend/prisma/seed.ts` | |
| Migrations | `backend/prisma/migrations/` via `tsx scripts/prisma-cli.ts migrate deploy` | |

---

## 3. Existing implementation inventory

### 3.1 Capability matrix

| Capability | Frontend | API | Database | Permissions | Tests | Real status | Evidence |
|---|---|---|---|---|---|---|---|
| BOM | Demo `/manufacturing/bom` + `/masters/bom` | ❌ | ❌ | Catalog only | Demo smoke | Mock or demo | `manufacturingRoutes.tsx`, `manufacturingService.ts`, `bomStore.ts` |
| Routing | Demo `/manufacturing/routes` + `/masters/routing` | ❌ | ❌ | Catalog | Demo | Mock or demo | `routeService.ts`, `routingStore.ts` |
| Work Centre | Demo `/masters/work-centers` | ❌ | ❌ | Catalog | Demo | Mock or demo | `WorkCenterPages.tsx`, `workCenterStore.ts` |
| Machine | Shopfloor view tab only | ❌ | ❌ | — | — | Missing (as entity) | Folded into WC / settings |
| Production Order | Accounting demo label | ❌ | ❌ | — | — | Missing / demo label | Execution center = Work Order |
| Work Order | Demo `/manufacturing/work-orders` + legacy `/work-orders/:id` | ❌ | ❌ | Catalog | Demo scripts | Mock or demo | `workOrderService.ts`, `workOrderStore.ts` |
| Shopfloor | `/manufacturing/shopfloor` + `/shop-floor` | ❌ | ❌ | Catalog | Demo | Mock or demo | `ShopfloorViewPage.tsx` |
| Daily Production | Shopfloor Daily Summary + report card | ❌ | ❌ | Catalog | Demo | Mock or demo | `ShopfloorViewPage.tsx` |
| Material Requirement | WO-embedded check | ❌ | ❌ | Catalog | Demo | Mock or demo | `checkWorkOrderMaterialAvailability` |
| Material Issue | WO action + `/inventory/issue` | ❌ | ❌ | Catalog | Demo | Mock or demo | `workOrderService.ts`, inventory store |
| Material Return | WO-embedded | ❌ | ❌ | Catalog | Demo | Mock or demo | `returnUnusedMaterialDemo` |
| WIP Transfer | Legacy scan `/production/scan/wip-move` | ❌ | ❌ | Catalog | Demo | Mock or demo | `productionRoutes.tsx` |
| Finished Goods Receipt | WO complete + legacy FG | ❌ | ❌ | Catalog | Demo | Mock or demo | `completeProductionQuantityDemo` |
| Quality Hold | WO + quality store | ❌ | ❌ | Catalog | Demo | Mock or demo | `qualityEngine.ts` |
| Rework / Scrap | WO-embedded | ❌ | ❌ | Catalog | Demo | Mock or demo | `workOrderService.ts` |
| Subcontracting | `/manufacturing/job-work` | ❌ | ❌ | Catalog | Demo | Mock or demo | `jobWorkService.ts` |
| Production Reports | `/manufacturing/reports` | ❌ | ❌ | Catalog | Demo | Mock or demo | `ManufacturingReportsPage.tsx` |
| Production Costing | WO preview + `/accounting/manufacturing/*` | ❌ | ❌ | FE-only keys | Demo | Mock or demo | `manufacturingAccountingService.ts` |
| Production Plan | `/manufacturing/production-plan` | ❌ | ❌ | Catalog | Demo | Mock or demo | `ProductionPlanPage.tsx` |

### 3.2 Prisma production models

**None.** Closest fields on `MasterItem`:

- `productionBomId` (`String?`) — soft string, no FK
- `routingNo` (`String?`) — soft string, no FK  
Evidence: `backend/prisma/schema.prisma` ~1421–1422.

### 3.3 Backend modules

No `backend/src/modules/production*` or `manufacturing*` transaction modules. Permission strings exist in `backend/src/constants/permissions.ts` ~401–430.

---

## 4. Route decision

| Decision | Detail |
|----------|--------|
| **Canonical shell** | `/manufacturing/*` |
| **Nav title** | Manufacturing (nav id `production`) — `frontend/src/config/navigation.ts` |
| **Hub redirects** | `/production`, `/production/control-tower` → `/manufacturing/control-room` |
| **WO list redirect** | `/work-orders` → `/manufacturing/work-orders` |
| **Job work redirect** | `/job-work` → `/manufacturing/job-work` |
| **Retain (do not delete)** | Legacy detail/scan routes under `/work-orders/:id`, `/production/scan/*`, `/shop-floor` until a later fold-in phase |
| **API prefix (future)** | `/api/v1/t/:tenantSlug/manufacturing/…` (align with FE shell; map permissions under `manufacturing.*` with `production.*` aliases where needed) |

**Do not** introduce a second primary nav under `/production/*` for the new backend.

---

## 5. Reusable assets

| Asset | Reuse how |
|-------|-----------|
| Manufacturing demo UX / WO-centric flows | Prototype for Phase 2–5 UX; not data layer |
| `MANUFACTURING_SIMPLE.md` principles | Carry into UX architecture |
| Master Item / UOM / Warehouse / Location / Vendor APIs | FK targets |
| CrmCompany + CrmSalesOrder Phase 1 | Demand source |
| CostCentre (finance) | Cost dimension reference |
| CodeSeries / FinanceNumberSeries patterns | Document numbering |
| PostingEvent + idempotency pattern | Future manufacturing accounting events |
| `FinanceFeatureKey.MANUFACTURING_ACCOUNTING` | Feature flag (default off) |
| CRM entity attachments pattern | Extend for WO / BOM docs |
| Permission middleware + catalog | Extend `manufacturing.*` enforcement |
| Thin controller / service / repository layout | Match accounting/CRM modules |

---

## 6. Gaps (blocking full Production)

1. No production / BOM / routing / WO Prisma models  
2. No inventory stock ledger backend (physical SoT missing)  
3. No purchase requisition backend (shortage → PR)  
4. No quality inspection backend  
5. No SO line normalisation / remaining-to-produce fields  
6. Duplicate FE BOM/routing/WO stacks (manufacturing vs masters vs legacy)  
7. Plant / Shift / Employee / Project masters missing or soft-string only  
8. UOM conversion master missing  
9. Manufacturing accounting posting deferred (events only until flagged)

---

## 7. Recommended architecture (summary)

```text
Manufacturing Profile (generic process template)
├── BOM versions + lines
├── Routing versions + stage groups + operations + dependencies
├── Quality plan references
├── Material / WIP / output rules
└── Execution mode (Simple | Detailed)

Production Order (= Work Order in current UX language)
├── Source demand (SO line / manual / stock replenishment / project)
├── BOM + routing snapshots
├── Material requirements + shortage links
├── Stage / operation execution
├── Stage quantity ledger (logical WIP)
├── WIP movements (intent) → Inventory posts physical stock
├── Quality links
├── Runtime changes / issues / downtime
├── Documents + activity timeline
└── Accounting events (feature-flagged, no post until mfg accounting)
```

**Terminology:** UI continues to say **Work Order** (operators). Backend model name **ProductionOrder** is acceptable if API DTOs expose `workOrderNo` aliases for UX continuity — decide in Phase 1 ADR acceptance.

Detail: see `PRODUCTION_DATABASE_DESIGN.md`, `PRODUCTION_API_PLAN.md`, `PRODUCTION_UX_ARCHITECTURE.md`, `PRODUCTION_CROSS_MODULE_DEPENDENCIES.md`, `PRODUCTION_PHASE_PLAN.md`.

---

## 8. Commands run (Phase 0)

| Command | Result |
|---------|--------|
| `backend npm run typecheck` | Pass (exit 0) |
| `npx tsx scripts/prisma-cli.ts validate` | Pass — schema valid |
| `npx tsx scripts/prisma-cli.ts migrate status` | Pass — 41 migrations, DB up to date |
| `frontend npm run typecheck` | Fail — 3 pre-existing errors in `treasuryApi.ts` (unrelated to Production) |
| `frontend npm run test:manufacturing-module` | Partial — route checks pass; then fails on `@/types` path resolution when loading insights |
| `frontend npm run test:route-integrity` | Fail — baseline stale (717 → 809 paths; finance routes added) |

No migrations applied. No schema changes. No Production implementation.
