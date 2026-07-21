# Remaining Work

Prioritized backlog. Status values: `open`, `in_progress`, `blocked`, `done`.

---

## P0 — Critical (blocks API-mode production CRM)

### P0-0: Product master API hydration (CRM-P0-1)

| Field | Value |
|-------|-------|
| Module | Masters / Products |
| Description | `MasterProduct` table + `/masters/products` + frontend hydrate/bridge |
| Reason | API-mode CRM product pickers used demo seed |
| Status | **done** (2026-07-13) — migration `20260713000000_add_master_products`; 3 seed products; `syncCoreMastersFromApi` |

### P0-0b: Quotation templates API (CRM-P0-3)

| Field | Value |
|-------|-------|
| Module | Quotations / Templates |
| Description | `CrmQuotationTemplate` + `/crm/quotation-templates` + frontend hydrate/bridge |
| Reason | API-mode template picker used demo seed only |
| Status | **done** (2026-07-13) — migration `20260713020000_crm_quotation_templates`; seed now **1** template (`STANDARD-TRAILER`, trimmed 2026-07-15) |

### P0-1: Quotation database migration

| Field | Value |
|-------|-------|
| Module | Quotations |
| Description | Create Prisma migration for `crm_quotations` and `crm_quotation_documents` |
| Reason | Schema existed; export/report services needed tables in MySQL |
| Dependencies | None |
| Next step | ~~Create migration~~ — done; use `migrate deploy` to apply |
| Test required | `npm run test:crm-live` + manual export `/crm/exports/quotations` |
| Status | **done** (2026-07-11) — migration `20260710212426_add_crm_quotations` applied; `migrate deploy` reports 7 migrations, none pending |

### P0-2: Quotation CRUD API + frontend bridge

| Field | Value |
|-------|-------|
| Module | Quotations |
| Description | Backend routes for quotation + document lifecycle; wire `crmApiBridge` |
| Reason | Quotation 360, editor, SO handover are demo-only |
| Dependencies | ~~P0-1~~ (done) |
| Next step | ~~Add `quotations/` module~~ — done; wire 360 attachments (P0-4) |
| Test required | E2E create → revise → approve; extend `crm-e2e.test.ts` |
| Status | **done** (2026-07-11) — CRUD + lifecycle + bridge + store wiring; live E2E 33/33 |

### P0-3: Notes & attachments E2E tests

| Field | Value |
|-------|-------|
| Module | Notes, Attachments |
| Description | Add live tests for entity notes CRUD and attachment upload/download |
| Reason | Feature shipped without automated verification |
| Dependencies | None |
| Next step | Optional: attachment download assertion |
| Test required | Part of `test:crm-live` |
| Status | **done** (2026-07-14) — notes create/list/PATCH/soft-delete on LEAD; attachments typed upload/list already live; download not separately asserted |

### P0-4: Quotation 360 API attachments & notes

| Field | Value |
|-------|-------|
| Module | Attachments, Quotations |
| Description | Replace `Enterprise360Documents` demo on Quotation360 with `EntityAttachmentsPanel` or quotation-specific API |
| Reason | Other 360 pages API-backed; quotation attachments still demo |
| Dependencies | P0-2, QUOTATION entity type |
| Next step | — |
| Test required | Manual API mode + E2E |
| Status | **done** (2026-07-13) — `CrmEntityType.QUOTATION` + Quotation360 notes/attachments API panels |

---

## P1 — High (completes CRM API mode)

### P1-1: System user & role admin UI

| Field | Value |
|-------|-------|
| Module | Users, Roles |
| Description | Frontend pages calling `/t/:slug/users` and `/roles` |
| Reason | Backend complete; no admin SPA |
| Dependencies | None |
| Next step | `modules/systemAdmin/UserAdminPages.tsx` + `RoleAdminPages.tsx` built, dual-mode (`adminStore` + `adminApiBridge` + demo seed, pre-existing), routed at `/admin/users` + `/admin/roles`, nav/sidebar wired. **Remaining:** run `npm run typecheck`, manual/live smoke test with `admin@vasant-trailers.com` (shell tool was unavailable this session — see `SESSION_CHANGELOG.md` 2026-07-15) |
| Test required | Manual + API integration tests — not yet executed |
| Status | **in_progress** (2026-07-15) — frontend built and wired; verification pending |

