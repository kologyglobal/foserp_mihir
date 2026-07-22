# Phase 8A — Baseline Results

> Recorded **2026-07-21** (local Windows). No DB reset, no force migrate, no feature work. Exit codes are authoritative.

**Classification key:** `pre-existing` · `environment` · `audit-introduced` · `business defect` · `test-only`

---

## Summary table

| # | Location | Command | Exit | Result | Classification |
|---|----------|---------|------|--------|----------------|
| 1 | `backend/` | `npx prisma validate` | **1** | Fail — `DATABASE_URL` not in process env for raw prisma | **environment** (prefer prisma-cli) |
| 2 | `backend/` | `npx tsx scripts/prisma-cli.ts validate` | **1** | Fail — `BankConnectorConsent` type missing in schema | **business defect** / schema |
| 3 | `backend/` | `npx tsx scripts/prisma-cli.ts generate` | **0** | Pass — client generated to `node_modules/@prisma/client` | Pass |
| 4 | `backend/` | `npx tsx scripts/prisma-cli.ts migrate status` | **1** | Drift — 2 pending local; 3 DB-only migrations | **environment** + **pre-existing** history drift |
| 5 | `backend/` | `npm run typecheck` (`tsc --noEmit`) | **2** | Fail — 18+ TS errors (FA, treasury, quality, dispatch) | **pre-existing** |
| 6 | `frontend/` | `npm run typecheck` (`tsc -b --noEmit`) | **2** | Fail — liquidity, dispatch, quality/dispatch API clients, FA, tax perms | **pre-existing** |
| 7 | `frontend/` | `npm run build` (`tsc -b && vite build`) | **2** | Fail at `tsc -b` (same FE errors; vite not reached) | **pre-existing** |

**Audit-introduced failures:** none (read-only docs + commands).

**Note:** `npx tsc --noEmit` is covered by `npm run typecheck` on both packages; not re-run separately.

---

## 1. `npx prisma validate` (raw)

**Cwd:** `backend/`  
**Exit:** `1`

```text
Error: Prisma schema validation - (get-config wasm)
Error code: P1012
error: Environment variable not found: DATABASE_URL.
  -->  prisma\schema.prisma:10
```

**Classification:** **environment** — shell had no `DATABASE_URL`; `backend/.env` exists but raw `prisma` does not compose URL from `DB_*`. Project standard is `scripts/prisma-cli.ts`.

---

## 2. `npx tsx scripts/prisma-cli.ts validate`

**Cwd:** `backend/`  
**Exit:** `1`

```text
Error: Prisma schema validation - (validate wasm)
Error code: P1012
error: Type "BankConnectorConsent" is neither a built-in type, nor refers to another model, composite type, or enum.
  -->  prisma\schema.prisma:221
```

Tenant relation `bankConnectorConsents BankConnectorConsent[]` present; no `model BankConnectorConsent` found in schema. Migration folder `20260721120000_finance_phase5d3_bank_connector_consent` exists on disk.

**Classification:** **business defect** (schema incomplete / out of sync with in-progress 5D3 consent work). Not introduced by this audit.

---

## 3. `npx tsx scripts/prisma-cli.ts generate`

**Cwd:** `backend/`  
**Exit:** `0`

```text
✔ Generated Prisma Client (v6.19.3) to .\node_modules\@prisma\client in 9.66s
```

**Classification:** Pass. (Generate succeeded despite validate failure — treat validate as the schema gate for CI.)

Equivalent npm script: `npm run db:generate`.

---

## 4. `npx tsx scripts/prisma-cli.ts migrate status`

**Cwd:** `backend/`  
**Exit:** `1`

```text
Datasource "db": MySQL database "fos_erp" at "localhost:3306"
69 migrations found in prisma/migrations

The last common migration is: 20260721010000_finance_phase5d1_bank_connectors

The migrations have not yet been applied:
20260721010000_manufacturing_phase6a1_demand_consolidation
20260721020000_quality_phase7b

The migrations from the database are not found locally in prisma/migrations:
20260720160000_manufacturing_phase2b_daily_ops
20260720180000_purchase_phase3b_requisition
20260720180000_finance_ar_sales_invoice_reversal
```

