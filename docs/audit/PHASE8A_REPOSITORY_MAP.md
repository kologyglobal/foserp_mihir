# Phase 8A — Repository Map

> Audit start snapshot. Evidence from repo tree and source files on **2026-07-21**. Prefer `frontend/` over legacy `trailer-erp/`. Code wins over older docs.

---

## 1. Monorepo layout

```text
trailer-erp 2/
├── frontend/                 # Active Vite SPA (prefer this)
├── trailer-erp/              # Legacy / parallel FE tree (older UAT scripts, src mirror)
├── backend/                  # Express API + Prisma
│   ├── src/
│   │   ├── app.ts            # Express app factory + route mounts
│   │   ├── server.ts         # Listen + DB connect
│   │   ├── middleware/       # auth, tenant, permission, validation, error
│   │   ├── constants/        # permissions.ts
│   │   └── modules/          # domain modules (see §5)
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/       # 69 migration folders (count at audit start)
│   │   └── seed.ts
│   └── scripts/              # prisma-cli.ts, live tests, integrity, deploy helpers
├── docs/                     # Project memory, module status, manufacturing/accounting docs
├── scripts/                  # Root deploy wrappers (deploy-prod.sh / .ps1)
├── database/                 # Ancillary DB assets
├── deploy/                   # Host packaging helpers
├── backups/                  # Local backups (not source)
├── release/                  # Release artifacts
├── docker-compose.yml
├── .env.production.example
└── .cursor/rules/            # Agent rules (fos-erp-project.mdc)
```

**Prefer:** `frontend/` for all SPA work. `trailer-erp/` remains for some historical UAT/scripts; do not treat it as the primary app.

---

## 2. Entry points

| Layer | Path | Role |
|-------|------|------|
| Backend process | `backend/src/server.ts` | `connectDatabase()` → `createApp()` → listen `env.PORT` |
| Backend app | `backend/src/app.ts` | Helmet/CORS/JSON, health, Swagger (dev), route mounts, optional SPA static |
| Frontend bootstrap | `frontend/src/main.tsx` | Root error boundary, ThemeProvider, AuthProvider, `App` |
| Frontend app | `frontend/src/App.tsx` | `bootstrapErpStartup()` then `RouterProvider` |
| Frontend router | `frontend/src/routes/index.tsx` | `createBrowserRouter` + module route children |

Health: `GET /api/v1/health` (DB ping). Dev docs: `/api/docs`.

---

## 3. Prisma schema & migrations

| Item | Path |
|------|------|
| Schema | `backend/prisma/schema.prisma` (MySQL, `url = env("DATABASE_URL")`) |
| Migrations | `backend/prisma/migrations/` |
| Seed | `backend/prisma/seed.ts` (`package.json` prisma.seed) |
| Prisma wrapper | `backend/scripts/prisma-cli.ts` — loads dotenv, builds `DATABASE_URL` from `DB_*` if missing, then `npx prisma …` |
| npm scripts | `db:generate`, `db:migrate`, `db:deploy`, `db:seed`, `db:setup` |

**CI deploy path (project rule):** `npx tsx scripts/prisma-cli.ts migrate deploy` (not interactive `db:migrate`).

**Audit note:** Tenant model references `BankConnectorConsent[]` (`schema.prisma` ~L222) but no `model BankConnectorConsent` was found in schema at audit start — see baseline results (validate fail). Migration folder `20260721120000_finance_phase5d3_bank_connector_consent` exists; several folders share timestamp prefix `20260721010000_*`.

---

## 4. Auth, tenant, permissions

| Concern | Path | Behaviour |
|---------|------|-----------|
| Auth routes | `backend/src/modules/auth/auth.routes.ts` | `/api/v1/auth/*` — login, refresh, logout, password flows, `me` |
| JWT middleware | `backend/src/middleware/auth.middleware.ts` | Bearer access token → `req.context` |
| Request context | `backend/src/middleware/permission.middleware.ts` | Loads user roles/permissions; `tenant.manage` ⇒ super-admin |
| Permission gate | `requirePermission` / `requireAnyPermission` in same file | Route-level RBAC |
| Tenant resolve | `backend/src/middleware/tenant.middleware.ts` | `:tenantId` or `:tenantSlug`; header `x-tenant-id`; mismatch errors |
| Permission catalog | `backend/src/constants/permissions.ts` | Canonical permission name strings |
| FE gate | `frontend/src/modules/auth/ApiAuthGate.tsx` (via routes) | Login only when API mode |

