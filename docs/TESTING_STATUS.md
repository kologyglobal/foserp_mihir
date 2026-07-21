# Purchase backend lifecycle verification (2026-07-21)

- `cd backend && npm run typecheck` — **PASS**.
- `cd backend && npx vitest run tests/purchase-invoice-lifecycle.test.ts` — **4/4 PASS** (create/code series, direct-invoice policy, PO/GRN requirements, tolerance override).
- Purchase RBAC regression — **4/4 PASS**.
- Broader combined purchase run — **11/12 PASS**; one existing planning create-PO concurrency test returned `[400, 400]` instead of one `201` and is outside the new invoice/QI/return modules.

## Purchase create/edit footer verification (2026-07-21)

- `npm run test:purchase-form-footers` — **80/80 PASS** (registered editor footer, API wiring, redirect, duplicate-save, unsaved-confirmation, mobile layout, and detail lifecycle contracts).
- `npm run typecheck` — **PASS**.
- `npm run build` — **PASS** (existing Tailwind/chunk warnings only).
- Targeted changed-file `oxlint` — **PASS** with four pre-existing hook dependency warnings.
- Full `npm run lint` — **BLOCKED** by the existing syntax error in `scripts/generate-uat-deliverables.ts`.
- `npm run test:purchase:production` — **39/39 PASS** (runner uses `tsconfig.app.json` for path aliases).

See [`PURCHASE_FORM_FOOTER_AUDIT.md`](PURCHASE_FORM_FOOTER_AUDIT.md).

---

## Purchase create/edit footer standard — 2026-07-21

- `cd frontend && npm run test:purchase-form-footers` — **80/80 PASS**
  - Registered PR/RFQ/VQ/PO/GRN/Return/Invoice editors use shared Cancel | Save actions.
  - Stable route-map redirects, unsaved confirmation, backend API wiring, lifecycle action placement, mobile widths, and duplicate-click single-flight behavior covered.
- `cd frontend && npm run build` — **PASS**
- `cd frontend && npm run test:purchase:production` — **39/39 PASS** (script now uses `tsconfig.app.json` for path aliases).
- Targeted `oxlint` on changed files — **PASS** with four pre-existing hook dependency warnings.
- Full `npm run lint` — non-zero on the existing repository-wide warning baseline; no changed-file lint errors.

---

# Testing Status

### 2026-07-21 — Self-approval policy (maker-checker override)

| Check | Result |
|-------|--------|
| `purchase-approval-flow.test.ts` | **7/7 PASS** — new: PERMISSION_ONLY default allows holder of `purchase.approvals.self_approve` (queue `canAct` + approve + `selfApproved` audit flag); NEVER blocks everyone; EVERYONE allows without permission; legacy maker-checker/delegation/send-back still pass |
| `purchase-approvals.test.ts` | **11/11 PASS** — requester provisioned without the bypass permission; self-approval block re-verified |
| Migration `20260721110000_self_approval_policy` | **Applied** |
| `sync-permissions.ts` | **PASS** (238 perms incl. `purchase.approvals.self_approve`) |
| Backend `tsc --noEmit` | **PASS** |
| Frontend `npm run typecheck` | **PASS** |

---

### 2026-07-21 — Purchase Setup full persistence

| Check | Result |
|-------|--------|
| `purchase-setup.test.ts` | **15/15 PASS** — nested DTO round-trip, approval bands, number series prefix/pad, notifications ON_HOLD, version 409, FK/RBAC/tenant isolation, audit |
| `purchase-invoice-lifecycle.test.ts` | **4/4 PASS** — matching / direct-invoice setup enforcement |
| Backend `tsc --noEmit` | **PASS** |
| Frontend `tsc -p tsconfig.app.json` | **PASS** |
| Migrations `20260721120000_purchase_setup_full_persistence` + `20260721130000_purchase_status_history_docs` | **Applied** |

### 2026-07-21 — Purchase Setup Phase 1A

