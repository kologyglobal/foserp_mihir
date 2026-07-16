# Testing Status

Last run: **2026-07-15** (Purchase module frontend quality review + E2E smoke).

### 2026-07-15 — Purchase frontend quality review

| Suite / check | Result |
|---------------|--------|
| `npx tsx scripts/smoke-purchase-e2e-flow.ts` | **PASS** — full PR→…→Return→report |
| `npm run test:purchase:production` | **39/39** |
| `npx tsx scripts/smoke-purchase-orders.ts` | **PASS** |
| `npx tsx scripts/smoke-purchase-return.ts` | **PASS** |
| `npx oxlint src/modules/purchase` | **PASS** (0 errors; warnings only) |
| `npm run lint` (repo) | **FAIL** — pre-existing hooks errors in `CrmMasterPages`, `BomPages` (not purchase) |
| `npm run typecheck` | **FAIL** — pre-existing non-purchase (`bomStore`, CRM bridge/seed, etc.); **no purchase module errors** in last filtered pass |
| `npm run build` | See session entry below / build-out |
| Browser UAT | **Not run** — service + route evidence only |

### 2026-07-15 — Convert Quotation → Sales Order

| Suite / check | Result |
|---------------|--------|
| `npm run typecheck` (backend) | **PASS** |
| `npx tsc --noEmit` (frontend, convert-related) | **PASS** (no errors in changed convert files) |
| `npm run test:crm-live` | **50/50** (e2e 43 + tenant isolation 7) |
| Coverage added | Convert success asserts Won + open SO; duplicate → **409**; lost opportunity → 422 |

### 2026-07-14 — Edit Opportunity header actions

| Suite / check | Result |
|---------------|--------|
| `npm run test:uat-03-opportunities` | **86/86** (78 automated + 8 live) |
| `npm run test:crm-opportunity-item-lines` | 29/31 (2 pre-existing failures: 360 items tab label, New page "Save & Create Quotation" copy) |
| `npm run test:crm-opportunity-full-page` | 15/20 (pre-existing New/360 string assertions) |
| FE typecheck (changed files) | OpportunityEdit / useOpportunityEditor clean |

### 2026-07-14 — Phase 1 Sales Order API

| Suite / check | Result |
|---------------|--------|
| `npm run typecheck` (backend) | **PASS** |
| `npm run test:crm-live` | **49/49** (e2e 42 + tenant isolation 7) |
| New cases | Direct SO create→patch→confirm→close; draft soft-delete |

### 2026-07-14 — Dashboard quotation approval panel (P1 closed)

| Suite / check | Result |
|---------------|--------|
| `npm run typecheck` (backend) | **PASS** |
| `npx tsc --noEmit` (frontend) | **PASS** |
| `npm run test:crm-live` | **47/47** (e2e 40 + tenant isolation 7) |
| New case | `dashboard metrics include pending quotation approval panel from DB` |
| Payload | `GET /crm/dashboard/metrics` → `panels.pendingApprovalCount` + `panels.pendingApprovalQuotations` |
| FE | API mode: `applyApiDashboardPanelOverlay`; demo keeps store derivation |

### 2026-07-14 — Quotation templates + CRM search live E2E (P2 closed)

| Suite / check | Result |
|---------------|--------|
| `npm run test:crm-live` | **46/46** (e2e 39 + tenant isolation 7; superseded by 47/47 above) |
| New cases | `creates, lists, gets, updates, duplicates, and soft-deletes quotation template`; `searches CRM companies, contacts, leads, and opportunities` |
| Template endpoints | `POST/GET/PATCH/DELETE …/quotation-templates`, `POST …/:id/duplicate` |
| Search endpoints | `GET …/crm/search?q=` (missing/empty `q` → 400) |

APIs already existed; gap was live coverage only.

### 2026-07-14 — Sales forecast API (P2 closed)