### P1-2: Tenant admin UI (Super Admin)

| Field | Value |
|-------|-------|
| Module | Tenants |
| Description | Tenant list/create/edit for Super Admin |
| Reason | API-only tenant management |
| Dependencies | None |
| Next step | `modules/systemAdmin/TenantAdminPages.tsx` built (list/create incl. first admin user/edit/detail + suspend/activate/archive), gated by `isSuperAdminUser()`, routed at `/admin/tenants`. **Remaining:** run `npm run typecheck`, manual/live smoke test |
| Test required | Manual — not yet executed |
| Status | **in_progress** (2026-07-15) — frontend built and wired; verification pending |

### P1-3: Dashboard quotation panel in API mode

| Field | Value |
|-------|-------|
| Module | CRM Dashboard |
| Description | Approval queue from `GET /crm/dashboard/metrics` → `panels.pendingApprovalQuotations` |
| Reason | Was store-backed in API mode |
| Dependencies | P0-2 |
| Next step | — |
| Test required | Live metrics panel assert |
| Status | **done** (2026-07-14) — FE `applyApiDashboardPanelOverlay`; demo keeps store derivation |

### P1-3b: Dashboard chart series in API mode

| Field | Value |
|-------|-------|
| Module | CRM Dashboard |
| Description | Funnel/trend charts read from `/dashboard/metrics.charts` in API mode |
| Reason | Charts were store-backed while KPIs/panels were API-backed |
| Dependencies | None |
| Next step | Manual visual verify on `/crm` |
| Test required | Manual |
| Status | **done** (2026-07-11) |

### P1-3c: Edit Opportunity header actions (shared controller)

| Field | Value |
|-------|-------|
| Module | Opportunities / Edit |
| Description | Central `useOpportunityEditor` for Save / Save&Close / Cancel / View 360 / Quotation / Actions |
| Reason | Placeholders + Save navigated away; PATCH sent workflow fields |
| Status | **done** (2026-07-14) — UAT-03 86/86; residual: no optimistic concurrency; Reopen UI only relevant on closed 360 |

### P1-3d: Convert Quotation → Sales Order shared workflow

| Field | Value |
|-------|-------|
| Module | Quotations / Sales orders |
| Description | One-click convert from list + 360 + smart overview with confirmation dialog; transactional SO + Won; 409 idempotent |
| Status | **done** (2026-07-15) — residual: credit/inventory warnings, tenant Sent-config, reopen-and-convert |

### P1-4: Migrate legacy permission checks

| Field | Value |
|-------|-------|
| Module | Permissions |
| Description | Replace remaining `sales.*` / role-name checks with `canCrmPermission()` |
| Reason | Inconsistent FE enforcement |
| Dependencies | None |
| Next step | Optional: migrate demo `salesStore` / `assertPermission('sales')` when transactional Sales gets API |
| Test required | `test:rbac` demo script; API-mode Sales Executive vs Viewer button parity |
| Status | **done** (2026-07-15) — CRM UI + route shell + quick-create; demo `sales.*` matrix retained only inside `canCrmPermission` fallback + deferred salesStore |

### P1-5: Login activity module

| Field | Value |
|-------|-------|
| Module | Login activity |
| Description | `login_events` table + list API + admin UI (if required) |
| Reason | Only `lastLoginAt` today |
| Dependencies | Product decision |
| Next step | Confirm requirements with stakeholders |
| Test required | New E2E |
| Status | open |

---

## P2 — Medium (quality & parity)

### P2-1: Lead bulk operations API parity