| Check | Result |
|-------|--------|
| `purchase-setup.test.ts` | Superseded by full persistence suite (was 13/13 on Phase 1A flat DTO) |
| `purchase-order-lifecycle.test.ts` | **PASS** — includes deliveryWarehouseId resolution, `requirePoWarehouse`, retain warehouse after setup change |
| `goods-receipt-lifecycle.test.ts` | **15/15 PASS** — Setup over-receipt tolerance (client `allowExcess` ignored), challan/vehicle/gate requirements |
| Backend `tsc --noEmit` | **PASS** |
| Frontend `npm run typecheck` | **PASS** |
| `prisma validate` + migrate `20260721090000_purchase_setup_phase1` | **Applied** |
| `sync-permissions.ts` | **PASS** (237 perms incl. `purchase.setup.view`) |

---

### 2026-07-21 — Purchase Planning Sheet E2E audit

| Check | Result |
|-------|--------|
| `purchase-planning-workflow.test.ts` | **6/6 PASS** — net qty, transitions, Action Message + PO-ready codes |
| `purchase-planning-sheet.test.ts` | **5/5 PASS** — approve→PPS sync, edit/bulk, create-po grouping, RFQ-required never syncs |
| FE Create PO eligibility | Aligns with backend: Action Message + vendor_selected/approved/po_pending + vendor/qty/rate/date |
| Who can Create PO | `purchase.planning.create_po` (Purchase Manager / Purchase Executive); Requester & Dept Manager cannot |
| Frontend `/purchase/planning-sheet` HTTP | **200** |

---

Last run: **2026-07-21** (Purchase Planning Sheet E2E + approvals).

### 2026-07-21 — Purchase approvals

| Check | Result |
|-------|--------|
| `purchase-approvals.test.ts` | **11/11 PASS** — PR+PO queue/review/actions/RBAC/tenant/empty state |
| `purchase-approval-flow.test.ts` | **4/4 PASS** — maker-checker, actor inbox, real-user delegation/assignment, PR send-back |
| PR + PO + approval combined regression | **26/26 PASS** |
| Frontend `test:purchase-approvals-api` | **PASS — 9 assertions** |
| Backend typecheck | **PASS** |
| Frontend app typecheck (`tsconfig.app.json`) | **PASS** |
| Running API smoke | **PASS** — pending + history queue |
| `/purchase/approvals` HTTP smoke | **200** |

### 2026-07-20 — Purchase typecheck + coverage gaps

| Check | Result |
|-------|--------|
| Frontend `npm run typecheck` | **PASS** |
| Frontend `npm run test:purchase-phase15-all` | **PASS** |
| Backend `tsc --noEmit` | **PASS** |
| Backend `npm run test:purchase-phase15` | **29/29** |
| Backend `purchase-phase15-integration.test.ts` | **9/9** |
| Backend `purchase-module-coverage.test.ts` | **4/4** (cross-tenant, double-approve, RFQ→PO, concurrent conflict) |
| Local migrate deploy `20260720160000_rfq_flow_award_fields` | **Applied** |

### 2026-07-20 — Purchase Phase 16 final QA

| Check | Result |
|-------|--------|
| Report | [`docs/purchase/PHASE_16_FINAL_QA_REPORT.md`](purchase/PHASE_16_FINAL_QA_REPORT.md) |
| Prisma validate | **PASS** |
| Backend `tsc --noEmit` | **PASS** |
| Backend `npm run test:purchase-phase15` | **29/29** |
| Backend live `purchase-phase15-integration.test.ts` | **9/9** |
| Frontend `npm run test:purchase-phase15-all` | **PASS** (20 + E2E A/B) |
| Frontend `npm run typecheck` | Was **FAIL** — **fixed** same day (see entry above) |
| Full CRM/Sales/Inventory suite | **Not re-run** (modules present) |

### 2026-07-20 — Purchase Phase 15 automated tests

| Check | Result |
|-------|--------|
| Backend `npm run test:purchase-phase15` | **29/29** |
| Backend `npx vitest run tests/purchase-phase15-integration.test.ts` | **9/9** (live MySQL) |
| Backend `tsc --noEmit` | **PASS** |
| Prisma validate | **PASS** |
| Frontend `npm run test:purchase-phase15-all` | **PASS** (20 FE checks + E2E A + E2E B) |
| Create PO from Planning | `POST /purchase/planning-sheet/create-po` |

