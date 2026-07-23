## 2026-07-23 — Manufacturing Accounting permission sync + UAT checklist

### Shipped

- Ran `sync-permissions.ts` on live DB — **84** role-permission links (enablement keys for Tenant Admin / Finance Manager / Inventory Manager / etc.).
- Production Manager limited to `manufacturing.accounting.view` + `.readiness` (Finance owns enable/sign-off); over-grants revoked.
- UAT checklist: `docs/manufacturing/accounting/MANUFACTURING_ACCOUNTING_UAT_CHECKLIST.md`
- Smoke: `backend/scripts/uat-mfg-accounting-enablement.ts` (does not enable flag)

### Evidence

- UAT smoke PASS on `vasant-trailers`: flag OFF, nextAction=`CONFIGURE_ACCOUNT_MAPPINGS` (LABOUR/MACHINE/JOB_WORK), period OPEN
- `test-mfg-accounting-enablement-gate.ts` PASS
- Re-login required for session permissions

---

## 2026-07-23 — Emergency Override drawers (Dispatch)

### Shipped

- Shared never-overridable vs operational blocker catalog; fail-closed on unknown codes.
- `emergency_overrides` audit register (GRANTED → CONSUMED, time-bound, document-scoped).
- Dispatch post accepts `emergencyOverride{…}`; readiness exposes `emergencyOverride.canRequest`.
- FE `EmergencyOverrideDrawer` on workbench outbound when Post is blocked.
- Docs: `docs/EMERGENCY_OVERRIDE.md`, updated `DISPATCH_EMERGENCY_OVERRIDE.md`.

### Evidence

- Migrate `20260723120000_emergency_overrides` applied
- `npx vitest run tests/emergency-override-catalog.test.ts` → **4/4 PASS**
- `dispatch-phase7c5` emergency case → **PASS** (GRANTED→CONSUMED path)

---

### Shipped

- POD register after posted Dispatch: `IN_TRANSIT` → capture DELIVERED / partial / exception / rejected / return.
- **No stock movements** on POD — FG already issued at Dispatch post.
- Auto-create IN_TRANSIT shell on post; APIs under `/dispatch/outbound/:id/pod/*`.
- Policy `REQUIRE_POD_BEFORE_INVOICE` (default OFF) gates auto draft SI.
- FE `DispatchPodPanel` on outbound detail; docs `docs/dispatch/DISPATCH_POD.md`.

### Evidence

- Migrate `20260723110000_dispatch_proof_of_delivery` + `20260723111000_dispatch_pod_ob_unique`
- `npx vitest run tests/dispatch-pod.test.ts` → **2/2 PASS** (IN_TRANSIT + capture DELIVERED; stock-neutral)

---

## 2026-07-23 — Dispatch e-Way Bill (statutory NIC panel)

### Shipped

- e-Way is **not** a manual number field: removed editable DC transport input; system snapshot only on generate.
- `GstEWayBill` enriched: generatedAt, transporterId, requiredReason, request/response JSON, outboundDispatchId.
- NIC adapter: generate / cancel / **update vehicle** + request/response snapshots (SIMULATED; LIVE blocked until certified).
- Dispatch panel API `GET …/e-way-bills/panel` + actions; FE `DispatchEWayBillPanel` on Delivery Challan detail.
- Docs: `docs/dispatch/DISPATCH_EWAY_BILL.md`.

### Evidence

- Prisma migrate `20260723103000_eway_bill_statutory_fields` applied
- `cd backend && npx vitest run tests/finance/finance-gst-einvoice-eway.test.ts` → **4/4 PASS**

---

### Shipped

- Policy locked: Post Dispatch → reduce FG → `InventoryAccountingEvent` → central `post()` **only** when `INVENTORY_ACCOUNTING` is enabled for the Legal Entity.
- Dispatch/frontend do **not** create COGS vouchers; Dispatch only calls `tryRecordInventoryAccountingEventsForMovements` with resolved `legalEntityId`.
- Docs ownership table in `docs/dispatch/DISPATCH_COGS.md`; live test covers POSTED + `SKIPPED_FLAG_OFF`.

### Evidence

- `cd backend && npx vitest run tests/dispatch-cogs-gl.test.ts` → PASS

---

### Shipped

- **FOS rule:** Posted Dispatch → `FG_DISPATCH` inventory accounting → Dr `COST_OF_GOODS_SOLD` / Cr `FINISHED_GOODS_INVENTORY` (not on Sales Invoice; `ENABLE_SI_COGS_POSTING` stays OFF).
- CoA template leaf **5600 Cost of Goods Sold**; Veer seed maps `COST_OF_GOODS_SOLD` (+ additive create if CoA pre-existed).
- Enable API: `GET/PUT /inventory/accounting/feature-controls/:legalEntityId` (requires COGS + FG mappings).
- Docs: `docs/dispatch/DISPATCH_COGS.md`.

### Evidence

- `cd backend && npx vitest run tests/dispatch-cogs-gl.test.ts` → **2/2 PASS** (₹4,00,000 Dr COGS / Cr FG + idempotent)
- `tests/inventory-accounting-events.test.ts` → builder COGS pair still green

---

### Shipped

- Posted dispatch → **DRAFT** Sales Invoice only (never auto-post). Idempotent per `DispatchPosting` via `sourceDocumentSnapshot.autoFromDispatchPostingId`.
- Outbox: `DISPATCH_POSTED` / `SALES_ORDER_INVOICE_READY` → `createDraftSalesInvoiceFromDispatchPosting`.
- Qty = invoice-ready (net posted − ACTIVE links − reversed). Partial dispatch invoices dispatched qty only.
- Reverse: only **POSTED** SI hard-blocks; DRAFT/READY linked SIs cancelled on reverse apply.
- Flag `ENABLE_AUTO_SALES_INVOICE_FROM_DISPATCH`: ON outside production by default; OFF in production until set.
- Docs: `docs/dispatch/DISPATCH_AUTO_SALES_INVOICE.md`.

### Evidence

- `cd backend && npx vitest run tests/dispatch-phase7c5.test.ts` → **17/17 PASS**

---

## 2026-07-23 — Admin UI Dynamics chrome (CRM/Accounting parity)

### Shipped

- `AdminWorkspaceShell` — `variant="dynamics"` + `layout="enterprise"` + badge **Admin** + `DynamicsTabs` + `ErpCommandBar`
- Overview + People / Organisation / Security hubs restyled; Users/Roles/Tenants lists use `badge="Admin"`

---

## 2026-07-23 — Dispatch 7C5 emergency / serial-lot / concurrency tests

### Shipped

- Live suite covers emergency override post (`dispatch.override`), serial/lot incomplete→409 / seeded serial→200 / duplicate active serial unique reject, and N-way post + concurrent reverse apply-once stress.
- Happy-path asserts auto DRAFT SI (created or already existing from outbox) + idempotent re-call.

### Evidence

- `cd backend && npx vitest run tests/dispatch-phase7c5.test.ts` → **17/17 PASS**

---

## 2026-07-23 — Admin users blank in API mode

### Shipped

- `useAdminApiSync` hydrates users/roles/tenants on AppShell mount (same pattern as CRM/master sync).
- `/admin/users` reads `useAdminStore.users`, which stayed empty when `VITE_USE_API=true` because only CRM + masters were synced.

### Evidence

- Live `GET /api/v1/t/vasant-trailers/users` as `admin@vasant-trailers.com` → **8** ACTIVE users.

---

## 2026-07-23 — Bank & Cash UAT readiness fix

### Shipped

- Status locked: **live API for internal UAT / controlled pilot**; **AIS / FX / intercompany** still deferred (`BANK_CASH_STATUS.md`, PROJECT_MEMORY)
- Workspace tabs trimmed to live routes only (no seed bank-accounts / deposits / cash-counts / setup links)
- Seed deep links redirect to `/accounting/bank-cash` (cash-book → cashbook)

---

## 2026-07-23 — Inventory + Pilot Finance sign-off (server-stored)

### Shipped

- Enable PUT requires explicit `inventoryReconcileConfirmed: true` and `pilotSignOff: true` (HTTP **422** codes `INVENTORY_RECONCILE_NOT_SIGNED_OFF` / `PILOT_FINANCE_SIGNOFF_REQUIRED`).
- Captures by/at/remarks/scope/reportRef on `FinanceFeatureControl.configurationJson` plus additive `signOffHistory[]`.
- Inventory: reconcile permission + reconciliation workspace available; Pilot: Finance permission, finance activated, mappings/period/failed pre-checks.
- FE checkboxes never preselected; all sign-off state is API-persisted only.

### Evidence

- `npx tsx scripts/test-mfg-accounting-enablement-gate.ts` → PASS

---

## 2026-07-23 — Manufacturing Accounting readiness / enablement APIs (§9–30 core)

### Shipped

- Consolidated `getReadiness()` (`checks`, `blockingCodes`, `nextAction`, `allowedActions`, feature-flag metadata, sign-off history).
- `GET /manufacturing/accounting/readiness`
- `POST …/sign-offs/inventory-reconciliation` + `…/finance-pilot` (additive `ManufacturingAccountingSignOff` + config snapshot).
- `POST …/enable` (re-validates readiness; stores enabledBy/At/note) + `POST …/disable` (reason; preserves events/GL).
- Permissions: readiness, reconcile_signoff, finance_signoff, enable, disable, failed_events.view/retry.
- FE: next-action strip; enable via new APIs; route alias `/manufacturing/costing/accounting-readiness`.
- Docs under `docs/manufacturing/accounting/`.

### Evidence

- Migration applied; gate script PASS; flag remains OFF by default.

---

## 2026-07-23 — Bank & Cash UAT readiness fix

### Shipped

- Status locked: **live API for internal UAT / controlled pilot**; **AIS / FX / intercompany** still deferred (`BANK_CASH_STATUS.md`, PROJECT_MEMORY)
- Workspace tabs trimmed to live routes only (no seed bank-accounts / deposits / cash-counts / setup links)
- Seed deep links redirect to `/accounting/bank-cash` (cash-book → cashbook)

---

## 2026-07-23 — Guided Fulfilment URL + Control Room shortcut

### Shipped

- `?step=` persistence on WO detail, SO fulfilment panel, and hub (`/manufacturing/guided-fulfilment`) — same pattern as Guided Deal
- **Fulfilment** shortcut on Control Room + Store workbench → shared journey strip
- Smoke checklist: `docs/dispatch/GUIDED_FULFILMENT_SMOKE.md`

---

## 2026-07-23 — Inventory + Pilot Finance sign-off (server-stored)

### Shipped

- Enable PUT requires explicit `inventoryReconcileConfirmed: true` and `pilotSignOff: true` every time (422 product codes).
- Captures by/at/remarks/scope/reportRef into `FinanceFeatureControl.configurationJson` + additive `signOffHistory[]`.
- Inventory sign-off needs reconcile (or settings) permission + reconciliation workspace available; pilot needs Finance permission, finance activated, mappings/period/failed pre-checks.
- FE checkboxes never preselected; remarks fields sent to API — no frontend-only storage.

### Evidence

- `npx tsx scripts/test-mfg-accounting-enablement-gate.ts`

---

## 2026-07-23 — Inventory + Pilot Finance sign-off (server-stored)

### Shipped

- Enable PUT requires explicit `inventoryReconcileConfirmed: true` and `pilotSignOff: true` every time (422 product codes).
- Captures by/at/remarks/scope/reportRef into `FinanceFeatureControl.configurationJson` + additive `signOffHistory[]`.
- Inventory sign-off needs reconcile (or settings) permission + reconciliation workspace available; pilot needs Finance permission, finance activated, mappings/period/failed pre-checks.
- FE checkboxes never preselected; remarks fields sent to API — no frontend-only storage.

### Evidence

- `npx tsx scripts/test-mfg-accounting-enablement-gate.ts`

---

## 2026-07-23 — Failed / unreconciled ProductionAccountingEvent integrity gate

### Shipped

- `manufacturing-accounting-event-integrity.service.ts` classifies FAILED, RECORDED, retry exhausted, inventory↔accounting gaps, reversal chain issues, duplicate pending.
- Enablement blockers: `FAILED_ACCOUNTING_EVENTS`, `INVENTORY_POSTINGS_UNRECONCILED` (replaces `UNRECONCILED_ACCOUNTING_EVENTS` for the product code).
- Readiness returns counts + UI-safe exception rows; `technicalDetails` only for settings/post roles (no stack traces).
- Enable 409 includes exception summary in `details`.

### Evidence

- `npx tsx scripts/test-mfg-accounting-enablement-gate.ts`

---

## 2026-07-23 — Manufacturing OPEN accounting period readiness check

### Shipped

- `checkOpenAccountingPeriod` on Accounting Period service (uses `resolvePeriodByDate`): `start ≤ postingDate ≤ end` and status `OPEN`/`REOPENED`.
- Default posting date = tenant timezone calendar day; optional `?postingDate=YYYY-MM-DD` on readiness APIs.
- Readiness returns `openPeriod` (id, code, start, end, status) + `postingDateChecked`; blocker `NO_OPEN_ACCOUNTING_PERIOD`.
- Enablement does **not** bypass posting — `post()` still calls `resolvePostingPeriod`.

### Evidence

- `npx tsx scripts/test-mfg-accounting-enablement-gate.ts` (period payload asserted).

---

## 2026-07-23 — Dispatch domain outbox (DISPATCH_POSTED / INVOICE_READY)

### Shipped

- Enqueue in post TX: `DISPATCH_POSTED`, `SALES_ORDER_DISPATCH_FULFILMENT_CHANGED`, `SALES_ORDER_INVOICE_READY`
- Enqueue on reverse apply: `DISPATCH_REVERSED` + fulfilment changed
- Post-commit drain → in-process handlers → `PUBLISHED` (retry / FAILED support)
- HTTP: `GET/POST /dispatch/domain-events` (+ process, retry)
- Doc: `docs/dispatch/DISPATCH_DOMAIN_EVENTS.md`

### Evidence

- `npx vitest run tests/dispatch-phase7c5.test.ts` → **14/14 passed**

---

## 2026-07-23 — Dispatch Invoice/COGS reverse blockers

### Shipped

- Hard deps: `SALES_INVOICE_POSTED` / `SALES_INVOICE_OPEN` (source links + header) + `COGS_OR_INV_ACCT_POSTED` (POSTED inv-acct only)
- `force` requires `dispatch.override`; re-check at apply
- FE reverse preflight via `getOutboundReversalDependencies`
- Docs: `DISPATCH_REVERSAL_DEPENDENCIES.md` — auto Dispatch→Invoice creation still deferred

### Evidence

- `npx vitest run tests/dispatch-phase7c5.test.ts` → **14/14 passed**

---

## 2026-07-23 — Dispatch partial reverse + approval workflow

### Shipped

- `DispatchReversalService`: create / submit / approve / reject / cancel / apply; partial line qty vs `reversedQuantity`
- Compat `POST /outbound/:id/reverse` returns `{ awaitingApproval, reversal, outbound? }`; `requestOnly` / `skipApproval` / self-complete for approve+apply users
- Routes: `/outbound/:id/reversals`, `/reversals/:id/{submit,approve,reject,cancel,apply}`
- Hard deps: `SALES_INVOICE_POSTED`, `COGS_POSTED`
- Permissions: `dispatch.reverse.request|approve|apply`
- Docs: `DISPATCH_REVERSAL.md`; FE reverse toast handles awaiting approval

### Evidence

- `npx vitest run tests/dispatch-phase7c5.test.ts` → **13/13 passed**

---

## 2026-07-23 — Manufacturing required account mappings readiness

### Shipped

- `manufacturing-account-mapping-readiness.service.ts`: validates **core** (`WIP_INVENTORY`, `FINISHED_GOODS_INVENTORY`, `PRODUCTION_VARIANCE`) + **conditional** MappingReady keys via existing `DefaultAccountMapping` (ADR-039; no mfg mapping table).
- Product aliases (`DIRECT_LABOUR_ABSORPTION` → `LABOUR_ABSORPTION`, `SCRAP_EXPENSE` → `SCRAP_LOSS`, etc.) resolve to enum keys; `REWORK_COST` / `PRODUCTION_CLEARING` have no enum key and are not validated separately.
- Account checks: exists, active, tenant/LE scope, postable (`!isGroup`), duplicate key conflict.
- Readiness returns `mappingKeys.missing` (+ `invalid`, `conditionalEnabled`) and specific blockers (`WIP_ACCOUNT_NOT_CONFIGURED`, `FINISHED_GOODS_ACCOUNT_NOT_CONFIGURED`, …, `MISSING_ACCOUNT_MAPPINGS`).
- Docs: `MANUFACTURING_ACCOUNT_MAPPING.md`, feature-flag rollout; FE enable panel shows missing keys.

### Evidence

- `npx tsx scripts/test-mfg-accounting-enablement-gate.ts` → PASS (flag stays OFF; missing keys + blockers returned).

---



### Shipped

- Shared `fulfilmentAutoAdvance.ts` (same `getFulfilmentAutoMode` preference as WO)
- After **Reserve** → open/create pick; **Pick complete** → packing; **Pack complete/verify** → challan; **Issue challan** → outbound `?focus=post`
- Tablet pick/pack: auto-complete session when lines are fully done (Auto Mode on)
- 7C5 coach strip: Auto Mode toggle + tip

---

## 2026-07-23 — start7C5 operator coach (outbound detail)

### Context

Phase 7C5 backend (canonical `postFgDispatch`, readiness gates, reverse) was already shipped. `start7C5` closed the operator gap: guided Reserve → Pick → Pack → Issue Challan → Post on outbound detail.

### Shipped

- `HardenedPostingCoach` on workbench drafts in `ApiOutboundDispatchPages.tsx`
- Command-bar **Create pick list** / **Create challan** (open existing when present)
- Tests: `npx vitest run tests/dispatch-phase7c5.test.ts` → **8/8 passed**

### Still pending (manual)

- Live UAT on `DSP-*` through full hardened post (scenarios in `PHASE7C5_UAT_RESULTS.md`)

---

## 2026-07-23 — DispatchPosting / Reversal ledger tables

### Shipped

- Prisma models + migration `20260723220000_dispatch_posting_reversal_ledger` (legacy backfill).
- `postFgDispatch` creates immutable `DispatchPosting` + lines with Inventory ISSUE.
- Reverse creates `DispatchReversal` (`APPLIED`) + lines; posting → `REVERSED`.
- Doc: `docs/dispatch/DISPATCH_POSTING_LEDGER.md`.

---

## 2026-07-23 — ISO tank child MAKE SA WO depth (live)

### Shipped

- Harness `backend/scripts/test-iso-tank-child-sa-wo.ts` — parent FG create → generate-child-orders → full child `SA-LADDER` WO (release/issue/stages/SA receipt/complete) → parent reserve+issue of that SA.
- Pointer from `test-iso-tank-wo-execution.ts` header to the child depth script.

### Evidence (`vasant-trailers`)

- `npx tsx scripts/test-iso-tank-child-sa-wo.ts` → **exit 0**
- Parent **WO-000037**; child **WO-000042**; SA movement `0cc64e0c-…` @ `WIP_FABRICATION`; parent consumed SA (onHand 1→0).

---
## 2026-07-23 — Dispatch 7C5 deferred gaps closed

### Shipped

- Immutable `DispatchPosting` / line `reversedQuantity` + `DispatchDomainEvent` outbox
- Partial reverse + approval lifecycle (`request` / `submit` / `approve` / `apply`)
- Hard reverse blockers: posted SI source-links + posted inventory accounting (COGS proxy)
- Post emits `DISPATCH_POSTED`, `SALES_ORDER_DISPATCH_FULFILMENT_CHANGED`, `SALES_ORDER_INVOICE_READY`
- Soft BASIC confirm classified as `LEGACY_POSTED`
- Serial/lot policy gates; concurrent double-post coverage
- Live suite **14/14 PASS** (`dispatch-phase7c5.test.ts`)

### Status

**READY FOR INTERNAL UAT** — not client production without UAT/reconciliation sign-off.

---

## 2026-07-23 — Dispatch 7C5 gap-close (audit refresh + reverse/post UX)

### Context

Phase 7C5 canonical posting already existed; audit doc was stale and reverse HTTP bypassed the canonical facade. FE Post stayed enabled when readiness failed to load.

### Shipped

- Refreshed `docs/dispatch/PHASE7C5_REPOSITORY_AUDIT.md` to match code (canonical service, gates, conditions).
- `POST …/outbound/:id/reverse` → `DispatchReversalService.reverseOutboundDispatchCanonical`.
- Confirm/post controllers pass body `idempotencyKey`.
- Direct `POST /inventory/movements/fg-dispatch` blocked when `DISPATCH_HARDENED_POSTING_ENABLED`.
- Outbound detail: Post only when readiness loads and `allowedActions` includes `POST`; richer post confirm copy; reverse immutable warning.

### Evidence

`npx vitest run tests/dispatch-phase7c5.test.ts` → **8/8 PASS**.

### Status

**READY FOR INTERNAL UAT — WITH CONDITIONS** (partial reverse, invoice/COGS blockers, outbox events deferred).

---

## 2026-07-23 — Shortage → RFQ → award → PO live loop

### Context

Production-shortage PRs default `rfqRequired: false` (planning-sheet → PO). The alternate RFQ path was not covered by `test-shortage-to-purchase-loop.ts`.

### Shipped

- Manufacturing shortage / bulk shortage schemas + services accept optional `rfqRequired: true` and pass through to `createFromProductionShortage` (default remains planning/PO).
- Live harness `backend/scripts/test-shortage-rfq-to-po-loop.ts`: WO shortage → PR (`rfqRequired: true`) → submit/approve → convert-to-rfq → send → 2 VQs → comparison → award → PO → GRN + re-reserve.
- Live result (vasant-trailers): **PASS** — WO-000030, PR-000011, RFQ-000001, CMP-000001, PO-000007, GRN-000006.

### Gaps

- WO / store-workbench shortage UI still does not expose an RFQ-required toggle (API override only).
- FE `createWorkOrderShortageRequisition` typings omit `rfqRequired` until UI is wired.

---

## 2026-07-23 — WO complete honours hard close-readiness blockers

### Root cause

`GET …/close-readiness` was advisory only; `POST …/complete` never called it. Harness called readiness without `allowInProgress=true`, so `OPERATIONAL_STATUS` counted as a blocker while complete still succeeded. Also `allowInProgress` incorrectly soft-gated all inventory/QC checks.

### Shipped

- Severity split: `allowInProgress` only relaxes status (purpose `COMPLETE`); quality softens via `allowCloseWithoutQc`/`flexibleExecution`; material/reservations soft only under flexible; FG never hard-blocks Complete.
- `assertCompleteAllowed` → complete returns **409 `WO_COMPLETE_BLOCKED`** with `blockers`/`warnings`.
- Response adds `purpose`, `blockers`, `warnings`.
- Focused live test `manufacturing-wo-complete-readiness.test.ts`; ISO harness asserts forced hard blocker then success.

---



### Root cause

`POST …/work-orders/:id/materials/issue` never accepted `batchId`/`batchNumber`/`serialId`/`serialNumber`, while `postIssueToWorkOrder` → `postStockMovement` already required them for tracked items. FE `MaterialIssueDrawer` had no batch/serial pickers. Live E2Es cleared tracking flags as a workaround.

### Shipped

- Backend: issue schema + service validate and pass tracking into inventory ISSUE_TO_WO; material item payload includes `batchTracked`/`serialTracked`.
- Frontend: issue drawer BatchSelector + SerialSelector (qty=1 for serial); BatchSelector API mode falls back to InventoryBatch balances via item lineage.
- Live: `scripts/test-wo-batch-material-issue.ts` (pass — reject without batch, issue with batch, balance −1). ISO/Fuel tank E2Es keep batch tracking and pass `batchNumber` on issue; serial still cleared for multi-qty full-flow.

### Remaining

- Multi-serial issue (qty > 1) in one request / loop UX.
- Material return with batch/serial re-allocation.
- Mixed reservation-at-batch (reservations remain item+warehouse).

---


### Shipped

- Prisma: sales fields + `ItemSalesFulfilmentMethod`; migration `20260723210000_master_item_sales_fields`.
- API: Zod + repository defaults/filter `salesAllowed`; lookup returns sales rate/fulfilment.
- FE: Item Master Sales section; DTO mapping.
- Metrics: `scripts/crm-item-migration-metrics.ts`.
- Docs: `CRM_ITEM_PHASE2_SALES_FIELDS.md`; migration map Phase 2 marked done.

### Next

Phase 3 — nullable `itemId` / JSON shapes (no CRM picker switch yet).

---

## 2026-07-23 — Admin Panel Phase 10 (polish close-out)

### Shipped

- `/admin/org-structure` — read-only LE → Branch; department/warehouse sibling links.
- Admin Audit: `GET /security/audit-logs` + `/admin/security/audit`.
- Read-only security policy (`GET /security/policy`) on Locked Accounts; Overview quick cards.
- Module Access on organization workspace + Roles deep-link; `requireModule` on purchase/manufacturing.
- Test: `admin-polish-phase10.test.ts`.

### Holds

Editable password/MFA settings; ModuleAdmin tables; blanket domain API module gates.

---

## 2026-07-23 — Admin Panel Phase 9 (module enablement + platform tree)

### Shipped

- `TenantModuleFlag` + catalog/deps; fail-open missing rows; `module.view|manage`.
- Admin UI `/admin/modules`; sidebar soft-gates via `tenantModulesStore` hydrate.
- Platform Admin `/platform` + tenants under `/platform/tenants` (redirects from `/admin/tenants`).
- Test: `admin-modules-phase9.test.ts`.

### Holds

Hard API module middleware / Module Admins → Phase 10; password-policy/MFA settings → later.

---

## 2026-07-23 — Admin Panel Phase 8 (security)

### Shipped

- `LoginActivity` + `failedLoginCount`/`lockedAt`; auto-lock after 5 failed logins.
- Security APIs under `/security/*` + user lock/unlock; perms `security.view|manage`.
- Admin UI: Login Activity, Active Sessions, Locked Accounts; user detail Lock/Unlock.
- Test: `admin-security-phase8.test.ts`.

### Holds

Password-policy Admin settings / MFA → later; module enablement → Phase 9.

---

## 2026-07-23 — Admin Panel Phase 7 (Effective Access + Access Review)

### Shipped

- `EffectiveAccessService` — roles → permissions (with sources) + scopes + responsibilities + explain notes.
- APIs: `GET /users/:id/effective-access`, `GET /access-review`.
- Admin UI: user detail Effective Access panel; `/admin/access-review` attention register.
- Perms `access.view` / `access.review` + Tenant Admin grants.
- Test: `admin-effective-access-phase7.test.ts`.

### Holds

Access overrides / review campaigns → later; login activity & security pages → Phase 8.

---

## 2026-07-23 — Admin Panel Phase 6 (scopes + responsibilities)

### Shipped

- Scope tables + `GET/PUT /users/:id/scopes`; fail-open empty grants; `scopeAllows` helper.
- Responsibility catalog (system seed + tenant CRUD) + user assignments.
- Admin UI `/admin/responsibilities` + user detail access panels.
- Migration `20260723220000_admin_scopes_responsibilities`; test `admin-scopes-responsibilities-phase6.test.ts`.

### Holds

Effective Access / Access Review → Phase 7; login activity / security pages → Phase 8.

---

## 2026-07-23 — Admin Panel Phase 5 (Role Builder + Departments)

### Shipped

- `Department` Prisma model + `User.departmentId` FK; migration `20260723200000_admin_departments`.
- Department CRUD API (`department.*` permissions) mounted under tenant + slug routes.
- Admin UI `/admin/departments`; user create/edit Department Select; Role Builder wizard (4 steps).
- Nav, page guides, demo catalog perms; grant SQL for Tenant Admin roles.
- Test: `admin-departments-phase5.test.ts`.

### Holds

Scopes / responsibilities / Effective Access / login activity → Phase 6+.

---

## 2026-07-23 — Dispatch Phase 7C5 hardened posting

### Shipped

- Canonical `DispatchPostingService` — `/confirm` and `/post` route through it.
- Policy + flag `DISPATCH_HARDENED_POSTING_ENABLED` (ON non-prod by default).
- Posting readiness API, reconciliation report/CSV, reversal dependency inspect.
- Fulfilment `reversedDispatchQty` from REVERSED headers.
- Live tests: `dispatch-phase7c5.test.ts` (8/8 pass).
- Docs under `docs/dispatch/PHASE7C5_*` and related rule sheets.

### Verdict

**READY FOR INTERNAL UAT** (not client production). See final delivery report in chat / `PHASE7C5_TEST_RESULTS.md`.

---

## 2026-07-23 — Finance foundation after ops (Manufacturing Accounting gated)

### Shipped

- Extended `seed-veer-organisation-setup.ts`: Cost Centres, AP/AR number series, WIP/FG/variance mappings, **Manufacturing Accounting forced OFF**.
- Enable gate requires inventory reconcile + pilot Finance sign-off (`pilotSignOff` / `inventoryReconcileConfirmed`) plus mappings/open period.
- UI gate no longer opens on view-permission alone; checklist copy updated.
- Live smoke: `scripts/test-finance-core-e2e.ts` — Journal/GL, Purchase Invoice, Vendor Payment, Sales Invoice, Customer Receipt.

### Evidence (`vasant-trailers`)

- Seed exit 0 — Finance activated; mfg accounting disabled.
- `npx tsx scripts/test-finance-core-e2e.ts` → exit 0 (GL entries populated; PI/VP/SI/CR posted).

### Re-run

```bash
npx tsx scripts/seed-veer-organisation-setup.ts
npx tsx scripts/test-finance-core-e2e.ts
```

---

## 2026-07-23 — Manufacturing Accounting enablement readiness gate

### Shipped

- Audit: `docs/manufacturing/accounting/MANUFACTURING_ACCOUNTING_ENABLEMENT_AUDIT.md`
- Readiness SoT: explicit `enablementChecks` / `canEnable`; `UNRECONCILED_ACCOUNTING_EVENTS` for `RECORDED` backlog; LE-scoped event counts; optional posting date
- FE: enable panel with checklist + inventory reconcile + pilot Finance sign-off; API sends required PUT body
- Docs: FEATURE_FLAG_ROLLOUT, ACCOUNT_MAPPING updated
- Tests: sign-off 400 + unreconciled 409 in `manufacturing-phase8-auto-gl.test.ts`

### Rule

Flag stays OFF until mappings + open period + zero failed + zero RECORDED + both sign-offs.

---

## 2026-07-23 — Fuel Tank manufacturing master setup (UAT example)

### Shipped

- Live API seeds for **5000 L MS Fuel Tank** (`FG-FUEL-TANK-5000L`): items, WC/machines, warehouses, 12 QC plans, multilevel BOM, PARALLEL route (`RT-000001`), profile `MP-FUEL-TANK-5000L`.
- LOGICAL SFG: Job Cards = route stage groups on FG WO; **no** child SFG WOs.
- Docs: `docs/manufacturing/examples/FUEL_TANK_*.md`
- Scripts: `seed-fuel-tank-pilot-items.ts`, `seed-fuel-tank-mfg-setup.ts`, `test-fuel-tank-wo-execution.ts`

### Evidence (`vasant-trailers`)

- Seeds exit 0; E2E exit 0 — WO **WO-000027** release → 6 JC stages / 15 ops; SFG WO blocked; childCount=0; materials issued; parallel JCs → QC_PENDING.

---

## 2026-07-23 — Production-shortage PR submit fields

### Shipped

- `production-shortage-pr.service.ts` now sets `departmentId`, `requestedById`, `requiredDate`, and defaults `rfqRequired=false` (opt-in RFQ) so shortage PRs submit → planning → PO without a DRAFT patch.
- Schema accepts optional `departmentId` / `requestedById` / `rfqRequired`.
- `test-shortage-to-purchase-loop.ts` removes PATCH workaround; asserts submit-ready fields on create.

### Evidence (`vasant-trailers`)

- `npx tsx scripts/test-shortage-to-purchase-loop.ts` → **exit 0**
- WO **WO-000026** → PR **PR-000009** (`rfqRequired=false`) → PO **PO-000005** → GRN **GRN-000004**

---

## 2026-07-23 — Admin Panel Phase 4 (invitations + session revoke)

### Shipped

- Prisma `UserInvitation` + migration; invite/resend/list APIs; accept via `/auth/accept-invitation`.
- User activate/deactivate + revoke-sessions (RefreshToken SoT); session list on user detail.
- FE: `/admin/invitations`, login accept-invite (`?invite=`), nav/docs updated.

### Hold

- Email delivery of invites (dev returns token); login activity register; Department.

---

## 2026-07-23 — Admin Panel Phase 3 (Tenant Profile + Companies/Branches)

### Shipped

- `/admin/tenant-profile` — workspace Tenant identity/locale via existing Tenant GET/PATCH (demo store + API).
- `/admin/companies` — Legal Entity hub over organisation/finance APIs; readiness + deep-links to Organisation Setup.
- `/admin/branches` — Branch hub over finance Branch API; deep-links to Accounting → Branches.
- Nav/routes/page guides updated; Admin Overview CTA to Companies.
- Product rule: Admin = entry; Organisation/Accounting = full editors; no second company SoT; Department deferred.

### Hold

- No new Prisma models; invitations / Department / scopes remain Phase 4+.

---

## 2026-07-23 — ISO tank SA child WO readiness

### Shipped

- Extended `seed-iso-tank-mfg-setup.ts`: each MAKE SA (`SA-TANK-SHELL`, `SA-FRAME`, `SA-VALVE-PIPING`, `SA-WALKWAY`, `SA-LADDER`) gets minimal ACTIVE BOM + DETAILED route + profile (WIP warehouses).
- FG BOM L1 SA lines kept `childProductionOrderRequired=true` + `stockedSemiFinished=true` (stocked SFG does **not** skip children in this engine).
- `test-iso-tank-wo-execution.ts` asserts child count ≥ 5 and route snapshot on each released child (stages/ops = job-card execution units).

### Evidence (`vasant-trailers`)

- Parent **WO-000010** → children **WO-000011…WO-000015** (`created=5 skipped=0`)
- Each child: route snapshot `ST-FAB` + 1 op; parent FG flow completed

---

## 2026-07-23 — Admin Panel Phase 2 (shared DS + Overview)

### Shipped

- Shared Admin kit under `frontend/src/components/admin/` (nav IA, badges, summary cards, needs-attention, states, permission matrix, Role Builder shell, Effective Access placeholder).
- `/admin` Overview page (`AdminOverviewPage`) — summary strip, attention list, planned Admin areas (Soon).
- Routes/nav: Overview is workspace landing (no redirect to Users); Users/Roles/Tenants remain.
- Roles form/detail use `AdminRoleBuilder` / `AdminPermissionMatrix` with View Only / No Access presets; Users/Tenants use shared status badges; User detail shows Effective Access placeholder.
- Docs: `ADMIN_PANEL_PHASE1_AUDIT.md` §14; `REMAINING_WORK` P0-ADMIN next = Phase 3.

### Hold

- No new IAM Prisma models; invitations / scopes / EffectiveAccessService remain Phase 3+.

---

## 2026-07-23 — Organisation & Finance Foundation Setup

### Shipped

- Extended existing accounting SoT (no parallel CoA/LE tables): `LegalEntity.tradeName` + new `OrganisationRegistration`.
- Tenant APIs: `/api/v1/t/:tenantSlug/organisation/*` (LE, registrations, CoA, mappings, FY, periods).
- Permissions: `organisation.*` + finance aliases (`finance.chart_accounts.*`, `finance.account_mapping.manage`, `finance.fiscal_year.manage`, `finance.posting_period.manage`); Finance Manager pack includes org perms.
- FE: Settings → Organisation Setup (`/settings/organisation/...`) shell + 6 pages.
- Veer seed: full Chhapi address + GST registration row; FY/periods/CoA/mappings unchanged.
- Migration `20260723170000_organisation_foundation` (short unique index `org_reg_tenant_type_number_key`).
- Tests: `tests/organisation-foundation.test.ts` (6).

### Verification

- `npx vitest run tests/organisation-foundation.test.ts` — 6/6 PASS
- `npx tsx scripts/seed-veer-organisation-setup.ts` — ready
- Backend + frontend `tsc --noEmit` — pass

---

## 2026-07-23 — Admin Panel Phase 1 audit

- Added `docs/admin/ADMIN_PANEL_PHASE1_AUDIT.md`.
- Confirmed reuse of Tenant/User/Role/Permission/RefreshToken/LegalEntity/Branch/Organisation APIs; no duplicate company model.
- Gaps: Admin Overview, invitations, departments, data scope, responsibilities, effective access, login activity, module enablement.
- Hold: no new Admin IAM models until Phase 2–3 sign-off.

---

## 2026-07-23 — CRM Product→Item migration Phase 1 audit

- Added `docs/crm/CRM_PRODUCT_TO_ITEM_MIGRATION_MAP.md` (dependency map, DB/API/FE impact, backfill rules, phased plan).
- Key findings: Opp lines already have nullable `itemId`; Quotation/SO lines still Product-centric JSON; Leads encode product lines in `productRequirement` TEXT; MFG resolver already accepts Item id with Product→`fgItemId` fallback; AR invoices already Item-native.
- Hold: no frontend Product-picker replacement until Phases 2–5.

---

## 2026-07-23 — Period Close Control Hardening

### Shipped

- Backend `GET …/periods/:id/close-readiness` aggregator (AP gate, unposted journals, bank recon, inv/mfg GL when flags on).
- Optional hard-block: `FinanceSettings.periodCloseHardBlock` (default off); close returns `PERIOD_CLOSE_BLOCKED` when on + blockers.
- `PeriodCloseChecklistAck` + GET/PUT checklist-acks (ACK / NA + note).
- FE: Period Locking blocker panel; checklist Ack/N/A; Bank scorecard live; Features page toggle.
- Migration `20260723120000_period_close_hardening`.
- Tests: `tests/finance/period-close-hardening.test.ts`; FE `npm run test:period-close`.
- Docs: `docs/accounting/PERIOD_CLOSE_STATUS.md`.

### Verification

- `npx vitest run tests/finance/period-close-hardening.test.ts` (when MySQL up)
- `cd frontend && npm run test:period-close`

---

## 2026-07-22 — Routing ↔ BOM alignment (panel + generate)


### Shipped

- Migration `20260722190000_routing_stage_source_bom_line` — optional `ManufacturingStageGroup.sourceBomLineId`.
- Backend: `GET …/routing-versions/:id/bom-context` and `POST …/generate-stages-from-bom` (DRAFT only; MAKE sub-assemblies + FINAL).
- FE routing version editor: BOM reference panel, Generate stages from BOM, “From BOM” stage badges.
- Live test: `tests/routing-bom-alignment.test.ts` (4).

### Verification

- `npx vitest run tests/routing-bom-alignment.test.ts` — 4/4 PASS

---

## 2026-07-22 — Flexible Work Order Execution

### Shipped

- Settings: `flexibleExecution` (default on), `allowCloseWithoutQc` default on with flexible; denormalized on settings DTO.
- Lifecycle softens: overproduction → warnings; start reservation → warn when flexible; complete WO QC blockers → warnings; complete stage skips QC gate by default when flexible (`skipQcGate` / `qcOverrideReason`).
- FE: WO detail flexible banner + tracking strip; Stage QC panel (decide / override); Record Progress remaining qty; Assignments Start/Pause/Resume.
- Docs: `docs/manufacturing/FLEXIBLE_WO_EXECUTION.md`; Phase 2A README rules updated.
- Tests: `manufacturing-phase2a.test.ts` flexible execution (2).

### Verification

- `npx vitest run tests/manufacturing-phase2a.test.ts -t "flexible execution"` — PASS

---

## 2026-07-22 — Live Inventory Issues register (API mode)

### Shipped

- `/inventory/movements/issues` (+ new/detail) no longer demo-gated in API mode.
- Live pages list `movementType=ISSUE` from stock ledger; post via `POST /inventory/movements/issue` or `issue-to-work-order`.
- Ledger GET/list permissions include `inventory.issues.view` (also receipts/returns view on list).
- Ledger query `referenceType` accepts `FG_DISPATCH` / `SA_RECEIPT`.

### Note

- No draft multi-line issue documents — same model as live Receipts/Returns.
- Demo mode Issues register unchanged.

---

## 2026-07-22 — GST e-invoice / e-way (simulated NIC)

### Shipped

- Migration `20260722153000_tax_einvoice_eway_registers` — `gst_e_invoices` / `gst_e_way_bills`.
- Backend: generate/list/cancel IRN + EWB via `SimulatedNicAdapter` (`GST_NIC_PROVIDER`, default SIMULATED).
- Permissions: `finance.tax.einvoice.manage`, `finance.tax.eway.manage`.
- FE dual-mode registers + Generate/Cancel on e-invoice / e-way pages (API mode).
- Docs: `docs/accounting/TAX_COMPLIANCE_STATUS.md` Phase 2.

### Verification

- `migrate deploy` + `prisma generate`
- `tests/finance/finance-gst-einvoice-eway.test.ts` (live MySQL)
- FE `scripts/verify-tax-compliance.ts`

### Ops

- `npm run db:sync-permissions` then re-login.
- Not live GST portal — simulated IRN/EWB only.

---

## 2026-07-22 — Manufacturing / Inventory Accounting API-complete pilot

### Shipped

- Prisma: `InventoryAccountingEvent` model + enums aligned to migration `20260722041000_inventory_accounting_events`.
- FE: `/accounting/manufacturing/**` wrapped in `ManufacturingAccountingApiGate` (API mode → live Phase 7E workspace + costing policies tab; demo seed unchanged).
- FE: `/inventory/accounting` dual-mode event register (gate + list + detail; voucher deep-link).
- Period Close Inventory / Manufacturing module pages compose live event/workspace counts in API mode.
- Docs: `PERIOD_CLOSE_STATUS.md`, accounting matrix, project memory.

### Verification

- `npx prisma generate` — PASS
- `tests/inventory-accounting-events.test.ts` — **11/11 PASS**
- `npx tsx scripts/verify-mfg-inventory-accounting.ts` — PASS (FE seed-leak guards)

### Ops

- Flags stay **OFF by default**: `MANUFACTURING_ACCOUNTING`, `INVENTORY_ACCOUNTING`.
- Enable after mappings + open period; see `PERIOD_CLOSE_STATUS.md` enable SOP.
- SoT for mfg GL: `docs/manufacturing/PRODUCTION_PHASE7E_README.md`.

---

## 2026-07-22 — Fixed Assets Phase 4 (revaluation, impairment, maintenance, reports)

### Shipped

- Migration `20260722120000_finance_fixed_assets_phase4_reval_impair_maint` — reval/impair/maint tables; asset surplus/impairment fields; mappings `ASSET_REVALUATION_SURPLUS` / `ASSET_IMPAIRMENT_LOSS`.
- API: revaluations (create/post/cancel), impairments (create/recognize/cancel), maintenance CRUD/complete/cancel, reports summary/register/NBV-by-category/disposals.
- Permissions: `finance.fa.revalue` / `finance.fa.impair` / `finance.fa.maintain`.
- FE dual-mode lists + live report print preview; banners use live when API mode is on.
- Docs: `docs/accounting/FIXED_ASSETS_STATUS.md` Phase 4 section.

### Verification

- `migrate deploy` + `prisma generate` — PASS
- `tests/finance/finance-fixed-assets-phase4.test.ts` — **4/4 PASS**

### Ops

- Configure default mappings for revaluation surplus + impairment loss.
- `npm run db:sync-permissions` then re-login for new FA perms.

---

## 2026-07-21 — Purchase Setup full persistence

### Shipped

- Nested Purchase Setup API contract for General, Requisition, Number Series, Approval matrix, Tax, Invoice Matching, Receiving, Quality, and Print.
- Prisma migration `20260721120000_purchase_setup_full_persistence` (+ status-history docs enum) — extended `purchase_settings`, approval tiers/roles, inspection categories, QI/Invoice/Return tables, CodeSeries entities `QUALITY_INSPECTION` / `PURCHASE_INVOICE` / `PURCHASE_RETURN`.
- Atomic save with optimistic `version`, FK validation, non-overlapping approval bands, editable series prefix/pad (next number read-only).
- Notifications tab remains visible, read-only, `ON_HOLD` — excluded from save payloads.
- Frontend `/purchase/setup` is API-only in API mode (no Phase 1 “not persisted” notices; no silent demo merge).
- Workflow enforcement: direct-PO / PR-before-PO, RFQ vendor count, GRN batch/serial/expiry + receiving flags, short-close, multi-level approval chain from persisted matrix, invoice matching/tax defaults via invoice module.

### Verification

- `npx tsc --noEmit` (backend) — **PASS**
- `tests/purchase-setup.test.ts` — **15/15 PASS**
- `tests/purchase-invoice-lifecycle.test.ts` — **4/4 PASS**
- Frontend `tsc -p tsconfig.app.json` — **PASS**
- Migrations applied to local `fos_erp` (including recovery after MySQL identifier-length fix)

---

## 2026-07-21 — Purchase Invoice, QI, and Return backend

### Shipped

- Added complete controller/service/repository/mapper/validation/workflow/routes stacks for Purchase Invoice, Quality Inspection, and Purchase Return.
- Added explicit lifecycle endpoints and tenant-scoped, soft-delete-aware persistence.
- Enforced Purchase Setup direct-invoice/matching/tolerance/tax defaults/authorized override, QI category/deviation/quarantine settings, and default vendor-return location.
- Added canonical invoice/QI/return permissions and mounted `/purchase/invoices`, `/purchase/quality-inspections`, and `/purchase/returns`.
- Document numbers use tenant code series entities only (`PURCHASE_INVOICE`, `QUALITY_INSPECTION`, `PURCHASE_RETURN`).

### Verification

- Backend typecheck — PASS.
- `purchase-invoice-lifecycle.test.ts` — 4/4 PASS.
- Purchase RBAC test — 4/4 PASS.
- Combined purchase regression — 11/12; pre-existing planning create-PO concurrency case failed with both requests returning 400.

## 2026-07-21 — Purchase create/edit footer standard

### Shipped

- Standardized all registered Purchase document editors (PR, RFQ, Vendor Quotation, PO, GRN, Return, Invoice), PO revision, Purchase master forms, and the Planning edit drawer on the shared responsive `FormActionBar`: **Cancel | Save** only.
- Save now performs create/update only, uses single-flight duplicate-click protection, reports backend errors, and redirects to the explicit module list route after backend success.
- Cancel uses stable list routes and the shared unsaved-changes confirmation; no browser confirm or history-back navigation.
- Removed lifecycle Submit / Verify actions from editor footers. PR and Vendor Quotation Submit were added to their detail pages; PO, GRN, Return, and Invoice lifecycle actions remain on existing detail pages.
- Added an explicit Purchase form route map and standardized the Planning Sheet edit drawer on the same shared action component.
- Added `test:purchase-form-footers` (route/footer/API wiring, unsaved confirmation, mobile layout, duplicate click, and detail lifecycle contracts).

### Verification

- `npm run test:purchase-form-footers` — **80/80 PASS**
- `npm run typecheck` — **PASS**
- `npm run test:purchase:production` — **39/39 PASS** (runner uses `tsconfig.app.json` for path aliases)
- `npm run build` — **PASS**
- Targeted `oxlint` — **PASS** (4 pre-existing hook warnings in PO/VQ editors)
- Full `npm run lint` remains non-zero because of the existing syntax error in `scripts/generate-uat-deliverables.ts` and the repository-wide warning baseline.
- Full route/action audit: [`PURCHASE_FORM_FOOTER_AUDIT.md`](PURCHASE_FORM_FOOTER_AUDIT.md).

---

## 2026-07-21 — Purchase form number previews

### Shipped

- **Backend** — Non-consuming `GET …/next-number` for RFQ, Vendor Quotation, PO, and GRN (PR already had it)
- **Frontend** — Create forms show the actual next sequence instead of “Auto-generated”; demo peeks for invoice/return
- **Tests** — `purchase-number-previews.test.ts` **4/4**

### Run

```bash
cd backend && npx vitest run tests/purchase-number-previews.test.ts
cd frontend && npm run typecheck
```

---

## 2026-07-21 — Self-approval policy (maker-checker override)

### Shipped

- **Schema** — `SelfApprovalPolicy` enum (`NEVER` / `PERMISSION_ONLY` / `EVERYONE`) + `PurchaseSettings.selfApprovalPolicy` (default `PERMISSION_ONLY`) — `20260721110000_self_approval_policy`, additive, applied
- **Permission** — `purchase.approvals.self_approve` (238 perms synced); excluded from `PURCHASE_OPS` (Purchase Manager does NOT get it); Tenant Admin / Admin / Administrator / CEO get it via full grant sets
- **Backend enforcement** — PR + PO `assertApprovable` accept `allowSelfApproval`; approve services resolve `isSelfApprovalAllowed(tenantId, actorPermissions)` (policy `EVERYONE` → yes; `PERMISSION_ONLY` → requires the permission; `NEVER` → maker-checker for all); controllers pass `req.context.permissions`; self-approvals audit `selfApproved: true` in `PR_APPROVED` / `PO_APPROVED` newValue
- **Approvals queue** — `pending_mine` keeps the actor's own requests (and `canAct: true`) when self-approval is allowed; assigned-to-another-user check still applies
- **Setup API + UI** — `selfApprovalPolicy` in setup GET/PUT/PATCH + defaults; Purchase Setup → Approval tab "Self-approval policy" select (Never / Permission-only (default) / Everyone)
- **Tests** — `purchase-approval-flow.test.ts` 7/7 (new: permission-based self-approve + audit flag, NEVER blocks, EVERYONE allows); `purchase-approvals.test.ts` 11/11 (requester now provisioned without the bypass permission); backend + frontend typecheck PASS

### Deferred (next iteration per product direction)

Approval Matrix enforcement (amount bands → role chain) and per-user Approval Limits — currently demo-only frontend config; backend approvals remain single-level.

### Run

```bash
cd backend && npx tsx scripts/prisma-cli.ts migrate deploy
cd backend && npx tsx scripts/sync-permissions.ts
cd backend && npx vitest run tests/purchase-approval-flow.test.ts tests/purchase-approvals.test.ts
```

---

## 2026-07-21 — Purchase form number previews

### Shipped

- **Backend** — Non-consuming `GET …/next-number` for RFQ, Vendor Quotation, PO, and GRN (PR already had it); uses `previewNextCode` / `previewPurchaseDocumentNumber`
- **Frontend** — New create forms show the actual next sequence (e.g. `GRN-000001`) instead of “Auto-generated”; demo peeks for invoice/return (no API series yet)
- **Tests** — `backend/tests/purchase-number-previews.test.ts` **4/4** (non-consume, RBAC, tenant isolation)

### Run

```bash
cd backend && npx vitest run tests/purchase-number-previews.test.ts
cd frontend && npm run typecheck
```

---

## 2026-07-21 — Purchase Setup Phase 1A (semantics 2A)

### Shipped

- **Schema** — `PurchaseSettings` + `PurchasePlantSettings`; `DuplicateChallanPolicy` enum; `PurchaseOrder.deliveryWarehouseId` FK (`20260721090000_purchase_setup_phase1`, additive, applied)
- **Backend** — `GET/PUT/PATCH /purchase/setup` + plant overrides; defaults-on-empty GET (no persist-on-read); optimistic `version` concurrency; FK validation (plant/warehouse/location + CRM payment terms); audit `SETUP_*`; shared `purchase-defaults` resolution
- **PO/GRN enforcement** — PO resolves/stores `deliveryWarehouseId` (explicit → PR → setup); `requirePoWarehouse` / expected delivery / payment terms on submit; GRN ignores client `allowExcess` and uses Setup over-receipt + tolerance; challan/vehicle/gate + duplicate challan policy; inspection default from Setup
- **Permissions** — `purchase.setup.view` (+ existing manage); `sync-permissions.ts` (237 perms)
- **Frontend** — `purchaseSetupApi` + facade (no API-mode memory fallback); Setup page 2A warehouse → dependent locations, CRM payment terms, unsaved guard, Phase-1 non-persisted tab notices; PR/PO/GRN drop first-warehouse fallback and prefill from Setup; `getPurchaseWarehouses` lazy-hydrates masters
- **Tests** — `purchase-setup.test.ts` **13/13**; PO lifecycle warehouse/setup cases **3** added (suite pass); GRN setup policy cases **3** added (suite **15/15**); backend `tsc` + frontend `typecheck` **PASS**

### Explicitly deferred (not Phase 1)

Multi-level approval matrix, QI/Returns/Invoice Setup enforcement, currency master, number-series/print/notification/tax persistence (number series stays on `CodeSeries`).

### Run

```bash
cd backend && npx tsx scripts/prisma-cli.ts migrate deploy
cd backend && npx tsx scripts/sync-permissions.ts
cd backend && npx vitest run tests/purchase-setup.test.ts tests/purchase-order-lifecycle.test.ts tests/goods-receipt-lifecycle.test.ts
cd frontend && npm run typecheck
```

---

## 2026-07-21 — Purchase Approvals queue (PR + PO, production API)

### Shipped

- **Backend** — `GET /purchase/approvals` (+ `GET /:id` review) from `PurchaseApproval` rows for PR + PO; orphan `PENDING_APPROVAL` docs healed into queue; RBAC via `purchase.pr/po.approve|view`
- **PR send-back** — `POST /requisitions/:id/send-back` (pending → draft + reason); approval resolved as `RETURNED`; no longer uses reopen from Approvals
- **Maker-checker + assignment** — PR/PO creators cannot approve their own documents; delegated approvals are actionable only by the assigned user; `pending_mine`, `approved_by_me`, and `rejected_by_me` are actor-scoped
- **Delegation** — `POST /purchase/approvals/:id/delegate` validates a real active user with the required PR/PO approval permission and records delegation in status history
- **Frontend** — Approvals page uses the live queue API (PR + PO); send-back uses the real PR endpoint; review shows named status-history actors and eligible live approvers; no hardcoded Finance Head or fake budget/matrix chrome
- **Tests** — approval queue **11/11**, maker-checker/delegation flow **4/4**, full PR+PO+approval regression **26/26**, frontend API contract **9 assertions**, backend/app typechecks pass

### Run

```bash
cd backend && npx vitest run tests/purchase-approvals.test.ts tests/purchase-approval-flow.test.ts --hookTimeout=120000
cd frontend && npm run test:purchase-approvals-api
```

---

## 2026-07-21 — GRN Phase 3 (production backend + FE wiring)

### Shipped

- **Schema** — `GoodsReceipt` + `GoodsReceiptLine`; `GoodsReceiptStatus` enum; `CodeSeriesEntity.GOODS_RECEIPT`; status-history doc type (`20260721080000_grn_phase3`, additive, applied)
- **Backend** — GRN CRUD + `POST /:id/{submit,cancel,reverse}` + `GET /orders/:id/receivable-lines`; submit updates PO `receivedQuantity` + header `PARTIALLY_RECEIVED`/`FULLY_RECEIVED` in one transaction; reverse restores qty; warehouse master required; over-receipt blocked without `allowExcess`; duplicate challan blocked; RBAC (`purchase.grn.*`); audit + status history
- **Frontend** — GRN list/editor/detail use real APIs in API mode; API-mode “not available” save/submit blocks removed; warehouse/location/bin dropdowns from Phase 2 masters
- **Tests** — `backend/tests/goods-receipt-lifecycle.test.ts` (12 live) — all pass

### Run

```bash
cd backend && npx vitest run tests/goods-receipt-lifecycle.test.ts
cd frontend && npm run typecheck
```

---

## 2026-07-21 — Inventory masters Phase 2 (Plant/Warehouse/Location/Bin)

### Shipped

- **Schema** — `MasterPlant` + `MasterBin` models; `MasterWarehouse.plantId` FK (`20260721070000_inventory_masters_phase2`, additive, applied)
- **Backend** — registry-driven CRUD for `plants` / `bins` / `storage-locations` (alias of locations) via existing masters engine; hierarchy FK guards (warehouse→plant, bin→warehouse+location, location-must-match-warehouse, inactive parents blocked); reference guards block hard delete (plant←warehouses, warehouse←bins, location←bins); dependent list/lookup filters `plantId` / `warehouseId` / `storageLocationId`
- **Routes** — `/api/v1/t/:slug/inventory/{plants|warehouses|storage-locations|bins}` alias (restricted) + existing `/masters/:resource`
- **RBAC** — new `master.plant.*` + `master.bin.*` permissions; `scripts/sync-permissions.ts` (idempotent DB sync — 236 perms, roles re-granted)
- **Seed** — `scripts/seed-inventory-setup.ts` (controlled): plants from warehouse plantCodes, links warehouses, default bin per location (vasant-trailers: 2 plants, 8 WH, 8 loc, 8 bins)
- **Frontend** — GRN editor: warehouse free-text → API-backed `Select`; receiving location → dependent Select; line BIN → Select from bins lookup (API mode); warehouse master form supports production warehouse types (receiving/quality_hold/rejected/vendor_return/…)
- **Tests** — `backend/tests/inventory-masters.test.ts` (17 live tests: hierarchy, unique codes, inactive blocks, delete guards, dependent filters, tenant isolation, RBAC, audit, persistence) — all pass

### Run

```bash
cd backend && npx vitest run tests/inventory-masters.test.ts
cd backend && npx tsx scripts/sync-permissions.ts
cd backend && npx tsx scripts/seed-inventory-setup.ts [tenantSlug]
```

---

## 2026-07-21 — PO lifecycle Phase 1 (production backend + FE wiring)

### Shipped

- **Schema** — `PurchaseOrderStatus` += `REJECTED`, `SENT_BACK`, `PARTIALLY_INVOICED`, `FULLY_INVOICED`; PO header `rejectedAt/rejectionReason/sentBackAt/sendBackReason`; PO line `acceptedQuantity/rejectedQuantity/returnedQuantity/invoicedQuantity` (`20260721060000_po_lifecycle_phase1`, additive, applied)
- **Backend** — full PO CRUD + lifecycle: `POST /purchase/orders`, `PATCH /:id`, `POST /:id/{submit,approve,reject,send-back,send-to-vendor,cancel,close,reopen}` — RBAC per action, tenant-scoped, Zod-validated, transactional, status history + `PurchaseApproval` rows + audit logs; DTO includes `allowedActions` + line `openQuantity`
- **Rules** — draft/sent-back editable only; reject/send-back require reason; only approved → send-to-vendor; receipts block cancel (close instead); reopen: rejected/cancelled→draft, closed→receipt-derived status; numbering via code-series only
- **Frontend** — PO editor save/submit, detail lifecycle buttons (incl. new Reject / Send Back with `appPromptNote`), list row actions and approvals queue all hit real APIs in API mode; refetch after mutation; eligibility from backend `allowedActions`; manual PO create unblocked in API mode; API-mode block notice removed; `revisePurchaseOrder` explicitly NOT_SUPPORTED in API mode (no silent demo fallback)
- **Domain** — FE `PurchaseOrderDomainStatus` += `rejected`, `sent_back`
- **Tests** — `backend/tests/purchase-order-lifecycle.test.ts` (17 live tests: CRUD, all transitions, invalid transitions, tenant isolation, RBAC denial, audit logs, persistence) — all pass

### Run

```bash
cd backend && npx vitest run tests/purchase-order-lifecycle.test.ts
cd backend && npm run typecheck
cd frontend && npm run typecheck
```

---

## 2026-07-20 — PR line PO track (read-only)

### Shipped

- **Schema** — `purchase_requisition_lines.purchaseOrderId` + `purchaseOrderNumberSnapshot` (`20260720170000_pr_line_purchase_order_track`)
- **Write-back** — Planning→PO and RFQ award→PO stamp lines via `linkPurchaseRequisitionLinesToOrder` (status `CONVERTED`, id + number snapshot)
- **API** — PR line DTO exposes `purchaseOrderId` / `purchaseOrderNumber` (not accepted on create/update input)
- **UI** — PR lines grid **PO No.** column (link); converted lines locked (`rowEditable` when no PO)
- **Tests** — live coverage asserts stamp after RFQ→PO / Planning create-PO

### Run

```bash
cd frontend && npm run typecheck
cd backend && npm run test:purchase-phase15
```

---

## 2026-07-20 — Purchase UAT flow seed (interconnected docs)

### Shipped

- **Script** — `backend/scripts/seed-purchase-flow-uat.ts` (idempotent `UAT-*` docs)
- **Data** — 13 PR + 8 planning + 5 RFQ + 6 VQ + 2 comparisons + 6 PO; warehouses/items/vendors reused; mixed statuses for UI testing
- **GRN** — still no DB table (demo FE only)

### Run

```bash
cd backend
npx tsx scripts/seed-purchase-demo-data.ts
npx tsx scripts/seed-purchase-flow-uat.ts
```

---

## 2026-07-20 — PR line → PO track record

### Shipped

- **Schema** — `purchase_requisition_lines.purchaseOrderId` + `purchaseOrderNumberSnapshot` (migration `20260720170000_pr_line_purchase_order_track`); line status set to `CONVERTED` on PO create
- **Backend** — Planning→PO and RFQ award→PO stamp PR lines automatically; RFQ→PO also sets `purchaseRequisitionLineId` on PO lines; API PR line DTO exposes `purchaseOrderId` / `purchaseOrderNumber`
- **Frontend** — PR line grid shows read-only **PO No.** (link when id present); demo create-PO paths stamp the same fields; mapper hydrates from API
- **Tests** — Phase 15 integration + coverage assert PR lines carry PO id/number after create-PO

### Run

```bash
cd backend && npx tsx scripts/prisma-cli.ts migrate deploy && npx prisma generate
cd backend && npm run test:purchase-phase15-live
cd frontend && npm run typecheck
```

---

## 2026-07-20 — Purchase typecheck fix + coverage gap tests

### Shipped

- **FE typecheck** — Planning Sheet `chipLabelResolver` + `defaults`; `LoadingState` props; unused imports; removed orphan Vitest file; `binCode` master usage guard
- **Create-PO conflicts** — map Prisma `P2034`/`P2028` to purchase `PO_ALREADY_CONVERTED` / global 409; concurrent loser no longer raw 500
- **Document numbers** — `nextPurchaseDocumentNumber` fallback for RFQ/VQ/comparison/PO when code-series enum not yet migrated
- **Comparison duplicate PO** — check existing PO before award-status gate (stable **409**)
- **Live coverage** — `tests/purchase-module-coverage.test.ts` (cross-tenant GET, double-approve idempotency, RFQ→award→PO, concurrent create-PO)
- **DB** — deployed `20260720160000_rfq_flow_award_fields` on local MySQL (additive)

### Run

```bash
cd frontend && npm run typecheck && npm run test:purchase-phase15-all
cd backend && npm run test:purchase-phase15 && npm run test:purchase-phase15-live
```

---

## 2026-07-20 — Purchase Phase 16 final QA

### Shipped

- **QA report only** — [`docs/purchase/PHASE_16_FINAL_QA_REPORT.md`](purchase/PHASE_16_FINAL_QA_REPORT.md) (no product features)
- **Verified** — RFQ vs Planning split, idempotent sync, vendor-grouped create-PO, tenant/RBAC, additive migrations, Phase 15 suites
- **Failed** — frontend `npm run typecheck`; claim that all Purchase pages are API-backed / free of FE memory
- **Go-live** — not full-module go-live; blockers listed in Phase 16 report

### Run

```bash
cd backend && npx tsx scripts/prisma-cli.ts validate && npx tsc --noEmit && npm run test:purchase-phase15
cd backend && npx vitest run tests/purchase-phase15-integration.test.ts --hookTimeout=120000
cd frontend && npm run test:purchase-phase15-all && npm run typecheck
```

---

## 2026-07-20 — Purchase Phase 15 automated tests

### Shipped

- **Create PO from Planning API** — `POST /purchase/planning-sheet/create-po` (vendor grouping, PR conversion status, concurrent guard, RFQ-required blocked)
- **Backend unit** — `purchase-phase15-unit.test.ts` + existing workflow/catalog/RBAC/RFQ/audit suites (`npm run test:purchase-phase15` → **29** tests)
- **Backend integration** — `purchase-phase15-integration.test.ts` covers Phase 15 items 1–17 (skip without MySQL)
- **Frontend** — `scripts/test-purchase-phase15.ts` (PR validation, helpers, Planning UI gates, error map)
- **E2E A/B (demo)** — `smoke-purchase-phase15-e2e-a.ts` (direct → Planning → POs), `smoke-purchase-phase15-e2e-b.ts` (RFQ → award → PO)

### Run

```bash
cd backend && npm run test:purchase-phase15 && npm run test:purchase-phase15-live
cd frontend && npm run test:purchase-phase15-all
```

---

## 2026-07-20 — Purchase Phase 14 validation and error messages


### Shipped

- **Stable codes + catalog** — `purchase/shared/purchase-error-catalog.ts` (`PR_*` / `PPS_*` / `PO_*`) with business copy; Phase 02 §12 expanded
- **PR workflow** — submit enforces department, requested by, dates, RFQ selection, ≥1 item, item/qty/UOM, date order; submitted → `PR_NOT_EDITABLE`; approved → `PR_MUST_REOPEN` (reopen allowed from approved)
- **Planning PO guards** — `assertPlanningRowReadyForPo` (vendor, net qty, rate, required date, eligible status, cancelled/converted/RFQ/tenant/active masters)
- **Error middleware** — Prisma/FK/SQL/stack never returned to clients; technical detail logged server-side
- **Frontend** — `utils/purchase/purchaseErrorMessages.ts` + `formatPurchaseApiError` / `PurchaseServiceError` map codes to friendly toasts; PR form validation copy aligned
- **Tests** — workflow + catalog unit tests updated; lifecycle expectations use new codes

### Remaining

- Wire Create-PO-from-Planning HTTP API to `assertPlanningRowReadyForPo` when that endpoint ships
- Live MySQL lifecycle re-run after UOM seed helper (when DB available)

---

## 2026-07-20 — Purchase Phase 13 audit logs and timeline


### Shipped

- **Canonical audit helper** — `purchase/shared/purchase-audit.ts` with `PR_*` / `PPS_*` / `RFQ_*` / `PO_*` actions, `writePurchaseAudit`, timeline entity map
- **Write-side** — PR (incl. line add/update/remove + RFQ decision), Planning (generate/buyer/vendor/rate/qty/status/hold/cancel), RFQ/VQ/comparison dual-write, PO create from award
- **Read API** — `GET /purchase/timeline/:entityType/:entityId` merges `AuditLog` + `PurchaseStatusHistory` (RFQ also includes linked VQ/comparison audits)
- **UI** — `PurchaseAuditTimeline` (CRM-style vertical feed) on PR View, Planning Row View, RFQ View, PO View
- **Tests** — `purchase-audit-timeline.test.ts` (labels + entity map)

### Remaining

- Live MySQL integration asserting timeline rows after PR submit/approve
- Full PO lifecycle audits when PO module APIs ship (submit/approve/send/receive/close)

---

### Shipped

- **Catalog** — renamed to `purchase.pr.*`, expanded `purchase.planning.*` (`assign_buyer`, `select_vendor`, `cancel`), RFQ (`enter_quote`, `compare`, `award`, `convert_to_po`), PO (`purchase.po.*` with `send` / `close`)
- **Role packs** — Requester, Department Manager (+ Department Head alias), Purchase Executive, Purchase Manager, Administrator; seed creates these roles
- **Backend routes** — all purchase routes use canonical keys; legacy JWT/DB names still authorize via `permissionSetIncludes` aliases
- **Audit** — `requirePermission` / `requireAnyPermission` / `requireSuperAdmin` write `PERMISSION_DENIED` audit logs (module `rbac`)
- **Frontend** — `utils/permissions/purchase.ts` + demo admin seed + UI call sites aligned; button hide remains supplementary

### Verify

- `npx vitest run tests/purchase-rbac-permissions.test.ts` — alias checks
- Re-seed or upsert permissions so new catalog rows exist in MySQL

### Remaining

- Live integration test asserting 403 + audit row for missing purchase permission
- Optional: migrate/remove orphaned legacy permission rows in DB

---

### Shipped

- **Frontend bridge** — `purchaseApiFacade` dual-mode for RFQ list/create/update/send/cancel, PR→RFQ convert, vendor quotations CRUD/submit, comparison build/selection/award, and award→draft PO
- **Mappers** — `mapApiRfqToDomain`, VQ + comparison matrix mappers in `purchaseMappers.ts`; `comparisonApi.ts` client
- **UI** — Quotation Comparison award passes vendor + selection reason into API award endpoint
- **Tests** — `purchase-rfq-workflow.test.ts` (2/2) for PR eligibility + draft send guards
- **Rule preserved** — `rfqRequired=true` never syncs to Planning Sheet (backend + demo)

### Remaining

- Live MySQL integration tests for RFQ→VQ→award→PO
- Enrich vendor/item display names from masters in API mode
- Create PO from planning selection; full PO lifecycle / GRN

---

## 2026-07-20 — Purchase RFQ vendor quotation and comparison/award APIs

### Shipped

- **Vendor quotations** — list/create/get/draft update/submit under `/purchase/vendor-quotations`; validates RFQ vendor membership and active RFQ state, calculates landed cost on submit, advances a SENT RFQ to `QUOTATION_RECEIVED`, and writes status history/audit records.
- **Comparisons** — list/get/build from submitted quotations, vendor-wise comparison matrix, award workflow, and comparison-to-draft-PO conversion under `/purchase/comparisons`.
- **PR handoff** — `POST /purchase/requisitions/:id/convert-to-rfq` now invokes the RFQ service with the RFQ create permission.
- **Verification** — regenerated Prisma client and `npx tsc --noEmit -p tsconfig.json` passes.

### Remaining

- Add focused Vendor Quotation / Comparison integration tests with a live MySQL test database and wire the frontend API bridge to these completed endpoints.

---

## 2026-07-20 — Purchase FE dual-mode API integration (PR + Planning)

### Shipped

- **API clients** — `purchaseRequisitionApi.ts`, `purchasePlanningApi.ts`, `rfqApi.ts`, `vendorQuotationApi.ts`, `purchaseOrderApi.ts` + `purchaseApiTypes.ts`
- **Mappers / facade** — `purchaseMappers.ts`, `purchaseApiFacade.ts`; barrel `services/purchase/index.ts` routes PR + Planning through dual-mode when `VITE_USE_API=true`
- **Backend source of truth (API mode)** — PR CRUD/submit/approve/reject/cancel; planning list/edit/buyer/vendor/status/recalculate; approval waits for server (planning sync); no optimistic PO/approval
- **Permissions** — FE catalog + route/nav gates for `purchase.planning.view|edit|approve|create_po`
- **Planning UI** — recalculate action, Create PO permission gate, refetch after mutations
- **RFQ / VQ / PO clients** — ready against expected paths; API mode surfaces `PURCHASE_API_NOT_IMPLEMENTED` until backends ship (demo mode unchanged)

### Verify

- Dual-mode facade + mappers compile (no errors in those files under `tsc -b`)
- Demo mode (`VITE_USE_API=false`) still uses in-memory `purchaseService`

### Next

- Ship Create-PO-from-planning + RFQ/VQ/PO backends; complete domain mappers for those DTOs
- Optional: page-level hydrate hook / summary KPI strip on Planning Sheet

---

## 2026-07-20 — Purchase Planning Sheet backend APIs

### Shipped

- **Permissions** — `purchase.planning.view|edit|approve|create_po`
- **APIs** under `/api/v1/t/:tenantSlug/purchase/planning-sheet` (+ tenantId alias):
  - `GET /` (filters: search, planningNumber, PR number, status, dept, item, vendor, buyer, priority, purchaseType, date ranges, overdue, poPending, page/pageSize, sort)
  - `GET /summary` (pending, critical, overdue, vendor pending, po pending/created, estimated value)
  - `GET|PATCH /:id` (editable vendor/rates/dates/type/buyer/priority/actionMessage/remarks/status; PR/item/qty/stock/PO refs read-only)
  - `POST /bulk-assign-buyer`, `/bulk-select-vendor`, `/bulk-status`, `/recalculate`
- **Rules** — tenant filter, RBAC, status transition matrix, audit + status history; recalculate batches open-PO qty (stock stub = 0 until inventory)
- **Tests** — workflow 5/5; API integration 4/4

### Next

- Create PO from planning selection (`purchase.planning.create_po`)
- FE dual-mode bridge for planning sheet

---

## 2026-07-20 — Purchase Requisition backend (PR lifecycle + planning sync)

### Shipped

- **Code series** — `CodeSeriesEntity` + `PURCHASE_REQUISITION` / `PURCHASE_PLANNING` (migration `20260720130000_add_purchase_code_series_entities`); prefixes `PR` / `PPS`
- **Module** `backend/src/modules/purchase/` — routes under `/api/v1/t/:tenantSlug/purchase` and `/api/v1/tenants/:tenantId/purchase`
- **PR APIs** — list/create/get/patch + submit / approve / reject / cancel / reopen
- **Rules** — draft-only edit; ≥1 valid line + qty>0 to submit; requiredDate ≥ requisitionDate; reject requires reason; approve permission-gated; tenantId on every query; audit + status history on lifecycle
- **Approve path** — `rfqRequired=true` → no PPS rows (RFQ-ready); `rfqRequired=false` → `syncPurchasePlanningRowsFromApprovedPr` in same TX
- **Error codes** — `PURCHASE_REQUISITION_NOT_FOUND|NOT_EDITABLE|NOT_SUBMITTABLE|NOT_APPROVABLE`, `REJECTION_REASON_REQUIRED`, `INVALID_PURCHASE_QUANTITY`; global `PERMISSION_DENIED` / `TENANT_ACCESS_DENIED`
- **Tests** — workflow unit 8/8; lifecycle integration 5/5

### Not in scope

- Planning Sheet CRUD APIs, RFQ/VQ/PO backends, FE API bridge for purchase

### Verify

- `migrate deploy` + `prisma generate` + `tsc --noEmit` — pass
- `vitest run tests/purchase-requisition-*.test.ts` — **13/13**

### Next

- Purchase Planning Sheet list/update + Create PO from planning
- Optional: dual-mode FE bridge for PR when `VITE_USE_API=true`

---

## 2026-07-21 - CRM route source audit (old UI string trace)

### Verdict

Production `/crm/leads` already rendered the **canonical** CRM stack. Visible
strings map to current enterprise components — not a stale duplicate page:

| String | Source file | Component | On `/crm/leads`? |
|--------|-------------|-----------|------------------|
| Quick Entry | `ErpQuickEntrySection.tsx` / `CrmLeadFormPage.tsx` | form FastTab | No (form/360 only) |
| Smart Context | `ErpCardFormPage` / 360 pages | fact box | No (form/360 only) |
| Create Lead | **not in source** | — | — |
| Lead Information | **not in source** | — | — |
| Change Stage | `LeadChangeStageControl.tsx` | Lead 360 | No (detail only) |
| Notes | `CrmStageNotes` / form sections | 360 + form | No (detail/form) |

List route chain: `crmRoutes` → `LeadListPage` → `CrmLeadListPage` →
`CrmLeadsTable`. Detail: `Lead360Workspace`. Form: `CrmLeadFormPage`.

### Fixes (indirection / alias only)

- `crmRoutes` imports Lead list/form/360 from CRM modules (no `SalesPages`
  lead wrappers).
- Removed `LeadDetailPage` / `LeadListPage` re-exports from `SalesPages`.
- `/crm/companies` mounts `CrmCustomersPage`; `/crm/customers` redirects.
- CRM barrel exports `LeadListPage` / `LeadFormPage`.

No business-rule, permission, or API contract changes.

---

### Follow-up from audits

- Overlay hardening: `erp-modal` z-index 320 above drawers (200); confirm 420;
  `CrmDeleteConfirmModal` + `SaveViewDialog` Escape / body lock / backdrop /
  labelled dialog; `CrmDrawerShell` `closeDisabled` + unique title id.
- Contact Save chrome: footer-only (`ErpStickySaveBar`); removed duplicate
  header `formSaveActions`.
- Lifecycle RBAC AND’d with status: quotation update/approve perms; Opp Won/Lost
  + move-to-won/lost → `crm.opportunity.close`; SO Confirm →
  `crm.sales_order.confirm`; Complete Activity on Lead360 + Quotation360 feeds.
- QA: wired orphan scripts + `test:crm-a11y` / `test:crm-form-alignment` into
  package.json and CRM freeze ([Audit CRM QA coverage](aa63249d-73d7-4b2e-a7cf-e2913677596c)).

### Still deferred

- Full Opp Edit → Quick Entry mirror; native Select → ErpSmartSelect sweep;
  DocumentTypeSelect extract; full focus-trap / arrow-key menus.

---

## 2026-07-21 - CRM form / overlay / workflow alignment pass

### Audit (keep working)

- Shared form stack already correct for responsive grids: `ErpFormGrid`
  desktop 3 → tablet 2 → mobile 1; CRM page forms use `CrmCardFormShell` +
  `erp-input` heights. No redesign of working Lead/Opp/Quote/SO shells.
- Masters catalog is centralized via `useCrmMasters` / `CrmMasterPages`
  ([Audit CRM masters reuse](4a1d7172-0830-49e6-b54f-ff95cf696a0e)).

### Minimum safe fixes shipped

- **Lead RBAC:** qualify stages need `crm.lead.qualify`; convert needs
  `crm.lead.convert` (`resolveLeadConvertActionGate`, Lead360, list row
  actions, OpportunityNew lead-path, `LeadChangeStageControl`).
- **Companies / Contacts registers:** pass `canEdit` permissions; contacts
  New/Duplicate → `/crm/contacts/new`; company Edit → masters edit; remove
  miswired Assign/Duplicate row actions.
- **CRM masters:** New / Import / Edit / Duplicate / Delete / bulk gated on
  `crm.master.*`.
- **Quick create parity:** `NewContactDrawer` uses `buildContactSchema`;
  `QuickCompanyCreateModal` industry/territory from CRM masters.
- **Quotation lifecycle UX:** ApprovalPanel await + toasts + approve perm;
  Customer Reject on Quote 360; hide Recall in API mode; Convert card
  fallback navigates to SO create when no dialog host.
- **Overlay a11y:** drawer initial focus; Modal `aria-modal` + labelled title.

### Verification

- Frontend `npm run typecheck` — pass after alignment edits.

---

## 2026-07-21 - CRM Lead→SO funnel hardening

### Shipped

- Quotation generic PATCH can no longer set lifecycle fields (`status`,
  `customerApproval` on header; `status` on document). Sanitizers in
  `quotation.workflow.ts` throw `ValidationError` (400); wired from
  `updateQuotation` / `updateQuotationDocument`.
- Live E2E: PATCH lifecycle rejection; confirm after convert-created SO;
  continuous Lead→Opp→Quote→mark-sent→customer-approve→convert→confirm +
  duplicate convert **409**. Draft-delete case no longer reuses an opportunity
  that already has a quotation.
- UAT-06 live path: mark-sent + customer-approve before convert; duplicate
  convert expectation **422 → 409**.
- Funnel toasts: Lead 360 convert gates use `notify.warning`; SO 360 confirm
  success/errors use `notify.success` / `notify.error`.

### Verification

- Backend `npm run typecheck` — pass.
- Frontend `npm run typecheck` — pass.
- `npm run test:crm-live` — **55 passed / 3 failed**. New funnel cases all
  passed (`rejects lifecycle fields on quotation PATCH`,
  `confirms convert-created sales order…`, continuous Lead→…→confirm funnel,
  duplicate 409, draft delete). Remaining failures are **local DB env**, not
  this change: missing `crm_notes.stageCode` column (migration not applied),
  empty locations seed.
- `npm run test:uat-06-sales-order` — demo path hits pre-existing `@/utils`
  resolution under `tsx`; live 409/sent/customer-approve code path updated in
  script. Static UAT-06.3 string check also pre-existing vs current convert
  action copy.

---

## 2026-07-21 - Hostinger Git deployment now builds and publishes the SPA

### Root cause

- Hostinger pulled `main`, but repository-root `npm run build` called a missing
  `build.ps1`. `frontend/dist` is intentionally ignored, so Git could not update
  nginx/Express static files by pull alone.
- The only GitHub workflow was under `frontend/.github/workflows`, which GitHub
  does not discover. Live therefore kept the July 17 Vite hash while API/DB
  changes could update independently.

### Shipped

- Root `npm run build` now runs cross-platform
  `scripts/build-hostinger.mjs`: deterministic frontend/backend installs, API-mode
  Vite build, Prisma generation/backend compile, then publish to
  ignored `backend/public` only after both builds succeed.
- `backend/hostinger-start.mjs` makes `backend/` a self-contained Hostinger
  output directory, starts the compiled backend from the correct working
  directory, and refuses startup when backend or SPA output is missing.
- `scripts/verify-hostinger-build.mjs` verifies copied asset hashes and
  `build-meta.json` revision parity.
- CI moved to repository-root `.github/workflows/ci.yml` and executes the same
  Hostinger build/verification path.
- Added `docs/HOSTINGER_GIT_DEPLOYMENT.md` with exact hPanel configuration.

### Verification

- Root `npm run build` passed: Vite production build + Prisma generate + backend
  TypeScript compile; published 16 referenced assets.
- `npm run verify:deployment` passed for revision
  `38f8d4ae4478e6571848dd66c280a04454156fa6`.
- Production-entry smoke test passed on port 5051:
  `/api/v1/health` returned JSON 200 and `/build-meta.json` returned the same
  revision. Generated `frontend/dist` and `backend/public` remain ignored.
- Live hPanel build settings/redeploy are still required before declaring
  production updated.

---

## 2026-07-21 - Quotation template catalog trimmed to the two VF ISO products

### Context

- User supplied the two real VF quotation docs (VF/QUO/26-27/76 → 26 KL ISO Tank Container; VF/QUO/26-27/109 → 20' ISO Dry Bulk Tanker 25 CBM). Frontend `DEFAULT_QUOTATION_TEMPLATES` and `prisma/quotationTemplateSeedData.ts` already contain exactly these two — but the DB still carried 9 legacy trailer templates (Standard/45M3 Bulker/Sidewall/Flatbed/Lowbed/Tipper/Job Work/Spare Parts/Custom) from the old seed.

### Shipped

- **New** `backend/scripts/cleanup-quotation-templates.ts` — per-tenant, idempotent: soft-deletes (deletedAt + isActive=0) every template whose code is not `ISO-TANK-26KL` / `ISO-DRY-BULK-25CBM`, then upserts/restores the two keep rows from `quotationTemplateSeedData`. `--dry-run` reports only; `--emit-sql` writes `scripts/quotation-template-cleanup.sql` (phpMyAdmin-ready, backslash + quote escaped JSON) for the live DB without SSH.
- **Applied on local DB:** 9 legacy templates soft-deleted; ISO-DRY-BULK-25CBM created (was missing). Verified list repo filters `tenantActiveFilter` → only the two ISO templates are served. Quotations referencing old templates are untouched (soft delete, catalog-only).
- Frontend demo mode already correct: `RETIRED_BUILTIN_QUOTATION_TEMPLATE_IDS` drops the same 9 on merge.

### Live fix (no terminal): run `backend/scripts/quotation-template-cleanup.sql` in phpMyAdmin, then hard-refresh the templates page.

---

## 2026-07-21 - Canonical CrmStageNotes component (replaces 3 duplicated notes cards)

### Shipped

- **New** `frontend/src/components/crm/shared/CrmStageNotes.tsx` — single canonical stage-stamped Notes card for CRM 360 pages. Props: `entityType`/`entityId` (useEntityNotes), `sectionId` (preserves `lead-section-notes` / `opp-section-notes` / `quo-section-notes` jump anchors), `stageOptions`, `currentStage`, `historyLabel`, plus the shared demo/composer/onNotesChange contract. Reuses existing `lead-notes-card` CSS — zero visual change vs the correct local design.
- **New** `frontend/src/utils/crmNoteStageOptions.ts` — `LEAD_NOTE_STAGE_OPTIONS`, `OPPORTUNITY_NOTE_STAGE_OPTIONS`, `QUOTATION_NOTE_STAGE_OPTIONS`, `quotationNoteStageLabel` (moved out of the deleted QuotationNotesCard; Quotation360Page unified-feed import updated).
- **Deleted** `LeadNotesCard.tsx`, `OpportunityNotesCard.tsx`, `QuotationNotesCard.tsx`; removed the `QuotationNotesCard` barrel export. Rewired `Lead360Workspace`, `Opportunity360Page`, `Quotation360Page` to render `CrmStageNotes`. No other consumers existed (verified by search). Contact/Customer 360 keep `EntityNotesPanel` (no stage workflow).
- Demo mode preserved: demoNotes list + editPath fallback behave exactly as before.

### Verification

- `typecheck` clean; `npm run build` clean; oxlint clean on changed files.
- Bundle proof of consolidation: `dist/assets/index-j7v20-mn.js` contains exactly **one** copy of the Notes-card strings ("No notes yet. Add the first note…", `lead-notes-card__composer`) — previously three duplicated components.
- `npm run test:crm` fails at startup with a **pre-existing** tsx alias error (`Cannot find package '@/utils'` from `permissions/manufacturing.ts`) — verified identical failure with all changes stashed; unrelated to this refactor.

### Live deploy

- Live still serves old `assets/index-DeT-0V6R.js`. Upload the new `frontend/dist/` (index.html + assets) to Hostinger public_html, hard-refresh, and confirm index.html now references `index-j7v20-mn.js`.

---

## 2026-07-21 - Live Convert Quotation → SO blocked: stale permission catalog on live DB

### Diagnosis

- `POST /:id/convert-to-sales-order` (backend `quotation.routes.ts`) requires **both** `crm.quotation.convert` and `crm.sales_order.create` (`requirePermission` is all-of). Frontend gate `canConvertQuotationToSalesOrderPermission()` requires the same pair, so the Convert button/action reports "You do not have permission".
- Live DB catalog only has the pre-convert-era CRM keys (`crm.quotation.view/create/update/delete/approve`, `crm.sales_order.view`, `crm.lead.convert`) — neither `crm.quotation.convert` nor `crm.sales_order.create/update/delete/confirm` exists there. Same RBAC seed-drift class as the Notes issue below: the live DB was seeded from the old catalog (old deploy bundle gated convert on `crm.quotation.update` only), then the new backend shipped with the expanded catalog but no permission sync was run.
- Code side is already complete: both keys are in `backend/src/constants/permissions.ts` PERMISSIONS and mapped in ROLE_PERMISSIONS (Tenant Admin/Admin/Administrator, Sales Manager, Sales Executive, CRM Admin). No code changes needed; no RBAC bypass.

### Live fix (idempotent, no code deploy needed if backend is current)

**Option A — server terminal available:** from `backend/`: `npx tsx scripts/sync-permissions.ts --dry-run`, review, then re-run without `--dry-run` (upsert-only; never removes grants or touches users/tenants).

**Option B — no SSH/terminal (phpMyAdmin only):** new generator `backend/scripts/generate-permission-sync-sql.ts` emits `backend/scripts/permission-sync.sql` — a self-contained idempotent script (INSERT IGNORE against `permissions.name` and `role_permissions.roleId+permissionId` unique keys) mirroring the same PERMISSIONS/ROLE_PERMISSIONS source of truth. Import/paste it into phpMyAdmin on the live DB. Validated locally: all 244 statements execute cleanly and re-running is a 0-row no-op. Regenerate after any catalog/role-map change.

Then in both cases:
1. Users log out / log in (frontend session permissions are issued at login; backend checks read the DB per request and take effect immediately).
2. Verify: `fos-erp-auth` → `user.permissions` includes both keys; Convert to Sales Order on a Sent + Customer Approved quotation creates an Open SO and marks the opportunity Won.
3. SQL spot-check: `SELECT name FROM permissions WHERE name IN ('crm.quotation.convert','crm.sales_order.create');` and per-role link counts via `role_permissions` join.

Local DB verified in sync (224/224 catalog; applied 3 pending `crm.note.*` links for Sales Executive from the entry below).

---

## 2026-07-21 - Live Notes still looks old after Hostinger SPA redeploy

### Diagnosis

- Live already serves a SPA that includes the new Notes card (`lead-notes-card` + `crm.note.create` present in `https://erp.dhurandharcrm.com/assets/index-DeT-0V6R.js`). Rebuild succeeded — this is not a “missing frontend upload” problem anymore.
- In API mode, Add Note only opens the new inline composer when the session has `crm.note.create`. Without it, the UI used to navigate to the record **edit** page (legacy remarks) — which looks like the previous Notes design.
- `Sales Executive` had no `crm.note.*` grants in `ROLE_PERMISSIONS` (same RBAC seed-drift class as Convert → SO).

### Shipped

- Grant `crm.note.view` / `create` / `update` to Sales Executive.
- Lead / Opportunity / Quotation Notes cards: missing `crm.note.create` now shows a clear permission toast instead of silently opening the edit form.

### Live fix

1. Deploy these code changes (or at least run permissions sync with updated role map).
2. On Hostinger app: `npm run db:sync-permissions`
3. Log out / log in; hard refresh.
4. Confirm `fos-erp-auth` → `user.permissions` includes `crm.note.create`.
5. Add Note should open Note type + Stage composer on the 360 page.

---

## 2026-07-18 - Finance Phase 3C5: Atomic Credit Note Allocation

### Shipped (subledger allocation only — no GL / voucher / PostingEvent / number series)

- **Migration** `20260718130000_finance_phase3c5_credit_note_allocations` — 6 allocation totals columns on `customer_credit_notes` (`allocatableAmount`/`allocatedAmount`/`unallocatedAmount` + base) + new `CustomerCreditNoteAllocationBatch` / `CustomerCreditNoteAllocation` tables (own enums `CustomerCreditNoteAllocationStatus` / `CustomerCreditNoteAllocationBatchStatus`; new relation names `CreditNoteCreditOpenItem` / `CreditNoteInvoiceDebitOpenItem` / `CreditNoteCreditAllocationBatch` on `ReceivableOpenItem` — distinct from the 3B5 receipt relations)
- **Module** `receivables/credit-notes/allocations/` — preview, atomic allocate (idempotent batch), credit-note/invoice history — mirrors `receivables/allocations/` (3B5) exactly, reusing `applyDebitAllocation` / `applyCreditAllocation` from `receivable-open-item.repository.ts`
- **APIs:**
  - `POST …/credit-notes/:creditNoteId/allocations/preview` (`finance.ar.allocation.view`)
  - `POST …/credit-notes/:creditNoteId/allocations` (`finance.ar.allocation.create` + `Idempotency-Key`)
  - `GET …/credit-notes/:creditNoteId/allocations` / reuses `GET …/invoices/:invoiceId/allocations`
  - Reused permissions only — no new `credit_note.allocate` permission
- **Posting hook:** `customer-credit-note-posting.service.ts` now seeds `allocatableAmount = allocatedAmount = 0` / `unallocatedAmount = grandTotal` (+ base) when a CN posts
- **Repository helper:** `customer-credit-note.repository.ts` — `updateCreditNoteAfterAllocation` (conditional/optimistic, mirrors `updateReceiptAfterAllocation`)
- **Allowed actions:** `customer-credit-note-allowed-actions.ts` — `allocate` when `POSTED` + `unallocatedAmount > 0` + `finance.ar.allocation.create`; `viewAllocations` when `POSTED` + `finance.ar.allocation.view`; `reverse: false`
- **Unified read APIs (shared with receipts):**
  - `listCustomerCredits` — now also returns `CUSTOMER_CREDIT_NOTE` CREDIT open items alongside `CUSTOMER_RECEIPT`; each row carries `sourceType` + (`receiptId`/`receiptNumber`) or (`creditNoteId`/`creditNoteNumber`)
  - `listAllocationsForInvoice` — merges receipt-sourced and credit-note-sourced allocation rows (sorted by date), each tagged with `sourceType`
- **Bug fix (uncovered by new reconciliation test):** `receivable-reconciliation.service.ts` `CONTROL_ACCOUNT_MANUAL_POSTING` check was missing `CUSTOMER_CREDIT_NOTE` from the allowed `sourceDocumentType` list, so any tenant with a posted credit note falsely failed reconciliation — fixed by adding it alongside `SALES_INVOICE` / `CUSTOMER_RECEIPT`
- **Tests:** `finance-ar-credit-note-allocation.test.ts` (new, 11 cases) — full/partial settlement, multi-invoice from one CN, multiple CNs against one invoice, multiple batches on one CN, unallocated CN stays a customer advance, over-allocation/empty/zero rejection, cross-customer rejection, idempotent replay, permission boundary (`credit_note.post` alone insufficient), invoice outstanding unchanged until allocation + reconciliation MATCHED

### Not in scope

- Allocation reversal, credit-note reversal, forex GL, frontend allocation screens (Phase 3C6), inventory return/refund

### Verify

- `npx prisma generate` + `npx tsx scripts/prisma-cli.ts migrate deploy` — pass
- `npx tsc --noEmit -p tsconfig.json` — pass
- `npx vitest run tests/finance/finance-ar-credit-note-allocation.test.ts` — **11/11**
- Regression: `finance-ar-credit-note-posting`, `finance-ar-credit-note-foundation`, `finance-ar-receipt-allocation`, `finance-ar-reporting`, `finance-ar-receipt-drafts` — all pass; `finance-ar-receipt-posting` — 11/12 (one pre-existing Phase 3B4 expectation, documented in the 3C1-3C4 entry below, still asserts posted receipts cannot allocate — unrelated to this phase)

### Next

- **Phase 3C6** — Credit note workspace UI (create/edit/validate/post/allocate/history)

---

## 2026-07-18 - Finance Phase 3C1-3C4: Customer Credit Notes

### Shipped

- Customer credit-note Prisma foundation, MySQL migration, tenant-scoped reasons, invoice-linked adjustment lines, approval state, posting links, and CREDIT open-item relation.
- Draft create/update/list/detail/validate/mark-ready/cancel plus minimal submit/approve/reject workflow.
- Proportional invoice GST reversal for full-line, quantity, value, rate, tax-only, and full-invoice adjustment modes with posted-credit over-claim checks.
- Atomic posting through the central posting engine: CREDIT_NOTE voucher, GL, CUSTOMER_CREDIT_NOTE number, PostingEvent, and CREDIT receivable open item.
- Invoice debit open item and invoice outstanding remain unchanged. Allocation, inventory return, refunds, reversal, and frontend pages remain deferred.

### Verification

- `npx prisma format` + `npx prisma generate` — pass.
- `npx tsx scripts/prisma-cli.ts migrate deploy` — migration applied to local MySQL.
- `npx tsc --noEmit` — pass.
- Focused credit-note tests — **8/8 pass** (calculation, atomic post, idempotency, unchanged invoice outstanding, over-credit, status, concurrency, permission boundary).
- Full finance suite — **232/233 pass**; one pre-existing Phase 3B4 expectation still asserts posted receipts cannot allocate, while Phase 3B5 now correctly enables allocation.

---

## 2026-07-18 - Finance Phase 3B5: Atomic Receipt Allocation

### Shipped (subledger allocation only ? no GL / voucher / PostingEvent / number series)

- **Migration** `20260718110000_finance_phase3b5_receipt_allocations` ? `CustomerReceiptAllocationBatch` + `batchId` / invoice outstanding snapshots on `CustomerReceiptAllocation` + `ReceivableOpenItem.settledAt`
- **Module** `receivables/allocations/` ? preview, atomic allocate (idempotent batch), receipt/invoice history, customer-credits list
- **APIs:**
  - `POST ?/receipts/:receiptId/allocations/preview` (`finance.ar.allocation.view`)
  - `POST ?/receipts/:receiptId/allocations` (`finance.ar.allocation.create` + `Idempotency-Key`)
  - `GET ?/receipts/:receiptId/allocations` / `GET ?/invoices/:invoiceId/allocations`
  - `GET ?/customer-credits` (`finance.ar.view`)
- **Reporting:** AR reconciliation subledger = debit ? credit open base; customer summary adds `debitOutstandingBase` / `creditOutstandingBase` / `netReceivableBase`; outstanding/ageing remain DEBIT-only
- **Allowed actions:** posted receipt `allocate` when credit outstanding > 0 + create perm; `viewAllocations` on receipt/invoice
- **Tests:** `finance-ar-receipt-allocation.test.ts` ? **11/11**

### Not in scope

- Allocation reversal, receipt reversal, cross-currency forex posting, frontend allocation screens (Phase 3B6)

### Verify

- `npx vitest run tests/finance/finance-ar-receipt-allocation.test.ts --hookTimeout=120000` ? **11/11**
- `npx tsc --noEmit` ? **PASS**

### Next

- **Phase 3B6** ? Receipt workspace UI (create/edit/validate/post/allocate/history)

---

## 2026-07-18 - Finance Phase 3B4: Atomic Customer Receipt Posting

### Shipped (backend atomic post to GL - mirrors sales invoice Phase 3A4; no allocation persistence)

- **`posting/posting-number.service.ts`** - `reserveSourceDocumentNumber` `documentType` widened to `'SALES_INVOICE' | 'CUSTOMER_RECEIPT'`
- **Module** `receivables/receipts/posting/` - new files mirroring `receivables/posting/`:
  - `customer-receipt-posting.types.ts` - `PostCustomerReceiptInput/Result`, `buildCustomerReceiptPostEventKey`
  - `customer-receipt-posting.schemas.ts` - empty-body Zod schema for `POST .../post`
  - `customer-receipt-posting.errors.ts` - `CustomerReceiptPosting*Error` classes + `mapPostingErrorToCustomerReceiptError`
  - `customer-receipt-accounting-builder.service.ts` - builds balanced `PostingRequest` (Dr bank/cash + TDS + bank charges + other deductions, Cr customer receivable)
  - `customer-receipt-number.service.ts` - `reserveCustomerReceiptNumber` wraps `reserveSourceDocumentNumber('CUSTOMER_RECEIPT', ...)`
  - `customer-receipt-posting-validation.service.ts` - re-validates status/amount-drift/deduction-sum/customer-active/posting-period/account-readiness before building the posting request
  - `customer-receipt-posting.service.ts` - orchestrates `post()` with `beforeTransaction` (reserve receipt number) + `afterAccounting` (create `CREDIT` `ReceivableOpenItem`, conditional `READY_TO_POST` -> `POSTED` update, audit log); idempotent replay when already `POSTED`
- **Wired into existing:**
  - `customer-receipt.controller.ts` / `.routes.ts` - `POST /:id/post` behind `finance.ar.receipt.post`
  - `customer-receipt-allowed-actions.ts` - `post: true` when `READY_TO_POST` + permission; `POSTED` -> `viewAccounting`/`viewCreditOpenItem: true`, `allocate`/`reverse: false`
  - `customer-receipt-read.service.ts` / `customer-receipt.types.ts` - detail response adds `creditOpenItem` summary + `ledgerEntryCount` once posted
  - `swagger.ts` - documents `POST /accounting/receivables/receipts/{id}/post`
- **Credit open item:** `side=CREDIT`, `documentType=CUSTOMER_RECEIPT`, `customerReceiptId`, `originalAmount=openAmount=grossReceiptAmount`, `allocatedAmount=0`, `status=OPEN`, `accountingVoucherId`, `receivableAccountId`, `dueDate=null`; `CustomerReceipt.creditOpenItemId` set on the same update
- **Tests:** `finance-ar-receipt-posting.test.ts` (new, 12 cases) mirroring `finance-ar-invoice-posting.test.ts` - happy/TDS/bank-charge/combined-deduction posts, credit-open-item assertions, idempotent replay, concurrent post, forced-fail-before-GL retry, DRAFT/POSTED guard rails, permission check, posted-immutability, no-allocation assertions
- **Fix to existing test** `finance-ar-receipt-drafts.test.ts` - `mark-ready` test's `allowedActions.post` expectation flipped `false` -> `true` (Phase 3B4 makes `post` available once `READY_TO_POST` + permission)

### Not in scope (deferred to Phase 3B5+)

- `CustomerReceiptAllocation` persistence, invoice open-item mutation, receipt reversal, frontend receipt pages/post action

### Verify

- `cd backend && npx vitest run tests/finance/finance-ar-receipt-posting.test.ts --hookTimeout=120000` -> **12/12**
- `cd backend && npx vitest run tests/finance --hookTimeout=120000` -> **218/218** (17 files; one unrelated `finance-journals.test.ts` MariaDB write-conflict flake seen on a mixed parallel run, reproduced green in isolation and on full-suite rerun)
- `cd backend && npm run typecheck` -> **PASS**
- `cd frontend && npm run typecheck` -> **PASS**

### Next

- **Phase 3B5** - `CustomerReceiptAllocation` persistence against invoice open items; then frontend Money In receipts tab (post action)

---

## 2026-07-18 ? Finance Phase 3B3: Customer Receipt Draft Workflow

### Shipped (backend draft CRUD + validate + mark-ready + cancel APIs ? no posting/GL/allocation persistence)

- **Migration** `20260718090000_finance_phase3b3_receipt_draft_fields` ? customer snapshot columns, `valueDate`, `calculationContext` JSON, TDS mode/value/base/section/certificate fields on `CustomerReceipt`; new `CustomerReceiptDeductionLine` table (`BANK_CHARGE`|`OTHER_DEDUCTION`) with per-line account id
- **Errors** `customer-receipt.errors.ts` ? 16 new draft-workflow error classes mirroring `SalesInvoice*Error`
- **Schemas** `customer-receipt.schemas.ts` ? create/update/cancel/validate/list Zod schemas; API field mapping `notes`?`internalRemarks`, `bankReference`?`customerBankReference`, `instrumentNumber`?`chequeNumber`, `instrumentDate`?`chequeDate`
- **Module** `receivables/receipts/` ? draft/read/validation services, allowed-actions (`post`/`allocate` always false), controller, routes
- **Repository** draft CRUD with `RCPT-DRAFT-YYYYMMDD-XXXXXX`, optimistic concurrency via `updatedAt`, READY?DRAFT on edit
- **Routes** under `/accounting/receivables/receipts` ? **no post/allocate routes**
- **Swagger** documents Phase 3B3 lifecycle; explicitly no posting/GL/number/open-item/allocation
- **Tests:** `finance-ar-receipt-drafts.test.ts` (12); finance suite **206/206**

### Not in scope (Phase 3B4+)

- Receipt posting, GL, PostingEvent, receipt number issuance, credit open items, allocation persistence, frontend receipt pages

### Verify

- migrate deploy + prisma generate ? applied
- backend typecheck ? pass
- finance vitest ? 206 passed
- frontend typecheck ? pass

### Next

- **Phase 3B4** ? atomic receipt posting (number + voucher + GL + credit open item)

---

## 2026-07-17 ? Finance Phase 3B2: Customer Receipt Calculation & Validation Preview

### Shipped (calculation + validation only ? no HTTP routes, no persistence)

- **Module** `receivables/receipts/calculation/` + `validation/` ? pure `calculateCustomerReceipt`, async `validateReceiptInput`
- **Amount formula:** Gross = Bank/Cash + Customer TDS + Bank Charges + Other Deductions; Allocatable = Gross
- **TDS:** NONE | AMOUNT | PERCENTAGE (user-supplied base; controlled rates 0/0.1/1/2/5/10; custom with warning)
- **Allocation preview:** combine duplicate open-item proposals; same-customer/currency; outstanding-after preview; no balance mutation
- **Posting preview:** balanced Dr Bank/TDS/Charges/Deductions / Cr Customer Receivable (party on credit line)
- **Account readiness:** bank/cash Account, CUSTOMER_RECEIVABLE / TDS_RECEIVABLE / BANK_CHARGES mappings, other-deduction accounts
- **Tests:** `finance-ar-receipt-calculation.test.ts` (19), `finance-ar-receipt-validation.test.ts` (19); finance suite **194/194**

### Not in scope (Phase 3B3+)

- Receipt draft create/update/list APIs, mark-ready, cancel, posting, number issuance, GL, open-item mutation, frontend receipt pages

### Verify

- `cd backend && npx vitest run tests/finance --hookTimeout=120000` ? 194 passed
- `cd backend && npm run typecheck` ? pass
- `cd frontend && npm run typecheck` ? pass

### Next

- **Phase 3B3** ? receipt draft CRUD + validate + mark-ready + cancel + list/detail APIs + audit

---

## 2026-07-17 ? Finance Phase 3B1: Customer Receipt & Allocation DB Foundation

### Shipped (backend DB + repos + validators ? no HTTP routes)

- **Migration** `20260717270000_finance_phase3b1_receipt_foundation` ? `CustomerReceipt`, `CustomerReceiptAllocation`, `ReceivableOpenItem.side` (DEBIT|CREDIT), `FinanceDocumentType.CUSTOMER_RECEIPT`, `ReceivableDocumentType.CUSTOMER_RECEIPT`
- **Architecture:** unified open items (no CustomerCreditOpenItem table); positive `openAmount`; bank/cash via `Account` (BANK|CASH); customer via CrmCompany UUID (no FK); reporting filters `side=DEBIT` only
- **Module** `receivables/receipts/` ? types, schemas, errors, find-only repos, ownership validators, open-item side invariants
- **Permissions:** `finance.ar.receipt.*`, `finance.ar.allocation.*` (Executive: view/create/edit/cancel receipts + view/create allocations; Manager: + post/reverse)
- **Reporting safety:** outstanding/reconciliation/overview subledger queries exclude CREDIT-side open items
- **Sales invoice posting:** explicitly sets `side: 'DEBIT'` on open item create
- **Tests:** `finance-ar-receipt-foundation.test.ts` (15 cases); full finance suite **156/156**

### Not in scope (by design ? Phase 3B2+)

- Receipt calculation, draft/post APIs, GL posting, allocation post/reverse services, HTTP routes, frontend pages

### Verify

- `npx tsx scripts/prisma-cli.ts migrate deploy` ? applied
- `cd backend && npx tsc --noEmit` ? pass
- `cd backend && npx vitest run tests/finance/ --hookTimeout=120000` ? 156 passed
- `cd frontend && npm run typecheck` ? pass

### Next

- **Phase 3B2** ? receipt calculation engine (gross/TDS/bank charge ? allocatable amounts)

---

## 2026-07-17 ? Finance Phase 3A6: Money In AR Frontend

### Shipped (frontend ? dual-mode demo + API)

- **Workspace** `/accounting/money-in/*` ? Overview, Invoices, Outstanding, Customers, Ageing, Reconciliation (no Receipts/Credit Notes tabs; footer ?Coming next? only)
- **Bridge** `receivablesApiBridge.ts` + `receivablesApi.ts` + `receivablesDemoStore.ts` ? invoice CRUD/validate/mark-ready/cancel/post + reporting endpoints
- **Permissions** `useMoneyInPermissions()` ? `finance.ar.*`; UI AND with server `allowedActions`
- **Pages:** overview KPIs + attention panel + ageing chart; invoice list/form/detail with RHF+Zod; reporting tables
- **Nav:** Accounting sidebar **Money In** ? `/accounting/money-in`; `/accounting/receivables` overview redirects to Money In; legacy receivables demo routes preserved
- **Tests:** `npm run test:money-in` (`scripts/verify-money-in.ts`) ? 20/20 UI + demo store smoke

### Not in scope (by design ? Phase 3B)

- Receipts, allocations, credit notes, collection actions

### Verify

- `cd frontend && npm run typecheck` ? pass
- `cd frontend && npm run build` ? pass
- `cd frontend && npm run test:money-in` ? 20 passed
- `cd backend && npx tsc --noEmit` ? pass

### Next

- **Phase 3B** ? customer receipts, allocation, credit notes

---

## 2026-07-17 ? Finance Phase 3A5: AR Reporting (Outstanding, Ageing, Reconciliation)

### Shipped (backend API ? read-only, no frontend pages)

- **Migration** `20260717260000_finance_phase3a5_ar_reporting_indexes` ? composite indexes on `ReceivableOpenItem` + GL `(tenantId, legalEntityId, accountId, postingDate)`
- **Module** `receivables/reporting/` ? outstanding list, ageing buckets, customer summary, overview, AR-to-GL reconciliation
- **HTTP (all GET, read-only):**
  - `/receivables/overview` ? `finance.ar.view`
  - `/receivables/outstanding`, `/ageing`, `/customers`, `/customers/:customerId`, `/customers/:customerId/open-items` ? `finance.ar.view`
  - `/receivables/reconciliation` ? `finance.ar.reconcile.view`
- **Rules:** default filter `openAmount > 0` + active statuses; `outstandingAmount` maps to `openAmount`; past `reportDate` allowed for ageing with `AGEING_USES_CURRENT_BALANCES`; reconciliation rejects historical `asOfDate`
- **Tests:** `finance-ar-reporting.test.ts` (10 cases); full finance suite **141/141**

### Not in scope (by design ? Phase 3A6+)

- Receipts, allocations, credit notes, collection actions, full frontend AR pages

### Next

- **Phase 3A6** ? AR frontend pages wired to reporting + invoice APIs

---

## 2026-07-17 ? Finance Phase 3A4: Atomic Sales Invoice Posting

### Shipped (backend API ? no frontend AR pages)

- **Migration** `20260717250000_finance_phase3a4_posting_event_source_number` ? `PostingEvent.sourceNumberSeriesId`, `reservedSourceDocumentNumber`, `sourceNumberReservedAt`
- **Posting engine extensions** ? optional `beforeTransaction` + `afterAccounting` hooks; `reserveSourceDocumentNumber()` for SALES_INVOICE series
- **AR posting module** `receivables/posting/` ? accounting builder, validation, coordinator; reuses Phase 2 `post()` engine
- **HTTP** `POST /accounting/receivables/invoices/:id/post` ? permission `finance.ar.invoice.post`; idempotent event key `SALES_INVOICE_POST:{invoiceId}:V1`
- **Atomic tx:** voucher + GL + `ReceivableOpenItem` + invoice POSTED + PostingEvent POSTED in one Prisma transaction
- **Tests:** `finance-ar-invoice-posting.test.ts` (9) ? happy path, GST shape, idempotent replay, permissions, concurrent post, partial-failure rollback
- **Docs/Swagger:** posting lifecycle in `API_CONVENTIONS.md`; allowedActions `post` + `viewAccounting`

### Not in scope (by design ? Phase 3A5+)

- Receipts, allocations, credit notes, ageing APIs, full frontend AR pages

### Next

- **Phase 3A5** ? outstanding list, ageing, AR subledger-to-GL reconciliation

---

## 2026-07-17 ? Finance Phase 3A3: Sales Invoice Draft Workflow

### Shipped (backend API ? no posting, no frontend)

- **Migration** `20260717240000_finance_phase3a3_ar_draft_fields` ? `postingDate`, commercial refs, freight/charges, customer snapshots, `calculationContext`, line `sourceLineId` + `grossAmount`
- **HTTP routes** `/accounting/receivables/invoices` ? create, update, validate, mark-ready, cancel, list, detail
- **Services:** draft/read/validation, sales-order source adapter, allowed-actions, optimistic `updatedAt` concurrency
- **Reuses:** Phase 3A2 `calculateSalesInvoice` + `validateSalesInvoiceDraft`, `requireActiveCustomerParty`
- **Tests:** `finance-ar-invoice-drafts.test.ts` ? live MySQL; critical no-accounting assertions after each action
- **Docs/Swagger:** AR draft lifecycle in `API_CONVENTIONS.md`; OpenAPI paths under Accounting Receivables / Sales Invoices

### Not in scope (by design ? Phase 3A4)

- Posting endpoint, invoice number issuance, PostingEvent/Voucher/GL/ReceivableOpenItem creation, FinanceNumberSeries consumption, frontend AR pages

### Next

- **Phase 3A4** ? Sales invoice posting to GL + open items + number series consumption

---

## 2026-07-17 ? Finance Phase 3A2: Sales Invoice Calculation Engine

### Shipped (backend only ? no HTTP routes, no posting)

- **Calculation engine** under `backend/src/modules/accounting/receivables/calculation/`:
  - `calculateSalesInvoice()` ? sync pure calculation (10-step order documented in orchestrator)
  - `validateSalesInvoiceDraft()` ? async side-effect-free preview (LE state, customer party, account/period readiness, MULTI_CURRENCY gate)
  - Taxable freight (`freightMode=TAXABLE`) and structured `otherCharges[]` with per-charge GST
- **Validation helpers** under `receivables/validation/` ? GSTIN, PAN, state code (01?38), HSN/SAC, account readiness, cost centre
- **finance-decimal.ts** ? `divide`, `min`, `max`, `roundQuantity` (6dp), `roundPercentage` (4dp), `roundTax` (4dp)
- **Schema:** optional `GST_OUTPUT_CESS` on `DefaultAccountMappingKey` ? migration `20260717230000_finance_phase3a2_gst_cess_mapping` (not mandatory for activation)
- **Tests:** `finance-ar-calculation.test.ts` (25), `finance-ar-gst-validation.test.ts` (8)

### Not in scope (by design)

- HTTP routes/controllers, SalesInvoice CRUD, GL posting, open-item creation, frontend AR pages

### Next

- **Phase 3A3** ? Create/Edit Draft APIs (completed; see entry above)

---

## 2026-07-17 ? Finance Phase 3A1: AR database foundation

### Shipped (backend only ? no HTTP invoice routes, no posting workflow)

- **Prisma:** `SalesInvoice`, `SalesInvoiceLine`, `ReceivableOpenItem`; enums `SalesInvoiceStatus`, `SalesInvoiceSourceType`, `SalesInvoiceSupplyType`, `SalesInvoiceTaxTreatment`, `ReceivableDocumentType`, `ReceivableOpenItemStatus`; `FinanceDocumentType.SALES_INVOICE` (number series only, not `AccountingVoucherType`)
- **Migration:** `20260717220000_finance_phase3a1_ar_foundation`
- **Customer architecture:** operational customer = `CrmCompany` via `customer-party` adapter (`backend/src/modules/accounting/receivables/customer-party/`); `customerId` UUID without Prisma FK; sales order link via `sourceType` + `sourceDocumentId` + snapshot (no FK to `CrmSalesOrder`)
- **Repos:** tenant-scoped find/list only under `receivables/sales-invoices` and `receivable-open-items`; Zod foundations for future APIs
- **Permissions:** `finance.ar.*` (+ invoice CRUD/post/cancel, reconcile.view); Finance Executive gets create/edit/cancel but **not** post
- **Tests:** `backend/tests/finance/finance-ar-foundation.test.ts`

### Not in scope (by design)

- Invoice HTTP routes, GST calculation, GL posting, open-item creation workflow, frontend AR pages, seeded posted invoices

### Next

- **Phase 3A2** ? calculation engine (completed 2026-07-17; see entry above)

---

## 2026-07-17 ? Task 3.2: Country-aware mobile validation

### Why
CRM mobile/phone fields used digit-length checks only. Indian numbers need optional `+91`, 10 digits, and first digit 6-9; international CRM records must not be forced through India-only rules.

### Change
- **Utility:** `frontend/src/utils/validation/mobilePhone.ts` ? `normalizeMobileInput`, `validateMobileForCountry`, `resolveMobileCountryKey` (IN default; E.164-ish fallback for others)
- **Zod helpers:** `optionalMobileForCountryField`, `refineMobileWithCountryField` in `phoneValidationZod.ts`
- **Wired:** Lead form (+ Quick Lead drawer), Contact form (company country), Customer/Company form (billing country)
- **UX:** Invalid mobile uses Task 3.1 `handleInvalidSubmit` / field errors + scroll/focus
- Empty optional mobiles still allowed; required emptiness stays on form required rules

### Country mapping
- `IN` / `India` / `+91` / `91` ? Indian rules
- Other labels (`United States`, `UAE`, ISO-ish codes, etc.) ? 7-15 digit E.164-ish fallback
- No country selected ? default **India** (primary market)

### How to verify
1. `cd frontend && npm run typecheck`
2. Lead/Contact: `1234567890` ? error; `9876543210` / `919876543210` OK
3. Customer country United States: 10-digit OK; 5 digits fail
4. Leave optional mobile empty ? still saves (unless soft lead contact rule)

---

## 2026-07-17 ? Task 3.1: Shared CRM form validation framework

### Why
CRM forms need one consistent invalid-submit path: block save, toast, field errors, expand section, scroll + focus.

### Change
- **Shared API** (`frontend/src/utils/formValidation/`): `handleInvalidSubmit`, `focusFirstInvalidField`, `scrollToInvalidField`, `normalizeFieldErrors`, `rhfErrorsToFieldMap`
- **ValidationSummary** (`frontend/src/components/forms/validation/`) ? optional inline error list; toast remains primary UX
- **ErpFieldRow** ? optional `dataField` ? `data-field` for DOM resolve
- **Lead create/edit** ? full reference: field-keyed validate, section expand (`forceOpenKey` + Additional Info tabs), summary + toast
- **Contact create/edit** ? RHF `onInvalid` ? `handleInvalidSubmit` + `data-field` / `forceOpenKey`
- **CRM masters** ? adopt via same `handleInvalidSubmit` pattern when fields gain stable `data-field` ids (see Lead/Contact)

### How to verify
1. `cd frontend && npm run typecheck`
2. Lead new: clear Company ? Save ? toast + field error + focus Company
3. Lead: set stage Closed without reason ? Additional Info / Status expands, Closed Reason focused
4. Contact new: clear Name ? Save ? toast + focus Name

---
## 2026-07-17 ? API docs: Accounting journals / approvals (OpenAPI 1.3.0)

### Why
Swagger and `API_CONVENTIONS.md` still described finance as deferred and omitted journal/approval/post endpoints shipped in Phases 2C1?2C2B.

### Change
- `backend/src/config/swagger.ts` ? OpenAPI **1.3.0**; tags Accounting Journals / Approvals / Vouchers / Posting Events; journal CRUD + validate/submit/cancel/approve/send-back/reject/**post**/ledger; approval inbox; read-only vouchers/GL/posting-events
- `docs/API_CONVENTIONS.md` ? Accounting routes section + lifecycle rows for journal submit/approve/post

### How to verify
1. Restart backend if running
2. Open http://localhost:5000/api/docs ? confirm Accounting Journals includes `POST ?/journals/{id}/post`
3. Confirm description states no public generic posting endpoint

---

## 2026-07-17 ? ErpDocumentUpload standardisation

### Why
CRM typed uploads and Sales Order confirm used parallel dropzone / file-picker UI with duplicated MIME/extension/size checks. Need one reusable Dynamics-styled upload control.

### Change
- **`ErpDocumentUpload`** (`frontend/src/components/erp/ErpDocumentUpload.tsx`) ? controlled `files`/`value` + `onChange`; validates MIME + extension + max size + max files; preview/remove flags; optional `documentTypeCode` / `documentTypeName`
- **Utils:** `validateErpUploadFile`, `mimeTypesForExtensions`; `validateCrmUploadFile` delegates to the shared validator
- **Adopted:** `CrmTypedDocumentUpload` composes `ErpDocumentUpload`; `SalesOrderConfirmDialog` PO upload replaced with the same control
- Exported from `frontend/src/components/erp/index.ts` as `DocumentUploadProps` / `ErpDocumentUploadProps`
- Entity attachment API dialog (`AttachmentUploadDialog`) left unchanged

### How to verify
1. `cd frontend && npm run typecheck`
2. CRM Contact/Lead/Opportunity form: pick document type ? upload ? preview/remove
3. Sales Order Confirm: select doc type ? upload JPG/PDF ? confirm still receives `documentFile`

---

## 2026-07-17 ? Task 7: Replace browser prompts with CRM modals

### Why
CRM / quotation / follow-up flows still used native `prompt()` for reschedule, blank templates, revision reasons, and rejection remarks.

### Change
- **`RescheduleFollowUpModal`** ? Current Date & Time (read-only), New Date/Time, optional Reason; future date+time validation; Escape/Cancel dismiss
- **`CreateBlankQuotationTemplateModal`** ? Template Name, Type, Page Size, Orientation, Default Currency, Description ? create with printLayout
- Wired: `CrmDashboardPanels`, `CrmEngagementPanels`, `CrmQuotationTemplateNewPage`
- Revision / duplicate / from-base name ? `systemPrompt`; reject quotation ? `systemConfirm` + `systemPrompt`; critical lead stage ? `systemConfirm`

### How to verify
1. `cd frontend && npm run typecheck`
2. Grep CRM/quotation/follow-up: no native `prompt(` / `alert(` / `confirm(`
3. Dashboard/Follow-ups ? Reschedule ? modal; Templates ? Blank ? modal; Quotation reject ? confirm+remarks

---
## 2026-07-17 ? Task 2.1: Lead create API flow reliability

### Why
Lead Save after create did not reliably land on the new record; payload edge cases (non-UUID customerId, unknown source) could fail API create; post-create activity/follow-up errors could surface as save failures after the lead already existed.

### Change
- **CrmLeadFormPage:** after confirmed create ? success toast then navigate to Lead 360 (`/crm/leads/:id`); Save & New clears form; Save & Close ? list (+ API soft-refetch); activity/follow-up side effects isolated
- **Validation:** require resolvable prospect name; email/mobile validators before API
- **crmApiBridge `mapLeadCreatePayload`:** unknown source ? `other`; UUID-only customer/contact/location; trim email
- Owner list refreshes when CRM masters hydrate (API mode)

### How to verify
1. `cd frontend && npm run typecheck`
2. API mode: New Lead ? Save ? toast ?Lead created? ? `/crm/leads/:id`; list shows the lead
3. Demo mode: same create ? detail redirect via Zustand

---

## 2026-07-17 ? Task 7: Replace browser prompts with CRM modals

### Why
CRM / quotation / follow-up flows still used native `prompt()` for reschedule, blank templates, revision reasons, and rejection remarks.

### Change
- **`RescheduleFollowUpModal`** ? Current Date & Time (read-only), New Date/Time, optional Reason; future date+time validation; Escape/Cancel dismiss
- **`CreateBlankQuotationTemplateModal`** ? Template Name, Type, Page Size, Orientation, Default Currency, Description ? create with printLayout
- Wired: `CrmDashboardPanels`, `CrmEngagementPanels`, `CrmQuotationTemplateNewPage`
- Revision / duplicate / from-base name ? `systemPrompt`; reject quotation ? `systemConfirm` + `systemPrompt`; critical lead stage ? `systemConfirm`

### How to verify
1. `cd frontend && npm run typecheck`
2. Grep CRM/quotation/follow-up: no native `prompt(` / `alert(` / `confirm(`
3. Dashboard/Follow-ups ? Reschedule ? modal; Templates ? Blank ? modal; Quotation reject ? confirm+remarks

---

## 2026-07-17 ? Stage completeness on Lead & Opportunity 360

### Why
Stage changes need a clear mandatory-field readiness signal and a FE gate aligned with backend `STAGE_REQUIREMENTS_INCOMPLETE`.

### Change
- **`StageCompletenessPanel`** on Lead 360 (pipeline) and Opportunity 360 (pipeline + move-stage modal)
- **Helpers:** `getLeadStageCompleteness` / `getOpportunityStageCompleteness` from `crmStageRequirements`
- **Gates:** demo stores + `crmApiBridge` block incomplete moves; API `missingFields` / code surfaced in toast + panel
- Notes remain separate (`stageCode` on notes ? not part of %)

### How to verify
1. `cd frontend && npm run typecheck`
2. `npx tsx scripts/test-crm-stage-requirements.ts`
3. Lead/Opportunity 360: incomplete stage ? panel shows Missing list; Change Stage options/Confirm disabled or blocked
4. API mode: incomplete move ? error lists missing fields

---

## 2026-07-17 ? Phase 12: CRM Masters consistency with CRM lists

### Why
CRM master registers needed the same list/create/import/bulk/responsive patterns as Lead/Opportunity lists, and Import was incorrectly auto-downloading the CSV template.

### Change
- **12A List:** CrmMasterListPage aligned with CRM ? OperationalPageShell, ErpCommandBar, CrmListFilterBar + filter drawer, ErpDataGrid, pagination, saved views
- **12B Create/Edit:** Drawer for small masters (CrmMasterEditorDrawer + ?new=1 / ?edit=); full page for complex (formPresentation / heuristic). Fields: Name, Code, Description, Status, Sort Order; Effective Date when catalog defines it
- **12C Import/Export:** Import opens dialog only (no auto template download). Template stays inside CrmMasterImportDialog. Preview + error rows + confirm. Export current filtered view
- **12D Bulk:** BulkActionToolbar ? Activate, Deactivate, Delete, Export selected
- **12E Responsive:** Mobile filter drawer, horizontal scroll, sticky primary on narrow, 44px touch row menu
- Bridges preserved via crmMasterApiBridge

### How to verify
1. cd frontend && npm run typecheck
2. Import opens dialog only ? template download only from inside dialog
3. Small master New ? drawer; complex ? full page
4. Bulk Activate / Deactivate / Delete / Export selected
5. Narrow viewport ? filter drawer + sticky New

---

## 2026-07-17 ? Low-priority UX: BackToTop + scrollbar polish

### Why
Long workspace pages need a convenient back-to-top control; scrollbars and pipeline/table spacing needed subtle Dynamics-aligned polish (no business logic).

### Change
- **BackToTopButton** mounted once in `AppShell` ? visible after ~500px scroll on `.d365-workspace-content` (window fallback); hidden when content is shorter than threshold; smooth scroll; bottom-right above rare status toasts (`z-index: 35`)
- Workspace + pipeline/kanban scrollbars: thin Dynamics brand-tinted thumbs
- Pipeline board / kanban column spacing + table actions cell vertical alignment

### How to verify
1. `cd frontend && npm run typecheck`
2. Open a long CRM list/360 page ? scroll past ~500px ? Back to top appears bottom-right; click smooth-scrolls workspace
3. Short page ? button stays hidden
4. Opportunity kanban DnD still works; row menus still aligned

---
## 2026-07-17 ? Unit Price focus + validation polish

### Why
Missing unit price on opportunity/quotation lines must expand Products, focus/highlight the field, and show "Unit Price is required" once (no duplicated guide/toast text).

### Change
- Stable line DOM hooks: `data-field={unitPrice-${lineId}}`, `id={opp-line-${lineId}-unitPrice}` on ErpLineItemsGrid + QuotationPriceTable
- Opportunity New/Edit + useOpportunityEditor + Quotation new: `handleInvalidSubmit` expands Products (`forceOpenKey`), focuses first missing unit price
- FE message canonical: `Unit Price is required`; validation guide uses field labels (no "X ? X" duplication)
- BE: opportunity/quotation line Zod refine requires `unitPrice > 0` when product present
- Lead/Contact: invalid mobile/email blocked via shared validation utils

### How to verify
1. `cd frontend && npm run typecheck` (+ backend `npx tsc --noEmit` if BE touched)
2. Opportunity with product but unit price 0 ? Save expands Products, focuses Unit Price, field error once, toast bullets
3. Quotation new same for lines
4. Lead invalid mobile / email blocked on save

---

## 2026-07-17 ? Task 3.3: Shared email validation


### Why
Lead/contact/customer email fields used weak or inconsistent checks and duplicate compares did not always normalize case/whitespace.

### Change
- `frontend/src/utils/validation/email.ts`: `normalizeEmail`, `validateEmail` (RFC-lite; no mailbox check)
- `frontend/src/utils/validation/emailZod.ts`: `optionalEmailField` / `requiredEmailField`
- Wired Lead, Contact, Customer forms + lead/contact import; duplicate compares use `normalizeEmail`
- Backend `emailValidation.ts` aligned on lead/contact/company schemas + company contact sync

### How to verify
1. `cd frontend && npm run typecheck`
2. Reject `a@b`, `a@@b.com`, spaces; accept `Name@Acme.IN` (stored lowercase)
3. Contact import duplicate email ignores case

---
## 2026-07-17 ? Task 6.1: Remove hard refreshes / page blinking (CRM + hubs)

### Why
Filtering, dropdowns, quick actions, and master-hub shortcuts must not remount the SPA via `window.location` hard navigations.

### Change
- **CRM paths** (`modules/crm`, `components/crm`): already soft ? filters/follow-up/import use React state + Zustand/`sync*FromApi`; masters hub uses `navigate` / `Link`. No `window.location.reload` left.
- **Masters / hubs still hard-navigating:** replaced `window.location.href` with React Router `navigate`:
  - `EnterpriseMasterShell` ?Back to list?
  - `MastersHomePage` command bar
  - `PurchaseMastersHubPage` shortcuts
  - `SettingsPages` Role Master ? permission matrix
  - `EcoPages` new ECR ? register

### Remaining intentional
- CRM `mailto:` / `tel:` / WhatsApp / CSV download blob links
- Error-boundary / AppShell retry `reload()` and bootstrap `?reset=1` replace

### How to verify
1. `cd frontend && npm run typecheck`
2. Grep CRM: no `window.location.reload`; only `mailto:` for `href =`
3. Lead/Opp filters, Quick Follow-up, Import ? no full page blink

---

## 2026-07-17 ? Task 13: Opportunity pipeline card layout + DnD validation

### Why
Kanban cards reserved excess height and mixed secondary fields; drops needed stage-requirement checks without page reload.

### Change
- **Card:** `height: auto` / no stretch; shows name, company, value, expected close, owner, next follow-up, priority; opp-no / probability / items in tooltip
- **Columns:** fixed 20rem width, scrollable body, compact empty drop zone (board min-height 280px)
- **DnD:** `preventDefault` on drop; FE `getMissingOpportunityStageFields` before move; toast + snap-back (no optimistic move); BE `STAGE_REQUIREMENTS_INCOMPLETE` still surfaced on API failure
- No `location.reload` on pipeline paths

### How to verify
1. `cd frontend && npm run typecheck`
2. Pipeline: cards hug content; columns aligned; drag without blink/reload
3. Drop to stage with missing fields ? toast + card stays; valid drop moves

## 2026-07-17 ? Document upload categories + BE MIME/size validation

### Why
Reusable `ErpDocumentUpload` needed category presets, full upload lifecycle (progress / preview / download / retry), and mandatory backend MIME + size checks against Document Type master (not FE-only).

### Change
- **FE presets:** `DOCUMENT_UPLOAD_CATEGORIES` / `getDocumentUploadCategory` (`customer_po`, `image`, `excel`, `drawing`, `general_document`, `quotation_attachment`)
- **ErpDocumentUpload:** select ? validate type/size ? upload + progress ? preview ? download ? remove ? retry failed
- **Wired:** `CrmTypedDocumentUpload`, `AttachmentUploadDialog` (entity attachments), `SalesOrderConfirmDialog` (Customer PO)
- **BE:** `attachment-upload.validation.ts` ? MIME + extension vs master `fileTypes`, size vs `min(maxSizeMb, CRM_MAX_UPLOAD_BYTES)`; service validates before persist
- **Masters aligned:** `customer_po` / `drawing` / `general` fileTypes updated in FE + BE seed

### How to verify
1. `cd backend && npx vitest run tests/attachment-upload.validation.test.ts`
2. `cd backend && npm run typecheck` ? `cd frontend && npm run typecheck`
3. API: upload wrong MIME for `customer_po` ? 400; oversize ? 400

---


### Why
Missing unit price on opportunity/quotation lines must expand Products, focus/highlight the field, and show ?Unit Price is required? once (no duplicated guide/toast text).

### Change
- Stable line DOM hooks: `data-field={unitPrice-${lineId}}`, `id={opp-line-${lineId}-unitPrice}` on ErpLineItemsGrid + QuotationPriceTable
- Opportunity New/Edit + useOpportunityEditor: handleInvalidSubmit expands Products (`forceOpenKey`), focuses first missing unit price
- FE message canonical: `Unit Price is required`; validation guide labels without ?X ? X? duplication
- BE: opportunity/quotation line Zod refine requires unitPrice > 0 when product present
- Lead: invalid mobile blocked via validateMobileForCountry (email already wired)

### How to verify
1. `cd frontend && npm run typecheck`
2. Opportunity with product but unit price 0 ? Save expands Products, focuses Unit Price, field error once, toast bullets
3. Quotation new same for lines
4. Lead invalid mobile / email blocked on save

## 2026-07-17 ? Stage-specific CRM entity notes (`crm_notes`)

### Why
Stage changes must keep prior stage notes; one reusable notes table needs `stageCode` + `noteType` without a second parallel notes system.

### Change
- **Prisma:** `CrmNote` (`@@map("crm_notes")`) + nullable `stageCode`, `noteType`; migration `20260717210000_crm_notes_stage_note_type`
- **API:** create accepts `stageCode` / `noteType`; list filters optional; PATCH content-only (stage/type immutable)
- **FE:** note-type picker + stage display on Lead/Opportunity notes; demo types extended
- **Guarantee:** stage notes are always new INSERT rows; updates never change `stageCode`/`noteType`

### How to verify
1. `cd backend && npx tsx scripts/prisma-cli.ts migrate deploy` then `npx tsc --noEmit`
2. Live: create two notes with different `stageCode` on same lead ? both remain; PATCH content leaves stage fields intact
3. `cd frontend && npm run typecheck` (notes files clean; unrelated CrmLeadFormPage syntax may still fail)

---

## 2026-07-17 ? Task 5.1: CRM follow-up date policy (future only)

### Why
Follow-up create/edit/reschedule must reject past date/time on both FE and BE, with picker mins in the user's local timezone.

### Change
- **Shared policy:** `frontend/src/utils/validation/crmDatePolicy.ts` + `backend/src/utils/crmDatePolicy.ts` ? `isFutureDateTime`, `validateFollowUpAt`, `getDatetimeLocalMin` / `getDateInputMin` / `getTimeInputMin`, `assertFollowUpInFuture` (BE)
- **FE:** `QuickFollowUpDrawer` + `RescheduleFollowUpModal` ? `min` on date/time, submit validation + `handleInvalidSubmit`; lead form next follow-up date `min` + future dueTime; demo `crmStore` rejects past create/update/reschedule/snooze
- **BE:** follow-up create / update (when due changes) / reschedule / snooze reject `<= now` with 400 `VALIDATION_ERROR`
- **Tests:** `backend/tests/crm-date-policy.test.ts`; e2e create uses near-future slot + past create ? 400

### How to verify
1. `cd backend && npx vitest run tests/crm-date-policy.test.ts`
2. `cd backend && npm run typecheck` ? `cd frontend && npm run typecheck`
3. Quick Follow-up: past date/time blocked; today disables past hours via `min`

---

## 2026-07-17 ? Lead edit policy (status-based, not permanent lock)

### Why
Converted/closed leads were hard-locked via `isLeadStageLocked` (FE) and `assertLeadMutable` (BE), so normal open/qualified leads that users treat as ?submitted? stayed editable only until terminal stages ? and converted leads could not even update notes. Product needs status + permission + ownership + field-level rules, not a blanket lock.

### Change
- **FE helper:** `frontend/src/utils/leadEditPolicy.ts` ? `resolveLeadEditPolicy` ? `{ mode, lockedFields, canSave, canChangeStage, reason }`
- **Modes:** full (open/new) ? controlled (qualified) ? limited (converted) ? permission (disqualified/closed) ? readonly (archived)
- **Wired:** Lead form, Lead 360 Edit, list/table Edit, demo `salesStore.updateLead`
- **BE:** `sanitizeLeadUpdateInput` allows limited PATCH on converted (notes/follow-up); workflow actions still use `assertLeadWorkflowMutable`
- **Tests:** `backend/tests/lead-workflow.test.ts` sanitize cases

### How to verify
1. `cd frontend && npm run typecheck`
2. `cd backend && npm run typecheck && npm test -- lead-workflow`
3. Demo/API: edit an open/qualified lead; convert then edit notes only; archived stays read-only

---

## 2026-07-17 ? Server-side CRM stage requirements enforcement

### Why
Frontend stage completeness is only an indicator. Lead / Opportunity stage transitions must be rejected by the API when mandatory fields for the target stage are empty.

### Change
- **Backend config:** `backend/src/modules/crm/stage-requirements.ts` ? mirror of `frontend/src/config/crmStageRequirements.ts` (codes/labels/field keys kept in parity; Prisma columns mapped to FE keys)
- **Enforced on:** `POST .../leads/:id/change-stage`, `POST .../leads/:id/qualify`, `POST .../leads/:id/disqualify`, `POST .../leads/:id/convert`, `POST .../opportunities/:id/move-stage`, win/lose
- **Error:** HTTP 422, `code: STAGE_REQUIREMENTS_INCOMPLETE`, top-level `missingFields: [{ field, label }]`, plus `errors` for existing clients
- **FE:** `ApiError` / `formatApiError` surface `missingFields` in toast text (bridges already return `ok: false` on rejection)
- **Tests:** `backend/tests/stage-requirements.test.ts`

### How to verify
1. `cd backend && npm run typecheck && npm test -- stage-requirements`
2. API mode: move a lead to `requirement_collected` without `productRequirement` ? 422 with `missingFields`
3. Complete the field ? stage change succeeds

---

## 2026-07-17 ? Task 6.1: Remove hard refreshes / page blinking (CRM + hubs)

### Why
Filtering, dropdowns, quick actions, and master-hub shortcuts must not remount the SPA via `window.location` hard navigations.

### Change
- **CRM paths** (`modules/crm`, `components/crm`): already soft ? filters/follow-up/import use React state + Zustand/`sync*FromApi`; masters hub uses `navigate` / `Link`. No `window.location.reload` left.
- **Masters / hubs still hard-navigating:** replaced `window.location.href` with React Router `navigate`:
  - `EnterpriseMasterShell` ?Back to list?
  - `MastersHomePage` command bar
  - `PurchaseMastersHubPage` shortcuts
  - `SettingsPages` Role Master ? permission matrix
  - `EcoPages` new ECR ? register

### Remaining intentional
- CRM `mailto:` / `tel:` / WhatsApp / CSV download blob links
- Error-boundary / AppShell retry `reload()` and bootstrap `?reset=1` replace

### How to verify
1. `cd frontend && npm run typecheck`
2. Grep CRM: no `window.location.reload`; only `mailto:` for `href =`
3. Lead/Opp filters, Quick Follow-up, Import ? no full page blink

---


### Why
After Lead create/edit in API mode, the register sometimes stayed stale until `window.location.reload()` ? Zustand persist was rehydrating `leads: []` over API-hydrated / bridge-upserted data.

### Change
- **salesStore persist (API mode):** partialize `{}` + merge ignores persisted CRM slices (no empty-array wipe)
- **crmApiBridge:** `upsertLead` uses `normalizeLead`; export `syncLeadsFromApi()` (RQ-style invalidate for leads only)
- **CrmLeadFormPage:** Save & Close soft-refetches leads then `navigate(/crm/leads)` (no reload); success toast after API confirms
- **CrmLeadListPage:** on mount in API mode, soft-refresh leads from API

### How to verify
1. `cd frontend && npm run typecheck`
2. Grep Lead form/list ? no `window.location.reload`
3. API mode: create Lead ? Save & Close ? new row on `/crm/leads` without browser refresh

---

## 2026-07-17 ? Stage-specific CRM entity notes (`crm_notes`)

### Why
Stage changes must keep prior stage notes; one reusable notes table needs `stageCode` + `noteType` without a second parallel notes system.

### Change
- **Prisma:** `CrmNote` (`@@map("crm_notes")`) + nullable `stageCode`, `noteType`; migration `20260717210000_crm_notes_stage_note_type`
- **API:** create accepts `stageCode` / `noteType`; list filters optional; PATCH content-only (stage/type immutable)
- **FE:** note-type picker + stage display on Lead/Opportunity notes; demo types extended
- **Guarantee:** stage notes are always new INSERT rows; updates never change `stageCode`/`noteType`

### How to verify
1. `cd backend && npx tsx scripts/prisma-cli.ts migrate deploy` then `npx tsc --noEmit`
2. Live: create two notes with different `stageCode` on same lead ? both remain; PATCH content leaves stage fields intact
3. `cd frontend && npm run typecheck`

---

### Why
Lead Save after create did not reliably land on the new record; payload edge cases (non-UUID customerId, unknown source, bad email) could fail API create; post-create activity/follow-up errors could surface as save failures after the lead already existed.

### Change
- **CrmLeadFormPage:** after confirmed create ? success toast then navigate to Lead 360 (`/crm/leads/:id`); Save & New clears form; Save & Close ? list; activity/follow-up side effects isolated so they cannot undo a confirmed create
- **Validation:** require resolvable prospect name (not customerId alone); basic email format check
- **crmApiBridge `mapLeadCreatePayload`:** unknown source ? `other`; UUID-only customer/contact/location; trim email
- Owner list refreshes when CRM masters hydrate (API mode)

### How to verify
1. `cd frontend && npm run typecheck`
2. API mode: New Lead ? Save ? toast ?Lead created? ? `/crm/leads/:id`; list shows the lead (store upsert)
3. Demo mode: same create ? detail redirect via Zustand

---

## 2026-07-17 ? Task 4.1: CRM stage requirements config

### Why
Lead/Opportunity stage advances must not hardcode mandatory-field rules inside 360 pages. Config needs real stage codes and model field keys so a later stage-gate UI can reuse one source.

### Change
- **`frontend/src/config/crmStageRequirements.ts`** ? stage ? required field maps for all `lead-stages` / `opportunity-stages` codes; field labels; helpers `getLeadStageRequirements`, `getOpportunityStageRequirements`, `getMissingStageFields` (+ typed lead/opp variants), `canAdvanceTo*`
- **`crmMastersSeed`**: mirrored `attributes.requiredFields` (comma-separated) on lead/opportunity stages as the future DB home (FE config remains authoritative for gates today)
- **`scripts/test-crm-stage-requirements.ts`**: pure helper smoke test

### How to verify
1. `cd frontend && npm run typecheck`
2. `npx tsx scripts/test-crm-stage-requirements.ts`

---

## 2026-07-17 ? Lead form FormActionBar (single Save bar)

### Why
Lead create/edit showed the same Save / Save & New / Save & Close / Cancel in both the header command bar and sticky footer.

### Change
- **`FormActionBar`** (`frontend/src/components/erp/FormActionBar.tsx`) ? reusable Save ? Save & New ? Save & Close ? Cancel with optional labels, busy/disabled, dirty Cancel confirm via `systemConfirm`
- **`CrmLeadFormPage`**: one sticky `FormActionBar` only; header keeps edit overflow actions (no duplicate Save buttons); Cancel respects dirty; create **Save** navigates to Lead 360 of the new lead; **Save & New** clears form; **Save & Close** ? `/crm/leads`

### How to verify
1. `cd frontend && npm run typecheck`
2. Open `/crm/leads/new` ? Save actions appear once (footer); Cancel with edits prompts discard
3. Save ? lands on `/crm/leads/:id`; Save & Close ? list; Save & New ? blank form

---

## 2026-07-17 ? Task 1.2: Route-level error handling

### Why
Unknown routes, permission denials, API failures, and lazy chunk load errors need distinct UIs ? not a single crash screen or silent CRM redirect.

### Change
- **RouteErrorBoundary** (`errorElement`) classifies errors: 404 ? PageNotFoundPage, 403 ? PermissionDeniedPage, 401 ? `/login` with `from`, chunk load ? reload CTA, API ? retry/go back, else crash panel
- **PageNotFoundPage** (canonical; `AppNotFoundPage` re-export) ? soft 404 with CRM/Home links; CRM `*` uses scoped 404 instead of redirecting to `/crm`
- **PermissionDeniedPage** (canonical; `AccessDeniedPage` re-export) ? role + required permission from matrix; ProtectedOutlet wired
- **PageLoadingFallback** ? Suspense/session loading; **lazyRoute** helper wraps dynamic imports and maps failures to chunk-load UI
- Root / CRM / purchase / mobile `errorElement` ? RouteErrorBoundary; root `*` ? PageNotFoundPage

### How to verify
1. `cd frontend && npm run typecheck`
2. Visit `/this-does-not-exist` and `/crm/typo-path` ? soft 404 (not crash, not silent `/crm` redirect)
3. Hit a permission-gated route without access ? Permission denied with required key
4. API mode, signed out deep link ? `/login` with return path

---

### Why
Deep CRM URLs must survive browser refresh and host Apache deploys without 404 or losing `:id` on legacy master redirects.

### Change
- **Apache SPA fallback:** `backend/.htaccess` (+ deploy copies) ? serve real `public/` files, else `public/index.html` (no longer rewrite `/crm/...` to a missing file path)
- **Vite:** `public/.htaccess` for dist-as-docroot; `vite.config.ts` `/api` proxy + open `/crm`
- **Router:** root `*` ? `AppNotFoundPage`; auth gate preserves query/hash on login redirect
- **CRM masters:** quotation-templates hub path ? `/crm/quotation-templates`; `CrmLinkedMasterPage` preserves deep links; hub shortcuts use `navigate`
- **Smoke:** `frontend/scripts/check-crm-routes.ts`

### How to verify
1. `cd frontend && npx tsx scripts/check-crm-routes.ts && npm run typecheck`
2. Hard-refresh `/crm/leads`, `/crm/opportunities/new`, `/crm/quotation-templates` (Vite or Docker nginx)
3. Host package: refresh `/crm/contacts` must return SPA, not Apache 404

---

## 2026-07-17 ? CRM routing / SPA refresh stability

### Why
Browser refresh on deep CRM paths must return `index.html` (not Apache/nginx 404), and legacy master redirects must preserve deep links.

### Change
- **Apache:** fixed SPA fallback in `backend/.htaccess` (+ deploy copies) ? static files from `public/`, else `public/index.html` (never rewrite `/api`)
- **Vite dist:** `frontend/public/.htaccess` copied into build for document-root=`public/` deploys
- **Vite:** `/api` proxy to `:5000`; open `/crm` on dev start
- **Router:** root `*` ? `AppNotFoundPage`; auth redirect keeps pathname+search+hash
- **CRM masters:** quotation-templates hub path ? `/crm/quotation-templates`; `CrmLinkedMasterPage` preserves `:id` / edit; masters hub uses `navigate` (no full reload)
- **Smoke:** `frontend/scripts/check-crm-routes.ts`

### How to verify
1. `cd frontend && npx tsx scripts/check-crm-routes.ts && npm run typecheck`
2. Refresh `/crm`, `/crm/leads`, `/crm/leads/new`, `/crm/customers`, `/crm/contacts`, `/crm/opportunities`, `/crm/opportunities/new`, `/crm/forecast`, `/crm/masters`, `/crm/quotation-templates` ? each must reload the SPA (not 404)

---

## 2026-07-17 ? Accounting Phase 2C2B: Post existing approved journal to GL

### Why
Phase 2C2A leaves approved manual journals as `AccountingVoucher` drafts without voucher numbers or GL. Operators need to post approved journals to the ledger using the existing voucher + lines (not `postingService.post()` which creates a new voucher).

### Change
- **Backend:** `posting-existing-voucher.service.ts` ? `postExistingApprovedVoucher()` updates existing approved voucher, inserts GL from existing lines, idempotent via `MANUAL_JOURNAL_POST:{voucherId}:V1`
- **Backend:** `journal-posting.service.ts` ? approval gate, `canPostJournal`, `POST /journals/:id/post`, `GET /journals/:id/ledger`
- **Frontend:** Post button + confirmation modal on journal detail; demo store posting; `finance.voucher.post` / `finance.gl.view` permissions
- **Tests:** `backend/tests/finance/finance-journal-posting.test.ts` (8 cases: success, status gates, idempotency, fail/retry, concurrency, permission, no duplicate voucher, period closed after approval)

### Explicitly NOT in 2C2B
- No journal reversal (Phase 2C3)

### How to verify
1. `cd backend && npm run typecheck && npm test -- tests/finance/` ? 60/60 pass
2. `cd frontend && npm run typecheck`
3. Submit journal (no approval) ? APPROVED ? Post ? POSTED with voucher number + GL entries

### Next
Phase **2C3** ? journal reversal workflow

---

## 2026-07-17 ? Accounting Phase 2C2A: Journal approval workflow (no posting)

### Why
Phase 2C1 submitted journals to `PENDING_APPROVAL` but had no runtime approval transactions, eligibility, or approve/send-back/reject actions.

### Change
- **Prisma:** migration `20260717200000_finance_phase2c2a_approvals` ? `FinanceApprovalRequest`, `FinanceApprovalStep` + enums
- **Backend:** `backend/src/modules/accounting/approvals/*` ? create request on submit (multi-level steps, cycle on resubmit), eligibility (maker-checker, role/user approver), approve/send-back/reject (conditional step updates, no GL); audit actions `APPROVAL_REQUEST_CREATED` / `APPROVE` / `SEND_BACK` / `REJECT` / `RESUBMIT` / `APPROVAL_LEVEL_ADVANCED` / `APPROVAL_COMPLETED`; inbox views `my_pending` | `submitted_by_me` | `completed_by_me` | `all`
- **Frontend:** `/accounting/entries/approvals` inbox (segments + summary cards) + detail; journal timeline for viewers; approve/send-back/reject when `allowedActions` allow; `approvalApiBridge` + `approvalDemoStore`
- **Script:** `backend/scripts/backfill-finance-approval-requests.ts` (idempotent for stuck `PENDING_APPROVAL` journals)
- **Tests:** `backend/tests/finance/finance-approvals.test.ts` (9 cases)

### Explicitly NOT in 2C2A
- No `postingService.post()`, no `PostingEvent`, no `GeneralLedgerEntry`, no voucher number assignment, no functional Post button

### How to verify
1. `cd backend && npx tsx scripts/prisma-cli.ts migrate deploy && npx prisma generate`
2. `npm run typecheck && npm test -- tests/finance/` ? 52/52 pass
3. `cd frontend && npm run typecheck`
4. Submit journal over rule threshold ? `PENDING_APPROVAL` + `FinanceApprovalRequest`; approver approve ? `APPROVED` (no GL)

### Next
Phase **2C2B** ? post approved journals to GL via posting engine

---

## 2026-07-17 ? Accounting Phase 2C1: Manual journal draft / validate / submit

### Why
Phase 2B posting engine is internal-only; operators need a manual journal workflow (draft ? validate ? submit) without triggering GL posting or voucher number issuance.

### Change
- **Backend:** `backend/src/modules/accounting/journals/*` ? CRUD draft journals on `AccountingVoucher` (`JOURNAL` / `MANUAL_JOURNAL`), validate report, submit ? `PENDING_APPROVAL` or `APPROVED`, cancel; approval resolution via `FinanceApprovalRule` + `journalApprovalLimit`; audit logs; routes at `/accounting/journals`
- **Frontend:** `/accounting/entries/journals` workspace (list, create/edit form, detail + validation panel); `journalApiBridge` + `journalDemoStore`; nav **Journals** (legacy `/accounting/vouchers` demo retained)
- **Tests:** `backend/tests/finance/finance-journals.test.ts` (11 cases)

### Explicitly NOT in 2C1
- No `postingService.post()`, no `PostingEvent`, no `GeneralLedgerEntry`, no voucher number / number-series consumption on submit
- No approve / reject / sendBack / post / reverse routes or UI buttons

### How to verify
1. `cd backend && npm run typecheck && npm test -- tests/finance/` ? 43/43 pass
2. `cd frontend && npm run typecheck`
3. API: `POST /accounting/journals` ? DRAFT; `POST ?/submit` ? APPROVED (or PENDING_APPROVAL); `voucherNumber` stays null

---

## 2026-07-17 ? Accounting Phase 2B: Central double-entry posting engine

### Why
Phase 2A ledger foundation needed a transactional posting service (idempotency, period enforcement, number series, GL insert) before module integrations or manual journals.

### Change
- **Prisma:** migration `20260717190000_finance_phase2b_posting_engine` ? `PostingEvent.numberSeriesId`, `reservedVoucherNumber`, `numberReservedAt`
- **Backend:** `backend/src/modules/accounting/posting/*` ? `post()`, validation pipeline, idempotency, atomic number reservation, GL insert in single transaction; read-only `GET /vouchers/:id`, `/vouchers/:id/ledger`, `/posting-events/:id`; `GET /ledger/posting-engine-status` (phase 2B)
- **Frontend:** Finance settings overview ledger card ? foundation/posting ready; manual journals + receipts/payments marked next/not connected
- **Tests:** `backend/tests/finance/finance-posting-engine.test.ts`

### Out of scope (Phase 2C+)
Public `POST /accounting/postings`, manual journal UI, reversal workflow, receipt/payment document integration

### How to verify
1. `cd backend && npx tsx scripts/prisma-cli.ts migrate deploy && npx prisma generate`
2. `npm test -- tests/finance/`
3. `GET /api/v1/t/:slug/accounting/ledger/posting-engine-status` ? `phase: 2B`, `postingEngine: true`, `publicPostingWorkflow: false`

---

## 2026-07-17 ? Accounting Phase 2A: Core ledger foundation

### Why
Phase 1 finance setup (LE, FY, CoA) needed immutable GL tables, draft voucher storage, posting-event idempotency, and posting-rule config before a posting engine can ship.

### Change
- **Prisma:** `AccountingVoucher`, `AccountingVoucherLine`, `GeneralLedgerEntry`, `PostingEvent`, `PostingRule` (+ enums); migration `20260717180000_finance_phase2a_ledger_foundation`
- **Backend:** Decimal utilities, ledger validators/repositories (no posting service), `GET /accounting/ledger/schema-status`, posting-rule CRUD/activate/deactivate, new `finance.voucher.*` / `finance.gl.*` / `finance.posting_*` permissions
- **Frontend:** Finance settings overview shows informational ?Ledger engine ? Foundation ready? card (no voucher actions)
- **Tests:** `backend/tests/finance/finance-ledger-foundation.test.ts`

### Out of scope (Phase 2B+)
Voucher posting, number issuance, GL seed data, AR/AP engines

### How to verify
1. `cd backend && npx prisma validate && npx tsx scripts/prisma-cli.ts migrate deploy`
2. `npm test -- tests/finance/finance-ledger-foundation.test.ts tests/finance/finance-setup.test.ts`
3. `GET /api/v1/t/:slug/accounting/ledger/schema-status` ? `phase: 2A`, `postingEngine: false`

---

## 2026-07-17 ? Accounting Phase 1A?1C: Legal Entity + finance setup

### Why
Transactional accounting needs a real ERP organisation structure (`Tenant ? LegalEntity ? Branch`), separate from CRM `CrmCompany`, plus finance setup (FY, periods, CoA, mappings, settings, activation) before any GL posting.

### Change
- **Prisma:** `LegalEntity`, `Branch`, `FinancialYear`, `AccountingPeriod`, `Account`, `DefaultAccountMapping`, `FinanceSettings`, `CostCentre`, `FinanceFeatureControl`, `FinanceApprovalRule`, `FinanceNumberSeries` (+ enums); migration `20260717120000_finance_phase1_setup` deployed
- **Backend:** `/api/v1/t/:tenantSlug/accounting/*` modules (controller?service?repository), `finance.*` permissions, setup-status + activate validation, audit via existing `AuditLog` (`module: finance`); CoA templates; LE-scoped number series (CRM `CodeSeries` unchanged)
- **Frontend:** `/accounting/settings/**` workspace + wizard; `financeApiBridge` dual-mode; demo Zustand store; Setup nav ? settings
- **Tests:** `backend/tests/finance/finance-setup.test.ts` (8 live tests pass with MySQL)

### Out of scope (Phase 2+)
GL posting, vouchers, receipts/payments, AR/AP outstanding, bank recon, GST returns, FA, financial reports, period-close engine

### How to verify
1. `cd backend && npx tsx scripts/prisma-cli.ts migrate deploy` then `npm run db:seed` (permissions)
2. `npm test -- tests/finance/finance-setup.test.ts`
3. Demo: `/accounting/settings` and `/accounting/settings/setup`
4. API mode: create legal entity ? FY ? periods ? CoA ? mappings ? activate

---

## 2026-07-17 ? Backend OpenAPI / API docs aligned to shipped routes

### Why
Swagger (`/api/docs`) was still at 1.1.0 and omitted ~55 endpoints that already exist in route modules (users/roles detail, CRM lifecycle, imports/exports, lookups).

### Change
- `backend/src/config/swagger.ts` ? OpenAPI **1.2.0** ? Users/Roles CRUD, lead/opp/follow-up lifecycle + history, pipelines CRUD, CRM imports, CRM master row CRUD + sync, entity note/attachment delete, master import/export, dedicated `/lookups/items|vendors`, fixed registry lookup enum
- `docs/API_CONVENTIONS.md` ? matching route table updates

### How to verify
Restart backend if running, open http://localhost:5000/api/docs ? confirm new tags (CRM Imports, CRM Pipelines, Master Imports/Exports) and Users `{userId}` paths.

---

## 2026-07-17 ? Create ISO Tank BOM from traveler preview data

### Why
Traveler sample should exist as a real BOM (masters tree + manufacturing components), not only a preview page.

### Change
- Masters items for ISO traveler assemblies/components
- Released masters BOM `bom-iso-a` = `BOM-ISO26K-TRAVELER-001` multilevel lines
- Manufacturing BOM `mfg-bom-003` same number ? material lines for WO
- BOM detail **Traveler** tab keeps PROC sheet; `/traveler-preview` redirects to this BOM
- WO `WO-2026-0043` linked

### How to verify
1. `/manufacturing/bom` ? open `BOM-ISO26K-TRAVELER-001`
2. Traveler tab shows PROC rows; Components tab shows WO materials
3. `/masters/bom/bom-iso-a/manage` shows multilevel tree

---

### Why
Stakeholders need to see multilevel BOM + PROC (process) rows in the product UI even though WO execution does not run traveler ops yet.

### Change
- Sample document: 26 KL ISO Tank Container traveler BOM (`isoTankTravelerSeed.ts`)
- Preview page: `/manufacturing/bom/traveler-preview` (amber PROC rows, levels 0?3)
- Links from BOM register + BOM-MFG-0003 detail; material BOM/WO seeds aligned to FG-ISO-TANK-26K
- Masters `bom-iso-a` marked released for tree preview

### How to verify
1. Open `/manufacturing/bom` ? **ISO Tank Traveler Preview**
2. Confirm yellow PROC rows under shell / dish ends / frame
3. Jump to material BOM `mfg-bom-003` and WO `WO-2026-0043`

---

## 2026-07-17 ? Route Master as reusable template (WO snapshot)

### Why
Users must not rebuild Cutting ? Welding ? ? on every Work Order.

### Change
- Route Master = create once, attach to Finished Item / BOM, version Draft/Active/Inactive
- WO create auto-finds active BOM + Route and **snapshots** operations onto the WO
- Create form shows a review table of stages before save; override is permission-only
- WO Operations edits and later master edits do not cross-update (snapshot + version stamped)

### How to verify
1. Routes ? Tank Assembly active for FG-TANK-ISO
2. New WO ? pick item/qty ? section ?Route Operations? lists stages (no manual add)
3. Create WO ? Operations tab shows snapshot; edit master route ? existing WO stages unchanged

---

## 2026-07-17 ? Routing / operation stages inside Work Order

### Why
Shopfloor needs a clear Cutting ? Welding ? ? path without a heavy MES document chain.

### Change
- Route Master at `/manufacturing/routes` (Draft / Active / Inactive) with operation lines
- WO create auto-loads active Route + generates stages; override gated by permission
- WO Detail **Operations** tab: tracker + Start/Hold/Resume/Complete/QC/Job Work actions
- WO status derived from operations; Shopfloor shows Current / Next Operation
- Still no Job Card / Material Issue / FG Receipt / Scrap / Rework / standalone QC modules

### How to verify
1. Open `/manufacturing/routes` ? Tank Assembly Route with 5 stages
2. Create WO for FG-TANK-ISO ? Operations tab shows Cutting ? ? ? Final QC
3. Start / Complete an operation ? WO status and Shopfloor current/next update

---

## 2026-07-17 ? Keep manufacturing light (no document chain)

### Why
Heavy ERP chains (Job Card ? Material Issue ? Operation ? FG ? Scrap ? QC ? Rework) overwhelm SME users.

### Change
- Canonical map is only: BOM ? Plan ? Work Order ? Start/Hold/Complete/QC/Close ? Shopfloor + Reports
- UI copy explicitly rejects the multi-document chain
- Material/scrap/QC stay WO actions, not primary documents

### How to verify
1. Control Room / any manufacturing page ? pipeline shows five light steps
2. Banner text mentions ?not Job Card ? Material Issue ? ??

---

## 2026-07-17 ? Production Control Room (owner / manager)

### Why
Owners need one attention board ? not to hunt across registers.

### Change
- New screen `/manufacturing/control-room` with six panels: Today's Plan, Running WOs, Material Shortage, QC Pending, Delayed WOs, Job Work Pending
- Nav primary: Control Room; `/manufacturing` and `/dashboard` redirect here
- Execute still opens Work Orders; QC Accept/Reject/Rework available on pending rows

### How to verify
1. Open `/manufacturing` ? lands on Control Room
2. Six summary chips + matching panels
3. Click a WO ? Work Order detail; QC buttons update demo review

---

## 2026-07-17 ? Manufacturing as one production command center

### Why
The module must feel WO-centric ? not a pile of separate ERP documents.

### Change
- Nav: Command Center ? Work Orders ? Shopfloor ? Plan ? BOM ? Job Work ? Reports ? Settings
- Command map shows canonical pipeline: BOM ? Demand ? WO ? Material ? Start ? Complete ? QC ? Close ? Reports/Shopfloor
- Per-screen role line on other pages

### How to verify
1. Open `/manufacturing/dashboard` ? vertical flow with Work Order highlighted
2. Steps Material ? Close are labeled ?Inside the Work Order?
3. Nav shows Work Orders under Command Center

---

## 2026-07-17 ? Manufacturing Settings (simple sections)

### Why
Normal users need a short settings page; advanced MRP/routing must stay hidden.

### Change
- Sections: General, Work Order, Material, Quality, Job Work, Advanced (collapsed)
- New toggles: auto BOM/warehouse/QC fill, allow close without QC, production without full material, negative stock warning, allow reject, vendor invoice placeholder
- Advanced keeps complex options OFF by default

### How to verify
1. `/manufacturing/settings` ? toggle Quick Mode / Auto Consumption ? Save
2. Advanced section starts collapsed
3. View-only users without `settings.manage` cannot save

---

## 2026-07-17 ? Manufacturing Reports (8 cards)

### Why
Supervisors need simple, export-friendly production reports without a heavy BI UI.

### Change
- Report cards: WO Status, Daily Production, Material Consumption, Scrap & Rework, QC Pending, Job Work Pending, Delayed WOs, Production Efficiency
- Shared filters: Date, Item, Status, Warehouse + Export CSV + Print
- Column sets for WO Status / Daily Production / Material Consumption as specified
- Demo data from work order + job work stores

### How to verify
1. `/manufacturing/reports` ? open Daily Production ? apply date/item filters
2. Export downloads CSV; Print opens printable table
3. Material Consumption shows Required / Consumed / Variance / Warehouse

---

## 2026-07-17 ? Job Work UI (simple subcontract)

### Why
Outside processing needs a clear WO-linked flow without accounting complexity.

### Change
- List columns: JW No, Linked WO, Vendor, Process, Material Sent Date, Sent/Received/Balance, Status, Actions
- Create form: WO, Vendor, Process, Material to Send, Qty, Expected Return, Rate placeholder, Remarks
- Detail tabs: Overview, Material Sent, Receipts, Reconciliation, Vendor Invoice Placeholder, Timeline, Documents
- `materialSentDate` / `materialToSend` / `remarks` on demo JobWork model

### How to verify
1. `/manufacturing/job-work` ? filter by status; open JW-2026-0012
2. Create Job Work ? save draft ? Send Material ? Receive ? Reconcile ? Link Invoice ? Close
3. Invoice tab stays placeholder (no AP posting)

---

## 2026-07-17 ? Work Order execution drawers

### Why
Operators need simple right-side drawers for the main WO actions ? not cluttered page forms.

### Change
- Drawers: Check Material, Start Production, Hold, Complete Production, QC Action, Close
- Hold reasons: Material Shortage, Machine Breakdown, Labour Issue, Quality Issue, Management Hold, Other
- Close shows final qty / material / QC / cost summary; Confirm Close ? read-only
- Complete supports Auto Consumption toggle

### How to verify
1. Open WO detail ? Check Materials drawer shows shortage + PR suggestion
2. Start / Hold / Complete drawers capture required fields
3. QC Action Accept / Reject / Rework; Close Confirm ? page read-only

---

## 2026-07-17 ? Work Order Detail (execution screen)

### Why
Supervisors need one powerful but simple screen to run the WO end-to-end.

### Change
- Header: WO No, item, status, planned/good qty, due, material/QC status, source ref
- Status actions: Check/Reserve Materials, Start, Hold, Resume, Complete Production, Send to QC, Close, Cancel
- Stepper: Draft ? Ready ? In Progress ? Completed ? [QC Pending] ? Closed
- Tabs: Overview, Materials, Production, Quality, Job Work, Costing, Timeline, Documents
- `WorkOrderExecutionStepper` uses derived `listStatus` + `qualityRequired`

### How to verify
1. Open a Ready WO ? Start ? Complete Production ? Close (or Send to QC if quality required)
2. Materials tab shows required/available/reserved/consumed/shortage
3. Timeline lists created / checked / started / held / completed / QC / closed events

---

## 2026-07-17 ? Work Order Quick Mode create/edit

### Why
Planners should create WOs with minimal fields; BOM and warehouses auto-fill.

### Change
- Quick Mode ON by default; Basic Details + auto BOM/materials/warehouse/QC/notes sections
- System Suggestions side panel (BOM, materials, QC, auto consumption, cost)
- Actions: Save Draft, Check Materials, Create & Mark Ready
- `previewWorkOrderMaterials`, `createWorkOrderAndMarkReady`

### How to verify
1. `/manufacturing/work-orders/new` ? pick SO source ? qty/dates/line auto-filled
2. Check Materials shows shortages if any
3. Create & Mark Ready opens WO detail as Ready when stock OK

---

## 2026-07-17 ? Accounting UI: Commercial Commitments (CRM-aligned)

### Why
Accounting must not treat CRM quotations / Sales Orders as posted financials. Phase 1 SO posting is deferred.

### Change (frontend only)
- Types + mock seed: `CommercialCommitment`, accounting status display unions
- Reusable: `CrmSourceDocumentPanel`, `CrmDocumentLink`, `SalesOrderAccountingSummary`, `ExpectedAccountingEntryDrawer`, badges, smart context, table/KPIs
- Page `/accounting/commercial-commitments` under Receivables workspace tabs
- Accounting dashboard: Commercial Commitments section (non-posted KPIs ? `/crm/sales-orders?status=?`)
- Receivables / Outstanding: Pending Commercial Value card (excluded from AR KPIs)
- Financial report banner: posted entries only; CRM pipeline / unbilled SOs excluded
- CRM Sales Order 360 (`/crm/sales-orders/:id`): Accounting Summary + expected-entry drawer
- Ledger entry source type optional `crmTrace` for future invoice chain display
- Nav: Receivables stays highlighted on commercial-commitments route

### How to verify
1. `/accounting` ? Commercial Commitments cards; confirmed SO link opens CRM list
2. `/accounting/commercial-commitments` ? tabs, amber non-posted labels, smart context, expected entry drawer
3. `/accounting/receivables` ? Pending Commercial Value does not change Total Receivables
4. `/accounting/reports` (Trial Balance / P&L) ? banner excludes CRM commercial values
5. `/crm/sales-orders/:id` ? Accounting Summary shows Not posted / Financial Impact None

---

## 2026-07-17 ? Work Order register (core list)

### Why
Work Order is the core manufacturing document ? supervisors need a rich filtered register with status chips.

### Change
- List columns: WO No, Source, Finished Item, Planned/Good Qty, Due, Material, QC, Production Status, Owner/Line
- Filters + status tabs including Ready / QC Pending / QC Hold
- Top actions: Create, Import from Plan, View Shopfloor, Export CSV
- Derived `getWorkOrderListStatus` / QC helpers; color progress bars

### How to verify
1. `/manufacturing/work-orders` ? filter by source, QC, owner/line
2. Status chips show Ready vs Draft; QC columns for quality WOs
3. Export downloads CSV; Import opens Production Plan

---

## 2026-07-17 ? Production Plan (list / create / detail)

### Why
Planners need a document to turn demand into draft WOs without mixing in shopfloor execution.

### Change
- `/manufacturing/production-plan` list (Plan No, date, source, items, qty, WOs, status, owner)
- New plan form + AI tips; detail with line Create WO and Generate Work Orders
- Plan sources/statuses; demo store plans with where-used style lines

### How to verify
1. Open plan list ? filter by source/status
2. New Plan ? add lines ? Save ? Generate Work Orders
3. AI panel shows due-date / inactive BOM / shortage tips

---

## 2026-07-17 ? Simple BOM UI

### Why
BOM create should be quick for supervisors/planners ? not a heavy engineering form.

### Change
- List: BOM No, Finished Item, Version, Status, Components, Last Updated, Created By + filters
- Form: header + component table (wastage %, issue Auto/Manual, remarks); Save Draft / Activate / Duplicate / Cost
- Detail tabs: Overview, Components, Cost Estimate, Where Used, Timeline
- Types: `autoConsumption`, `issueMethod`, `remarks`; `getBomWhereUsed`

### How to verify
1. `/manufacturing/bom` ? filter and open a row
2. New BOM ? add 2 materials ? Save Draft ? Activate
3. Detail tabs show where-used WOs and timeline

---

## 2026-07-17 ? Shopfloor View (3 tabs)

### Why
Supervisors need a simple live production board without a full MES.

### Change
- `/manufacturing/shopfloor`: Live Board, Machine/Line View, Daily Production Summary
- Card fields + Start / Hold / Resume / Complete / Send to QC / Close (demo store)
- `sendWorkOrderToQcDemo`; seed workstations on more WOs
- Docs: `MANUFACTURING_SIMPLE.md` shopfloor section

### How to verify
1. Open `/manufacturing/shopfloor` ? switch all three tabs
2. Live Board: Start a draft WO; Hold / Resume; Complete; Send to QC; Close
3. Machine/Line shows workstation rows; Summary shows 8 KPI cards

---

## 2026-07-17 ? Inventory Phase 1 foundation alignment

### Why
Confirm Inventory & Warehouse Phase 1 (nav, overview, items, stock availability, stock details) against acceptance; close remaining gaps without demoting later-phase movement demos.

### Change
- `/inventory/stock/:itemId` now uses domain mock `InventoryStockDetailPage` (not legacy Zustand page).
- `StockDetailsDrawer` tabs: Availability, Warehouses, Batch or Serial, Reservations, Recent Movements, Valuation, Planning.
- Items Register: Default Warehouse, Reorder Level, Current Cost (permission-gated), row actions menu.

### How to verify
1. `/inventory` ? KPIs drill to stock/items filters; quick actions open movement routes.
2. `/inventory/items` ? tabs, New/Edit/Detail, cost column hidden without `inventory.view_cost`.
3. `/inventory/stock` ? drawer tabs + Full opens domain stock detail.

---

## 2026-07-16 ? Hostinger: rust-free Prisma (timer panic fix)

### Why
Deployed API on Hostinger failed at startup with `PANIC: timer has gone away` ? Prisma?s native Rust query engine exceeds shared-hosting process/thread limits.

### Change
- Prisma **6.19.3** with `engineType = "client"` in `schema.prisma`
- `@prisma/adapter-mariadb` wired in `src/config/database.ts` (pool limit 5 in prod)
- Seed/cleanup scripts use shared `prisma` singleton (adapter required)
- Note in `docs/HOSTING_ERP_DHURANDHARCRM.md`

### How to verify
- Local: `npm run typecheck`; server starts and `/api/v1/health` shows DB connected
- Hostinger: rebuild/upload, start `dist/server.js`, confirm no timer panic in logs

### Remaining
Redeploy host package to production; confirm `/api/v1/health` JSON on erp.dhurandharcrm.com.

---



### Why
Ship demo-FE **Manufacturing & Production** Phase 1: navigation shell, dashboard, BOM register/form/detail with versioning, production plan with WO draft creation, and placeholders for WO/Job Work/Reports/Settings. No backend/Prisma.

### Change
- **Types / seed / service:** `types/manufacturing.ts`, `data/manufacturing/seed.ts`, `services/manufacturing/manufacturingService.ts` (BOM CRUD, duplicate/version, activate/deactivate, cost preview, plan + demo WO drafts)
- **Permissions:** `utils/permissions/manufacturing.ts`; `canRoute` branches for `/manufacturing/*`
- **Pages:** Dashboard, BOM register/form/detail, Production Plan grid; placeholders for WO / Job Work / Reports / Settings
- **Routes:** `manufacturingRoutes.tsx` registered in `routes/index.tsx` (was imported but missing from router children ? fixed)
- **Nav:** 7 items under **Manufacturing & Production**; legacy `/production`, `/work-orders`, `/job-work` redirect to new paths
- **Tests:** `scripts/test-manufacturing-module.ts` (`npm run test:manufacturing-module`); route-integrity key path `manufacturing` + `manufacturingRoutes.tsx` module check

### How to verify
- `npm run test:manufacturing-module` ? 24 passed
- Nav: 7 items; `/manufacturing`, `/manufacturing/bom`, `/manufacturing/production-plan` load
- BOM: create/edit, duplicate, new version, activate/deactivate; cost preview gated by `manufacturing.bom.view_cost`
- Production plan: select rows ? check materials ? create draft WO(s)
- Placeholders resolve for work-orders, job-work, reports, settings

### Remaining
Phase 2+ per `docs/MANUFACTURING_SIMPLE.md`: WO execution (select ? confirm qty ? complete), Job Work workflows, reports/settings, manufacturing API/DB.

---

## 2026-07-16 ? Manufacturing Phases 2?4 (WO, Complete, Job Work, Reports, Settings)

### Why
Finish the simplified Manufacturing & Production module (demo FE): Work Order as the central screen, complete production inside WO, Job Work subcontracting, reports, and settings.

### Change
- Phase 2: WO register/new/detail; start/hold/resume; materials availability/reservation; activity timeline
- Phase 3: Complete Production (good qty), partial output, auto consumption, optional manual issue/return, quality/scrap/rework, close, cost/variance ? all in-WO dialogs
- Phase 4: Job Work register/detail (dispatch/receive/reconcile/invoice link), `/manufacturing/reports`, `/manufacturing/settings` (advanced features off by default)
- Permissions: `manufacturing.work_orders.*`, `manufacturing.production.*`, `manufacturing.job_work.*`, `manufacturing.reports.*`, `manufacturing.settings.*`
- Docs: `MANUFACTURING_SIMPLE.md` updated; route baseline refreshed (717 paths)

### How to verify
- `/manufacturing/work-orders` ? New WO from SO ? Start ? Complete (good qty) ? Close
- `/manufacturing/job-work` ? Send ? Receive ? Reconcile
- Settings: Automatic Consumption Yes, Job Cards / Operations No
- `npx tsc -b` / `npm run build` / `npm run test:route-integrity`

### Remaining
Manufacturing **backend** still deferred by design.

---

## 2026-07-16 ? Manufacturing & Production Phase 1 (shell + dashboard)

### Why
Introduce ERPNext-style **Simple Manufacturing & Production** navigation and dashboard (demo FE only). Legacy Production hubs redirect so bookmarks do not 404.

### Change
- Nav: **Manufacturing & Production** (7 items) under `/manufacturing/*`; sidebar rail label **Mfg** unchanged
- Routes: `manufacturingRoutes.tsx` registered; Dashboard + BOM/Plan demo pages; WO / Job Work / Reports / Settings placeholders
- Redirects: `/production`, `/production/control-tower` ? `/manufacturing`; `/work-orders`, `/production/job-cards` ? `/manufacturing/work-orders`; `/job-work` ? `/manufacturing/job-work`
- Soft-updated `roleExperience.ts`, `pageGuideRegistry.ts`, `controlTowerRoutes.ts`
- Docs: `docs/MANUFACTURING_SIMPLE.md` (principles, phases, deferred separate documents)

### How to verify
- Left nav shows exactly 7 Manufacturing items; `/manufacturing` loads KPIs
- Every child nav path resolves (page or placeholder)
- Legacy Production hub URLs redirect without 404
- No new manufacturing backend/Prisma

### Remaining
Phases 2?6 per `MANUFACTURING_SIMPLE.md` (BOM polish, Production Plan engine, simple WO complete flow, Job Work, Reports/Settings). Backend still deferred by design.

---

## 2026-07-17 ? Manufacturing Production Dashboard (manager view)

### Why
Owners/managers need visual production visibility ? planned vs good qty, shortages, QC, job work ? without a dense ERP grid.

### Change
- Route `/manufacturing/dashboard` ( `/manufacturing` redirects here ); nav Dashboard updated.
- Live aggregates via `getManufacturingControlDashboard()` from WO + materials + QC + job work stores.
- KPI strip (8): Planned today, Good qty, In progress, Shortage, QC pending, Job work pending, Delayed, Efficiency.
- Panels: Today's plan table, Live status cards, Material risk, QC Accept/Reject/Rework, Job work snapshot, AI insights.
- Seed: pending QC reviews on WO-0040 / WO-0035 for demo actions.

### How to verify
Open http://127.0.0.1:5173/manufacturing/dashboard ? KPIs + panels; Accept QC on attention row; Shopfloor CTA.

---

## 2026-07-17 ? Manufacturing Shopfloor + AI-assisted UX

### Why
Indian SME users need a modern production control UI ? not SAP-style manufacturing. Work Order stays the only primary execution document; shopfloor needs a touch-friendly board.

### Change
- Nav: **Shopfloor View** (`/manufacturing/shopfloor`) after Dashboard.
- Shared UX: `ManufacturingAiAssist`, execution stepper, demo banner, quick-action cards.
- Dashboard: Quick Mode / auto-consumption chips, AI suggestions, primary Shopfloor CTA.
- WO create: visual Source ? Item & Qty ? Confirm stepper + auto-fill assist.
- WO detail: execution stepper + next-best-action AI strip (Start / Complete / QC / Close stay on WO).
- Settings defaults unchanged: Quick Mode ON, auto consumption ON, advanced Job Cards OFF.

### How to verify
1. `/manufacturing` ? AI tips + Shopfloor quick card
2. `/manufacturing/shopfloor` ? Start / Complete from lane cards
3. `/manufacturing/work-orders/new` ? stepper + system-filled BOM/warehouses
4. Open an in-progress WO ? Complete Production dialog still on the same page

### Remaining
No manufacturing backend. Accounting Setup stub unrelated.

---

## 2026-07-16 ? Budgeting & Forecasting Accounting FE (demo)

### Why
Ship Accounting ? Budgeting & Forecasting workspace (UI/mock only), same class as GST & TDS / Period Close ? no finance APIs or GL posting.

### Change
- Nav: **Budgeting & Forecasting** before Period Close; in-page side tree (Overview ? Setup) via `budgetingNav.ts` + `BudgetingShell`
- Types / seed / Promise mock service (`budgetingService.ts`) for FY 2025-26 Vasant/Chakan manufacturing demo
- Screens: Overview, Versions, Annual workbench (Information | Monthly Grid), Dept/CC, Sales/Purchase/Production, Expense, CAPEX, Cash Flow, BvA, Rolling Forecast, Approvals, Reports, Setup
- Permissions: `accounting.budgeting.view|create|edit|approve|export|setup`

### How to verify
- Open `/accounting/budgeting` ? tree order Overview ? Setup; preview banner visible
- Versions ? Annual (spread / growth / copy PY) ? Approvals (reject requires comment)
- BvA Actual ? ledger; Committed ? purchase orders
- Rolling non-manual method shows engine placeholder
- `npx tsc --noEmit` (frontend) clean on new paths

---

## 2026-07-16 ? Transactional ERP scope reconciled (plan execute)

### Why
Plan ?Addressing Deferred by design (SO / Purchase / Inventory / Production)? required a scope choice. Code already had **SO Phase 1**; docs still described SO as GET-only and treated G2/G3 like open CRM defects.

### Decision
- **phase1-so:** Confirmed complete in code (no new SO API this pass).
- **keep-deferred:** Purchase / inventory / production **backends** and SO MRP/dispatch/invoice remain **Accepted deferral** (not CRM verification bugs). Do **not** start `phase2-purchase` or `full` in this pass.

### Change
- `docs/CRM_FE_API_DB_VERIFICATION_REPORT.md` ? SO Phase 1 matrix + G2/G3 ? Accepted deferral; Phase 1 gap closed
- `docs/crm-page-api-map.md` ? Sales orders Phase 1 write map
- `docs/BACKEND_SHARED_CONSOLIDATION.md` ? remove stale ?SO conversion deferred?
- `docs/REMAINING_WORK.md` / `PROJECT_STATUS.md` ? align wording if needed

### How to verify
- `backend/src/modules/crm/sales-orders/sales-order.routes.ts` exposes POST/PATCH/DELETE/confirm/close
- FE create/edit/confirm/delete call `salesOrderApiBridge` under `VITE_USE_API=true`

---



### Why
Phase 1 agent finished last and added `// @ts-nocheck` across Phase 2?6 inventory pages/services to silence type errors instead of fixing them. Phases 2?6 implementations were intact in the tree but type safety was degraded.

### Change
- **Routes/navigation:** No regression ? `inventoryRoutes.tsx` already wired all Phase 2?6 real pages (receipts, issues, transfers, adjustments, returns, stock count, planning, reports, setup); `navigation.ts` lists all 13 workspace items. `InventoryPlaceholderPage` exists but is unused in routes.
- **Removed `// @ts-nocheck`** from 28 inventory module/service/component files.
- **Fixed 5 type errors** uncovered after removal: `openProductionOrders` typo in `inventoryPlanningService.ts`; missing `createdAt` on saved views in `inventorySetupService.ts`.

### Verification
- `npm run typecheck` ? pass
- `npm run build` ? pass
- `npx tsx scripts/test-inventory-module.ts` ? 18/18
- `npm run test:stock-count` ? 14/14
- `npm run test:route-integrity` ? pass

---

## 2026-07-16 ? Inventory & Warehouse Phase 2: Receipts & Issues

### Why
Store and production teams need quick material receipt/issue flows tied to PO/WO sources, quality review, and demo posting into the inventory ledger.

### Change
- **Phase 1 completion:** Items register/form/detail, stock availability, stock details drawer, overview routing, permissions.
- **Phase 2:** Receipts register + Quick Receipt (3-step wizard, quick/detailed mode); Issues register + Quick Issue (BOM from production order, FIFO/FEFO/manual batch); shared movement components (header, line grid, cost/accounting preview, audit); Quality Review drawer.
- Mock `movementService` (`getReceipts`, `postReceiptDemo`, `getIssues`, `postIssueDemo`, batch preview, etc.) updates `inventoryStore` on demo post.
- Permissions: `inventory.receipts.*`, `inventory.issues.*`, `inventory.quality.*`.
- Routes: `/inventory/movements/receipts`, `/inventory/movements/issues` (+ new/edit/detail). Transfers/adjustments/returns/stock-count remain placeholder or parallel phases ? not in this scope.

### How to verify
1. `/inventory` ? Overview KPIs and quick actions
2. `/inventory/items`, `/inventory/stock` ? Phase 1 registers
3. `/inventory/movements/receipts` ? Quick Receipt from PO ? Post Demo ? stock ledger grows
4. `/inventory/movements/issues` ? Quick Issue from WO ? Post Demo
5. `npm run test:inventory-module` (18/18), `npm run build`

---

## 2026-07-16 ? Inventory Phase 3: Transfers, Adjustments & Returns

### Why
Complete remaining inventory movement types with source-driven UX ? users select source document, confirm quantities, post.

### Change
- Routes: `/inventory/movements/transfers`, `/adjustments`, `/returns` (+ `/new` and `/:id` detail).
- Mock service `transferAdjustmentReturnService.ts` with all Phase 3 API functions; demo seed for transfers/adjustments.
- Registers with status tabs; Quick Transfer/Adjustment editors; source-driven Return flows (purchase GRN, sales invoice/dispatch, production WO materials, completed transfer).
- Permissions: `inventory.transfers.*`, `inventory.adjustments.*`, `inventory.returns.*`.
- Shared components: `MovementPreviewPanels` (cost/accounting preview, audit timeline, register tabs).

### How to verify
1. `/inventory/movements/transfers` ? register tabs, Quick Transfer, dispatch/receive demo actions
2. `/inventory/movements/adjustments/new` ? system preview, conditional approval on high value
3. `/inventory/movements/returns/new?type=purchase_return` ? select GRN, lines load from source

### Tests
- Phase 3 files: no TS errors in isolated grep of build output
- Full repo `tsc -b` / `npm run build`: fails on pre-existing Phase 5?6 inventory modules (planning, reports, setup, traceability) ? not Phase 3

---

## 2026-07-16 ? Inventory Phase 6: Planning, Reports, Setup

### Why
Complete demo Inventory module with replenishment planning, report catalog, setup controls, saved views, and final route/permission wiring.

### Change
- Planning (`/inventory/planning`), Reports hub + runner (`/inventory/reports`, `/:reportId`), Setup (`/inventory/setup` ? 11 tabs, advanced features off by default).
- Mock services: `inventoryPlanningService`, `inventoryReportsService`, `inventorySetupService`; saved view presets; PR/production/transfer demo drafts from planning.
- Routes wired for receipts, issues, transfers, adjustments, returns, stock count, item ledger alongside Phase 6 screens.
- Permissions: `inventory.planning.view`, `inventory.reports.view`, `inventory.setup.manage` (+ stock-count keys). Backend must enforce same rules.

### How to verify
`/inventory/planning`, `/inventory/reports/stock-summary`, `/inventory/setup`, `npm run test:route-integrity`

### Remaining
No inventory backend API; movement posting demo-only.

---

## 2026-07-16 ? Inventory Phase 4: Traceability (batch, serial, reservations, ledger)

### Why
Movement documents and stock views need batch/serial selection, contextual reservations, read-only item ledger, and traceability timeline ? without new main-menu Batch or Reservations pages.

### Change
- Mock `traceabilityService` + `traceabilitySeed`: batches, serials, reservations, item ledger, traceability timeline.
- Components: `BatchSelector` (FEFO preview), `SerialSelector`, `BatchDetailDrawer`, `TraceabilityDrawer`, `ReservationsPanel`.
- Integrated into Receipt/Issue line grids, Transfer/Adjustment/Return editors, `StockDetailsDrawer`, `InventoryItemDetailPage`.
- Route: `/inventory/items/:id/ledger` (read-only; cost hidden without `inventory.view_cost`).
- Contextual reservations on Stock Details, Item Card, SO 360, PO detail, Planning page.
- Permissions: `inventory.batch.view`, `inventory.serial.view`, `inventory.reservations.*`, `inventory.view_item_ledger`, `inventory.traceability.view`.

### How to verify
1. Quick Issue with FEFO batch method ? batch preview sorted by expiry
2. Stock Availability ? row ? Stock Details drawer ? Batches / Serials / Reservations tabs
3. Item Card ? Item Ledger + Traceability actions
4. PO detail `PO-2026-0088` ? Inventory Reservations section

### Remaining
Demo-only ? no backend. Route-integrity baseline not updated (684 vs 459 paths repo-wide).

---

## 2026-07-16 ? Inventory Phase 5: Stock Count & Physical Verification

### Why
Warehouse teams need one desktop module for full physical verification, cycle counts, blind counts, recount, variance approval, and demo adjustment posting ? without real ledger posting.

### Change
- Routes: `/inventory/stock-count`, `/inventory/stock-count/new`, `/inventory/stock-count/:id` (replaces placeholder).
- Mock `stockCountService` + seed data; types in `inventoryDomain.ts`; permissions `inventory.stock_count.*`.
- Register with status tabs (All, Draft, Counting, Recount Required, Under Review, Approved, Posted, Cancelled).
- Step workbench: scope ? snapshot ? quantity entry ? difference review ? recount ? variance approval ? adjustment preview ? post demo.
- Quick count mode for counters; supervisor review with reveal system qty, movement-after-snapshot, audit history.
- Test: `npm run test:stock-count` (14 assertions).

### How to verify
1. `/inventory/stock-count` ? seeded counts, tabs, KPI strip
2. New count ? select warehouse ? Create Snapshot ? enter quantities ? Submit
3. Blind count hides system qty; supervisor can reveal with reason
4. High-value variance ? Under Review ? Approve ? Adjustment Preview ? Post Demo (read-only after post)

### Remaining
No inventory backend; demo posting may update `inventoryStore` for visibility only.

---


### Why
Indian manufacturing users need WIP, FG valuation, production costing, variances and product cost sheets connecting production, inventory, purchase and finance (demo FE only ? no GL posting or production backend).

### Change
- Routes under `/accounting/manufacturing/**` (Overview, Material Consumption, WIP Register, Finished Goods Valuation, Production Costing Workbench, Variances, Subcontracting, Scrap & Rework, Overhead Allocation, Cost Centres, Product Cost Sheet, Production Ledger, Costing Reports, Setup).
- Mock Promise `manufacturingAccountingService` + trailer-fabrication seed; permissions `accounting.mfg_costing.*`.
- Strongest UX on Dashboard (KPIs, variance summary, WIP/FG trend), Production Costing Workbench (PO list + cost breakup), Product Cost Sheet (BC-style BOM/routing), and Production Ledger (read-only accounting impact).
- Nav: Accounting ? Manufacturing Accounting (after Fixed Assets). Removed placeholder route; cleaned duplicate Fixed Assets route block in `accountingRoutes.tsx`.

### How to verify
1. `/accounting/manufacturing` ? consumption, WIP, FG, variance KPIs + charts
2. Production Costing ? select PO ? cost breakup (RM, labour, OH, scrap recovery)
3. WIP Register + Finished Goods Valuation tables
4. Product Cost Sheet ? BOM + routing lines + total standard cost
5. Costing Setup ? save demo GL account mapping

### Remaining Accounting UI order
Accounting Setup & Controls ? optional Budgeting & Forecasting. (Financial Reports + Period Close already done.)

---

## 2026-07-16 ? Fixed Assets frontend module

### Why
Accounting needed a Fixed Assets workspace for machinery, buildings, vehicles, depreciation, transfers and disposal (demo FE only ? no GL posting).

### Change
- Routes under `/accounting/fixed-assets/**` (Overview, Register + Asset Card, Categories, Acquisition, Capitalization, Depreciation Workbench, Transfers, Maintenance, Revaluation, Impairment, Disposal, Physical Verification, Asset Ledger, Reports, Setup).
- Mock Promise `fixedAssetsService` + Indian manufacturing seed; permissions `accounting.fixed_assets.*`.
- Strongest UX on Dashboard, Asset Register/Card, Depreciation Workbench (opening/closing WDV preview + demo post), and Disposal (gain/loss preview).
- Nav: Accounting ? Fixed Assets (after Bank & Cash).

### How to verify
1. `/accounting/fixed-assets` ? KPIs and alerts
2. Register ? open asset card tabs
3. Depreciation ? Preview ? Post in Demo (toast: no live ledger)
4. Disposal ? New ? gain/loss preview ? Complete in demo

### Remaining Accounting UI order
Manufacturing Accounting ? (Financial Reports / Period Close already done) ? Accounting Setup.

---

## 2026-07-16 ? Bank reconciliation workbench UX (primary screen)

### Why
Bank & Cash flow centres on reconciliation; the workbench needed BC-style two-pane matching, auto-match discipline, and difference gating.

### Change
- Workbench: sticky header/summary, flow strip, selectable two-pane match (1:1 / 1:N / N:1), partial match, unmatch/ignore, mobile steps.
- Service: `manualMatchDemo`, `unmatchLinesDemo`, `ignoreLinesDemo`; richer auto-match preview; low confidence never auto-applied.
- Draft recon seed expanded (mixed receipts, charges, AMF ?2,500 difference, in-transit items).
- Flow strip on Overview + Reconciliation list.

### How to verify
Open `/accounting/bank-cash/reconciliation/brecon-001` ? Auto-Match Preview ? apply high ? manual match remaining ? Difference Remaining ?2,500 blocks complete until authorised adjustment.

---

## 2026-07-16 ? Bank & Cash Management frontend module

### Why
Accounting ? Bank & Cash was a placeholder; treasury/finance users need a Business Central?style bank/cash workspace (balances, transfers, statements, reconciliation, cheques, cash counts) without live banking or GL posting.

### Change
- Routes under `/accounting/bank-cash/**` (overview, bank/cash accounts + cards, transactions, fund transfers, statements + import wizard, reconciliation workbench, cheques, deposits, cash book, cash counts, reports, setup). Legacy `/accounting/bank` redirects.
- Mock Promise `bankCashService` + Indian manufacturing seed; permissions `accounting.bank_cash.*` (UI only ? backend must enforce later).
- Masked account numbers only; demo banners on every screen; recon completion blocked when difference remains unless authorized adjustment; auto-match never applies low-confidence matches automatically.

### How to verify
1. Accounting ? Bank & Cash ? `/accounting/bank-cash`
2. Walk workspace tabs; create fund transfer ? submit/approve ? Complete in Demo toast.
3. Statements ? Import wizard (UI preview formats) ? Reconciliation workbench ? Auto-match preview ? Complete blocked if difference ? 0.

### Remaining
No finance backend / live bank feeds / real cheque clearing. Next Accounting UI: Manufacturing Accounting, Accounting Setup & Controls, optional Budgeting.

---

## 2026-07-16 ? Financial Reports & Statements frontend module

### Why
Accounting ? Financial Reports was a placeholder; finance users need Trial Balance, P&L, Balance Sheet, Cash Flow, Account Schedules, and MIS from posted accounting data (demo FE only).

### Change
- Routes under `/accounting/reports/*` (16 workspace tabs). Nav item already present.
- Mock Promise service + Indian manufacturing FY seed; amount drill-down to Ledger Entries; BC-style Account Schedules; export/print demo placeholders.
- Permissions `accounting.reports.*`. Read-only; filters preserved across tabs via URL query.

### How to verify
Open http://127.0.0.1:5173/accounting/reports ? KPIs, Trial Balance ? ledger drill-down, P&L / BS / Cash Flow, Schedules, MIS.

### Remaining Accounting UI sequence
Financial Reports (done) ? Budgeting & Forecasting ? Period Close (done) ? Accounting Setup & Controls.

---

## 2026-07-17 ? Inventory Phase 1 foundation alignment

### Why
Confirm Inventory & Warehouse Phase 1 (nav, overview, items, stock availability, stock details) against acceptance; close remaining gaps without demoting later-phase movement demos.

### Change
- `/inventory/stock/:itemId` now uses domain mock `InventoryStockDetailPage` (not legacy Zustand page).
- `StockDetailsDrawer` tabs: Availability, Warehouses, Batch or Serial, Reservations, Recent Movements, Valuation, Planning.
- Items Register: Default Warehouse, Reorder Level, Current Cost (permission-gated), row actions menu.

### How to verify
1. `/inventory` ? KPIs drill to stock/items filters; quick actions open movement routes.
2. `/inventory/items` ? tabs, New/Edit/Detail, cost column hidden without `inventory.view_cost`.
3. `/inventory/stock` ? drawer tabs + Full opens domain stock detail.

---

### Why
Accounting needed a full month-end / year-end close workspace (checklist, reconciliations, locks, year-end wizard) instead of a placeholder.

### Change
- `/accounting/period-close/**` ? 18-item in-page tree (Close Dashboard ? Close Setup), shell mirroring GST & TDS.
- Mock seed + Promise `periodCloseService`; permissions `accounting.period_close.*` (UI only).
- Screens: dashboard, calendar, checklist, subledger recon, inventory/mfg/FA/bank/GST-TDS review, accruals (2 workspaces), prepaid, FX, trial balance, period locking, reopen requests, year-end wizard, reports, setup.
- Demo banners: no real period locks or GL/inventory/tax postings.

### How to verify
1. Accounting ? Period Close ? `/accounting/period-close`
2. Walk left nav through Setup; Soft Lock shows demo toast; Year-End Confirm shows ?no ledger balances were updated.?
3. Subledger Mark Reviewed blocked while difference ? 0.

---

## 2026-07-16 ? CRM Dual Create UX (Quick + Guided)

### Why
Users need fast min-field capture and an optional proper ERP guided funnel ? without forcing full forms at first touch.

### Change
- Global **Quick create** menu (suite bar + topbar) ? drawers: Lead, Customer, Opportunity, RFQ, Quotation, Follow-up + Guided deal.
- `CrmQuickCreateHost` + `QuickLeadDrawer` / `QuickQuotationDrawer` / `QuickRfqDrawer`; trimmed `NewOpportunityDrawer` (optional details).
- `/crm/guided-deal` step shell (URL state: leadId, opportunityId, quotationDocumentId, step).
- Minimum-first validation: lead early stages need no product notes; opportunity early stages need no commercial lines.

### How to verify
1. Suite bar **Quick create** ? each entity opens a drawer; save with min fields.
2. `/crm/guided-deal` ? Lead ? Qualify ? Opp ? Quote ? Order; refresh keeps query params.
3. Lead form at stage `new` saves without requirement lines; Opp `new_lead` saves without product prices.

---

## 2026-07-16 ? Allow direct CRM create (SO + Follow-up + copy)

### Why
Users must be able to create Company, Contact, Lead, Opportunity, RFQ, Quotation, Follow-up, and Sales Order **directly** ? not only via funnel handoffs. CRM Sales Orders were hard-blocked to quotation-only create.

### Change
- CRM Sales Orders: **New Sales Order** primary CTA ? blank create (`fromCrm=1`); From quotation kept as secondary; Direct mode allowed on create form (customer + product lines + direct reason).
- Follow-up drawer: when opened without entity context, company / lead / opportunity pickers (require at least one).
- Softened Direct Quotation / page-guide copy that claimed SO was impossible without an opportunity.
- Company/Contact/Lead/Opportunity/Quotation/RFQ already supported direct create (unchanged behavior).

### How to verify
1. `/crm/sales-orders` ? New Sales Order ? Direct ? pick customer + product ? reason ?10 chars ? Save Draft.
2. Opportunity Pipeline ? Follow-ups ? New Follow-up ? pick company (or lead/opp) ? Schedule.
3. `/crm/quotations/new` ? Direct still available; `/purchase/rfqs/new` defaults to Manual.

---

## 2026-07-15 ? Quotation From opportunity: PRODUCT dump + false Customer Required

### Why
New Quotation ? From opportunity showed `<!--fos-lead-lines:v1-->` JSON in Deal Information PRODUCT, and the Customer section stayed **Required** even when the opportunity already had a linked company.

### Change
- Deal Information PRODUCT uses `summarizeLeadRequirementLines` / `opportunityRequirementDisplay` (never raw marker+JSON); hydrates lines from encoded `productRequirement` when `opp.lines` is empty.
- Form section completion: Customer complete when `customerId` is set; validity no longer gates Customer (stays under Commercial).
- Scope notes sanitized on opp select; quotation template `product_capacity` placeholder skips encoded payloads.

### How to verify
`/crm/quotations/new` ? From opportunity ? pick opp with company + line items ? PRODUCT human-readable; Customer section Complete (not Required). Validity still Required under Commercial until set.

---

## 2026-07-15 ? GST & TDS Compliance frontend (UI-only)

### Why
Accounting ? GST & TDS was a placeholder; finance users need a navigable Indian GST/TDS compliance workspace (demo preview ? no government portals).

### Change
- Nav: Accounting **GST & TDS** ? `/accounting/tax-compliance`; exact 23-item in-page side tree (`config/taxComplianceNav.ts`); child routes registered with `subNav: false` so Accounting Dynamics tabs stay uncluttered while page titles/search still resolve. Legacy `/accounting/gst-tds` redirects.
- Full route map under `/accounting/tax-compliance/**` (GST registers, ITC workbench, GSTR-1/2B/3B, e-invoice/e-way, exceptions, TDS/TCS, notices, calendar, reports, setup). TDS Deduction Workbench remains deep-link only (not in side tree).
- Mock Promise service + Indian manufacturing seed; `accounting.tax.*` UI permissions; preview banner on all screens.

### How to verify
Open http://127.0.0.1:5173/accounting/tax-compliance ? Accounting tab highlights GST & TDS; left tree matches Overview ? Setup order; walk Outward/Inward/ITC/TDS. Demo only ? no portal filing.

### Honest limits
Frontend compliance preview based on demo data. No GST Portal / Income Tax / TRACES / e-invoice / e-way generation, no return filing, challan payment, certificate generation, or GL postings.

---

## 2026-07-16 ? Financial Reports & Statements frontend module

### Why
Accounting ? Financial Reports was a placeholder; finance users need Trial Balance, P&L, Balance Sheet, Cash Flow, Account Schedules, manufacturing/MIS views from posted accounting data (demo FE only).

### Change
- Routes under `/accounting/reports/*` (16 workspace tabs). Nav item Financial Reports already present.
- Mock Promise service + Indian manufacturing FY seed; drill-down to Ledger Entries; Account Schedules (BC-style); export CSV/Excel + PDF/print demo placeholders.
- Permissions `accounting.reports.*`. Read-only amounts; filters preserved across report tabs via URL query.

### How to verify
Open http://127.0.0.1:5173/accounting/reports ? KPIs, Trial Balance drill-down, P&L / Balance Sheet / Cash Flow, Schedules, MIS. Demo only ? not statutory.

### Remaining UI sequence (documented)
Financial Reports ? Budgeting & Forecasting ? Period Close (already FE) ? Accounting Setup & Controls.

---

## 2026-07-16 ? Accounts Payable frontend module

### Why
Accounting ? Payables was a placeholder; finance users need a BC-style AP workspace covering outstanding, invoices, ageing, payment planning/proposals, vendor payments/allocations, advances, debit notes, disputes, vendor card, reports and setup (demo FE only).

### Change
- Routes under `/accounting/payables/*` (13 workspace tabs + invoice/vendor/payment/proposal detail routes). Nav item Payables already present.
- Mock Promise service + Indian manufacturing seed; three-way match drawer; payment planning ? proposal ? payment ? allocation ? posting preview (demo) ? ledger links.
- Permissions `accounting.payables.*` (UI gating; backend must also enforce later). No real bank/GL posting.

### How to verify
Open http://127.0.0.1:5173/accounting/payables ? Overview KPIs, Outstanding ? Invoices ? Payment Planning ? Proposals ? Payments ? Allocations. Demo only.

### Honest limits
`npm run build` (`tsc -b`) still fails on unrelated Bank & Cash Fund Transfer editor TS errors; `vite build` and payables oxlint succeed. MSME ageing / statutory dates are frontend preview values.

---

## 2026-07-15 ? Ledger Entries polish (FactBox + dimension summaries)

### Why
Ledger Entries FE existed; acceptance gaps remained for Account Ledger FactBox, Project/Cost Centre summary headers, and voucher picker UX.

### Change
- `LedgerAccountFactBox` on Account Ledger (desktop); project + cost-centre summary cards when a dimension is selected.
- Lookups include posted vouchers for picker; `getProjectLedgerSummary` / `getCostCentreLedgerSummary` mock rollups (demo only).

### How to verify
`/accounting/ledger-entries` ? Project / Cost Centre tabs with a selection; Account Ledger shows FactBox. Oxlint on ledger paths clean; `vite build` succeeds (full `tsc -b` still fails on unrelated receivables).

---

## 2026-07-15 ? Accounting Vouchers frontend module

### Why
Accounting ? Vouchers was a placeholder shell; finance users need a full voucher register/editor/detail workflow (demo/frontend only).

### Change
- Routes: `/accounting/vouchers`, `/new`, `/:voucherId`, `/:voucherId/edit`. Nav item Vouchers already present.
- Mock Promise service + Indian manufacturing seed (11 vouchers); lifecycle Draft???Posted/Reversed (status simulation only ? **no GL posting**).
- Register KPIs/tabs/filters/import/export; two-workspace editor (Information | Entries) with CoA account picker; posting preview, reversal, approval drawers.
- Permissions `accounting.voucher.*` (UI gating; backend must also enforce later).

### How to verify
Open http://127.0.0.1:5173/accounting/vouchers ? browse KPIs, open JV-2026-00021 / PMT-2026-00012, create draft, submit/approve/post (demo toast). Demo only.

### Honest limits
CSV import is text-parse validation preview only. Dashboard ?Recent Vouchers? still reads legacy `accountingStore` (separate seed) until those KPIs are rewired.

---

## 2026-07-15 ? Ledger Entries frontend module

### Why
Accounting ? Ledger Entries was a placeholder; finance users need a BC-style read-only ledger for review, dimensions, and manufacturing cost visibility (demo FE only).

### Change
- Routes: `/accounting/ledger-entries` (+ account / voucher / party / `:entryId`); `/accounting/ledger` redirects. Nav updated.
- Views: General, Account, Voucher, Party, Cost Centre, Project, Manufacturing ? filters, KPI strip, drawers (details / related / audit), export + print preview, saved views (session).
- Mock Promise service + Indian manufacturing seed; permissions `accounting.ledger.*`. CoA ?View ledger? deep-links to Account Ledger.

### How to verify
Open http://127.0.0.1:5173/accounting/ledger-entries ? tabs, date range, filters, entry drawer, account/voucher/party routes. Demo only ? no posting.

---

## 2026-07-15 ? PR create Quick Entry / Additional / Line Items

### Why
User feedback on `/purchase/requisitions/new`: make **Quick Entry** the first section, **Additional Information** below it, and a distinct section for **Line Items** (not abstract Details/Items tabs alone).

### Change
- `PurchaseRequisitionWorkspaceTabs`: workspaces **Requisition** | **Line Items**; validation chips map header fields ? Requisition, lines ? Line Items.
- `PurchaseRequisitionEditorPage` WS1: FastTab **Quick Entry** (essentials) then **Additional Information** (source/costing/remarks/approval, collapsible + `forceOpenKey`); WS2 retitled **Line Items** (table + finance + attachments). Continue CTA ? Line Items. No business/API/validation rule changes.

### How to verify
Open http://127.0.0.1:5173/purchase/requisitions/new ? Quick Entry first, Additional below (collapsed when empty), Continue to Line Items; form state preserved across tabs; Save Draft / Submit unchanged.

---

## 2026-07-15 ? PR create/edit two-workspace layout

### Why
`/purchase/requisitions/new` still used a flat FastTab section nav while PO create/edit ships a clearer two-workspace flow (Details | Items).

### Change
- Extracted shared `PurchaseDocumentWorkspaceTabs` chrome; PO tabs now wrap it; added `PurchaseRequisitionWorkspaceTabs` + `derivePrWorkspaceTabs`.
- `PurchaseRequisitionEditorPage`: **Requisition Details** | **Items & Totals** workspaces, Continue CTA, sticky save bar, validation chips / click-to-focus; FactBox + sticky header unchanged. Hooks moved above loading return. No business/API/validation rule changes. Page guide already disabled for PR create/edit.

### How to verify
Open http://127.0.0.1:5173/purchase/requisitions/new ? switch workspaces; fill header then Continue; lines/totals on WS2; Save Draft / Submit still work; edit route `/purchase/requisitions/:id/edit` same chrome.

---

## 2026-07-15 ? Chart of Accounts frontend module

### Why
Accounting ? Chart of Accounts was a placeholder shell; finance users need a Business Central?style hierarchical CoA UI (demo/frontend only).

### Change
- Routes: `/accounting/chart-of-accounts` (+ `/:accountId` card); `/accounting/coa` redirects. Nav + dashboard deep link updated.
- Mock Promise service + Indian manufacturing seed; create/edit/import/export/activate/deactivate/delete (session-only).
- Three-pane layout: hierarchy tree, filterable/sortable list, collapsible FactBox; form/import drawers; CoA permissions (`accounting.coa.*`).

### How to verify
Open http://127.0.0.1:5173/accounting/chart-of-accounts ? tree filter, New Group/Posting, FactBox, account card. Demo only ? no ledger posting / no API.

---

## 2026-07-15 ? Purchase Approvals register polish

### Why
`/purchase/approvals` lagged PO/PR registers: flat SmartFilterBar, no KPI strip, no Overview/Suggestions rail, denser table chrome.

### Change
- `PurchaseApprovalsPage.tsx`: dynamics shell, Home?Purchase?Approvals breadcrumbs, KPI strip (pending / overdue / approved / rejected), tab chips with pending count, CRM filter drawer + embedded register toolbar + sort, 2-column layout with `PurchaseRegisterContextPanel`.
- Added `PurchaseApprovalsTable`, `approvalFilterConfig`, `approvalKpiItems`, `approvalRegisterInsights`; `approvalsListBreadcrumbs`.
- Approval actions / queue service / review drawer unchanged; filters applied client-side on existing `getPurchaseApprovalQueue` tab loads.

### How to verify
Open http://127.0.0.1:5173/purchase/approvals ? KPI strip + right Overview; Filters drawer; Review / Approve / Reject still work; demo mode only.

---

## 2026-07-15 ? Fix PO detail hooks crash

### Why
`/purchase/orders/:id` crashed with ?Rendered more hooks than during the previous render? once FactBox `useMemo`s ran only after the loading early return.

### Change
`PurchaseOrderDetailPage.tsx`: moved `changeHistoryPeek` / `documentFactBox` `useMemo`s above the loading/`!po` return so hook count is stable. Sibling detail pages already safe (hooks before early return or non-hook FactBox JSX).

### How to verify
Open http://127.0.0.1:5173/purchase/orders/prd-po-5003 ? page loads without hooks crash; Smart context FactBox still shows.

---

## 2026-07-15 ? Vendor Quotation create/edit polish

### Why
`/purchase/vendor-quotations/new` lagged PO/RFQ/Invoice/detail: flat Header dump, 18-column lines grid, no CRM sticky facts, no metrics strip, FactBox reopen chrome inconsistent.

### Change
`VendorQuotationEditorPage.tsx`: sticky `recordHeaderFacts`; dense FastTabs (Quotation / Vendor / Commercial collapsed / Item Lines / Tax / Remarks); `EnterpriseFormMetrics`; slim lines + expandable Details; `PurchaseTaxTotalsPanel` + collapsible FactBox. Logic/validation unchanged. Purpose banner already disabled for VQ new/edit.

### How to verify
Open http://127.0.0.1:5173/purchase/vendor-quotations/new ? sticky VQ/Vendor/RFQ/Date facts; teal Item Lines; Details drawer for compliance/freight; Smart context reopen.

---

## 2026-07-15 ? Purchase Smart context / Details FactBox

### Why
Purchase document shells showed FactBox chrome as ?FactBox? while CRM/masters use **Smart context / Details**. Several purchase editors and detail pages lacked the right-side FactBox entirely.

### Change
- `PurchaseCardFormShell` default `factBoxLabel` ? `Details` (pane chrome: Smart context + Details); `PurchaseDocumentFactBox` panel title aligned.
- Wired `PurchaseDocumentFactBox` (vendor / status / related from existing demo fields) on GRN, Return, RFQ, Vendor Quotation editors + GRN / Return / Invoice / RFQ / VQ detail pages.
- PO / PR / Invoice editors and PO detail already had FactBox; list register panels unchanged.

### How to verify
Open create/edit and detail for PO, PR, Invoice, GRN, Return, RFQ, VQ ? right pane shows **Smart context / Details**; toolbar AI toggle hides/reopens. URLs e.g. `/purchase/grn/new`, `/purchase/returns/new`, `/purchase/rfqs/new`, `/purchase/vendor-quotations/new`, and matching `/:id` detail routes.

---

## 2026-07-15 ? Vendor Quotation detail polish (`prd-vq-4002`)

### Why
VQ detail was a flat Header + oversized 18-column lines table + equal Totals fields ? hard to scan vs PO/Invoice document chrome.

### Change
`VendorQuotationDetailPage.tsx`: CRM sticky record facts; dense FastTabs (Document / Commercial peek / Lines / Tax); expandable line Details; `PurchaseTaxTotalsPanel` with dominant Quotation Total; CGST+SGST vs IGST disclosure.

### How to verify
Open http://127.0.0.1:5173/purchase/vendor-quotations/prd-vq-4002

---

## 2026-07-15 ? Purchase create/edit CRM Quotation-style headers

### Why
Purchase document new/edit pages stacked EnterpriseDocumentHeader (module eyebrow + title + Draft) with facts grids and meta chips, duplicating the workspace title and status already implied by CRM?s Quotation sticky header pattern.

### Change
- Added `PurchaseDocumentRecordHeader` (CRM sticky: title + favorite + status badge + Label: value row).
- `PurchaseCardFormShell` composes sticky header via `recordHeaderFacts` / `workspaceRecordHeader`; suppresses in-body documentIdentity strip and duplicate action-row header.
- Wired PR / RFQ / PO / Invoice / GRN / Return editors; dropped fat `documentIdentity` + facts + chips; RFQ metrics slimmed to Lines + Est. Value.
- `EnterpriseWorkspace`: skip actionRow `EnterpriseWorkspaceHeader` when `workspaceRecordHeader` is set.

### How to verify
Open `/purchase/orders/new`, `/purchase/rfqs/new` ? single sticky title row with Draft ? Vendor/Buyer/Date; no boxed documentIdentity block above form. Sticky save and FactBox intact.

### Routes
`requisitions/new` ? `PurchaseRequisitionFormPage` ? `PurchaseRequisitionEditorPage` (not legacy `PurchaseRequisitionDocumentPage`).

---

## 2026-07-15 ? RFQ create/edit denser layout

### Why
`/purchase/rfqs/new` had excessive white space: all FastTabs open, nested field grids fighting dense layout, and a large EmptyState for vendors.

### Change
- `RfqEditorPage.tsx`: document header identity/facts/chips, live metrics strip, dense ErpCardSections with Document/Locations groups, Commercial Terms collapsed + picklists, tighter source chips + scrollable PR list, Item Lines with amount column + totals footer, compact vendor empty state, Remarks collapsed.
- Purpose/Next-step guide disabled for RFQ new/edit in `pageGuideRegistry`.

### How to verify
Open http://127.0.0.1:5173/purchase/rfqs/new ? shorter scroll, Commercial/Remarks collapsed by default.

---

## 2026-07-15 ? PO editor typecheck stabilize

### Why
Concurrent UX agents left `PurchaseOrderEditorPage.tsx` with merge residue (unused Origin state/imports, missing symbols, half-wired Origin modal) and a dependent `PurchaseCardFormShell` typing break (`children` required on `EnterpriseWorkspaceProps` but omitted from the props object).

### Change
- Reconciled PO editor Origin compact selector + source lookup `Modal` (chips ? chosen strip ? modal create) so `originChosen` / `originLookupOpen` / `selectOrigin` / `reopenOriginSelector` are live, not dead.
- Item Lines / Tax / Terms / FastTabs / header / workflow remain via `PurchaseOrderLinesTable`, `PurchaseTaxTotalsPanel`, `PurchaseTermsNotesTabs`, etc.
- `PurchaseCardFormShell`: type shell props as `Omit<EnterpriseWorkspaceProps, 'children'>` (children stay JSX).

### How to verify
`cd frontend && npx tsc -b --noEmit --force` ? exit 0; no `PurchaseOrderEditorPage` diagnostics.

### Still open
Oxlint warning on PO editor `inspectionCategories` exhaustive-deps (pre-existing / non-blocking).

---

## 2026-07-15 ? PO/PR Item Lines focus grid

### Why
Purchase Order (and PR) Item Lines tables were wide secondary-field spreadsheets; Item Code stacking and auto-blank rows hurt create/edit density.

### Change
- Extracted `PurchaseOrderLinesTable` / `PurchaseRequisitionLinesTable` + `PurchaseLineDetailsDrawer`.
- Visible columns: Line, Item, Description, Specification, UOM, Qty, Rate/Est. Rate, Discount (PO), Tax % (PO), Taxable/Amount, Line Total/Est. Amount, Actions.
- Secondary fields (HSN, dates, warehouse/location, cost centre/project/PO refs, CGST/SGST/IGST, remarks, attachments) moved to row-details drawer.
- Rich single-row `PurchaseItemCodeCell` picker (code, name, category, stock, UOM, last rate, preferred vendor).
- Sticky Line + Item columns, sticky header, sticky Actions, totals footer, empty-state CTA (no auto blank line), mandatory highlighting, Enter-to-next-row nav.
- Item Lines section keeps defaultOpen with stronger teal chrome.

### How to verify
1. `/purchase/orders/new` ? Item Lines empty until Add Line; fewer columns; details drawer; rich item picker; totals row.
2. `/purchase/requisitions/new` ? same lines UX (PR columns).
3. Save still persists drawer fields via line state.

### Still open
True available stock / last purchase rate still proxied from reorderLevel / standardRate in demo; line attachments placeholder only on PO.

---

## 2026-07-15 ? Purchase FactBox reopen affordance

### Why
Closing the FactBox on `/purchase/orders/new` hid the rail with no way to reopen (origin gate has no section-nav trailing; CRM always keeps `FactBoxPaneAiToggle`).

### Change
- `PurchaseCardFormShell`: always render CRM `FactBoxPaneAiToggle` in `erp-form-body__toolbar` when FactBox is collapsible (Lead360 pattern).
- Preference still via `purchase.factbox.collapsed` localStorage (existing).
- Dropped duplicate section-nav trailing defaults / explicit toggles on purchase form pages that use the shell.

### How to verify
1. `/purchase/orders/new` ? close FactBox ? sparkles ?Show FactBox? appears; click restores rail; form uses full width while closed.
2. Preference survives refresh.

### Still open
None for this fix.

---

## 2026-07-15 ? New PO Origin compact UX

### Why
New Purchase Order Origin consumed a large card with always-visible source selects before the PO form.

### Change
- `PurchaseOrderEditorPage.tsx`: compact **Create Purchase Order From** chips; after choice, slim **Origin:** bar with **Change source** (and **Select source?** for non-manual).
- Source origins (PR / Comparison / VQ / Blanket) open design-system `Modal` with existing lookup fields + Create PO; cancel keeps origin selected without the big inline block.
- Manual Entry collapses immediately and shows the form. Create-from-origin service calls unchanged.

### How to verify
1. `/purchase/orders/new` ? pick Manual Entry ? slim origin bar + form visible.
2. Pick Approved PR ? modal with PR/vendor selects ? Create still navigates to edit.
3. Change source reopens chip selector.

### Still open
Manual browser verify preferred; purchase remains demo-only.

---

## 2026-07-15 ? Purchase document FactBox panels (BC-style)

### Why
PO create/edit/detail needed Business Central?inspired Vendor / History / Status / Related FactBox panels; shell-level component avoids clashing with concurrent PO editor work.

### Change
- New `PurchaseDocumentFactBox.tsx` (+ `buildPurchaseRelatedLinks`, `purchaseDocumentApprovalFact`, demo vendor insight derivation).
- Shell defaults: FactBox label, `purchase.factbox.collapsed` storage, ~280?320px xl rail class.
- Wired on PO editor, PO detail, Invoice editor (PR keeps existing `PurchaseEnterpriseFactBox`).

### How to verify
1. `/purchase/orders/new` ? four FactBox panels; Related empty for manual until source IDs exist.
2. Hide panel ? form full width; preference persists via localStorage.
3. Typecheck: `npm run typecheck` in frontend (PASS).

### Still open
PR editor not switched to document FactBox; blanket related has no detail route.

---

## 2026-07-15 ? Purchase document editor responsive behaviour

### Why
PO create/edit needed breakpoint-aware layout: FactBox default open only on xl+, More actions below lg, and mobile item cards instead of a wide lines table.

### Change
- `useMediaQuery` + `getFactBoxInitialOpen` ? FactBox defaults open at xl+ (session/local preference still wins); purchase key `purchase.factbox.collapsed` supported.
- FactBox side-rail CSS split moved from lg ? xl (matches register right-rail).
- `ErpCommandBar` ? `collapseSecondaryOnNarrow` + `pin` keeps Submit / Save Draft visible; other actions under ?More actions? below lg.
- `PurchaseDocumentLineCards` + `PurchaseOrderLinesTable` ? md+ table, &lt;md expandable cards; secondary line tools (Copy / Clear) collapse under More below lg.
- Wired on `PurchaseOrderEditorPage` (compose with FactBox / lines / sticky save bar).

### How to verify
1. &lt;768px: Item Lines are expandable cards; sticky save bar remains.
2. 768?1279: dense form 2-col; FactBox closed by default; command/line secondary under More.
3. ?1280: FactBox open by default (toggle persists); Item Lines table/grid.

### Still open
Invoice/Return can reuse `PurchaseOrderLinesTable` / `PurchaseDocumentLineCards` + same command-bar pins when those editors adopt the shared lines component.

---

## 2026-07-15 ? PO Submit for Approval validation UX

### Why
Purchase Order Submit for Approval used toast-only checks (`notify.error`) without a top summary, field highlights, FastTab expand, or scroll-to-error ? unlike the PR editor shell pattern.

### Change
- Added `frontend/src/utils/purchaseOrderValidation.ts` (draft: vendor; submit: vendor, PO date, expected delivery date, ?1 complete line with item + qty > 0 + rate > 0).
- `PurchaseOrderEditorPage`: `attemptedMode` / `showErrors`, top `validationTitle` + `validationItems` / `validationErrors` on `PurchaseCardFormShell`, field `fieldState=error`, `forceOpenKey` on General / Commercial / Item Lines FastTabs, scroll to first invalid field.
- `ErpCardSection`: `forceOpenKey` to expand without permanently locking controlled open state.
- `PurchaseOrderLinesTable`: `showErrors` + `lineErrors` (red cell messages under item / qty / rate).
- Shared: `scrollToPurchaseValidationTarget`, optional `validationTitle` on Enterprise Workspace / Purchase shell.
- PR editor: on invalid submit, scroll to general or lines (removed toast-only ?resolve errors? path as primary).

### How to verify
1. New PO ? Submit for Approval with empty vendor and incomplete lines ? top summary ?Purchase Order cannot be submitted.?, no `alert()`, Vendor highlighted, Commercial expands if delivery date cleared, lines show cell errors, first error scrolled into view.
2. Save Draft without vendor ? summary ?cannot be saved? with Vendor only.
3. Fix fields ? errors clear live; submit succeeds when valid.

### Still open
Invoice / Return / RFQ editors still use thinner toast validation ? not mirrored (different flows; no shared submit+shell validationItems yet).

## 2026-07-15 ? Compact purchase document attachments

### Why
PO (and related) Attachments used tall EmptyState cards and id-only lists, wasting vertical space on purchase editors.

### Change
- New shared `PurchaseDocumentAttachments.tsx`: compact horizontal drop zone (~?120px empty) + dense table (`File Name | Type | Uploaded By | Uploaded Date | Size | Actions`) when files exist; demo stub file pick/drag.
- `PurchaseOrderEditorPage`: Attachments extracted to its own FastTab (collapsed by default); persists via existing `attachmentIds`.
- Wired into `PurchaseRequisitionEditorPage` (maps placeholders) and read-only `PurchaseOrderDetailPage`.
- Invoice / Return editors have no attachments block ? left unchanged.

### How to verify
1. New PO ? open Attachments FastTab ? compact drop zone + Add Attachment ? 0 files.
2. Browse/drop a file ? dense table row; save; reload ? id still in `attachmentIds`.
3. PO with seed attachment (e.g. `att-po-tc-01`) ? table when expanded.
4. PR Attachments FastTab same compact pattern.

### Still open
Real upload storage for purchase documents (demo stub only). Invoice/Return can adopt the shared component when an attachments FastTab is added.

---

## 2026-07-15 ? Purchase BC FastTabs (collapsed defaults + summaries)

### Why
Purchase document editors/detail pages had nearly every FastTab expanded, forcing long pages and scrolling. Needed Business Central-style defaults with header peeks when collapsed.

### Change
- `ErpCardSection`: additive `collapsedSummary`, controlled `open` / `onOpenChange` (uncontrolled `defaultOpen` unchanged for CRM).
- `purchaseFastTabSummaries.ts`: helpers for commercial / tax totals / notes / attachments / approval / receiving peeks; `hasMeaningfulTaxTotals`.
- CSS: `.erp-card-section__summary` ellipsis peek when collapsed.
- Wired defaults + peeks on PO editor/detail/revise, PR editor, invoice editor/detail, return editor/detail, GRN editor.

### Defaults
- General / Header / Lines ? open
- Commercial / Receiving (GRN) / Notes / Attachments / Approval ? collapsed (+ summary when available)
- Tax & Totals / Financial Summary ? open iff any meaningful amount (> 0)

### How to verify
1. New PO: General + Item Lines open; Commercial / Terms / Attachments collapsed; Tax open only after line amounts.
2. Collapse Commercial ? header shows e.g. `Expected Delivery: ? ? Payment: ? ? Freight: ?`.
3. Collapse Tax ? `Subtotal ? ? GST ? ? Total ?`.
4. CRM/Quick Entry collapsible usage still works (additive props only).

### Still open
Older `PurchaseDocumentPages` / RFQ form pages not fully retuned; demo-only purchase backend unchanged.

---

## 2026-07-15 ? Purchase document header hierarchy

### Why
Purchase editors/details used a fragmented `documentStrip` of many tiny highlight boxes (document, status, vendor, type, origin, lines, total, buyer, currency), competing with the live metrics strip.

### Change
- New shared `EnterpriseDocumentHeader` + workspace props: `documentIdentity`, `documentFacts`, `documentMetaChips`.
- `PurchaseCardFormShell` / `EnterpriseWorkspace` prefer the hierarchy API; when identity is set, `documentStrip` is ignored. Identity header always renders in the main canvas (not the factbox rail).
- Migrated editors + details: PO, PR, Invoice, GRN, Return. Secondary chips hold origin/type/department/currency (and page-appropriate equivalents); Lines/totals stay with `EnterpriseFormMetrics`.
- Dense `erp-*` token CSS in `enterprise-workspace.css`.

### How to verify
1. Open `/purchase/orders/new` ? module label, title + status, fact rows, meta chips; no row of 8 tiny boxes.
2. Open an existing PO detail ? same hierarchy with real values.
3. Spot-check PR / Invoice / GRN / Return new + detail.

### Still open
Legacy purchase list/form pages (`PoFormPages`, `PurchaseDocumentPages`, RFQ) may still use `documentStrip`; migrate when those surfaces are polished.

---

## 2026-07-15 ? PO document workflow strip

### Why
PO create/edit and detail relied on a small status badge ? lifecycle stage and next action were easy to miss.

### Change
- New shared `PurchaseDocumentWorkflowStrip`: happy-path steps `Draft ? Pending Approval ? Approved ? Released ? Partially Received ? Fully Received ? Closed` with current step highlighted; Current status + Next action copy.
- Domain map: `invoiced` maps onto Fully Received index (status label still Invoiced); `cancelled` is off-track with note.
- Next actions derived from status (+ permission helpers when present): draft?Submit for Approval, pending?Approve/Await, approved?Release, released?Record GRN, partial?Continue/Close, etc.
- Wired under document header / before metrics on `PurchaseOrderEditorPage` and before General on `PurchaseOrderDetailPage`.
- Styles in `purchase-process.css`; exported from `components/purchase`.

### How to verify
1. New PO ? Draft highlighted + Next action ?Submit for Approval?.
2. Detail on a released PO ? Released highlighted + ?Record GRN / await receipt? (or await receipt if no GRN create perm).
3. `npx tsc --noEmit` in `frontend/` if available.

### Still open
Adopt strip on other purchase docs with similar lifecycles (PR/GRN/invoice) when useful.

---

## 2026-07-15 ? PO General Information source refs

### Why
Manual PO create/edit showed five disabled Source Reference fields with ???, cluttering General Information.

### Change
- `PurchaseOrderEditorPage.tsx`: Manual origin shows a single quiet fact `Source: Manual Entry` (no Source References group).
- Sourced POs show only origin-relevant populated source refs under `ErpFormSpan` ?Source References?; empty ??? fields are hidden.
- Edit of a sourced PO still surfaces linked numbers even when `originMode` defaults to manual (no sync from `po.origin`).

### How to verify
1. New PO (manual) ? General Information shows `Source: Manual Entry` only; no five dash fields.
2. PO created from PR/VQ/comparison/blanket ? only linked source number(s) appear.

### Still open
Edit-load still does not sync `originMode` from `po.origin`.

---

## 2026-07-15 ? Purchase Terms & Notes tabs

### Why
PO create/edit (and revise) stacked three large Terms / Internal Notes / Remarks textareas, wasting vertical space.

### Change
- New shared `PurchaseTermsNotesTabs`: TabStrip with one capped textarea at a time (Terms 140?160px, Notes 90?100px, Remarks 70?80px); content-dot + tooltip preview when filled.
- Wired into `PurchaseOrderEditorPage` (attachments stay below tabs) and `PurchaseOrderRevisePage` (section stays collapsed by default).
- `TabStrip` gained optional `indicator` / `title` for content polish.
- Invoice/Return editors only expose a single remarks field today ? shared component ready when they gain the trio.

### How to verify
1. Open PO new/edit ? Terms & Notes ? only one textarea visible; switch tabs; content-dot when filled.
2. Attachments remain below the tabbed editors.
3. PO revise page Terms & Notes behaves the same (collapsed by default).

### Still open
Adopt `PurchaseTermsNotesTabs` on invoice/return if those documents add terms + internal notes fields.

---

## 2026-07-15 ? Purchase Tax & Totals two-column redesign

### Why
Tax & Totals on purchase editors mixed editable charges with calculated totals as `Input readOnly` lookalikes, with no visual hierarchy for Grand Total.

### Change
- Added shared `PurchaseTaxTotalsPanel.tsx`: left column charges (plain values + compact inputs), right column final calculation as `dl` rows with tinted dominant Grand Total.
- Wired into PO, Invoice, Return, and Vendor Quotation editors (`columns={1}` on the section so the panel owns layout).
- Preserved IGST vs CGST+SGST and TCS/TDS conditional disclosure; calc logic unchanged.

### How to verify
1. PO new/edit ? Tax & Totals two columns; Basic/Line Discount plain text; Trade Discount?TCS compact inputs; right side Taxable/GST/Round Off/Grand Total without fake inputs.
2. Toggle interstate vendor ? IGST only vs CGST+SGST on the right.
3. Invoice / Return / Vendor Quotation Totals sections use the same panel pattern.

### Still open
Invoice header totals stay GST-aggregated (no CGST/SGST/IGST split in line aggregate); detail pages still use `ErpViewField` layout.

---

## 2026-07-15 ? PO conditional field disclosure

### Why
Purchase Order create/edit showed every source, GST split, inspection, TCS, and insurance field at once; complexity should reveal by origin and domain signals.

### Change
- `PurchaseOrderEditorPage.tsx`: origin-gated Source References (PR / RFQ+comparison / VQ?RFQ / blanket / Manual Entry only); CGST+SGST vs IGST in line grid and Tax & Totals via `isInterstate` (recomputed from place of supply vs vendor state); Inspection Requirement, TCS, Insurance Terms gated on setup/item/order/charge signals. Save still sends zeros/nulls for hidden fields.
- `PurchaseInvoiceEditorPage.tsx`: TCS (and TDS) line columns + Tax section totals hidden unless setup-enabled or amounts present. No CGST/SGST/IGST columns existed on invoice (single Tax GST total).
- Purchase return editor: no matching GST/TCS/insurance disclosure fields.

### How to verify
1. Manual PO ? only ?Source: Manual Entry?; no unused source refs.
2. Change Place of Supply away from vendor state ? IGST columns; match again ? CGST+SGST.
3. Enter insurance charges &gt; 0 ? Insurance Terms appears; leave charges 0 and empty terms ? hidden.
4. Invoice editor ? TCS hidden when setup `tcsEnabled` false and amounts zero.

### Still open
Vendor master has no `inspectionRequired` flag; inspection gate uses item `qcRequired`, setup categories, header text, capital/job_work order type.

---

## 2026-07-15 ? Purchase Commercial Terms dropdowns

### Why
PO create/edit Commercial Terms used free-text inputs for standardized values (payment/delivery/freight/price basis), and the section lacked clear Dates / Commercial / Additional Conditions grouping.

### Change
- Added shared picklists in `data/purchase/purchaseCommercialTerms.ts` (aligned with Setup + seed PO values).
- `PurchaseTermSelect` preserves saved values not in the list.
- PO editor Commercial Terms: three ErpFormSpan groups; Select for Payment/Delivery/Freight/Price Basis/Packing/Insurance; Warranty + Inspection remain free-text; Insurance/Inspection stay conditionally disclosed.
- Invoice editor Payment Terms uses the same payment picklist (no full commercial block on invoice).
- Purchase Setup default payment/delivery options import the shared lists.

### How to verify
1. Open `/purchase/orders/new` ? Commercial Terms (collapsed by default) ? Dates / Commercial / Additional Conditions with dropdowns.
2. Edit a seed PO with custom freight text ? current value still appears in the select.
3. Invoice editor Payment Terms is a dropdown.

### Still open
RFQ / VQ / Revise pages still use free-text commercial fields if full consistency is needed later.

---

## 2026-07-15 ? PO General Information source refs

### Why
Manual PO create/edit showed five disabled Source Reference fields with ???, cluttering General Information.

### Change
- `PurchaseOrderEditorPage.tsx`: Manual origin shows a single quiet fact `Source: Manual Entry` (no Source References group).
- Sourced POs show only populated source refs under an `ErpFormSpan` ?Source References? label; empty ??? fields are hidden.

### How to verify
1. New PO (manual) ? General Information shows `Source: Manual Entry` only; no five dash fields.
2. PO created from PR/VQ/comparison/blanket ? only linked source number(s) appear.

### Still open
Edit-load still does not sync `originMode` from `po.origin` (display uses populated refs when present).

---

## 2026-07-15 ? Purchase editor single document summary

### Why
Purchase document editors showed the same Units/Subtotal/Tax/Grand Total KPIs twice ? below the header and again inside Tax & Totals / Financial Summary.

### Change
- Keep one live `EnterpriseFormMetrics` strip directly under the document header (above section nav where present).
- Remove inner `EnterpriseFormMetrics` from Tax & Totals / Financial / lines footers on PO, Invoice, PR, Return, and GRN editors.
- PR & Return Financial sections now use field breakdowns only (estimates / taxable?GST?total).
- PO & Invoice detail Tax sections: drop duplicate totals KPI band; keep detailed `ErpViewField` breakdown (PO adds Grand Total field).

### How to verify
1. Open PO new/edit ? one metrics strip under header; Tax & Totals open body is charges/tax fields only (collapsed summary may still show Subtotal?GST?Total).
2. Confirm Invoice, PR, Return, GRN editors likewise have a single top metrics strip.

### Still open
Coordinate with BC FastTabs work: Tax collapsed summary is fine; open Tax body must stay metrics-strip-free.

---

## 2026-07-15 ? Purchase Item Code cell density

### Why
PR/PO Item Lines stacked catalog select + manual code input vertically, making rows tall.

### Change
- New shared `PurchaseItemCodeCell`: catalog select and manual code side-by-side on one `h-8` row (manual only shows code input).
- Wired into `PurchaseRequisitionEditorPage` and `PurchaseOrderEditorPage` Item Lines tables.

### How to verify
1. Open PR or PO editor Item Lines ? Item Code is single-row height.
2. Pick catalog item ? select only; clear to manual ? select + Code input inline.

### Still open
Other purchase editors (invoice/GRN/RFQ) did not use the stacked pattern; adopt `PurchaseItemCodeCell` if they add manual code later.

---

## 2026-07-15 ? GRN create/edit UI polish

### Why
GRN editor lagged PR/PO editor density (flat header grid, no document strip/metrics, weak section chrome).

### Change
- `GrnEditorPage.tsx`: `documentStrip`, `EnterpriseFormMetrics`, dense collapsible `ErpCardSection` + `ErpFormSpan` groups, PO-source chips, section nav, breadcrumbs `Purchase ? Goods Receipts ? New|doc`, `erp-table` lines.
- `pageGuideRegistry.ts`: disable Purpose/Next-step banner on `/purchase/grn/new` and `/purchase/grn/:id/edit`.
- Create-from-PO, validation, save draft, submit, and excess-permission flow preserved.

### How to verify
1. Open `/purchase/grn/new` ? strip, metrics, PO chips, Document/Receiving/Lines/Notes sections.
2. Create from PO (`?poId=?`) ? lines hydrate; save draft / submit still work.
3. Confirm no Purpose/Next-step page guide on new/edit.

### Still open
Purchase API deferred; GRN remains demo store.

---

## 2026-07-15 ? Page guide dismiss (session-only)

### Why
Purpose / Next step banners were always visible; users needed a way to hide them without permanent persistence.

### Change
- `ErpPageGuide.tsx`: X dismiss button (top-right, `aria-label="Dismiss"`); hides guide via component `useState` only ? reappears on remount / refresh / navigate-back. No localStorage/sessionStorage.

### How to verify
1. Open any page with Purpose/Next step (e.g. purchase list) ? dismiss X; banner vanishes.
2. Refresh or leave and return ? banner shows again.

### Still open
None for this change.

---

## 2026-07-15 ? Purchase Return create/edit UI polish

### Why
Return editor lagged polished PR/PO create density (no document strip, nested grids, chunky origin chips, incomplete breadcrumbs).

### Change
- `PurchaseReturnEditorPage.tsx`: `documentStrip`, `EnterpriseFormMetrics`, dense `ErpCardSection` + `ErpFormSpan` groups, compact origin chips (PO style), icons/subtitles/collapsible, breadcrumbs `Purchase ? Returns ? New/Edit`, financial summary band.
- `pageGuideRegistry.ts`: disable Purpose/Next-step banner on `/purchase/returns/new` and `/purchase/returns/:id/edit`.
- Create-from-origin / save / submit lifecycle preserved (demo).

### How to verify
1. Open `/purchase/returns/new` ? strip, metrics, origin chips, dense header, lines, totals.
2. Confirm Save Draft / Submit still work; create-from-GRN/QI still loads lines.

### Still open
Purchase API deferred; returns remain demo store.

---

## 2026-07-15 ? Purchase Invoice detail UI polish

### Why
Invoice detail lagged polished PO/RFQ detail density (no document strip, loose header section, weak totals hierarchy).

### Change
- `PurchaseInvoiceDetailPage.tsx`: `detailMode`, `documentStrip`, denser `ErpCardSection` chrome (icons/subtitles/accents), totals band, `erp-table` lines/matching, command-bar primary lifecycle action, breadcrumbs `Purchase ? Invoices ? document`.
- Lifecycle actions and demo bindings preserved (verify/submit/approve/reject/hold/exception/post/debit/print).

### How to verify
1. Open `/purchase/invoices/prd-inv-7002` ? strip, matching section, lines, tax totals.
2. Confirm lifecycle buttons still appear by status/perms.

### Still open
Purchase API deferred; invoice remains demo store.

---

## 2026-07-15 ? Purchase Invoice editor UI polish (PR/PO pattern parity)

### Why
Invoice create/edit still used nested field grids and lacked the document strip / metrics / dense section chrome already shipped on PR and PO editors.

### Change
- `PurchaseInvoiceEditorPage.tsx`: `documentStrip`, `EnterpriseFormMetrics`, dense `ErpCardSection` (icons/subtitles/collapsible), `ErpFormSpan` group labels, polished origin chips, Tax & Totals / Notes sections, breadcrumb `Purchase ? Invoices ? New/Edit`.
- `pageGuideRegistry`: skip Purpose/Next-step banner on `/purchase/invoices/new` and invoice edit (same as PR/PO).
- Business logic / create-from-origin / matching / save-verify unchanged (UI only). Did not touch invoice detail page.

### How to verify
1. Open `/purchase/invoices/new` ? denser 3-col sections, strip metrics, origin chips.
2. Switch PO / GRN / Service PO origins ? create-from-source still navigates to edit.
3. `npx tsc --noEmit` in `frontend` for the touched editor.

### Still open
Purchase API deferred; transactional invoice remains demo store.

---

## 2026-07-15 ? Purchase register Overview / Suggestions right rail

### Why
`/purchase/orders` (and PR register) lacked the CRM-style right column for register context.

### Change
- Added `PurchaseRegisterContextPanel` wrapping enterprise `EnterpriseFormContextPanel` (`Overview` + `Suggestions`).
- Layout uses the CRM/master register grid `xl:grid-cols-[1fr_280px]` (same as CRM master lists).
- Wired purchase-relevant overview counts + clickable suggestions on PO list and PR list (`poRegisterInsights` / `prRegisterInsights`).
- Suggestions apply list filters (pending approval, overdue, pending delivery, etc.) or navigate to create / setup.

### How to verify
1. Open `/purchase/orders` ? right rail shows Overview stats and Suggestions actions.
2. Click a suggestion (e.g. pending approval) ? status filter updates.
3. Open `/purchase/requisitions` ? same rail pattern with PR metrics/tips.
4. `npx tsc --noEmit` in `frontend` for touched files.

### Still open
Other purchase lists (RFQ/GRN/invoice) still use older shells without this rail; extend when those registers are polished.

---

## 2026-07-15 ? Purchase Order editor UI polish (PR pattern parity)

### Why
PO create/edit still used nested field grids and lacked the document strip / metrics / dense section chrome already shipped on Purchase Requisition editor.

### Change
- `PurchaseOrderEditorPage.tsx`: `documentStrip`, `EnterpriseFormMetrics`, dense `ErpCardSection` (icons/subtitles/collapsible), `ErpFormSpan` group labels, polished origin chips, tax totals emphasis, breadcrumb `Purchase ? Orders ? New/Edit`.
- `pageGuideRegistry`: skip Purpose/Next-step banner on `/purchase/orders/new` and PO edit (same as PR).
- Business logic / origin create flows unchanged (UI only).

### How to verify
1. Open `/purchase/orders/new` ? denser 3-col sections, strip metrics, origin chips.
2. Switch Manual / From PR (etc.) ? create flows still work.
3. `npx tsc --noEmit` in `frontend` (or project typecheck) for the touched editor.

### Still open
Purchase API deferred; transactional PO remains demo store.

---

## 2026-07-15 ? Purchase Orders list CRM register polish

### Why
Align `/purchase/orders` list UI with CRM Leads / Purchase Requisitions register patterns (KPI strip, embedded toolbar, dense ErpDataGrid).

### Change
- Reworked `PurchaseOrderListPage` to use `EnterpriseRegisterTableShell`, `kpiStrip`, `CrmFilterDrawer`, saved views, and sort ? same shell as PR list.
- Added `PurchaseOrdersTable`, `poFilterConfig`, `poKpiItems`, and `PO_REGISTER_PRESETS`.
- Preserved demo data via `getPurchaseOrderList`, row actions, export, query-param status deep links (`overdue`, `pending_delivery`, domain statuses).
- Did not touch `PurchaseOrderEditorPage` (concurrent edit).

### How to verify
1. Open `http://127.0.0.1:5173/purchase/orders` in demo mode.
2. Confirm KPI strip, register search/filters/sort/saved views, dense table with PO number links and status tones.
3. Dashboard links like `?status=pending_approval` / `?status=overdue` still filter the list.

---

## 2026-07-15 ? Apply purchase.view seed + Tenant Admin soft-guard fallback

### Why
`admin@vasant-trailers.com` (Tenant Admin, UI label Admin) still saw Access Denied on `/purchase` requiring `purchase.view`. Prior catalog/role-pack edits existed in code but **DB was never re-seeded** ? `purchase.view` permission row missing and Tenant Admin had **0** `purchase.*` RolePermissions.

### Root cause
- Soft route gate (`ProtectedOutlet` ? `canRoute` ? `canPurchaseRoute` ? `canPurchasePermission`) reads JWT/session `user.permissions` in API mode.
- Session permissions come from DB RolePermissions at login / `/auth/me` ? not from FE role label.
- Code catalog had `purchase.view` for Tenant Admin / Admin; live MySQL did not.

### Change
- Seed now loads dotenv / builds `DATABASE_URL` (same as `prisma-cli`) so `npm run db:seed` works without an explicit env.
- **Ran `npm run db:seed` successfully** ? verified Tenant Admin now has 34 `purchase.*` including `purchase.view`.
- FE soft-guard fallback: API-mode users with role `Tenant Admin` / `Admin` / `Administrator` / `Super Admin` pass purchase permission checks even if RolePermissions briefly lag (not a total gate disable).
- Demo admin seed: added `Admin` alias pack matching Tenant Admin (includes full `purchase.*`).

### How to verify
1. Hard refresh `http://127.0.0.1:5173` (AuthProvider `/auth/me` refreshes permissions without full re-login) ? or re-login as `admin@vasant-trailers.com` / `Admin@123`.
2. Open `/purchase` and Dashboard Purchase tab ? module loads.
3. Non-admin roles without purchase grants still denied.

### Still open
Purchase API deferred; FE soft-guards only.

---

## 2026-07-15 ? Fix Tenant Admin Purchase Access Denied

### Why
API-mode Tenant Admin (Rajesh Patel / Admin) hit Access Denied on `/purchase` ? JWT lacked `purchase.view` / purchase catalog keys after a prior agent added granular `purchase.*` strings without ensuring module shell + role assignment sync.

### Change
- Registered `purchase.view` (module shell) alongside `purchase.dashboard.view` in backend `PERMISSIONS` and frontend purchase catalog.
- `Tenant Admin` / `Admin` role packs include full `purchase.*` (via catalog filter); seed also creates `Admin` + `Purchase Executive`.
- Demo admin seed catalog + role packs synced; route/nav shell accepts `purchase.view` or legacy `purchase.dashboard.view`.
- Access Denied page already uses purchase route resolver for correct required-permission label.

### How to verify
1. `cd backend && npm run db:seed` (upserts new RolePermissions for Tenant Admin).
2. Re-login as `admin@vasant-trailers.com` / `Admin@123`.
3. Open `/purchase` ? module loads (gate still enforced; no bypass).

### Still open
Purchase API deferred; live tenants need re-seed (or equivalent RolePermission grant) after deploy.

---

## 2026-07-15 ? Purchase Module frontend permissions (FE-only until purchase API)

### Why
Complete FE soft-gating for fine-grained `purchase.*` (nav, soft route guards, command-bar / row actions) so demo RBAC and JWT catalogs stay aligned. Soft-guard only ? purchase API remains deferred.

### Change
- Helpers already in `utils/permissions/purchase.ts` (`canPurchasePermission`, `usePurchasePermissions`, `purchaseActionGate`, route/nav resolvers); BE + FE admin seed role packs for Requester ? Administrator (+ `purchase.view` shell key).
- Nav: sidebar Purchase category + Dynamics sub-nav hide items without view/manage perms.
- Routes: `ProtectedOutlet` via `canPurchaseRoute`; Access Denied shows fine-grained key.
- Domain pages wire create/lifecycle actions by permission **and** document status (PR, RFQ, VQ, comparison, PO, GRN, QI, invoice, return, setup, approvals).

### How to test
1. Demo admin ? Purchase nav + actions unchanged.
2. Demo role switch (Requester / Store Executive / Finance) ? nav and actions shrink; denied deep links ? Access Denied.
3. Typecheck purchase-touched files; do not treat skipped live API as pass.

### Still open
Purchase API + server-side enforcement ? FE gates are not security until then.

---

## 2026-07-15 ? Purchase Module frontend quality review (E2E)

### Why
Full mock procurement quality pass: umbrella E2E flow, lint/type blockers in purchase paths, linked-docs completeness, verification evidence.

### Change
- New `frontend/scripts/smoke-purchase-e2e-flow.ts` (+ `npm run test:purchase-e2e` / `smoke:purchase-e2e`) covering PR ? RFQ ? VQ ? Compare (non-lowest reason) ? PO approve/release ? partial GRN ? QI ? post (`inventoryPostDeferred`) ? invoice 3-way match/exception ? return ? linked docs ? `runPurchaseReport('po-open')`.
- `PurchaseOrderLinkedDocuments.returns` + PO detail Linked Documents section (invoices link to `/purchase/invoices/:id`).
- Lint: unconditional hooks in legacy `PurchaseFormPages` / `PurchaseMasterListPage` (move early returns below hooks / drop conditional `useMemo`).
- Reports service already importing status labels from `types/purchaseDomain` (sibling).

### How to test
1. `npx tsx scripts/smoke-purchase-e2e-flow.ts` ? `ok ? purchase E2E flow complete`
2. `npm run test:purchase:production` ? 39/39
3. Spot nav: `/purchase/invoices`, `/purchase/grn`, `/purchase/reports`, `/purchase/quality-inspections`
4. Browser checklist (actions/mobile/console) **not** fully exercised this session ? service smoke + route compile evidence only.

### Still open
Purchase / inventory / AP backends deferred; full SPA browser UAT; FE `tsc` still fails on pre-existing non-purchase files (bomStore, CRM/master hooks, demo seed).

---

## 2026-07-15 ? Purchase Reports & Analytics (domain mock)

### Why
Replace Zustand Purchase Reports stub with a full Reports hub + runners over mock domain data (demo only).

### Change
- Types: `frontend/src/types/purchaseReports.ts` (catalog ids, filters, columns, results).
- Service: `purchaseReportsService.ts` ? `getPurchaseReportCatalog`, `runPurchaseReport`, filter options; derives from public domain getters; placeholders for Vendor Outstanding + ITC.
- UI: `PurchaseReportsHubPage` + `PurchaseReportRunnerPage` with filters, DataTable, Excel(CSV)/PDF(demo)/Print, doc-number drill-downs.
- Routes: `/purchase/reports`, `/purchase/reports/:reportId`.
- Smoke: `scripts/smoke-purchase-reports.ts` (36 reports, PR register rows).

### How to test
1. `/purchase/reports` ? six category sections, open Purchase Requisition Register.
2. Apply date/vendor filters; Export to Excel / PDF; Print; click PR/PO links.
3. Open Vendor Outstanding / ITC ? placeholder empty state with filters.
4. `npx tsx scripts/smoke-purchase-reports.ts`

### Still open
Purchase backend deferred; real Excel/PDF libs not added; invoice detail route still placeholder deep-link.

---

## 2026-07-15 ? Purchase Invoice (domain service)

### Why
Domain-backed purchase invoice register with multi-origin create, three-way matching, setup tolerances, and exception-gated posting ? same mock-service pattern as RFQ / VQ / PO / GRN.

### Change
- Domain: invoice origin, reverse charge, e-invoice ref, TDS/TCS lines, matching result DTOs, exception / debit-note fields; `on_hold` status.
- Setup: invoice match tolerances + `allowDirectInvoice` (already on Purchase Setup `invoice_matching` tab).
- Service: list/CRUD, create from PO / posted GRN / service PO / direct, verify, submit/approve/reject/hold, post (tolerance gate), matching compute, debit-note stub, duplicate vendor-invoice detection.
- Pages: `PurchaseInvoiceListPage` / `Editor` (origin chips) / `Detail` (matching panel + actions) / `Print`; routes `/purchase/invoices/*`; nav item.
- Seed: PINV-7001 fully matched from GRN; PINV-7002 rate-mismatch demo for exception posting.

### How to test
1. `/purchase/invoices` ? PINV-7001 / 7002; New Invoice ? PO / Posted GRN / Vendor / Service / Direct.
2. Save Draft ? Verify ? matching badges; mismatch seed ? Post blocked until Approve Exception.
3. Purchase Setup ? Invoice matching tolerances.
4. `npx tsx scripts/smoke-purchase-invoice.ts`

### Still open
Purchase / AP / GL backend deferred ? post confirms in demo only (no live ledger).

---

## 2026-07-15 ? Goods Receipt Note + Quality Inspection (domain service)

### Why
Operational GRN creation from released POs with qty / batch-serial-expiry validations, quality inspection disposition, and post with inventory deferred (demo mock).

### Change
- Domain: item control flags (`batchControlled` / `serialControlled` / `expiryControlled`); enriched GRN header/lines (challan, LR, warehouse, qty breakdown, inspection status); QI parameter table + results (accepted / partial / rejected / under deviation / hold); list rows.
- Seed: draft GRN-6002 against released PO-5002; pending QI-6102; posted GRN-6001 + completed QI-6101 retained.
- Service: `getGrnList`, `createGRNFromPo`, `updateGRN`, `submitGRN`, `postGRN` (inspection gate + `inventoryPostDeferred`); QI list/CRUD + accept/reject/hold/requestDeviation.
- Pages: `GrnListPage` / `GrnEditorPage` / `GrnDetailPage`; `QualityInspectionListPage` / `QualityInspectionDetailPage`.
- Routes: `/purchase/grn`, `/new?poId=`, `/:id`, `/:id/edit`, `/:id/print`; `/purchase/quality-inspections`.

### How to test
1. `/purchase/grn` ? GRN-6001 posted, GRN-6002 draft; New GRN from PO-5001 (open qty) or PO detail ? Create GRN.
2. Save Draft / Submit ? pending inspection + QI; Post without QI ? blocked; Accept on QI ? Post ? inventory deferred confirmation.
3. Excess qty without Allow Excess ? blocked; batch-controlled item without batch ? blocked.
4. `npx tsx scripts/smoke-purchase-grn-qi.ts`

### Still open
Purchase / inventory backend deferred; live stock post not claimed.

---

## 2026-07-15 ? Purchase Return (domain service)

### Why
Domain-backed purchase return list / create / detail / print with multi-origin create, reason enums, approval/post/cancel, debit-note and replacement PO stubs ? replacing Zustand screens at the route layer.

### Change
- Domain: origins, reason enums, extended lines (batch/serial, available/return qty, unit cost, tax, replacement), debitNote/replacement flags, linked replacement PO + debit note.
- Service: list/CRUD, create from GRN / QI / reason presets, submit/approve/post/cancel, createDebitNote, createReplacementPo stubs.
- Pages: `PurchaseReturnListPage`, `Editor` (origin chips), `Detail`, `Print` return challan; routes under `/purchase/returns/*`.
- Seed: posted `PRTN-2526-8001` (linked DN) + draft `PRTN-2526-8002` against GRN/PO/invoice/QI.

### How to test
1. `/purchase/returns` ? draft + posted rows; open PRTN-2526-8001 (linked debit note).
2. New Return ? origin chips / Load from GRN or QI; Save Draft ? Submit ? Approve ? Post Return.
3. Detail ? Create Debit Note / Create Replacement PO; Print Return Challan.
4. `npx tsx scripts/smoke-purchase-return.ts`

### Still open
Purchase backend deferred; Zustand return pages left unused at route level.

---

## 2026-07-15 ? Purchase Setup multi-tab configuration

### Why
Expand Purchase Setup from approval-matrix-only into a full API-ready configuration UI so later modules can read general, tax, matching, receiving, quality, print, and notification defaults from the mock service.

### Change
- Extended `PurchaseSetup` with `general`, `numberSeries`, `tax`, `invoiceMatchTolerances` (merged with invoice-agent tolerances), `receiving`, `quality`, `print`, `notifications`; kept `approvalMatrix`, `availableBudgetPlaceholderInr`, `allowDirectInvoice`.
- Seed + `updatePurchaseSetup` deep-merge persistence for all sections.
- `PurchaseSetupPage` ? 9 tabs (General, Number Series, Approval, Tax, Invoice Matching, Receiving, Quality, Print, Notifications); one Save posts whole setup; `#approval-matrix` hash opens Approval tab.
- Route `/purchase/setup` and masters `approval-matrix` redirect unchanged.

### How to test
1. `/purchase/setup` ? walk all 9 tabs; Save; reload page and confirm values persist in session mock state.
2. `/purchase/masters/approval-matrix` ? lands on Setup; hash `#approval-matrix` opens Approval tab; edit matrix ? Approvals queue still uses roles.
3. Toggle Invoice Matching tolerances / Allow direct invoice; confirm no typecheck errors (`npx tsc --noEmit` in frontend).

### Still open
Purchase backend deferred; setup is config storage only (except approval matrix consumption).

---

## 2026-07-15 ? Purchase Order (domain service)

### Why
Full commercial PO list / create / detail / print with multi-origin create, lifecycle actions, and post-release revision (no direct edit of released POs).

### Change
- Domain: order type/origin, commercial terms, extended lines, tax extras (trade discount, packing, insurance, TCS), approval/invoice status, change history + revision snapshots, blanket orders.
- Service: list/CRUD, submit/approve/release/reopen/send/close/cancel, `revisePurchaseOrder`, create from PR / VQ / comparison / blanket / manual.
- Pages: `PurchaseOrderListPage`, `Editor` (origin chips), `Detail`, `Revise`, `Print`; routes under `/purchase/orders/*`.
- Seed: PO-5001/5002/5003 enriched; blanket `BLO-2526-9001`.

### How to test
1. `/purchase/orders` ? columns (GST, received %, invoice/approval status); open PO-5001.
2. New PO ? try Manual / PR / VQ / Comparison / Blanket; Save Draft ? Submit ? Approve ? Release.
3. Released PO ? Edit blocked; Revise with reason; change history shows original vs new.
4. `/purchase/orders/:id/print` ? print preview.
5. `npx tsx scripts/smoke-purchase-orders.ts`

### Still open
Purchase backend deferred; GRN create from PO still navigates to Zustand GRN register.

---

## 2026-07-15 ? Vendor Quotation + Quotation Comparison (domain service)

### Why
Operational vendor quotation entry and multi-vendor comparison with selection rules, recommendation/approval, and PO creation ? replacing Zustand screens at the route layer.

### Change
- Domain: full VQ header/lines/totals; comparison method, criteria, selection mode, highlight flags, recommendation status; vendor quality/delivery scores.
- Service: VQ list/CRUD/submit; `buildQuotationComparison`, selection update (reason required if not lowest cost), recommend, approve, `createPurchaseOrderFromComparison`.
- Pages: `VendorQuotationListPage` / `Editor` / `Detail`; `QuotationComparisonIndexPage` / `QuotationComparisonPage` (matrix, highlights, export/print).
- Routes: `/purchase/vendor-quotations`, `/new`, `/:id`, `/:id/edit`; `/purchase/comparison`, `/comparison/:rfqId`.

### How to test
1. `/purchase/vendor-quotations` ? VQ-4001/4002; New entry from RFQ; Save Draft / Submit.
2. `/purchase/comparison/prd-rfq-2001` ? Build matrix; highlights for lowest basic/landed, delivery, preferred, non-compliant.
3. Select non-lowest vendor without reason ? blocked; with reason ? Recommend ? Approve ? Create PO.
4. `npx tsx scripts/smoke-purchase-vq-comparison.ts`

### Still open
Purchase backend deferred; per-line multi-vendor PO split deferred (single recommended vendor PO).

---

## 2026-07-15 ? Request for Quotation (domain service)

### Why
Domain-backed RFQ list / create / detail with PR origin modes, vendor invite lifecycle, and send preview.

### Change
- Extended RFQ model: full lines (source PR, target price), multi-PR ids, freight/inspection/contacts, vendor rating/last price/selected, list row enrichment.
- Service: `getRfqList`, `createRFQ`, `updateRFQ`, `sendRFQ`, `cancelRFQ`, `getRecommendedVendorsForItems`, multi-PR create.
- Pages: `RfqListPage`, `RfqEditorPage` (manual / single PR / multi-PR), `RfqDetailPage` + send preview modal.
- Routes wired; Zustand RFQ list/detail replaced at route level (legacy docs remain in store for quotes/comparison).

### How to test
1. `/purchase/rfqs` ? columns + draft RFQ-2002 / evaluation RFQ-2001.
2. New RFQ ? pick approved PR(s) or manual; add vendors; Save Draft; Send with preview.
3. Detail shows vendor received/responded status after send.
4. `npx tsx scripts/smoke-purchase-rfq.ts`

### Still open
Vendor quotation / comparison still Zustand; purchase backend deferred.

---

## 2026-07-15 ? Purchase Approvals + Setup matrix

### Why
Operational approval queue for PRs/POs with configurable amount-based matrix (not hardcoded in page UI).

### Change
- `PurchaseApprovalsPage` ? tabs (Pending / Approved by Me / Rejected by Me / All History), filters, actions, review drawer.
- `PurchaseSetupPage` (`/purchase/setup`) ? editable approval matrix tiers + budget placeholder.
- Domain service: multi-level submit/approve/reject/send-back/delegate using setup matrix; queue + review APIs.
- Seed: pending PR (Purchase Head L2) + pending PO (Department Head); nav + masters link wired.

### How to test
1. `/purchase/approvals` ? Pending shows PR-1002 and PO-5003; Review drawer Approve/Reject/Send Back.
2. Reject/Send Back without comment ? blocked.
3. `/purchase/setup` ? change tier thresholds; Save; new submits follow matrix.
4. Demo admin can act on all pending roles.

### Still open
Live budget integration; purchase backend deferred.

---

## 2026-07-15 ? Purchase Requisition Create/Edit (domain service)

### Why
BC-inspired manual PR document for create/edit with validation and unsaved-change guard, backed by the purchase domain mock service.

### Change
- `PurchaseRequisitionEditorPage` ? General / Item Lines / Financial Summary / Attachments / Approval & Activity; header actions (Back, Save Draft, Submit, Delete, Print, More).
- Validations 1?13 + duplicate-item warnings; submit blocked until errors clear.
- `purchaseRequisitionValidation.ts`; service create/update/delete support extended PR fields.
- Routes: `/purchase/requisitions/new` and `/:id/edit` ? editor (replaces legacy Zustand create and domain stub edit).

### How to test
1. Open `/purchase/requisitions/new` ? PR Number shows Auto-generated; fill Department/Location + line; Save Draft ? number assigned, URL switches to edit.
2. Submit with missing Purpose on Urgent / empty lines ? blocked; fix and submit ? detail view.
3. Edit draft `prd-pr-1003`; leave with unsaved edits ? browser confirms.
4. Duplicate catalog item on two lines ? warning (does not block).

### Still open
Purchase backend API deferred; RFQ/PO still partially Zustand.

---

## 2026-07-15 ? Purchase Requisitions list (domain service)

### Why
Operational PR register with search/filters, status-aware actions, and domain mock data ? ready for future API swap.

### Change
- `PurchaseRequisitionListPage` ? summary cards, filters, sortable/paginated table, status-gated row actions, CSV export.
- Domain model: `priority`, expanded `source` labels (Manual / Material Planning / ? / Sales Order), list row enrichment.
- Service: `getPurchaseRequisitionListSummary`, cancel / duplicate / convert-to-RFQ / convert-to-PO.
- Domain detail/edit for `prd-*` ids; legacy Zustand detail remains as fallback.
- Seed: approved packing PR (`PR-2526-1004`) for convert actions.

### How to test
1. Open `/purchase/requisitions`.
2. Filter by status/source; click summary cards; export CSV.
3. Draft ? Edit / Submit; Approved ? Convert to RFQ or PO; converted rows show linked RFQ/PO.
4. PR number opens domain detail.

### Still open
RFQ/PO registers and transactional purchase beyond PR still mix Zustand vs domain service; purchase backend deferred.

---

## 2026-07-15 ? Purchase Dashboard (domain service)

### Why
Replace the store-backed purchase hub hero with an operational manufacturing dashboard fed by the Promise mock `purchaseService`.

### Change
- Extended `PurchaseDashboardData` + `getPurchaseDashboard(filters)` (date/location, KPIs, status buckets, deliveries, pending actions, trend, category, vendors, activity).
- Rewrote `PurchaseModuleDashboard` ? date/location filters, refresh, Create PR, 8 KPIs, sections, Recharts charts, loading/empty/error.
- Added `components/purchase/PurchaseDashboardCharts.tsx` (trend / category / top vendors).
- Existing PR/RFQ/PO list pages unchanged (still Zustand).

### How to test
1. Open `/purchase` (demo mode).
2. Confirm KPIs and Upcoming Deliveries load from mock service; Refresh / date-FY filters work.
3. Click KPI / status / delivery rows ? related `/purchase/...` routes.
4. `npx tsx scripts/smoke-purchase-domain-service.ts`.

### Verify
Smoke KPIs OK; no new TS errors in purchase dashboard/service files.

### Still open
List pages do not yet honour `?status=` query filters (links land on register). Invoice pending links to reports focus until AP invoice list exists.

---

## 2026-07-15 ? Purchase domain models + mock service layer

### Why
Prepare shared, API-ready Purchase data structures and a Promise-based mock service before UI/API wiring, without changing the existing Zustand-backed Purchase screens.

### Change
- New `frontend/src/types/purchaseDomain.ts` ? PR/RFQ/VQ/PO/GRN/QI/Invoice/Return models, Vendor/PurchaseItem, approvals, attachments, status enums + labels (INR / Indian GST fields).
- New `frontend/src/data/purchase/purchaseDomainSeed.ts` ? Indian manufacturing seed (RM/components/consumables/packing/maintenance/job-work; MH + interstate vendors; GSTIN/HSN/SAC).
- New `frontend/src/services/purchase/purchaseService.ts` + barrel ? mock Promise CRUD/lifecycle methods (`getPurchaseDashboard`, PR/RFQ/PO/GRN/invoice/return flows).
- Existing `types/purchase.ts` + `purchaseStore` left untouched (demo pages unchanged).

### How to test
1. `npx tsx scripts/smoke-purchase-domain-service.ts` from `frontend/` ? expects approved PR smoke path.
2. Confirm Purchase UI still uses store: open `/purchase` in demo mode (no behavior change).

### Verify
`tsc` shows no errors in the new purchase domain/service files (pre-existing unrelated repo TS noise remains). Smoke script exercised create ? submit ? approve PR.

### Still open
Wire pages to `purchaseService` (optional migration); backend purchase API still deferred (P3-2).

---

## 2026-07-15 ? User, role, and tenant administration UI

### Why
Backend admin APIs (`/t/:slug/users`, `/t/:slug/roles`, `/tenants`) were complete but had **no** frontend ? system admin, role, and tenant management was API-only (curl/Postman). `PROJECT_STATUS.md` P1-1/P1-2 flagged this as the top open gap.

### Change
- New `modules/systemAdmin/RoleAdminPages.tsx` ? `RoleAdminListPage` / `RoleAdminFormPage` / `RoleAdminDetailPage` with a grouped, collapsible permission-matrix editor (`PermissionMatrixEditor`, per-module "select all"); system roles are read-only (no edit/delete).
- New `modules/systemAdmin/TenantAdminPages.tsx` ? `TenantAdminListPage` / `TenantAdminFormPage` / `TenantAdminDetailPage`; create flow includes the tenant's first admin user; Suspend/Activate/Archive lifecycle actions; gated by `isSuperAdminUser()` with a `SuperAdminOnlyNotice` fallback (tenant admin is platform Super Admin-only, per backend `requireSuperAdmin`).
- `modules/systemAdmin/UserAdminPages.tsx` ? already existed from an interrupted prior session; left as-is except a type fix (see below).
- New `routes/adminRoutes.tsx` ? `/admin` ? redirect to `/admin/users`; `/admin/users`, `/admin/roles`, `/admin/tenants` list/new/:id/:id/edit routes; wired into `routes/index.tsx`.
- `config/navigation.ts` ? new **Administration** category (`Users`, `Roles`, `Tenants`) driving the generic sub-nav/breadcrumb machinery (no bespoke code needed).
- `config/sidebarGroups.ts` ? added `admin` to `SIDEBAR_ICON_MENU` (Settings2 icon) and a new `administration` `SIDEBAR_GROUPS` bucket.
- `components/layout/Sidebar.tsx` ? the Admin icon-rail entry is hidden unless `canAccessAdminShell()` (any of `user.view` / `role.view` / `tenant.view` / Super Admin) ? route-level `/admin` ? `settings.view` gate in `permissionMatrix.ts` already existed from the prior session.
- `design-system/enterprise/EnterpriseTablePrimitives.tsx` ? fixed a latent bug: `RowActionItem.to` was accepted by callers app-wide (masters row actions, this new admin UI) but `EnterpriseRowActionsMenu` never navigated on it. Added `to?: string` to the type + `useNavigate()` call so `to` actually works everywhere it's used.
- `modules/systemAdmin/UserAdminPages.tsx` + `TenantAdminPages.tsx` ? `wrapVoid` helper's parameter type now correctly reads `MaybePromise<StoreActionResult>` (was accidentally typed as "a function returning a function" via `ReturnType<typeof useAdminStore.getState>['deleteX']`, which happens to also describe the property's own type ? pre-existing latent type bug, fixed for correctness).
- Dual-mode preserved: `adminStore.ts` + `adminApiBridge.ts` + `data/admin/seed.ts` already existed and are unchanged; demo mode shows seeded users/roles/tenants, API mode hydrates via `syncAdminFromApi()` on login (`apiHydration.ts`, unchanged).
- No backend changes ? wired only to existing `/api/v1/t/:tenantSlug/users`, `/roles`, `/api/v1/tenants` endpoints.

### How to test
1. `VITE_USE_API=true`, log in as `admin@vasant-trailers.com` (Tenant Admin / Super Admin seed user).
2. Sidebar shows an **Admin** icon (gear) ? click it, or navigate directly to `/admin/users`, `/admin/roles`, `/admin/tenants`.
3. Users: list ? Invite User (create) ? view 360 ? assign/remove role ? edit ? deactivate.
4. Roles: list ? New Role ? toggle permissions per module (or "select all") ? save ? view detail (read-only matrix) ? edit ? delete (non-system only).
5. Tenants (Super Admin only ? shows `SuperAdminOnlyNotice` otherwise): list ? New Tenant (creates tenant + its first admin user in one form) ? edit ? suspend/activate ? archive.
6. Demo mode (`VITE_USE_API=false`): same routes render against `data/admin/seed.ts` seed data ? no login required.

### Verify
Manually cross-checked every prop passed into shared components (`MasterListShell`, `DetailLayout`/`FormLayout`, `ErpCardSection`, `Checkbox`, `Select`, `useMasterLifecycle`, `EnterpriseRowActionsMenu`) against their actual type signatures, and every `adminStore` action/field against `types/admin.ts` and `adminApiBridge.ts`, since the sandboxed shell could not run `npm run typecheck` or the dev server this session (commands returned no exit status ? same `resource_exhausted` shell instability as the interrupted prior attempt). **Typecheck / build were not run ? please run `npm run typecheck` and smoke-test the routes above before treating this as verified.**

### Still open
- Typecheck/build/dev-server verification pending (shell tool unavailable this session).
- No automated tests added for the new admin pages.
- Tenant admin form only supports fields already on `AdminTenant`; no logo/branding upload.

---

## 2026-07-15 ? CRM workflow diagram documentation

### Why
Need a single, code-accurate Mermaid reference for the commercial CRM funnel (lead ? SO) without inventing APIs or statuses.

### Change
- Added [`docs/CRM_WORKFLOW.md`](CRM_WORKFLOW.md): happy path, lead lifecycle, opportunity stages, quotation lifecycle, SO Phase 1, activities/follow-ups, permissions table, UI routes, deferred scope.
- Linked from `PROJECT_MEMORY.md` (commercial funnel + related docs) and `PROJECT_STATUS.md` header.

### Verify
Cross-checked enums/routes against `lead.constants.ts`, `quotation.constants.ts`, `sales-order.workflow.ts`, CRM master seed stages, `crmRoutes.tsx` / `quotationRoutes.tsx`, and existing `crm-workflow-map.md` / `crm-permission-map.md`.

### Still open
None for this docs deliverable.

---

## 2026-07-15 ? Wire Accounting module navigation and routes

### Why
`accountingStore`, seed data, `AccountingDashboardPage` and shared components (`AccountingStatusBadge`, `AccountingRoleBar`, `AccountingReportToolbar`, `JournalLinesGrid`, `PostingPreviewDrawer`) already existed but had **no** router entries and were absent from `navigation.ts` ? unreachable except by manually typing a URL, and even then only the dashboard existed.

### Change
- New `routes/accountingRoutes.tsx` ? registers `/accounting` ? `AccountingDashboardPage` (fully built) plus stub routes for Chart of Accounts, Vouchers (list/new/detail), Receivables (+ ageing, customer ledger), Payables, Bank & Cash (+ reconcile), Manufacturing Accounting, GST & TDS, Ledger Entries, Financial Reports, Period Close, Setup ? wired into `routes/index.tsx`.
- New `modules/accounting/AccountingPlaceholderPage.tsx` ? CRM/Masters-style "shell ready" placeholder (reuses `OperationalPageShell` + `ErpCommandBar`, same pattern as `MasterPlaceholderPage`) for the screens above; dashboard deep-links (`/accounting/vouchers?status=?`, `/accounting/bank/:id/reconcile`, etc.) now resolve instead of 404-ing inside the SPA shell.
- `config/navigation.ts` ? new top-level **Accounting** category (separate from Finance/`/invoices` ? Sales Finance invoice register left untouched) with 12 sub-items (Dashboard, Chart of Accounts, Vouchers, Receivables, Payables, Bank & Cash, Manufacturing Accounting, GST & TDS, Ledger Entries, Financial Reports, Period Close, Setup).
- `config/sidebarGroups.ts` ? added `accounting` to `SIDEBAR_ICON_MENU` (Landmark icon, after Finance) and to the `commercial` `SIDEBAR_GROUPS` bucket.
- No changes to `accountingStore`, seed, types, or existing components ? UI-only mock wiring, no backend posting engine touched.
- Active-highlight + parent-expand behavior comes for free from the existing generic `moduleCategories` ? `getModuleSubNavForPath` / `moduleHeaderIsActive` machinery (same as every other module); no bespoke sidebar code needed.

### Verify
`npm run typecheck` ? no new errors introduced (pre-existing unrelated repo TS noise only, none in touched files). `vite` dev server: `/accounting` and all 12 sub-routes return 200 and render (dashboard fully live; stubs show the shell-ready placeholder with working "Back to Accounting Dashboard" link).

### Still open
Only the dashboard is a real screen; the 11 other routes are placeholders pending actual build-out (list/forms wired to `accountingStore` CRUD, which already exists). No backend/API ? remains **frontend demo mock only** per `finance` deferred-by-design scope.

---

## 2026-07-15 ? Migrate CRM UI off legacy `sales.*` permission checks

### Why
API-mode JWT carries `crm.*` / `crm.sales_order.*`; several CRM list/360 gates still used demo matrix `sales.edit` / `sales.override`, so UI could show actions that 403 on the API.

### Change
- Lead / opportunity / company / contact / engagement / 360 pages ? `canCrmPermission('crm?')`
- CRM route shell + mobile CRM ? `canAccessCrmShell` / JWT CRM view codes
- Quick-create customer/contact ? `crm.company.create` / `crm.contact.create`
- Demo fallback mapping stays inside `canCrmPermission` only (no UI soft-gates on `sales.*`)

### Verify
`rg "canPermission\\('sales'" frontend/src` ? only `utils/permissions/crm.ts` + `canRoute` demo branch. Login as Sales Executive: edit lead OK, delete lead hidden.

---

## 2026-07-15 ? Docs: close stale dashboard quotation backlog refs

P1-3 (dashboard quotation approval panel) and P1-3b (chart series) were already **done** in `REMAINING_WORK.md` / `PROJECT_STATUS.md` / live E2E; stale wording remained in older audit docs.

### Change
- `crm-completion-audit.md` ? dashboard KPIs/panels/charts marked complete; dropped ?panels store-backed / quotation widgets demo-only?; closed remaining-work item 8
- `crm-gap-analysis.md` ? closed chart/approval panel gap + criterion 3; corrected ?quotation backend out of scope?
- No code changes (API mode already uses `panels.pendingApprovalQuotations` + metrics charts)

### Still accurate / open (unrelated)
- Dashboard **next actions** remain client-built from hydrated store
- Optional average sales-cycle KPI still absent from metrics API
- Admin UIs, permission migration leftovers, mobile live E2E, deferred transactional ERP

---

## 2026-07-15 ? UX: Contact / Company / Quotation 360 unified activity feed

Rolled `CrmUnifiedActivityFeed` (icon-only Edit/Delete) out to Contact, Company (Customer), and Quotation 360; `ActivityTimeline` actions also use `crm-unified-feed__icon-btn`.

---

## 2026-07-15 ? UX: QuotationConversionDialog warning callout + Valid till

### Why
Audit: conversion warnings used ad-hoc `text-amber-800`; Valid till could show raw ISO.

### Change
- Warnings list ? shared CRM `erp-warning-*` callout (same pattern as QuotationApprovalPanel)
- Valid till ? `formatDate()` (en-IN)

### Verify
Convert a quotation with warnings; callout matches CRM warnings; Valid till e.g. `15 Jul 2026`.

---

## 2026-07-15 ? UX audit: Purchase PR/RFQ/PO modal sweep (F1 pair)

### Why
Low finding: sweep new Purchase dialogs for the same Esc / backdrop / ? gap as QuotationConversionDialog.

### Change
- Swept `modules/purchase` + `components/purchase` (PR, RFQ, PO, GRN, amend, masters): **no custom confirm/delete/modal overlays** ? lifecycle is inline + toast; line delete is direct; item/vendor pickers are Escape-aware dropdown portals (not Modal candidates).
- `QuotationConversionDialog` already on shared `Modal` + `closeDisabled` ? left untouched.

### Verify
No Purchase modal migration to spot-check. Quotation convert still Esc/backdrop/? (locked while Converting?).

---

## 2026-07-15 ? UX: PR create footer ? single Save Draft

### Why
`/purchase/requisitions/new` sticky footer had duplicate draft actions (Save + Save Draft, both `persist(false)`).

### Change
- Footer: Cancel ? Save Draft ? Submit for Approval (primary); Ctrl+S still saves draft
- PO / RFQ / GRN audited ? no same dual Save/Save Draft pattern

### Verify
Hard-refresh `/purchase/requisitions/new` ? footer shows one draft save + primary submit.

---

## 2026-07-15 ? UX: QuotationConversionDialog shared Modal

### Why
Audit finding: convert-to-SO dialog lacked Esc / backdrop dismiss / visible ?.

### Change
- `QuotationConversionDialog` now uses design-system `Modal` (Esc, backdrop, ? header)
- `Modal` gains optional `closeDisabled` ? convert dialog locks dismiss while `isConverting`

### Verify
Quotations list or 360 ? Convert to SO ? Esc / click outside / ? close; during Converting? those are locked.

---

## 2026-07-15 ? UI: Purchase RFQ New CRM parity polish

### Why
`/purchase/rfqs/new` still used the older purchase fact-box + plain PR-lines table, while PR New / Opportunity / Quotation already use Dynamics + Smart Overview.

### Change (UI / demo only ? no API)
- `RfqFormPages` (`RfqCreateDocumentPage`): `CrmSmartOverviewPanel` Smart Context, sticky footer + Ctrl+S hints, `EnterpriseFormMetrics`, dynamics/CRM workspace classes, section nav + AI toggle
- PR demand lines via read-only `PrLineItemsGrid` (`erp-line-items-grid--opportunity`)
- Demo create flow unchanged (`createRfqFromPr` + vendor invite ?2)

### Verify
Hard-refresh `/purchase/rfqs/new` ? shell, KPIs, line grid, and right rail should match CRM/PR New.

---

## 2026-07-15 ? UI: Purchase Requisition CRM parity polish

### Why
New PR page (`/purchase/requisitions/new`) used an older purchase line grid and fact-box shell that did not match CRM quotation/opportunity density.

### Change (UI / demo only ? no API)
- `PrLineItemsGrid`: CRM opportunity line pattern ? `erp-line-items-grid--opportunity`, expand rows, Add line + copy/delete icon actions, `FormattedCurrencyInput`, sticky product/# columns, summary totals
- `PurchaseFormPages`: `CrmSmartOverviewPanel` Smart Context, sticky footer + Ctrl+S hints, `EnterpriseFormMetrics`, dynamics/CRM workspace classes
- `PurchasePages` PR list: `ErpCommandBar` (New / Refresh / Export) aligned with CRM lists
- `PurchaseCardFormShell`: sticky footer on by default; CRM smart-overview theme

### Verify
Hard-refresh `/purchase/requisitions/new` ? line grid and right rail should match CRM quotation form look.

---

## 2026-07-15 ? DB cleanup: remove all CRM sales orders

### Script
- `backend/scripts/cleanup-sales-orders.ts`
- Run: `cd backend && npx tsx scripts/cleanup-sales-orders.ts`
- Options: `TENANT_SLUG=vasant-trailers` (default), `TENANT_SLUG=ALL`, `DRY_RUN=1`

### Scope (hard-delete when safe)
- All `crm_sales_orders` (line JSON on row; no SO status-history table; no `CrmEntityType.SALES_ORDER` notes/attachments)
- Clears `salesOrderId` / `salesOrderNo` on quotations + quotation documents (does not delete parents)
- Does **not** touch companies, contacts, leads, opportunities, quotations, templates, users, masters, purchase

### Local result (`vasant-trailers` / `fos_erp`)
- Before: **14** SOs (2 active) ? After: **0** / **0**
- Related: quote/doc SO links were already 0; deleted 14 SO rows
- Protected unchanged: companies 84, contacts 63, leads 3, opps 1, quotations 1, templates 1
- Only tenant in DB; `GET ?/crm/sales-orders` ? `meta.total=0`

---

## 2026-07-15 ? UI: Quotation Editor polish (Quote 360 / dates / commercial grid)

### Why
Editor page showed duplicate Quote 360 actions, raw ISO dates in Data sources / delivery terms, mismatched completion bar colors (KPI green vs sidebar blue), uneven Commercial two-column field grid, and long unwrapped term blobs in the right rail.

### Fix (UI-only)
- `QuotationBuilder`: single Quote 360 (shell actions); Export PDF ? print route; Commercial via `ErpFormGrid`; validity date formatted in doc meta
- `QuotationDataSourcePanel`: format embedded ISO dates; clamp long term strings; completion bar uses success/warning (matches Completion KPI)
- `quotationTermUtils` / placeholders: humanize delivery-time master attributes; stop dumping validity ISO into `validity_days`
- CSS: commercial field alignment + datasource value wrap/clamp

### Verify
Open `/crm/quotations/:id/editor` (e.g. QUO-000037) ? refresh editor; check action bar, Commercial grid, Data sources terms/dates, section completion bar color.

---

## 2026-07-15 ? DB cleanup: remove all CRM leads

### Script
- `backend/scripts/cleanup-leads.ts`
- Run: `cd backend && npx tsx scripts/cleanup-leads.ts`
- Options: `TENANT_SLUG=vasant-trailers` (default), `TENANT_SLUG=ALL`, `DRY_RUN=1`

### Scope (hard-delete when safe)
- All `crm_leads` (+ status history, assignments)
- LEAD notes/attachments
- Lead-only activities (hard); shared activities/follow-ups detached (`leadId=null`)
- Does **not** touch companies, contacts, opportunities, quotations, SOs, users, masters, templates

### Local result (`vasant-trailers` / `fos_erp`)
- Before: **45** leads (25 active) ? After: **0** / **0**
- Related removed: 39 status hist, 10 assignments, 7 notes, 9 attachments, 1 lead-only activity; 34 activities + 17 follow-ups detached
- Protected: companies 81, contacts 60, SOs 14 unchanged; opps/quotations still 0
- Only tenant with leads; API list total=0 after cleanup

---

## 2026-07-15 ? Fix: CRM Sales Orders list crash (null `.slice`)

### Why
After opp/quotation cleanup, API-hydrated SOs can have `requiredDate: null` (backend DTO). List called `requiredDate.slice` via `isSalesOrderOverdue` in `SalesOrdersTable` ? ErrorBoundary. Cleared `quotationId`/`opportunityId` were already null-safe; crash was the date field.

### Fix
- Null/empty-safe `isSalesOrderOverdue` + delivery/risk helpers
- `salesOrderFromApi` coerces null `requiredDate`/`productId`/remarks ? `''`; keeps linkage FKs null
- Guard SO 360 hero + sales pipeline overdue cells
- Regression checks 16?17 in `test:crm-list-utils`

---

## 2026-07-15 ? Audit: phpMyAdmin leads vs empty CRM Leads UI

### Bug reasons (evidence)
1. **Production (`erp.dhurandharcrm.com`)** ? `GET /api/v1/health` and `/api/v1/t/?/crm/leads` return **HTTP 200 `text/html`** (Vite SPA), not JSON. Cause in deploy: `backend/.htaccess` rewrote **all** paths into `public/`, so Apache served `index.html` for `/api/*` and Node never answered CRM calls. UI is API mode (`VITE_USE_API=true`) ? hydrate/create fail while phpMyAdmin still shows `fos_erp` rows.
2. **Local** ? Frontend already `VITE_USE_API=true` ? `127.0.0.1:5000`; when backend was **not listening**, stores stay empty / sync errors. Not a demo-mode mixup and not a wrong DB name (`DB_NAME=fos_erp`).
3. **Data itself OK** ? Tenant `vasant-trailers` only; **44** leads total after probe creates, **24** active (`deletedAt=null`), **20** soft-deleted (correctly hidden). With backend up: list `meta.total=24`, create ? `LEAD-000121` OK. Soft-deleted rows visible in phpMyAdmin but not in UI by design.

### Fixes in repo
- `backend/.htaccess` (+ `deploy/FINAL-UPLOAD/.htaccess`): skip rewrite for `^api` so Passenger/Node handles API
- `backend/src/app.ts`: serve Vite `public/` SPA for non-`/api` (host-package / single-host; Docker still uses frontend nginx)
- FE `client.ts`: detect HTML-as-API and throw a clear message; `AppShell` retry + ?backend /api? hint
- `deploy/FINAL-UPLOAD/HOSTINGER_403_FIX.txt` note on HTML health check
- `backend/scripts/audit-leads-ui.ts` loads `env.ts` (uses `leadCode`)

### Remaining
- **Production still needs redeploy/upload** of fixed `.htaccess` + running Node app; until `/api/v1/health` returns JSON, live CRM stays broken.
- Local: keep `backend` `npm run dev` on :5000 while using API-mode frontend.

---

## 2026-07-15 ? DB cleanup: opportunities / quotations (keep SOs + 1 template)

### One-off script
- `backend/scripts/cleanup-opp-quotations.ts`
- Run: `cd backend && npx tsx scripts/cleanup-opp-quotations.ts`
- Options: `TENANT_SLUG`, `DRY_RUN=1`, `KEEP_TEMPLATE_CODE=STANDARD-TRAILER`

### Applied to `vasant-trailers` (local MySQL)

| Entity | Before (total / active) | After |
|--------|-------------------------|-------|
| Opportunities | 47 / 26 | 0 / 0 |
| Quotations | 13 / 1 | 0 / 0 |
| Quotation documents | 22 | 0 |
| Quotation templates | 22 / 10 | 1 / 1 |
| Sales orders | 11 / 1 | **11 / 1 unchanged** |

- Kept template: `STANDARD-TRAILER` ? Standard Trailer Quotation (`6b93e12e-6da7-4e0e-87af-163a76c4df53`)
- SO source link fields (`quotationId` / `quotationDocumentId` / `opportunityId`) cleared on 9 rows; SO rows themselves untouched; `quotationNo` retained
- Detached activities/follow-ups/leads from deleted opportunities; soft-deleted opp/quote notes+attachments (none present)
- Seed trimmed: `quotationTemplateSeedData.ts` now seeds **1** template only (re-seed will not restore the old 10)
- Note: additional sales orders may appear after cleanup if the app/tests create them ? script never deletes SOs

### Not changed
- Prisma models, CRM modules, companies/contacts/leads/products/users

---

## 2026-07-15 ? Convert Quotation ? Sales Order (complete workflow)

### Permission mapping (product ? codebase)
| Product / request code | Codebase permission |
|------------------------|---------------------|
| `crm.quotation.convert_sales_order` | **`crm.quotation.convert`** (new; seeded) |
| `sales.order.create` | **`crm.sales_order.create`** |
| `crm.opportunity.mark_won` | **`crm.opportunity.close`** (win endpoint); convert itself marks Won without separate close call |
| `crm.quotation.view` | `crm.quotation.view` (unchanged) |

FE show requires `crm.quotation.convert` **and** `crm.sales_order.create`. Never owner-gated. Backend enforces both on convert route.

### API
- Path (unchanged): `POST /api/v1/t/:tenantSlug/crm/quotations/:quotationId/convert-to-sales-order`
- Permissions: `crm.quotation.convert` + `crm.sales_order.create` (was `crm.quotation.update` only)
- Success: SO `status=open`, quotation `converted`, opportunity Won (or link if already Won), supersede older revisions, changeHistory audit, timeline activity
- Already converted ? **409** with `salesOrderId` / `salesOrderNo` in `errors[]`
- Lost/Archived opportunity ? 422 clear message
- Require approved + customerApproval (Accepted). No tenant Sent-shortcut config ? default require-approved = Yes (gap documented)

### Frontend
- `useQuotationConversion` + `QuotationConversionDialog` + shared `convertQuotationToSalesOrder()`
- Wired: Quotations list row Actions, Quotation 360 header (read-only OK), smart overview NBA
- Success popup: Stay on Quotations | View Sales Order (primary)
- Demo mode mirrored in `crmStore.convertQuotationDocumentToSalesOrder`

### Gaps (honest)
- Credit / inventory warnings not implemented
- Company config overrides (allow Sent, require-approval toggles) not implemented
- No reopen-and-convert privilege
- No dedicated `convertedAt`/`convertedBy` columns (stored in quotation `changeHistory`)
- Opportunity has no `actualCloseDate` ? uses `expectedCloseDate` when newly Won

### Verification
- Backend typecheck + `npm run test:crm-live` (see TESTING_STATUS)

---

## 2026-07-14 ? Edit Opportunity header actions (`useOpportunityEditor`)

### Problem
- Edit Opportunity Save navigated away to 360; Actions/Save & Close/Cancel/View 360 were placeholders or inconsistent
- `apiUpdateOpportunity` previously sent workflow fields (`ownerId`/`stage`) on PATCH

### Fix
- Central controller: `frontend/src/modules/crm/hooks/useOpportunityEditor.ts` ? save / save&close / cancel / open360 / quotation / lifecycle Actions / shortcuts / Smart Context
- Bridge: strip workflow PATCH fields; shared `mapOpportunityLinesForApi`; assign-owner after PATCH; `apiReopenOpportunity`
- Dialogs: discard, unsaved?360, move stage (won/lost/hold), existing quotation, archive/delete
- API-mode attachments: `EntityAttachmentsPanel` on edit; demo keeps typed upload store

### Verification
- `npm run test:uat-03-opportunities` ? **86/86** (78 automated + 8 live)
- Frontend typecheck: no new errors in OpportunityEdit / useOpportunityEditor (repo has pre-existing unrelated TS errors)

### Docs
- `PROJECT_STATUS.md`, `REMAINING_WORK.md`, `TESTING_STATUS.md`, this entry

---

## 2026-07-14 ? Phase 1 Sales Order API (beyond convert)

### Backend
- `POST/PATCH/DELETE /crm/sales-orders` ? draft create/update/soft-delete (`status=open`)
- `POST ?/confirm` (`open`?`confirmed`), `POST ?/close`
- Permissions: `crm.sales_order.create|update|delete|confirm`
- Migration `directSoReason` on `crm_sales_orders`
- Swagger updated

### Frontend
- `salesOrderApi` + bridge write paths; Create/Edit/Confirm/Delete use API in `VITE_USE_API=true`

### Verification
- Backend `typecheck` PASS; `npm run test:crm-live` **49/49**

### Still deferred
- MRP / dispatch / invoice posting beyond confirm/close

---

## 2026-07-14 ? Dashboard quotation approval panel from metrics (P1)

### Problem
- CRM Command Center approval queue used hydrated Zustand `quotationDocuments`, which could drift from server aggregates

### Fix
- Extended `GET /crm/dashboard/metrics` panels with tenant-scoped `pendingApprovalCount` + `pendingApprovalQuotations` (top 8 from DB)
- FE API mode: `applyApiDashboardPanelOverlay` + dashboard page consume panel payload; loading/error/retry + silent refetch on focus
- Demo mode unchanged (store-derived queue)

### Verification
- `npm run typecheck` (backend) PASS; `npx tsc --noEmit` (frontend) PASS
- `npm run test:crm-live` **47/47** ? new pending-approval panel case + tenant isolation shape assert

### Docs
- `CRM_FE_API_DB_VERIFICATION_REPORT.md` (P1/G1 closed), `TESTING_STATUS.md`, `PROJECT_STATUS.md`, this entry

---

## 2026-07-14 ? Sales forecast API (P2)

### Problem
- `/crm/forecast` only rolled up hydrated Zustand opportunities client-side ? no tenant-scoped forecast endpoint

### Fix
- Backend: `GET /api/v1/t/:tenantSlug/crm/forecast` (validation ? service ? aggregate), soft-delete + `tenantId`, optional `ownerId` / `pipelineId` / close-date range
- Weighted math uses **pipeline stage probability** (fallback opportunity.probability)
- Frontend: `fetchCrmSalesForecast` + `useCrmSalesForecast` ? API mode fetches forecast; demo keeps `buildCrmSalesForecast`
- Unit tests for ?(value ? probability/100); live E2E + tenant-isolation smoke

### Verification
- `npm run typecheck` (backend) **PASS**
- `tests/crm-forecast.test.ts` **2/2**; `npm test` **39 passed / 49 skipped**
- `npm run test:crm-live` **47/47** (forecast GET + tenant-scoped)

### Docs
- `CRM_FE_API_DB_VERIFICATION_REPORT.md`, `crm-page-api-map.md`, `TESTING_STATUS.md`, this entry

---

## 2026-07-14 ? Quotation templates + CRM search live E2E (P2)

### Problem
- Verification report P2: quotation templates and CRM global search APIs existed with FE wiring, but limited/no live E2E

### Fix
- `backend/tests/crm-e2e.test.ts`:
  - `creates, lists, gets, updates, duplicates, and soft-deletes quotation template`
  - `searches CRM companies, contacts, leads, and opportunities` (missing/empty `q` ? 400)
- Docs: verification report G2/G3 closed; `TESTING_STATUS.md` counts updated

### Verification
- `npm run test:crm-live` ? **46/46** (`crm-e2e` 39 + `crm-tenant-isolation` 7)

### Docs
- [`docs/CRM_FE_API_DB_VERIFICATION_REPORT.md`](CRM_FE_API_DB_VERIFICATION_REPORT.md)
- [`docs/TESTING_STATUS.md`](TESTING_STATUS.md)
- This changelog entry

---

## 2026-07-14 ? Production Docker Compose deploy

### Deliverable
- Repo-root [`docker-compose.yml`](../docker-compose.yml): MySQL 8 + backend + nginx SPA
- [`backend/Dockerfile`](../backend/Dockerfile) + entrypoint (`prisma-cli.ts migrate deploy` ? `node dist/server.js`)
- Reused [`frontend/Dockerfile`](../frontend/Dockerfile) / [`frontend/nginx.conf`](../frontend/nginx.conf) (25MB body; `/api/` ? backend)
- [`.env.production.example`](../.env.production.example), root/frontend dockerignores
- [`scripts/deploy-prod.sh`](../scripts/deploy-prod.sh) + [`scripts/deploy-prod.ps1`](../scripts/deploy-prod.ps1)
- [`docs/DEPLOYMENT.md`](DEPLOYMENT.md) ? build, up, optional seed, backups, TLS tip

### Notes
- Seed is **opt-in** (`docker compose exec backend npm run db:seed`) ? not on start
- Does not modify or replace `release/fos-erp-host`


---

## 2026-07-14 ? Entity notes live E2E (P1)

### Problem
- Verification report G1/P1: entity notes API + FE (`useEntityNotes`) wired, but no live E2E (attachments already covered)

### Fix
- Added `creates, lists, updates, and soft-deletes entity notes on LEAD` in `backend/tests/crm-e2e.test.ts`
- Covers `POST/GET ?/entities/LEAD/:id/notes` and `PATCH/DELETE ?/entities/notes/:noteId` (soft-delete ? list excludes; second DELETE ? 404)
- No new API surface ? existing note routes/services/validators used as-is

### Verification
- `npm run test:crm-live` ? **42/42** (e2e 36 + tenant isolation 6)

### Docs
- `CRM_FE_API_DB_VERIFICATION_REPORT.md` ? notes ? Working; G1 closed
- `TESTING_STATUS.md` ? live counts + notes case
- `PROJECT_STATUS.md` / `REMAINING_WORK.md` ? Notes tests ?; P0-3 done

---

## 2026-07-14 ? CRM FE ? API ? DB verification report

### Deliverable
- [`docs/CRM_FE_API_DB_VERIFICATION_REPORT.md`](CRM_FE_API_DB_VERIFICATION_REPORT.md) ? page-wise + function-wise matrix (Working / Partial / Demo-only), live evidence, gaps, ordered fixes
- [`docs/TESTING_STATUS.md`](TESTING_STATUS.md) ? pointer + this-session counts

### Evidence
- Stack up: MySQL, backend :5000, FE :5173 `VITE_USE_API=true`
- `npm run typecheck`; `npm test` 37 pass / 43 skip; `npm run test:crm-live` **41/41**
- HTTP CRM reads 200; browser smoke dashboard / leads / opportunities
- Verdict: commercial CRM path Working; no P0 Broken; Partial = notes E2E, approval panel store source, forecast client rollup, template/search live gaps

---

## 2026-07-14 ? Lead form: select / add Contact Person

### Problem
- Edit/New Lead CONTACT block was free-text only (and read-only once a company was linked)
- No pick-from-company-contacts or **+ Add New Contact** parity with Company quick-create
- Lead `contactId` existed on the API but was not wired on the frontend Lead model / form

### Fix
- `LeadContactSelect`: searchable company contacts (`ErpSmartSelect`) + **Add New Contact** (disabled until company linked); reuses `NewContactDrawer`
- Lead form: linked company ? contact picker + editable Mobile/Email; prospect-only ? free-text name
- Selecting/creating a contact sets `contactId` and fills name/mobile/email (Smart Context clears ?Contact details incomplete?)
- Dual-mode: demo `salesStore.createLead` / `updateLead` + `crmApiBridge` create/update payloads pass `contactId`
- `NewContactDrawer` syncs/locks customer when opened from a linked company

### Verification
- `npx tsc --noEmit` (frontend) clean
- Browser: Edit Lead ? company linked ? Add New Contact / select existing ? save ? contact linked

### Docs
- This changelog entry

---

## 2026-07-14 ? Lead row ? menu + AssignOwnerDialog

### Problem
- Leads list row actions (especially Create Opportunity) looked clickable but did nothing ? business rules used HTML `disabled` with no muted styles / toast
- Assign owner used native `window.prompt` with free-text name matching

### Fix
- Soft-gated Create Opportunity / Create Quotation / locked Edit via page handlers + warning toasts (`resolveLeadConvertToOpportunityGate`)
- Always show Create Quotation in the menu; toast if no linked opportunity
- Row action menu: deferred click, portal `data-row-actions`, visible `:disabled` styles
- Shared `AssignOwnerDialog` (searchable `ErpSmartSelect` owners) on Leads + Opportunities (bulk / row Assign)
- `apiAssignOpportunity` bridge + `crmStore.assignOpportunity`

### Verification
- Browser: Leads ? View navigates; Create Opportunity toast when not Qualified; Assign opens dialog
- Dual-mode assign by user id

### Docs
- This changelog entry

---

## 2026-07-14 ? Backend API sync for today?s CRM/master FE work

### Gap close (API mode)
- CRM activity/follow-up PATCH+DELETE already existed; added live E2E for activity update + follow-up create/update/delete (Lead/Opp timeline edit-delete)
- Attachment create: required `documentType` + `documentTypeName` on create/list (already shipped); Swagger body/413 docs; live E2E reject missing type + typed upload
- Sync ensure now includes `opportunity-stages` (seed rows under `src/?/crm-master.seed-data.ts` ? fixes typecheck rootDir import from prisma/)
- Quotation/lead/opportunity optional UUID helpers (`optionalUuid`) coerce `""` ? null for `locationId` etc.
- Locations/warehouses master APIs already present; seed sample data covered by live list assertion after `db:seed`
- Purchase / Contact 360 restyle / form Save command bar: **demo FE only** ? no purchase/AP backend

### Verification
- `npm run typecheck`; `npm test`; `npm run db:seed`; `npm run test:crm-live`

### Docs
- This entry; PROJECT_STATUS / REMAINING_WORK / TESTING_STATUS

---

## 2026-07-14 ? CRM create/edit: restore Save command-bar actions

### Frontend (`frontend/`)
- Root cause: New Lead passed header `commandBar` (Save / Save & New / Save & Close / Cancel); Opportunity New, Quotation New, Contact create, and Sales Order create only had sticky footers ? Dynamics chrome showed no header actions
- Added shared `CrmFormSaveCommandBar` + `EnterpriseWorkspace` `formSaveActions` (auto header bar when `commandBar` omitted)
- Wired Opportunity New, Quotation New, Contact create/edit, Sales Order create (+ SO edit / Opportunity edit Save & Close / Cancel); Lead uses shared bar; 360 pages unchanged

### Docs
- This changelog entry

---

## 2026-07-14 ? Opportunity Stage Master seed + funnel alignment

### Problem
- API-mode Opportunity Stage Master was empty (`opportunity-stages` missing from `crmMasterSeedData`)
- Default CRM pipeline stages had outdated labels and omitted `quotation_sent` / `on_hold`, so stage moves could fail vs UI codes

### Fix
- Seeded canonical `opportunity-stages` CRM master (10 system rows) for Vasant tenant
- Aligned `DEFAULT_PIPELINE_STAGES` + seed upsert updates (labels, sequence, probability, closed flags)
- Frontend forms / Kanban / filters resolve stages reactively from CRM master (`useResolvedOpportunityStages`)

### Canonical stages
`new_lead` ? `qualified` ? `requirement_discussion` ? `technical_review` ? `quotation_prepared` ? `quotation_sent` ? `negotiation` ? `won` / `lost` / `on_hold`

### Verification
- `npm run db:seed`; GET `/crm/masters/sync` + `/crm/pipelines` show 10 matching stages
- Browser API mode: master TOTAL 10; Opportunity Pipeline columns use master labels/order
- Frontend `tsc --noEmit` clean

### Docs
- This changelog entry

---

## 2026-07-14 ? Quotation create: locationId Invalid uuid

### Root cause
- Form/`useDocumentLocation` often sent `locationId: ""` (or a non-UUID) while completion % ignored it
- Backend Zod `z.string().uuid().optional().nullable()` rejects `""`
- Banner duplicated the same string as both `label` and `message` (`err ? err`)

### Fix
- `quotationApiBridge`: coerce empty/non-UUID optional FKs (incl. `locationId`) to `null` before create/update
- Quotation Zod: preprocess `""` ? `null` for optional UUIDs
- `CrmQuotationNewPage`: send `null` when location empty; stop duplicating validation guide message
- `useDocumentLocation`: re-apply default after master locations hydrate in API mode

### Docs
- This changelog entry

---

## 2026-07-14 ? Location Master sample data (demo + API seed)

### Backend
- Added `prisma/warehouseLocationSeedData.ts` (warehouses + locations) and upsert in `prisma/seed.ts` for `vasant-trailers`
- Sample locations: HO, AHMD-PLT, MUM-YARD, RM-STORE, BO-STORE, WIP-PROD, FG-YARD, QC-HOLD (UUID ids, tenant-scoped)

### Frontend (`frontend/`)
- Demo `locationSeed` / warehouse seed: Head Office, Ahmedabad Plant, Mumbai Yard (+ existing plant stores); HO is default for sales docs

### Docs
- This changelog entry

---

## 2026-07-14 ? CRM attachments: master type required + upload size fix

### Backend
- Express JSON/urlencoded limit raised from 1mb to CRM_MAX-sized base64 (+2MB overhead); default `CRM_MAX_UPLOAD_BYTES` ? 25MB
- Clear 413 response (`Upload too large?`) instead of raw `request entity too large`
- Attachment create requires `documentType` (Document Type / Attachment Master code); validates active `document-types` master; responses include `documentTypeName`

### Frontend (`frontend/`)
- `AttachmentUploadDialog`: required master dropdown before Choose file; type-gated accept + validation
- `EntityAttachmentsPanel` (Lead/Opp/Contact/Company/Quotation 360): shows attachment type; empty-state copy updated
- Demo seed + catalog: full `document-types` set aligned with backend ensure-seed
- `CrmTypedDocumentUpload` form flows already typed; label clarified to Attachment type

### Docs
- This changelog entry

---

## 2026-07-14 ? Lead 360 timeline: View ? Edit

### Frontend (`frontend/`)
- `CrmUnifiedActivityFeed`: removed View/Notes on activity & follow-up cards; **Edit** (+ optional Delete) only; notes/system stay read-only
- Lead 360 / Opportunity 360: Edit opens `LogActivityDrawer` / `QuickFollowUpDrawer` prefilled; gate Edit with `sales.edit` so API sessions aren?t blocked by missing fine-grained CRM permission codes
- Store/bridge update/delete paths reused (demo + API)

### Docs
- This changelog entry

---

## 2026-07-14 ? Lead ? menu + Lead 360 activity/follow-up edit-delete

### Frontend (`frontend/`)
- Leads register `CrmLeadsTable` / `CrmLeadListPage`: **Schedule Activity** opens `LogActivityDrawer` with lead context (was wrongly opening follow-up); Assign lists directory owners + API requires match; Create Opportunity / quotation URLs encode ids; permission gates on Create Opp / Schedule
- Lead 360 engagement feed: View / Edit / Delete on logged activities and follow-ups via existing drawers + confirm modal; store/bridge `updateActivity`, `updateFollowUp`, `deleteFollowUp` (reuse existing REST)
- Opportunity new: prefill contact from lead contact person / primary company contact when `leadId` in query

### Docs
- This changelog entry

---

## 2026-07-14 ? Purchase UX aligned to canonical procurement process

### Frontend (`frontend/`)
- Canonical 20-step map: `config/purchaseWorkflow.ts` + dashboard `PurchaseProcessMap`
- Status / next-action vocabulary (`purchaseStatusLabels`) on PR / RFQ / PO / GRN lists + 360 stage panels
- Sidebar + page guides ordered/worded to match Demand ? PR ? RFQ ? Compare ? PO ? Gate/GRN ? (AP Planned)
- Gate entry / invoice / stock-check clearly labeled Planned; no fake AP/inventory backend

### Docs
- `docs/purchase-workflow-map.md`; this changelog; `PROJECT_STATUS` purchase note (still deferred transactional ERP)

---

## 2026-07-14 ? Purchase master create/edit ? CRM Quick Entry shell

### Frontend (`frontend/`)
- Purchase master create/edit (`PurchaseMasterFormPage`): left `ErpFormShell` for `PurchaseCardFormShell` + Quick Entry (code/name/status) + Additional Info (configuration, description/notes), section nav, sticky save / command bar, context panel as fact box
- Unrouted legacy `PurchaseDashboardPage` left untouched (routes use `PurchaseModuleDashboard`)
- Demo-only: no purchase API; `VITE_USE_API=false` preserved

### Docs
- This changelog entry

---

## 2026-07-14 ? Purchase module CRM / Dynamics UI restyle

### Frontend (`frontend/`)
- Purchase lists (PR, RFQ, PO, GRN already Dynamics): PR + RFQ + vendor quotes / returns / comparison / performance / reports on `OperationalPageShell variant="dynamics"`
- Document 360 (PR / RFQ / PO / GRN): tabs ? section-scroll nav; readouts via `ErpViewField`; `PurchaseCardFormShell detailMode` + CRM smart-overview theme
- Create forms (PR / PO / RFQ): `ErpQuickEntrySection` + `ErpAdditionalInfoToggle` / panel (CRM Lead / Quotation New pattern)
- Vendor quotation detail: migrated from raw `ErpCardFormPage` to `PurchaseCardFormShell`
- Purchase masters detail: Dynamics list shell + `ErpViewField` grids; **master create/edit now also on PurchaseCardFormShell** (see follow-up entry above)
- Demo-only: no purchase API invented; attachment sections labeled demo; `VITE_USE_API=false` preserved

### Docs
- This changelog; `PROJECT_STATUS` purchase frontend note (UI language only ? still deferred backend)

---

## 2026-07-14 ? Contact 360 Profile layout polish

### Frontend
- Contact 360 Profile/Company cards: replaced horizontal `ErpFieldRow` + read-only inputs with Dynamics-style `ErpViewField` / `ErpViewEmail` / `ErpViewPhone` (2-col grids)
- Long emails truncate with full address in `title`; phone no longer crushed into stacked digits

---

## 2026-07-14 ? CRM funnel API + docs alignment

### Backend
- `assertLeadConvertible` requires **qualified** (stage or lifecycleStatus) before `POST ?/leads/:id/convert`
- Convert-to-SO error copy: ?Approve the quotation?? (matches single-step Approve)
- Swagger: convert qualified, Approve sets `customerApproval`, convert-to-SO preconditions documented

### Frontend (same wave)
- Shared Lead?Opp gate; Quote Accept CTA removed; CRM blank New SO removed; Direct Quotation CTA copy; `/sales/leads*` ? `/crm/leads*`; SO create CRM Dynamics shell on Sales path; `salesOrderStatusLabel`

### Docs
- `crm-workflow-map`, `crm-page-api-map`, `API_CONVENTIONS`, `PROJECT_STATUS` (SO), `PROJECT_MEMORY`, `backend/docs/api-requirement-matrix`, this changelog

---

## 2026-07-14 ? P2 CRM funnel polish (KPI strips, badges, Archive)

### Shipped
- Thinned register KPI strips to ?4 primary metrics (Leads, Companies, Quotations, Sales Orders); demoted secondary values into context copy
- Unified commercial status badges on quote/SO lists + 360 headers around `StatusBadge` / `StageBadge`; Draft SO uses hold/draft tone
- Wired Lead 360 Archive to `archiveLead` (navigate to list); removed stub Archive from Opportunity 360

---

## 2026-07-13 ? Commercial terms sample masters

### Shipped
- Seeded 12 commercial term categories (Payment, Delivery, Warranty, Validity, Jurisdiction, Exclusions, Maintenance, Change Conditions, Packing, Insurance, Penalty, Force Majeure)
- Sync ensure includes `commercial-terms`; live tenant has all 12

---

## 2026-07-13 ? Lost reasons sample masters

### Shipped
- Replaced stub Price/Competition with 31 proper lost reasons (Commercial, Competitive, Operations, Technical, etc.)
- Sync ensure includes `lost-reasons`; live tenant has all 31

---

## 2026-07-13 ? Opportunity priorities sample masters

### Shipped
- Seeded Low / Normal / Medium / High / Strategic / Critical in `crmMasterSeedData.ts`
- Sync ensure includes `opportunity-priorities`; live tenant has all 6

---

## 2026-07-13 ? Industries sample masters

### Shipped
- Expanded industries seed to 28 standard trailer/B2B industries in `crmMasterSeedData.ts`
- Sync ensure covers industries (same path as payment-terms)
- Live tenant has all 28 via sync

---

## 2026-07-13 ? Payment terms sample masters

### Shipped
- Added 15 payment-terms rows to `backend/prisma/crmMasterSeedData.ts`
- `listAllMastersForSync` ensures payment-terms for existing tenants
- Live tenant already has all 15 via sync ensure

---

## 2026-07-13 ? Company owner on portfolio list

### Shipped
- Company API returns `ownerId` + resolved `ownerName`; create defaults owner to current user
- CRM Companies list Owner column prefers company owner (not only opportunity owner)
- Script `scripts/assign-company-owners.ts` assigns admin to companies missing `ownerId` (8 updated)

---

## 2026-07-13 ? Company form contact fields ? CRM primary contact

### Shipped
- Saving Contact Person / Phone / Email on company create/edit upserts a linked CRM primary contact
- Backend: `company.service` sync after create/update; FE demo: `syncCustomerFieldsToPrimaryContact`; API bridge re-hydrates contacts into `crmStore`
- Reverse sync (primary contact ? company fields) already existed via `syncPrimaryToCustomer`
- E2E asserts auto-linked contact from company contact fields
- Docs: `api-requirement-matrix`, `crm-page-api-map`, `API_CONVENTIONS`, `FRONTEND_BACKEND_INTEGRATION`, `MASTER_REGISTRY`, `database-entity-map`

---

## 2026-07-13 ? Masters index: hide purchase-linked duplicates

### Shipped
- Masters Data index omits Purchase-linked Item/Vendor/UOM/etc. when the canonical register already exists
- Purchase Masters hub still lists those shortcuts (`listRoute` ? canonical)

---

## 2026-07-13 ? P3-6 Commercial terms single source

### Shipped
- SO `CommercialTermSelect`, quick-create, Sales quotation payment picker ? CRM payment/delivery masters via `commercialTermsAdapter`
- Global search indexes CRM terms only (removed `masterStore.commercialTerms` loop)
- Quick-create payment/delivery ? `crmMasterStore.addEntry`; tax quick-create blocked with GST master guidance
- Retired `seedCommercialTerms`, `masterStore.commercialTerms` slice, persist merge
- Docs: `MASTER_REGISTRY.md`, `REMAINING_WORK` P3-6 done

---

## 2026-07-13 ? Master consolidation (canonical routes)

### Shipped
- Registry: [`docs/MASTER_REGISTRY.md`](MASTER_REGISTRY.md) ? canonical map, permission keys, consumers, User/Employee/Owner, commercialTerms dual-source warning, purchase linked targets
- Cross-links: `PROJECT_MEMORY.md`, `REMAINING_WORK.md` (P3-6), `master-module-audit.md`, `master-implementation-plan.md`, `master-dependency-map.md`
- Phase 1: Company Master `/masters/companies`; `/masters/customers/*` ? Navigate; helpers/nav ? companies
- Phase 2: Role Permission Matrix `/masters/role-permissions`; permissions + settings aliases redirect; single catalog card
- Phase 3: Catalog/quick-card label **User Management**; owners ? `/masters/users`; summary count key `users` (not `employees`)
- Phase 4: Approval Workflow nav; purchase `listRoute` ? `/masters/approval-workflows`; CRM Approval Rule form section renamed off ?Approval Matrix?
- Phase 5: Commercial terms dual-source **audit only** in `MASTER_REGISTRY.md` (full consumer map + migration checklist); `masterStore.commercialTerms` **retained** ? cutover tracked as P3-6
- Phase 6: Purchase linked masters ? hub opens canonical `listRoute`; `/purchase/masters/{slug}?` path-preserving Navigate; purchase-owned CRUD unchanged
- Verification: `tsc --noEmit` OK; route-integrity baseline **459** paths (purchase linked edit aliases)

---

## 2026-07-13 ? Company Master progressive disclosure UX

### Shipped
- New Company / Customer form aligned with Lead progressive disclosure
- Quick Entry only by default (code, name, type, territory, status, primary contact)
- Additional Information navigator: Tax & Credit, Billing, Shipping, Contact, History, Attachments (one open at a time)
- Removed duplicate top section tabs, bottom sticky save bar, and Smart Context Save / Key Details / preview clutter
- Lean `CompanySmartOverviewPanel`: readiness %, warnings, Next Best Action navigates + focuses missing fields
- APIs, validation, GST/PAN, code series, shipping same-as-billing, and save modes unchanged

---

## 2026-07-13 ? Vasant Fabricators Product Master portfolio

### Shipped
- Idempotent seed: category ? family ? product ? Fuel Tank variants (no schema migration)
- Backend: `vasantProductPortfolio.ts` + extended `productSeedData.ts` + FG item/UOM seed in `seed.ts`
- Demo mirror: `vasantPortfolioSeed.ts` merged via `mastersExtension`
- Product Master list: Category / Family / Material filters; capacity & material columns
- Docs: `docs/VASANT_PRODUCT_PORTFOLIO.md`

---

## 2026-07-13 ? Product line density / hierarchy

### Shipped
- Product cell: name (strong) ? code (secondary) ? spec (muted, 2-line clamp)
- Product picker label is name-only; code in meta
- Opportunity grid: Qty+UOM merged; Delivery moved to expand; less horizontal scroll

---

## 2026-07-13 ? Smart Context card: content height

### Shipped
- Smart Context / factbox pane sizes to content (no tall empty white panel)
- Right column remains sticky; card is `height: fit-content`
- Lean overview: percent + gaps + NBA + `Stage ? Owner` footer; AI hidden in lean

---

## 2026-07-13 ? Additional Information section tiles

### Shipped
- Section nav status copy: `3 items`, `Needs input`, `3 updates`, `No files`, stage labels
- Subdued status text (no pill badges); amber only for warnings

---

## 2026-07-13 ? Additional Information toggle label

### Shipped
- `ErpAdditionalInfoToggle`: fixed title **Additional Information**, subtitle `N sections ? M need attention`, chevron only (no Add/Hide)
- Wired on Lead form, Lead 360, Opportunity New, Contact form
- Spec updated in `docs/FORM_STANDARDS.md`

---

## 2026-07-13 ? Opportunity Activity Timeline (unified feed)

### Shipped
- Opportunity 360: Notes / Activities / Follow-ups / Change History merged into **Activity Timeline**
- Same filters as Lead: All ? Activities ? Notes ? Follow-ups ? System
- System filter includes deal milestones + detailed change history (API mode)
- Shared `buildUnifiedFeed` / `buildOpportunitySystemEvents`

---

## 2026-07-13 ? Lead Activity Timeline (unified feed)

### Shipped
- Lead 360: Notes / Activities / Follow-ups / Relationship Timeline merged into **Activity Timeline**
- Filters: All ? Activities ? Notes ? Follow-ups ? System
- Add via dedicated actions: Log activity ? Add note ? Schedule follow-up
- Shared helpers: `crmUnifiedFeed.ts`, `CrmUnifiedActivityFeed.tsx`

---

## 2026-07-13 ? Lead Additional Info: one section at a time

### Shipped
- `ErpAdditionalSectionNav` chips inside Additional Information
- Lead 360 + Lead create/edit: only the active section panel renders (Products / Commercial / Follow-up / Notes / Attachments / Activities / Status)
- Follow-up list merged into Follow-up; territory + timeline under Status on 360
- Spec: `docs/FORM_STANDARDS.md` accordion rule

---

## 2026-07-13 ? Standard form architecture (Quick Entry + Additional Info)

### Shipped
- Shared form components: `ErpQuickEntrySection`, `ErpAdditionalInfo*`, `ErpFormGrid`, `ErpFieldGroup`
- `ErpCardSection` dense default ? **3 columns**; form footers non-sticky system-wide
- Button semantics: Save & New ? `secondary` (not success)
- Migrated: Lead, Contact, Opportunity New
- Spec: `docs/FORM_STANDARDS.md`

### Remaining
- Opportunity Edit, Company, Quotation, Sales Order, Purchase, Masters ? adopt same pattern (see FORM_STANDARDS.md Phase 4)

---

## 2026-07-13 ? API docs refresh (shipped surface)

### Updated
- `backend/src/config/swagger.ts` ? OpenAPI 1.1.0 covering auth, CRM (quotations, templates, sales orders, entities), masters (geography + products), lookups
- `docs/API_CONVENTIONS.md` ? quotation/SO/template routes; `QUOTATION` entity type; CRM master kinds; `products` registry
- `docs/crm-page-api-map.md` ? quotations/templates/SO no longer demo-only; designations/departments
- `backend/docs/api-requirement-matrix.md` ? full matrix aligned to code
- `docs/master-api-map.md` ? products ?; geography seed counts; CRM quotation APIs in baseline
- `backend/README.md` ? API structure overview

### Live docs
- Swagger UI: `http://localhost:5000/api/docs` (restart backend if already running)

---

## 2026-07-13 ? Designation & Department masters

### Shipped
- CRM master kinds `designations` + `departments` (backend + frontend catalog)
- Master pages at `/masters/designations` and `/masters/departments`
- Seed data for both (API + demo)
- Wired selects on contact form, quick-create, purchase PR, work centers; contact list filter uses designation master

---

## 2026-07-13 ? CRM-P0-3 Quotation templates API

### Shipped
- Prisma `CrmQuotationTemplate` + migration `20260713020000_crm_quotation_templates`
- Routes: `GET/POST /crm/quotation-templates`, `GET/PATCH/DELETE /:id`, `POST /:id/duplicate`
- Seed: 10 templates (incl. `ISO-TANK-26KL`)
- Frontend: `quotationTemplateApi` + bridge; `syncAllCrmFromApi` hydrates `crmStore.quotationTemplates` (empty in API mode until hydrate)
- Featured ISO tank lookup by `code` / `productFamily` (no hard dependency on demo `qtpl-iso-tank` id)

### Verified
- List ? 10 rows; create from source; duplicate; patch; delete
- Backend + frontend `tsc --noEmit` pass

### CRM P0 status
- CRM-P0-1 Products ?
- CRM-P0-2 Quotation attachments ?
- CRM-P0-3 Quotation templates ?

---

## 2026-07-13 ? CRM-P0-2 Quotation 360 attachments API

### Shipped
- Prisma `CrmEntityType` + `crm_notes`/`crm_attachments` enums include `QUOTATION`
- Migration `20260713010000_crm_entity_type_quotation`
- `assertCrmEntityInTenant` resolves `crm_quotations`
- Quotation 360: `EntityAttachmentsPanel` + `EntityNotesPanel` with `entityType="QUOTATION"` in API mode; demo docs/notes preserved when `VITE_USE_API=false`

### Remaining CRM P0
- _(none ? CRM-P0-1/2/3 done 2026-07-13)_

---

## 2026-07-13 ? CRM-P0-1 Product master API hydration

### Shipped
- Prisma `MasterProduct` + migration `20260713000000_add_master_products`
- Masters registry slug `products` (`master.product.*` permissions)
- Seed: 3 released products (`FG-45M3-BULKER`, `FG-ISO-TANK-26K`, `FG-SIDEWALL-32FT`)
- Frontend: `fetchMasterProducts` / map / create-update bridge; `syncCoreMastersFromApi` hydrates `masterStore.products` (empty seed in API mode)
- Role grants: Sales Manager / Executive / CRM Admin / Production Manager get `master.product.view`

### Verified
- `GET /api/v1/t/vasant-trailers/masters/products` ? 3 rows (UUID ids)
- Frontend + backend `tsc --noEmit` pass
- Migration applied; backend restarted after Prisma generate

### Remaining CRM P0
- CRM-P0-2 Quotation 360 attachments
- CRM-P0-3 Quotation templates API

---

## 2026-07-11 ? Quotation?SO backend + CRM live E2E journey

### Shipped

**P0-1 Sales Order conversion (backend)**
- Prisma `CrmSalesOrder` model + migration `20260711000000_crm_sales_orders`
- `SALES_ORDER` code series (`SO-` prefix)
- `POST /api/v1/t/:tenantSlug/crm/quotations/:id/convert-to-sales-order`
- `GET /api/v1/t/:tenantSlug/crm/sales-orders` + `/:id`
- Conversion links quotation + document, wins opportunity, duplicate guard (422)
- Frontend: `salesOrderApi.ts`, `salesOrderApiBridge.ts`, API mode in `crmStore.convertQuotationDocumentToSalesOrder`
- CRM hydration syncs sales orders to `mrpStore`

**P0-2 Live CRM E2E journey**
- `scripts/test-uat-crm-e2e-journey.ts` + `UAT-CRM-E2E_REPORT.md`
- Journey: Lead ? Opp ? Follow-up ? Quotation ? Approval ? SO (14/14 live)

**P1 fixes**
- UAT-06 live conversion tests (real API, not stub)
- Stale `crmBootstrap` imports ? `demo/factories/crmEcosystemBootstrap` in 6 scripts

### Tests

| Command | Result |
|---------|--------|
| `backend npm run typecheck` | Pass |
| `backend npm run test:crm-live` | 36/36 |
| `backend npm test` | 23/23 (38 skipped without RUN_CRM_E2E) |
| `backend npm run test:backend-structure` | 20/20 |
| `trailer-erp npm run typecheck` | Pass |
| `trailer-erp npm run build` | Pass |
| `npm run test:uat-05-quotations` | 69/69 |
| `npm run test:uat-06-sales-order` | 40/40 |
| `npm run test:uat-crm-e2e-journey` | 14/14 |
| `npm run test:crm-integration` | 18/18 |
| `npm run test:folder-structure` | 71/71 |
| `npm run test:frontend-freeze-gate` | Fail ? pre-existing `demo-data-saturation` |

---

## 2026-07-11 ? Structure migration Phase 7 (Purchase / Inventory / Production / Quality)

### Shipped

**7.1 Purchase** ? moved 5 shared widgets from `modules/purchase/` to `components/purchase/`:
- `PurchaseCardFormShell.tsx`, `PurchaseEnterpriseFormKit.tsx`, `PrLineItemsGrid.tsx`, `purchaseCardFormShared.tsx`
- `masters/PurchaseMasterContextPanel.tsx` ? `components/purchase/masters/`
- Created `components/purchase/index.ts` barrel
- Compat shims at old `modules/purchase/` paths
- Updated purchase module page imports to `@/components/purchase/...`

**7.2 Inventory** ? moved `InventoryDashboard.tsx` ? `components/inventory/InventoryDashboard.tsx` (exports `InventoryDashboardPage`; orphan, not routed)
- Created `components/inventory/index.ts`
- Compat shim at `modules/inventory/InventoryDashboard.tsx`

**7.3 Production / execution** ? moved `JobWorkSendReceiveForms.tsx` ? `components/execution-layer/`
- Created `components/execution-layer/index.ts`
- Compat shim at old path
- Updated `JobWorkOrderDetailPage` import to canonical path

**7.4 Quality** ? audit only: `modules/quality/` contains routed pages only (`QualityPages.tsx`, `QcMasterPages`, `QualityProductionPages`, `QualityPage.tsx`). No extractable shared widgets; no `components/quality/` barrel created.

**7.5 Structure gate** ? added Phase 7 checks to `scripts/test-folder-structure.ts`

### Tests

| Command | Result |
|---------|--------|
| `npm run typecheck` | Pass |
| `npm run build` | Pass (chunk-size warnings only) |
| `npm run test:folder-structure` | 78/78 |
| `npm run test:route-integrity` | 438 paths |
| `npm run test:purchase:production` | 39/39 |
| `npm run test:purchase-module` | 73/75 (2 pre-existing: 8.2 ErpFactBoxPanel, 8.4 ErpCommandBar) |
| `npm run test:quality:production` | 8/8 |
| `npm run test:quality` | 25/28 (3 pre-existing WO-0001 anchor failures) |
| `npm run test:wo-flow` | 59/60 (1 pre-existing WO-0001 failure) |

---

## 2026-07-11 ? Structure migration Phase 8 (Demo / data isolation)

### Shipped

- Created `demo/factories/crmEcosystemBootstrap.ts` (moved from `store/bootstrap/crmBootstrap.ts`)
- Created `demo/scenarios/goLiveScenario.ts` and `scenarioExtensions.ts` (moved from `demo/runGoLiveScenario.ts`, `demo/demoScenarioExtensions.ts`)
- Added barrel exports: `demo/factories/index.ts`, `demo/scenarios/index.ts`, `demo/index.ts`
- Compat shims retained at old paths (`store/bootstrap/crmBootstrap.ts`, `demo/runGoLiveScenario.ts`, `demo/demoScenarioExtensions.ts`)
- Updated `bootstrap/demoBootstrap.ts` and `demo/seeds/demoFullFactorySeed.ts` to canonical `@/demo/...` imports
- Added `scripts/test-demo-api-isolation.ts` + `npm run test:demo-api-isolation`
- Added Phase 8 checks to `scripts/test-folder-structure.ts`
- Updated `docs/structure-migration-checklist.md` ? Phase 8 complete

### Tests

| Command | Result |
|---------|--------|
| `npm run typecheck` | ? pass |
| `npm run build` | ? pass |
| `npm run test:folder-structure` | ? 78/78 |
| `npm run test:demo-api-isolation` | ? pass (0 violations) |
| `npm run test:demo-data` | ? 12/20 ? `loadDemoData` fails: go-live scenario `Cannot read properties of undefined (reading 'id')` (pre-existing on branch; logic unchanged in move) |
| `npm run test:crm-integration` | ? 18/18 |

---

## 2026-07-11 ? Structure migration Phase 6 (Masters / data consolidation)

### Shipped

- Moved 8 legacy root `src/data/*.ts` demo files into domain folders:
  - `inventory/legacyDemo.ts`, `production/legacyDemo.ts`, `dispatch/legacyDemo.ts`, `quality/legacyDemo.ts`
  - `sales/legacyDemo.ts` (from `orders.ts`), `masters/legacyProducts.ts` (from `products.ts`)
  - `bom/legacyEngineering.ts` (from `engineering.ts`), `mrp/legacyDemo.ts`
- Thin compat re-exports retained at old root paths
- Updated known importers to canonical `@/data/{domain}/legacy*` paths
- Verified `routes/masterRoutes.tsx` wired in `routes/index.tsx`
- Added Phase 6 checks to `scripts/test-folder-structure.ts` (legacy files, shims, master routes)
- Updated `docs/structure-migration-checklist.md` ? Phase 6 complete

### Tests

| Command | Result |
|---------|--------|
| `npm run typecheck` | Pass |
| `npm run build` | Pass (chunk-size warnings only) |
| `npm run test:folder-structure` | 73/73 |
| `npm run test:route-integrity` | 438 paths |
| `npm run test:masters` | 21/26 (5 nav/catalog failures ? pre-existing) |
| `npm run test:code-series` | 20/20 |