| Suite / check | Result |
|---------------|--------|
| `npm run typecheck` (backend) | **PASS** |
| `tests/crm-forecast.test.ts` | **2/2** — weighted = Σ(amount × probability/100) + bucket/at-risk |
| `npm test` (no live) | **39 passed / 49 skipped** |
| `npm run test:crm-live` | **47/47** (e2e 40 + tenant isolation 7) — includes forecast GET + tenant-scoped assert |

API: `GET /t/:tenantSlug/crm/forecast`. FE API mode: `useCrmSalesForecast` (no mix with demo rollup).

### 2026-07-14 — Entity notes live E2E (P1 closed)

| Suite / check | Result |
|---------------|--------|
| `npm run test:crm-live` | **42/42** (e2e 36 + tenant isolation 6; superseded by 46/46 above) |
| New case | `creates, lists, updates, and soft-deletes entity notes on LEAD` |
| Endpoints | `POST/GET …/entities/LEAD/:id/notes`, `PATCH/DELETE …/entities/notes/:noteId` |

Notes API already existed (FE `useEntityNotes`); gap was live coverage only. Attachments remain covered separately.

### 2026-07-14 — CRM FE ↔ API ↔ DB verification

Full page-/function-wise report: [`docs/CRM_FE_API_DB_VERIFICATION_REPORT.md`](CRM_FE_API_DB_VERIFICATION_REPORT.md).

| Suite / check | Result |
|---------------|--------|
| Stack | MySQL :3306 up; backend :5000 health 200 (`database: connected`); FE :5173 with `VITE_USE_API=true` |
| `npm run typecheck` (backend) | **PASS** |
| `npm test` (no live) | **37 passed / 44 skipped** |
| `npm run test:crm-live` | **47/47** (e2e 40 + tenant isolation 7) |
| HTTP probes | login + dashboard/leads/opportunities/quotations + `/crm/masters/sync` + `/masters/locations` → **200** |
| Browser smoke | Login → `/crm`, `/crm/leads`, `/crm/opportunities` in API mode |

Verdict: CRM commercial funnel **Working**; remaining gaps = mobile CRM live coverage, deferred transactional ERP. Forecast / templates / search / notes / dashboard approval live gaps closed.

### 2026-07-14 — CRM/master API sync

| Suite | Result |
|-------|--------|
| `npm run typecheck` | **PASS** (seed rows moved under `src/modules/crm/masters/crm-master.seed-data.ts`) |
| `tests/crm-validation.test.ts` | **10/10** — optionalUuid, quotation `locationId: ""`, attachment `documentType`, opportunity-stages seed |
| `tests/lead-workflow.test.ts` | **4/4** |
| `npm test` (no live) | **37 passed / 43 skipped** (crm-e2e + tenant isolation skipped) |
| `npm run db:seed` | **PASS** — 8 warehouses, 8 locations |
| `npm run test:crm-live` | **42/42** — prior coverage + entity notes create/list/PATCH/soft-delete on LEAD |

### 2026-07-14 — Lead convert gate

| Suite | Result |
|-------|--------|
| `backend/tests/lead-workflow.test.ts` | **4/4 passed** — `assertLeadConvertible` requires qualified |

## Commands reference

### Backend (`backend/`)

| Command | Description |
|---------|-------------|
| `npm run typecheck` | TypeScript compile check |
| `npm test` | Vitest — unit/integration (live CRM tests **skipped**) |
| `npm run test:crm-live` | Sets `RUN_CRM_E2E=true`; runs CRM E2E + tenant isolation |
| `npm run test:watch` | Vitest watch mode |
| `npm run db:setup` | generate + migrate deploy + seed |
| `npx tsx scripts/prisma-cli.ts migrate deploy` | Apply migrations (CI-safe) |
| `npm run db:seed` | Seed only |

### Frontend (`trailer-erp/`)