**Classification:**

- **environment** — local DB history ≠ current checkout.
- **pre-existing** — renamed/replaced migration folders on disk vs applied names in `_prisma_migrations`.

**Do not** force-reset or rewrite history as part of Phase 8A START. Resolve later with intentional migrate/reconcile plan.

---

## 5. Backend `npm run typecheck`

**Cwd:** `backend/`  
**Command:** `tsc --noEmit`  
**Exit:** `2`

Representative errors (not exhaustive):

| Area | Sample |
|------|--------|
| Fixed assets | `FIXED_ASSET_DISPOSAL` not in `ApprovalDocumentType`; missing `postingEventId` / `reversalPostingEventId` on Prisma update input; missing `../fixed-assets.repository.js` |
| Bank connectors | `sftp-client.ts` — `sftp` namespace has no `default`; `bank-connector.enums.ts` — `Cannot find name 'z'` |
| Treasury liquidity | unused `subtract`; `JsonArray` cast to `ClosingControlItem[]` |
| Dispatch | `ParsedQs` cast errors in outbound controller |
| Quality | `samplingMethod` not on create type; possibly undefined totals; readonly `in` arrays vs Prisma filters |

**Classification:** **pre-existing** (uncommitted / in-progress module work on working tree). Not audit-introduced.

---

## 6. Frontend `npm run typecheck`

**Cwd:** `frontend/`  
**Command:** `tsc -b --noEmit`  
**Exit:** `2`

Representative errors:

| Area | Sample |
|------|--------|
| Bank & Cash | `ApiLiquidityDashboardPage` — missing `active` on workspace tab props |
| Dispatch | `ApiOutboundDispatchPages` — `CommandBarButton` missing `icon`; `DetailLayout` missing props; `dispatchApi.ts` wrong `fetch`/client signatures |
| Manufacturing | `ApiWorkOrderRegisterPage` — `status: string` vs WO status union |
| Fixed assets | `approvedAt: string \| null \| undefined` vs `string \| null` |
| Quality | `qualityApi.ts` — payloads typed as `BodyInit` (client helper misuse) |
| Tax | `finance.tax.view` / `finance.tax.extract` not in FE permission union |

**Classification:** **pre-existing**.

---

## 7. Frontend `npm run build` (optional)

**Cwd:** `frontend/`  
**Command:** `tsc -b && vite build`  
**Exit:** `2`

Failed in `tsc -b` with the same error set as typecheck; Vite bundling did not start.

**Classification:** **pre-existing** (blocked by typecheck).

---

## Tests — how to run (not executed for START)

Broad `npm test -- --passWithNoTests` intentionally skipped.

### Backend finance / manufacturing

```bash
cd backend
npx vitest run tests/finance
npx vitest run tests/manufacturing-phase2a.test.ts
npx vitest run tests/manufacturing-phase6b.test.ts
# Live CRM (MySQL required):
npm run test:crm-live
```

### Frontend manufacturing / finance smoke

```bash
cd frontend
npm run test:manufacturing-phase6b
npm run test:bank-connectors
npm run test:treasury-liquidity
npx tsx scripts/verify-fixed-assets.ts   # if present; no dedicated npm alias found
```

Classify future suite failures separately when Phase 8A continues.

---

## Environment notes

| Fact | Evidence |
|------|----------|
| `backend/.env` present | `Test-Path` true |
| Process `DATABASE_URL` unset | Shell check `no` |
| prisma-cli synthesizes URL | `scripts/prisma-cli.ts` `buildDatabaseUrl()` |
| MySQL reachable for migrate status | Connected `fos_erp@localhost:3306` |
| Prefer `frontend/` | Active SPA; `trailer-erp/` legacy parallel |

---

*End of baseline results (Phase 8A START).*