**Tenant URL shapes (both mounted in `app.ts`):**

- `/api/v1/tenants/:tenantId/…`
- `/api/v1/t/:tenantSlug/…` (preferred client shape)

Never trust `tenantId` from request bodies — route/JWT only.

---

## 5. Backend route registration

Central mounts in `backend/src/app.ts` (tenant-scoped):

| Domain | Module aggregator | Notes |
|--------|-------------------|-------|
| CRM | `modules/crm/crm.routes.ts` | companies, contacts, leads, opportunities, quotations, templates, SO, entities, exports… |
| Accounting | `modules/accounting/accounting.routes.ts` | LE/FY/periods, CoA, journals, AR/AP, treasury, tax, FA, approvals… |
| Manufacturing | `modules/manufacturing/manufacturing.routes.ts` | masters, demands, WO, today/control-room, job-work, plans, accounting… |
| Inventory | `modules/inventory/inventory.routes.ts` | balances, ledger, movements, reservations |
| Purchase | `modules/purchase/purchase.routes.ts` | requisitions only (RFQ/PO/GRN deferred) |
| Quality | `modules/quality/quality.routes.ts` | inspections, NCRs, parameters, plans, certificates, workspace |
| Dispatch | `modules/dispatch/dispatch.routes.ts` | `/outbound` fulfilment |
| Masters / items / vendors | `masters`, `items`, `vendors` | + imports/exports/lookups |
| Users / roles / tenants | `users`, `roles`, `tenants` | tenants also at `/api/v1/tenants` (super-admin) |

Also: `modules/auth` (unscoped), Swagger in development.

---

## 6. Frontend route registration

Aggregator: `frontend/src/routes/index.tsx`.

| File | Domain |
|------|--------|
| `crmRoutes.tsx` | CRM tree |
| `accountingRoutes.tsx` | Finance / accounting (+ legacy CoA/voucher redirects) |
| `manufacturingRoutes.tsx` | Manufacturing & Production shell |
| `productionRoutes.tsx` | **Legacy** `/production/*` + MRP children |
| `purchaseRoutes.tsx` | Purchase |
| `inventoryRoutes.tsx` | Inventory |
| `qualityRoutes.tsx` | Quality |
| `dispatchFinanceRoutes.tsx` | Dispatch + some finance shell links |
| `salesRoutes.tsx`, `quotationRoutes.tsx` | Sales / quotations |
| `masterRoutes.tsx`, `adminRoutes.tsx`, `authRoutes.tsx`, `mobileRoutes.tsx`, … | Masters, admin, auth, mobile |

---

## 7. Dual-mode (`VITE_USE_API`), bridges, demo stores

### Config

| File | Role |
|------|------|
| `frontend/src/config/environment.ts` | `useApi: VITE_USE_API === 'true'`; `VITE_API_BASE_URL`; `VITE_TENANT_SLUG` |
| `frontend/src/config/apiConfig.ts` | `isApiMode()` |

Default: demo mode (`VITE_USE_API` unset/false). **Never mix** demo Zustand seed with API hydrate.

### Bridges (`frontend/src/services/bridges/`)

| Bridge | Purpose |
|--------|---------|
| `crmApiBridge.ts` | CRM hydrate / writes |
| `masterApiBridge.ts` / `masterBatchApiBridge.ts` | Core masters |
| `crmMasterApiBridge.ts` | CRM masters |
| `quotationApiBridge.ts` / `quotationTemplateApiBridge.ts` | Quotations |
| `salesOrderApiBridge.ts` | Sales orders |
| `financeApiBridge.ts` / `journalApiBridge.ts` / `receivablesApiBridge.ts` / `payablesApiBridge.ts` / `approvalApiBridge.ts` | Finance |
| `adminApiBridge.ts` | Admin |
| `index.ts` | Re-exports sync helpers |