### 2026-07-20 — Purchase Phase 14 validation and error messages

| Check | Result |
|-------|--------|
| `npx vitest run tests/purchase-requisition-workflow.test.ts tests/purchase-planning-workflow.test.ts tests/purchase-error-catalog.test.ts` | **Pass** (8+6+2) |
| Backend `tsc --noEmit` | **PASS** |
| Stable codes | `PR_*` / `PPS_*` / `PO_*` catalog + FE `purchaseErrorMessages` |
| Error middleware | Prisma/FK/SQL sanitized; technical detail logged only |
| Live MySQL lifecycle | Expectations updated (`PR_NOT_EDITABLE`, `PR_NO_LINES`, …); re-run when DB available |

### 2026-07-20 — Purchase Phase 13 audit logs and timeline

| Check | Result |
|-------|--------|
| `npx vitest run tests/purchase-audit-timeline.test.ts` | **2/2** |
| Backend `tsc --noEmit` | Pass (after audit helper + service wiring) |
| Timeline API | `GET /purchase/timeline/:entityType/:entityId` |
| FE views | PR / Planning drawer / RFQ / PO show `PurchaseAuditTimeline` |

### 2026-07-20 — Purchase RBAC

| Check | Result |
|-------|--------|
| `npx vitest run tests/purchase-rbac-permissions.test.ts` | **4/4** |
| Canonical keys on purchase routes | Wired (`purchase.pr.*` / `planning.*` / `rfq.*` / `po.*`) |
| Permission-denied audit | `requirePermission` → `PERMISSION_DENIED` audit log |

### 2026-07-20 — Purchase RFQ workflow + FE dual-mode bridge

| Check | Result |
|-------|--------|
| `npx vitest run tests/purchase-rfq-workflow.test.ts` | **2/2** |
| FE RFQ/VQ/comparison facade + mappers | Wired (`VITE_USE_API=true`); demo path unchanged |
| Live RFQ/VQ/comparison MySQL suite | **Pending** |

### 2026-07-20 — Purchase Planning Sheet backend

| Suite / check | Result |
|---------------|--------|
| `npx vitest run tests/purchase-planning-workflow.test.ts` | **5/5** |
| `npx vitest run tests/purchase-planning-sheet.test.ts --hookTimeout=120000` | **4/4** (live MySQL) |
| `npx tsc --noEmit` (backend) | **PASS** |

### 2026-07-20 — Purchase Requisition backend

| Suite / check | Result |
|---------------|--------|
| `npx vitest run tests/purchase-requisition-workflow.test.ts` | **8/8** |
| `npx vitest run tests/purchase-requisition-lifecycle.test.ts --hookTimeout=120000` | **5/5** (live MySQL) |
| `npx tsc --noEmit` (backend) | **PASS** |
| `npx tsx scripts/prisma-cli.ts migrate deploy` | **PASS** (`20260720130000_add_purchase_code_series_entities`) |

### 2026-07-18 — Finance Phase 3B3: Customer receipt draft workflow

| Suite / check | Result |
|---------------|--------|
| `npx vitest run tests/finance/finance-ar-receipt-drafts.test.ts` (new) | **12/12** |
| `npx vitest run tests/finance --hookTimeout=120000` (full finance suite) | **206/206** (16 files) |
| `npx tsc --noEmit` (backend) | **PASS** |
| `npm run typecheck` (frontend) | **FAIL** — pre-existing, unrelated (`PurchaseApprovalsPage.tsx` TS2304, `PurchaseSetupPage.tsx` TS17001); no frontend files touched this phase |
| Fix applied during verification | Circular ES module import between `customer-receipt.schemas.ts` and `calculation/customer-receipt-calculation.schemas.ts` was causing an intermittent `ZodObject._parse` crash (HTTP 500) on every receipt-create call — resolved by moving `customerReceiptPaymentMethodSchema` into the calculation schema file |

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