| Field | Value |
|-------|-------|
| Module | CRM Leads |
| Description | Verify bulk-assign UI uses `POST /leads/bulk-assign` in all code paths |
| Reason | Prior gap analysis flagged N+1 |
| Dependencies | None |
| Next step | Audit `CrmLeadListPage` bulk actions |
| Test required | Live E2E bulk test |
| Status | open |

### P2-2: Opportunity PATCH workflow sanitizer

| Field | Value |
|-------|-------|
| Module | Opportunities |
| Description | Block win/lose/status bypass via PATCH (enforce workflow endpoints) |
| Reason | Parity with lead workflow |
| Dependencies | None |
| Next step | Review `opportunity.service.ts` update path |
| Test required | Negative E2E tests |
| Status | open |

### P2-3: Mobile CRM API-mode E2E

| Field | Value |
|-------|-------|
| Module | Mobile CRM |
| Description | Verify mobile follow-up/opportunity pages after API sync |
| Reason | Mobile tests run demo-only |
| Dependencies | None |
| Next step | Run mobile pages with `VITE_USE_API=true` |
| Test required | New script or manual checklist |
| Status | open |

### P2-4: Global search E2E

| Field | Value |
|-------|-------|
| Module | CRM Search |
| Description | Automated test for `/crm/search` integration |
| Reason | Backend exists; no live test |
| Dependencies | None |
| Next step | — |
| Test required | Live test |
| Status | **done** (2026-07-14) — `searches CRM companies, contacts, leads, and opportunities` in `crm-e2e.test.ts`; `test:crm-live` 46/46 |

### P2-5: Master modules still demo-only

| Field | Value |
|-------|-------|
| Module | Master data |
| Description | BOM, work-center, routing, code series UI remain demo |
| Reason | Out of Phase 4 scope |
| Dependencies | Master phase 5 plan |
| Next step | See `docs/master-implementation-plan.md` |
| Test required | TBD per resource |
| Status | open |

---

## P3 — Low / future phases

### P3-1: Sales order backend

| Field | Value |
|-------|-------|
| Module | Sales orders |
| Description | Full transactional SO / MRP / dispatch API (beyond CRM create/confirm/close) |
| Reason | **Phase 1 shipped 2026-07-14:** convert + POST/PATCH/DELETE draft + confirm + close (`salesOrderApiBridge`). **Accepted deferral:** MRP / dispatch / invoice (not a CRM defect — see verification report G2). |
| Dependencies | P0-2 quotations (done) |
| Next step | Architecture phase for fulfilment ERP (in_production → invoiced) only when product prioritizes it |
| Test required | Full fulfilment lifecycle E2E when that phase starts |
| Status | partial (Phase 1 done; fulfilment deferred by design) |

### P3-2: Purchase module backend

| Field | Value |
|-------|-------|
| Module | Purchase |
| Description | PR/PO/GRN API |
| Reason | **Partial** — PO lifecycle + inventory masters + GRN + Approvals + **Purchase Setup full persistence** (all editable tabs + enforcement) + Invoice/QI/Return APIs shipped 2026-07-21. Remaining gaps: richer inventory posting, reports, and fuller FE wiring for invoice/QI/return beyond Setup enforcement. |
| Dependencies | Items, vendors (done); PR schema Phase 03 (done); PO lifecycle (done); Approvals queue (done); Setup 1A (done) |
| Next step | Quality inspections / invoice / returns backends when prioritized. **Approvals next iteration:** backend Approval Matrix enforcement (amount bands → role chain, currently demo-only frontend config) + per-user Approval Limits, layered on the existing RBAC + self-approval policy. |
| Test required | Setup **13/13**; PO lifecycle (warehouse resolution); GRN **15/15** (Setup policies); approvals 11/11 + flow 4/4. Continue quality/invoice suites next. |
| Status | partial (Setup 1A done; quality/invoice/returns next) |

### P3-3: Inventory / production / quality / finance backends