Rule: CRM/master writes go through bridges — do not duplicate field mapping in pages.

### Demo stores (`frontend/src/store/`)

Representative Zustand stores (demo / dual-mode): `crmStore`, `masterStore`, `purchaseStore`, `inventoryStore`, `qualityStore`, `dispatchStore`, `accountingStore`, `workOrderStore`, `journalDemoStore`, `receivablesDemoStore`, `financeSetupStore`, plus attachment/mobile helpers. API mode replaces or bypasses slices via sync hooks / service layer — do not merge seed into live API data.

---

## 8. Duplicate / legacy routes

### Production → Manufacturing

From `frontend/src/routes/productionRoutes.tsx`:

| Legacy path | Redirect / status |
|-------------|-------------------|
| `/production` | → `/manufacturing/today` |
| `/production/control-tower` | → `/manufacturing/control-room` |
| `/production/job-cards` | → `/manufacturing/work-orders` |
| `/work-orders` (top-level) | → `/manufacturing/work-orders` |
| `/job-work` | → `/manufacturing/job-work` |
| Scan / 360 detail paths | Still live under `/production/scan/*`, `/work-orders/:id`, etc. until folded |

### Legacy CoA / vouchers / bank

From `frontend/src/routes/accountingRoutes.tsx` (comment + redirects ~L318+):

| Legacy path | Canonical |
|-------------|-----------|
| `/accounting/coa`, `/accounting/chart-of-accounts*` | `/accounting/settings/chart-of-accounts` |
| `/accounting/vouchers*` | `/accounting/entries/journals*` |
| `/accounting/bank*` | `/accounting/bank-cash*` |
| `/accounting/dashboard` | `/accounting` |
| `/accounting/gst-tds` | `/accounting/tax-compliance` |
| `/accounting/setup` | `/accounting/settings` |

**Residual risk:** some pages (e.g. `ChartOfAccountsPage`, `AccountCardPage`) still navigate to `/accounting/chart-of-accounts/…` which redirects to the settings hub (detail deep-link may lose `:accountId`).

### Other redirects

CRM/purchase/masters have additional Navigate aliases (kanban, contacts under CRM, GRN plural, approval matrix, etc.).

---

## 9. Risk areas (top)

1. **Prisma schema integrity** — `BankConnectorConsent` relation without model; migration history drift vs local DB (see baseline).
2. **Migration timestamp collisions** — multiple `20260721010000_*` folders; DB vs disk mismatch on historical renames.
3. **Dual-mode / demo–API leakage** — large surface of demo stores + partial API modules (AP often API-only; inventory/purchase dual-mode incomplete).
4. **Legacy route residue** — `/production/*` and old CoA URLs still referenced from control towers / older pages.
5. **Typecheck debt** — backend and frontend `tsc` both failing at audit start (FA disposal, quality workspace, dispatch/quality API clients, tax permission unions).
6. **Production host packaging** — known risk: API served as HTML until `.htaccess`/redeploy (see `PROJECT_STATUS.md`).
7. **Parallel FE trees** — `frontend/` vs `trailer-erp/` confusion for agents/scripts.

---

## 10. How to run focused test suites (not executed in this START step)

### Backend (Vitest)

```bash
cd backend
npx vitest run tests/finance                 # finance suite folder
npx vitest run tests/manufacturing-phase2b.test.ts   # example manufacturing file
npm run test:crm-live                        # live CRM (needs MySQL)
npm run verify:finance-integrity
```

Manufacturing files live under `backend/tests/manufacturing-phase*.test.ts`. Finance under `backend/tests/finance/finance-*.test.ts`.

### Frontend (tsx scripts)

```bash
cd frontend
npm run test:manufacturing-module
npm run test:manufacturing-phase6b
npm run test:bank-connectors
npm run test:treasury-liquidity
# Fixed assets: scripts/verify-fixed-assets.ts (invoke via tsx if no npm alias)
```

`npm test` on frontend is a curated purchase/quality/dispatch/integrity bundle — not a full Vitest suite.

---

*End of repository map (Phase 8A START).*