| Command | Description |
|---------|-------------|
| `npm run typecheck` | `tsc -b --noEmit` |
| `npm run build` | Production build |
| `npm run test:route-integrity` | Route path baseline gate (`--write-baseline` after alias changes) |
| `npm run test:crm-integration` | Demo-mode CRM ↔ ERP integration (18 cases) |
| `npm run test:crm` | masters + integration + eeata fix |
| `npm run test:regression` | Large demo regression bundle |
| `npm run test:crm-live` | ❌ Not defined on frontend — use backend script |

## Last verified results (2026-07-13) — Master consolidation

### Frontend typecheck

```
npx tsc --noEmit → EXIT 0
```

### Route integrity

```
npm run test:route-integrity -- --write-baseline → 443 paths
npm run test:route-integrity → PASSED
```

---

## Last verified results (2026-07-11)

### Backend typecheck

```
npm run typecheck → EXIT 0
```

### Frontend typecheck

```
npm run typecheck → EXIT 0
```

### Backend `npm test` (Vitest, RUN_CRM_E2E not set) — re-run 2026-07-11

| Metric | Count |
|--------|-------|
| Test files passed | 5 |
| Test files skipped (live-only) | 2 |
| Tests passed | **23** |
| Tests skipped | **29** |
| Tests failed | **0** |
| Duration | ~6.8s |

Skipped files (require `RUN_CRM_E2E=true`):

- `tests/crm-e2e.test.ts` — 21 tests skipped
- `tests/crm-tenant-isolation.test.ts` — 6 tests skipped (also 2 auth tests skipped in integration.test.ts when DB unavailable)

**Important:** Skipped live tests are **not** counted as passed.

### Backend `npm run test:crm-live` (MySQL required) — re-run 2026-07-11

| Metric | Count |
|--------|-------|
| Test files passed | 2 |
| Tests passed | **27** |
| Tests failed | **0** |
| Duration | ~4.3s |

Breakdown:

- `crm-e2e.test.ts` — **21 passed** (company/contact/lead/activity/opportunity full lifecycle)
- `crm-tenant-isolation.test.ts` — **6 passed**

### Frontend `npm run test:crm-integration` (demo mode) — re-run 2026-07-11

| Metric | Count |
|--------|-------|
| Tests passed | **18** |
| Tests failed | **0** |

Note: Runs against Zustand stores, not live API.

## Test file inventory (backend)

| File | Live DB | Purpose |
|------|---------|---------|
| `integration.test.ts` | Optional | Health + auth reject + tenant isolation setup |
| `crm-e2e.test.ts` | **Required** (`RUN_CRM_E2E=true`) | CRM CRUD lifecycle |
| `crm-tenant-isolation.test.ts` | **Required** | Cross-tenant access denied |
| `masters.test.ts` | Required | Geography/UOM CRUD |
| `master-batch.test.ts` | Required | Item/vendor/GST batch |
| `master-import.test.ts` | Required | Import pipelines |
| `master-tenant-isolation.test.ts` | Required | Master tenant isolation |

## Not verified live (pending)

| Area | Reason |
|------|--------|
| Attachments download E2E | Upload/list covered live; download path not separately asserted |
| Quotation export API E2E | Tables exist; no live test case; export returns empty until quotation CRUD writes data |
| Dashboard chart series API | Wired in code; manual `/crm` visual check not automated |
| Master import on CI | Requires MySQL |
| Frontend tests in API mode | Most scripts assume demo stores |
| Full `npm run test:regression` | Not run this session (long demo suite) |

## How to run live CRM tests

```bash
cd backend
# Ensure .env has DATABASE_URL or DB_* pointing to seeded database
npm run db:setup   # if fresh
npm run test:crm-live
```

Prerequisites: MySQL 8+, migrations applied, seed data present.

## CI recommendation

1. Job A: `typecheck` both packages (no DB).
2. Job B: `npm test` backend (expect 29 skipped).
3. Job C: MySQL service → `npm run test:crm-live` (must pass 27/27).
4. Job D: frontend `npm run test:crm-integration` (demo, 18/18).

## Historical note

Prior session reported CRM live E2E **27/27** — **re-verified 2026-07-11** with same result.