| Field | Value |
|-------|-------|
| Module | ERP transactional |
| Description | Incremental backend per module |
| Reason | **Accepted deferral** — large scope; demo frontend may exist. Not a CRM funnel gap (report G3). |
| Dependencies | Purchase, SO Phase 1 |
| Next step | Module-by-module planning when prioritized. Manufacturing FE: **Phases 1–6 + Route/Operations demo shipped** (Control Room, shopfloor, BOM, routes, plan, WO ops stages, job work, reports, settings) — production API still deferred (`docs/MANUFACTURING_SIMPLE.md`). |
| Test required | Per-module production-ready scripts |
| Status | open (accepted deferral; finance **setup** Phase 1 carved out 2026-07-17 — posting still deferred) |

### P3-3b: Manufacturing & Production FE (simple mode)

| Field | Value |
|-------|-------|
| Module | Manufacturing & Production |
| Description | ERPNext-style simple manufacturing: BOM → Route → Plan → Work Order (ops stages inside WO) → Job Work → Reports/Settings |
| Reason | Replace complex Production nav with a simpler operator flow; demo FE only until backend phase |
| Dependencies | None for FE phases |
| Next step | Manufacturing **backend** when prioritized; FE polish/smoke scripts optional |
| Test required | Route integrity + typecheck; later phase-specific smoke scripts |
| Status | Phases 1–6 + Route/Operations **done** (2026-07-17); manufacturing backend still deferred |

### P3-4: Attachment cloud storage

| Field | Value |
|-------|-------|
| Module | Attachments |
| Description | S3/Blob storage adapter |
| Reason | Current filesystem not production-portable |
| Dependencies | None |
| Next step | Storage abstraction layer |
| Test required | Upload/download integration |
| Status | open |

### P3-5: Duplicate detection / merge (CRM)

| Field | Value |
|-------|-------|
| Module | CRM |
| Description | Lead/company duplicate detection |
| Reason | Phase 2 enhancement per gap analysis |
| Dependencies | None |
| Next step | Product spec |
| Test required | — |
| Status | open |

### P3-7: Accounting module screens (build-out behind wired nav/routes)

| Field | Value |
|-------|-------|
| Module | Accounting |
| Description | **Finance Settings Phase 1** + **Phase 2C1–2C2B journals** + **Phase 3A1–3A6 AR** + **Phase 3B1–3B5 customer receipts** + **Phase 3C1–3C4 customer credit-note backend posting** + **Phase 3C5 credit-note allocation**. |
| Next step | **Phase 3C6** credit-note frontend. Phase **3B6** receipt workspace UI and document reversal remain open. |
| Test required | Finance tests (`tests/finance/`) + `npm run test:money-in` |
| Status | partial (**3C1–3C5 implemented; focused tests/typecheck pass**; 3C6 frontend deferred) |

### P3-6: Commercial terms single source

| Field | Value |
|-------|-------|
| Module | Masters / Sales |
| Description | Migrate SO / quick-create / search off `masterStore.commercialTerms` onto CRM payment/delivery/warranty masters; then retire dual store |
| Reason | Dual sources audited in [`MASTER_REGISTRY.md`](MASTER_REGISTRY.md) Phase 5; SO still depends on seed fallback (empty in API hydrate) |
| Dependencies | CRM commercial masters stable in API mode |
| Next step | 1) Wire `CommercialTermSelect` to CRM options 2) Remap search + quick-create 3) Cutover SO free-text → codes 4) Remove seed/store only after demo+API tests |
| Test required | Quotation + SO create/edit + purchase PO + quick-create + global search in demo and API mode |
| Status | **done** (2026-07-13) — SO/quick-create/search on CRM; `masterStore.commercialTerms` retired |

---

## Recommended next task

See [`PROJECT_STATUS.md`](PROJECT_STATUS.md) open risks. Highest ops: **redeploy production `.htaccess`** so `/api` returns JSON. Product backlog: **verify P1-1/P1-2 admin UIs**; then P2 mobile API E2E. Finance **next:** **Phase 3B6** receipt workspace UI.
