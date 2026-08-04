# Remaining Work

Prioritized backlog. Status values: `open`, `in_progress`, `blocked`, `done`.

---

## Done recently — Admin People & Access (2026-08-04)

| Field | Value |
|-------|-------|
| Module | Admin People & Access |
| Description | Permission workspace extension on existing IAM: overrides DENY/ALLOW enforced in request-context + JWT, user register columns/bulk (scope/branch/wh), invite wizard, overrides UI, copy access picker, role clone/compare, access-review buckets + soft SoD |
| Status | **done in code** — **READY WITH CONDITIONS** |
| Doc | [`docs/admin/USER_ACCESS_MANAGEMENT.md`](admin/USER_ACCESS_MANAGEMENT.md), [`USER_ACCESS_UAT.md`](admin/USER_ACCESS_UAT.md) |
| Next step | `migrate deploy` `20260804190000_people_access_extension`; live smoke DENY → next request 403; optional SPA UAT |
| Deferred | Campaign/attestation persistence; hard SoD blocks |

---

## Open — Document Governance live enforcement (not this phase)

| Field | Value |
|-------|-------|
| Module | Platform Document Governance |
| Description | Configuration framework shipped 2026-08-04 (policies, profiles, allowances, exception model, Admin Date Controls). **Next phases:** turn on `DOCUMENT_GOVERNANCE_DATE_CONTROL` and wire per document type (CRM then Purchase); exception request lifecycle UI; closed-period interaction |
| Status | **config done** / enforcement **open** |
| Doc | [`docs/platform/DOCUMENT_GOVERNANCE_DATE_CONTROL.md`](platform/DOCUMENT_GOVERNANCE_DATE_CONTROL.md) |
| Next step | Only after product decision: integrate `getDocumentDatePolicy` + `evaluateDocumentDatePolicy` behind flag on chosen document save/post paths |

---

## Open — CRM Notifications (post-MVP)

| Field | Value |
|-------|-------|
| Module | CRM Notifications |
| Description | Initial production slice shipped 2026-08-03 (DB, service, event hooks, 15m scheduler, bell + centre + prefs). Remaining: email/push delivery, mandatory admin policy UI, manager escalation targets, meeting engine, SO delivery notifications, dashboard Action Zone shared counts, full integration-failure fan-out, digest email job |
| Status | **in_progress** / READY WITH CONDITIONS |
| Next step | `migrate deploy` `20260803100000_crm_notifications`; live smoke assign lead → unread count; wire Action Zone to `/notifications/summary` |

---

## Open — HRMS V1 (phased)

| Field | Value |
|-------|-------|
| Module | HRMS |
| Description | Phase 1–11 in code. **UI/UX redesign (2026-07-31)** shipped frontend-only Zoho People–inspired shell (`/hrms` home, employee 360, attendance register, leave/OT/payroll/loans/exit polish). Backend phases unchanged. |
| Doc | [`docs/hrms/HRMS_UI_UX_REDESIGN.md`](hrms/HRMS_UI_UX_REDESIGN.md), [`HRMS_PHASE11_EXIT_FNF.md`](hrms/HRMS_PHASE11_EXIT_FNF.md) |
| Status | **UI/UX READY WITH CONDITIONS** + Phase 11 **READY WITH CONDITIONS** (migrate + sync-permissions + vitest live + SPA UAT) |
| Next step | Manual HRMS SPA UAT checklist in redesign doc; migrate/sync for Phase 1–11 backends; polish leftover transactional drawers / Leave Approvals nav / My HR linked employee |
| Deferred (V1 non-goals) | Recruitment, ATS, performance management, LMS; portal filing (EPFO/ESIC/TRACES), Form 16/24Q, live bank payment gateway APIs, interest-bearing loan products, full annual TDS engine; OKR, GPS attendance, biometric device APIs, engagement |

---

## Done recently — Maintenance V2 Preventive (2026-07-30)

| Field | Value |
|-------|-------|
| Module | Maintenance |
| Description | PM Plan → due → generate MaintenanceTicket (PREVENTIVE) → existing repair/test/close → next due; checklist; PM compliance; dashboard due KPIs |
| Doc | `docs/maintenance/MAINTENANCE_V2_PREVENTIVE.md` |
| Status | **done** in code — **READY WITH CONDITIONS**: migrate `20260730210000_maintenance_v2_preventive` + `test-maintenance-v2.ts` |
| Next step | Live harness PASS. Deferred: meter-based PM, AMC, IoT, auto scheduling |

---

## Done recently — Maintenance V1.1 Machine Health (2026-07-30)

| Field | Value |
|-------|-------|
| Module | Maintenance |
| Description | Failure SAFETY + rootCause/repairAction; automatic downtime/repair time; repeat breakdown; Machine Health API/UI; MFG active-ticket banner; PR `sourceType=MAINTENANCE` + part backlink; dashboard month KPIs; production impact + contractor reports |
| Doc | `docs/maintenance/MAINTENANCE_V11_AUDIT.md`, `MACHINE_HEALTH.md`, `PRODUCTION_MAINTENANCE_INTEGRATION.md`, `MAINTENANCE_ANALYTICS.md`, `MAINTENANCE_V11_UAT.md` |
| Status | **done** in code — **READY WITH CONDITIONS**: migrate `20260730200000_maintenance_v11_machine_health` + run `test-maintenance-v1.ts` / `test-maintenance-v11.ts` |
| Next step | Live harness PASS; then optional human SPA UAT. Deferred: PM scheduler, calendar, AMC, IoT, OEE, CAPA |

---

## Done recently — Unified Sales Invoice (CRM + Money In) (2026-08-04)

| Field | Value |
|-------|-------|
| Module | CRM Commercial / Money In AR |
| Description | Single canonical `SalesInvoice`; CRM create/post facade; legacy CRM TI redirect; convert queue retired |
| Doc | `docs/accounting/UNIFIED_SALES_INVOICE.md` |
| Status | **done** in code — **condition**: migrate `20260804020000_unify_sales_invoice_commercial` + optional `migrate-crm-tax-invoices-to-sales-invoices.ts` |
| Next step | Live UAT: CRM create → same id in Money In; allocate; no dual INV/SINV rows |

---

## Done recently — CRM Tax Invoice → Money In bridge (2026-07-30)

| Field | Value |
|-------|-------|
| Module | CRM Commercial / Money In AR |
| Description | **Superseded by unified Sales Invoice (2026-08-04).** Former bridge: posted CRM TI → convert → SI + payment sync |
| Doc | `docs/accounting/UNIFIED_SALES_INVOICE.md` |
| Status | **retired** — use unified path |
| Next step | n/a |

---

## Done recently — Period Close FX revaluation (2026-07-30)

| Field | Value |
|-------|-------|
| Module | Accounting / Period Close |
| Description | Closing FX rates + unrealized AR/AP revaluation preview/post/reverse; dual-mode FE wizard |
| Doc | `docs/accounting/PERIOD_CLOSE_FX_REVALUATION.md` |
| Test evidence | `finance-fx-revaluation` **4/4 PASS**; migrate `20260730220000_finance_fx_revaluation` applied locally; `db:sync-permissions` (+5 FX keys) |
| Status | **done** — **conditions**: Hostinger migrate + sync-permissions; map `UNREALIZED_FX_GAIN` / `UNREALIZED_FX_LOSS`; enable `MULTI_CURRENCY` |
| Next step | Treasury FX / intercompany; live TPP AIS (external) |

---

## Done recently — Accounting year-end P&L close (2026-07-30)

| Field | Value |
|-------|-------|
| Module | Accounting / Period Close |
| Description | Year-end closing entries (INCOME/EXPENSE → `RETAINED_EARNINGS`), FY lock hardened, FE year-end wizard API mode, AP cascade idempotencyKey hash fix, money-out npm scripts wired |
| Doc | `docs/accounting/PERIOD_CLOSE_STATUS.md` |
| Test evidence | `finance-year-end-close` **8/8**; core finance pack **50/50**; BE/FE typecheck PASS; `test:period-close` PASS; `test:money-out` **68/68** |
| Status | **done** for year-end P&L slice — **conditions**: Hostinger migrate deploy of `20260730121000_finance_year_end_close`; human SPA year-end walk |
| Next step | Treasury FX / intercompany; live TPP AIS (external) |

---

## Done recently — Period Close calendar + reopen requests (2026-07-30)

| Field | Value |
|-------|-------|
| Module | Accounting / Period Close |
| Description | Checklist templates (LE), calendar generate/CRUD, reopen-request approval workflow (approve reopens period until requestedUntil); dual-mode FE |
| Doc | `docs/accounting/PERIOD_CLOSE_CALENDAR_REOPEN.md` |
| Test evidence | BE typecheck PASS; live suite `finance-period-close-calendar-reopen` |
| Status | **done** — **conditions**: Hostinger migrate `20260730200000_finance_period_close_calendar_reopen` + `db:sync-permissions` |
| Next step | Treasury FX / intercompany |

---

## Done recently — Period-end accruals + prepaid (2026-07-30)

| Field | Value |
|-------|-------|
| Module | Accounting / Period Close |
| Description | Live accruals (post + auto-reverse next period) and prepaid amortisation schedules via `/accounting/period-adjustments`; default mappings `ACCRUED_EXPENSE_LIABILITY` / `PREPAID_EXPENSE_ASSET`; dual-mode FE on Period Close Accruals/Prepaid pages |
| Doc | `docs/accounting/PERIOD_END_ADJUSTMENTS.md` |
| Test evidence | BE/FE typecheck PASS; `finance-period-end-adjustments` **4/4**; migration + permissions synced locally |
| Status | **done** for accruals/prepaid — **conditions**: Hostinger migrate deploy of `20260730190000_finance_period_end_adjustments` + `db:sync-permissions` |
| Next step | Treasury FX / intercompany |

---

## Done recently — Purchase QI parameter checklist (2026-07-30)

| Field | Value |
|-------|-------|
| Module | Quality / Purchase QI |
| Description | Persist incoming QI `inspectionPlan` + parameter checklist (DB → API → facade → FE); hold/DEVIATION_PENDING editable; docs scope + deferrals |
| Doc | `docs/quality/QUALITY_SCOPE_AND_DEFERRALS.md` |
| Status | **done** in code — **condition**: migrate deploy + live `purchase-qi-lifecycle` re-run when MySQL up |
| Next step | `npx tsx scripts/prisma-cli.ts migrate deploy` then vitest QI + quality-phase suites |

---

## Done recently — Inventory Costing READY gate closure (2026-07-30)

| Field | Value |
|-------|-------|
| Module | Inventory Costing |
| Description | Closed READY WITH CONDITIONS: wired costing recon/overview to FIN-CLOSE-1 Inventory↔GL TB (Not Available when flag off; never ₹0; no Force Balance); SPA UAT API harness; live GL parity suite + npm scripts |
| Doc | `docs/inventory/INVENTORY_COSTING_TEST_RESULTS.md`, `INVENTORY_COSTING_CONTROLLED_UAT.md` |
| Status | **done** for Inventory Costing READY — residual optional human browser walk; purchase-return/dispatch matrices + 10k soak accepted deferrals; **purchase invoice retro cost** remains Purchase/FIN open (not an Inventory Costing condition) |
| Next step | Optional SPA browser sign-off; Purchase retro cost adjust separately |

---

## FIN-CLOSE-1 deferred leftovers (updated 2026-07-30)

| Field | Value |
|-------|-------|
| Module | Accounting / Purchase / Inventory |
| Description | **FIN-CLOSE-1 code closure met.** Purchase invoice retro cost now uses Inventory Costing: remaining stock is capitalised, consumed delta remains PPV, original receipt is immutable, retries are idempotent, and reversal reallocates consumed delta to PPV. Optional GR/IR ageing remains nice-to-have. |
| Blocker | **Human production action only:** Hostinger `migrate deploy`, FIN mapping script, build/redeploy and post-checks per `docs/accounting/FIN_CLOSE_1_HOSTINGER_MIGRATION_RUNBOOK.md`. Nothing was deployed remotely. |
| Test evidence | **PASS** — `npm run test:fin-close-1-live`; retro-cost live 4/4; purchase/inventory regression pack 15/15; backend typecheck; Inventory↔GL matched without Force Balance. |
| Status | **done in code / production deploy pending human action** |

---

## Done recently — Maintenance V1 inventory ISSUE (2026-07-30)

| Field | Value |
|-------|-------|
| Module | Maintenance |
| Description | Spare parts post `ISSUE_TO_MAINTENANCE` via inventory `postStockMovement` (on-hand + cost entry); FE honest stockable vs free-text; PR shortage deep-link (`source=MAINTENANCE`); `sync-permissions` verified |
| Test | `npx tsx scripts/test-maintenance-v1.ts` — **PASS** (ISSUE `STM-000187`; insufficient stock fail-closed). External contractor **SKIP** (no vendor). |
| Status | **done** for V1 product gate (**READY**). V1.1 closed PR `sourceType` persistence (see V1.1 section above). Human: optional SPA walk; contractor UAT when vendor exists. Deferred: PM scheduler. |
| Docs | `docs/maintenance/` |

---

## Done recently — Purchase multi-unit UOM (2026-07-27)

- Vendor → primary conversion across Item Master / PO / GRN / inventory posting.
- Fields: `quantity` (primary), `uomQuantity` (vendor), `uomConversionFactor`.
- Docs: `docs/PURCHASE_MULTI_UNIT_UOM.md`; Hostinger SQL: `backend/scripts/purchase-multi-unit-uom-hostinger.sql`.

---

## Done recently — Dispatch commercial policy UI + enforcement (2026-07-27)

| Field | Value |
|-------|-------|
| Module | Dispatch / O2C |
| Description | Tenant `DispatchSettings` + `/dispatch/settings` UI; enforce partial / multiple / invoice mode / POD on draft + Invoice Ready + auto SI |
| Test | `backend/tests/dispatch-commercial-policy.test.ts` (+ existing 7C5 / O2C allocate proofs) |
| Status | **done** for base commercial policy — **open**: live e-Way (blocked until base flow sign-off) |

---

## Done recently — Close Money In/Out UI gaps (2026-07-27)

| Field | Value |
|-------|-------|
| Module | Accounting Money In / Money Out |
| Description | Receipt/CN/journal reverse already on detail pages; AP reversal history API + FE; allocation reverse links; Money In Corrections hub; POD gate on manual SI create + invoice-ready filter |
| Status | **done** for high-priority reverse + Dispatch→SI POD — commercial policy UI shipped 2026-07-27 |

---

## Done recently — Dispatch → AR Invoice O2C slice 1 (2026-07-27)

| Field | Value |
|-------|-------|
| Module | Dispatch / Money In |
| Description | HTTP invoice-ready + prefill; SI create persists `sourceLinks`; API outbound detail Create/View Invoice; Money In Invoice Ready route; live post→invoice→allocate |
| Test | `backend/tests/dispatch-o2c-invoice-allocate.test.ts` **PASS** |
| Status | **done** for manual close path + commercial policy — live e-Way deferred until base flow sign-off |

---


## Done recently — Bank & Cash UAT readiness (2026-07-23; 5D4 closed 2026-07-30)

| Field | Value |
|-------|-------|
| Module | Accounting / Treasury |
| Description | Live API for **internal UAT / controlled pilot**; workspace tabs + seed redirects cleaned; **5D4 SIMULATED AIS + scheduleCron** shipped |
| Doc | `docs/accounting/BANK_CASH_STATUS.md` |
| Status | **done** for core UAT + SIMULATED AIS/cron — **open** / deferred: **live TPP AIS**, **FX**, **intercompany**, cheque print |

---

## Done recently — ISO tank child MAKE SA WO depth (2026-07-23)

| Field | Value |
|-------|-------|
| Module | Manufacturing |
| Description | Live harness proves child MAKE SA WO end-to-end (SA-LADDER): SA receipt into WIP → parent reserve/issue |
| Script | `backend/scripts/test-iso-tank-child-sa-wo.ts` |
| Status | **done** for ladder SA path — **open** for heavier SAs (shell/frame) + QC-gated child routes |

---

## Done recently — CRM Item Phase 2 sales fields (2026-07-23)

| Field | Value |
|-------|-------|
| Module | CRM / Masters |
| Description | MasterItem sales commercial fields, API `salesAllowed` filter, Item form Sales section, migration metrics script |
| Doc | `docs/crm/CRM_ITEM_PHASE2_SALES_FIELDS.md` |
| Status | **done** |

---

## Done recently — Dispatch 7C5 hardened posting (2026-07-23)

| Field | Value |
|-------|-------|
| Module | Dispatch |
| Description | Canonical `DispatchPostingService`, policy gates, readiness API, reverse, reconciliation; emergency override API; serial/lot + concurrency stress; live **17/17** |
| Doc | `docs/dispatch/PHASE7C5_HARDENED_POSTING.md` |
| Status | **done** for controlled UAT foundation — FE reverse approval panel + perm gates + reversibleQty fixed 2026-07-27; **open** for client production (manual UAT sign-off); emergency override HTTP audit register still thin |

---

## Done recently — Dispatch domain outbox (2026-07-23)

| Field | Value |
|-------|-------|
| Module | Dispatch |
| Description | `DISPATCH_POSTED` / `SALES_ORDER_INVOICE_READY` (+ fulfilment / reverse) enqueue + drain to PUBLISHED; list/process/retry APIs |
| Doc | `docs/dispatch/DISPATCH_DOMAIN_EVENTS.md` |
| Status | **done** (auto-invoice consumer shipped; see `DISPATCH_AUTO_SALES_INVOICE.md`) |

---

## Done recently — Dispatch reverse Invoice/COGS blockers (2026-07-23)

| Field | Value |
|-------|-------|
| Module | Dispatch |
| Description | Hard-block reverse on posted/open SI links + posted inv-acct COGS; force requires override; FE preflight |
| Doc | `docs/dispatch/DISPATCH_REVERSAL_DEPENDENCIES.md` |
| Status | **done** (auto Dispatch→Invoice + manual invoice-ready path shipped 2026-07-27) |

---

## Done recently — Dispatch partial reverse / approval (2026-07-23)

| Field | Value |
|-------|-------|
| Module | Dispatch |
| Description | Partial line reverse (`reversedQuantity`), reversal lifecycle DRAFT→APPLIED, routes under `/reversals`, invoice/COGS hard blocks |
| Doc | `docs/dispatch/DISPATCH_REVERSAL.md` |
| Status | **done** |

---

## Done recently — MFG pilot scenarios API pack (2026-07-29)

| Field | Value |
|-------|-------|
| Module | Manufacturing |
| Description | Open pilot scenarios automated: shortage→PR, material return (+ batch return fix), hold/resume, SO→Demand→WO, Dispatch serial AVAILABLE; SPA checklist for UI walk |
| Evidence | `test-fuel-tank-pilot-scenarios.ts` **PASS**; `PR-000010`; `WO-000038` from SO; serials @ FG-MAIN |
| Doc | `docs/manufacturing/MFG_PILOT_SPA_UAT_CHECKLIST.md`, `MFG_PILOT_SCENARIO_RESULTS.md` |
| Status | **done** for API scenario pack + **A1–A9 + partial FG signed** (2026-07-29) — optional live SPA UX walk remains |

## Done recently — MFG-GOLDEN-1 Fuel Tank re-verification (2026-07-28)

| Field | Value |
|-------|-------|
| Module | Manufacturing |
| Description | Audit + re-run factory golden path; docs pack under `docs/manufacturing/MFG_*`; no new mfg features |
| Evidence | `WO-000010`, serial `FT-5000L-52948875`, material=WO=FG ₹111,020; CLOSE purpose blocked / COMPLETE ready |
| Doc | `docs/manufacturing/MFG_GOLDEN_PATH_AUDIT.md`, `MFG_GOLDEN_PATH_TEST_RESULTS.md`, `FUEL_TANK_GOLDEN_PATH.md` |
| Status | **READY FOR CONTROLLED PILOT** — live SPA sign-off / shortage-return-partial SPA / SO→WO UI run / perf soak remain open |

## Done recently — Fuel Tank factory golden path (2026-07-27)

| Field | Value |
|-------|-------|
| Module | Manufacturing |
| Description | Controlled UAT: ONE FG WO + LOGICAL SFG Job Cards → reserve/issue → route/QC/rework → WC/machine assignment → FG serial receipt → WO actual cost (inventory costing) → FG valuation → close readiness → COMPLETED |
| Evidence | `WO-000009`, serial `FT-5000L-43550266`, material/WO/FG cost ₹111,020; script `npx tsx scripts/test-fuel-tank-wo-execution.ts` |
| Doc | `docs/manufacturing/examples/FUEL_TANK_UAT.md` |
| Status | **PASS** — superseded evidence by 2026-07-28 re-run (`WO-000010`) |

## Done recently — Fuel Tank mfg master (2026-07-23)

| Field | Value |
|-------|-------|
| Module | Manufacturing / Masters |
| Description | 5000 L Fuel Tank live seed: multilevel BOM, PARALLEL route RT-000001, profile MP-FUEL-TANK-5000L, LOGICAL SFG Job Cards under FG WO |
| Doc | `docs/manufacturing/examples/FUEL_TANK_MASTER_SETUP.md` |
| Status | **done** — superseded for close-path by 2026-07-27 golden path UAT above |

---

## Done recently — Purchase completion FE/integration (2026-07-28)

| Field | Value |
|-------|-------|
| Module | Purchase |
| Description | GRN receiving-chain UX; Invoice AP handoff honesty + Money Out link; Return accounting-pending banner; GRN→cost entry automated proof |
| Doc | `docs/purchase/PURCHASE_COMPLETION_AUDIT.md`, `PURCHASE_COMPLETION_TEST_RESULTS.md` |
| Status | **done** for internal UAT closure of FE/integration links — return→AP and invoice retro cost are now closed; spend/supplier dashboards remain optional (QI parameters API **done** 2026-07-30) |

---

## Done recently — Inventory Costing UAT-1 hardening (2026-07-28)

| Field | Value |
|-------|-------|
| Module | Inventory Costing |
| Description | Controlled UAT suite (4 methods + transfer + tenant isolation); cost-entry/movement value parity; transfer cost preservation; method-change readiness preview; MA before/after history; Standard ItemLookupSelect; recon GL Not Available |
| Doc | `docs/inventory/INVENTORY_COSTING_UAT_AUDIT.md`, `INVENTORY_COSTING_TEST_RESULTS.md`, `INVENTORY_COSTING_PRODUCTION_READINESS.md` |
| Status | **done** for UAT-1 automated hardening + **2026-07-30 READY gate** (SPA API harness + Inventory↔GL wiring) — **accepted deferrals**: purchase-return/dispatch 4-method matrices, 10k soak, dedicated approve permission; residual human SPA walk optional |

---

## Done recently — Inventory Costing FE + Reconciliation UI (2026-07-28)

| Field | Value |
|-------|-------|
| Module | Inventory Costing UI |
| Description | Overview, enriched registers, MA/standard/specific screens, Run Reconciliation, method-change current method, read APIs |
| Doc | `docs/inventory/INVENTORY_COSTING_FE_AUDIT.md`, `INVENTORY_COSTING_UI.md` |
| Status | **done** for FE usability + Inventory↔GL summary surface — residual human SPA walk optional |

---

## Done recently — IV-MFG-1 Inventory ↔ Manufacturing cost consolidation (2026-07-28)

| Field | Value |
|-------|-------|
| Module | Inventory Costing / Manufacturing Costing |
| Description | Inventory Costing is sole inventory valuation authority; WO material consumes InventoryCostEntry; legacy mfg valuation enum deprecated (not dropped); cost-trace + item summary + effective-method APIs; WO Costing material UI |
| Doc | `docs/inventory/INVENTORY_MANUFACTURING_COSTING_AUDIT.md`, `docs/inventory/INVENTORY_VALUATION_ARCHITECTURE.md` |
| Status | **done** for architecture consolidation — **open**: controlled golden-path UAT (MA/FIFO/Standard/Specific) + live mfg GL still blocked |

---

## In progress — Inventory costing engine (2026-07-27)

| Field | Value |
|-------|-------|
| Module | Inventory / Manufacturing / Finance integration |
| Description | Costing engine Phase A–C BE + **Phase 1 FE Costing UI** + **all 4 valuation methods hardened** + **IV-MFG-1** (WO material from InventoryCostEntry; legacy mfg enum deprecated). |
| Status | **done** (engines + UI + IV-MFG-1 + UAT-1 + **2026-07-30 READY**: SPA API harness + Inventory↔GL TB wiring) |
| Next step | Optional live SPA browser checklist. Purchase-return + dispatch 4-method matrices and 10k soak remain accepted deferrals. **Do not** expand live Manufacturing Accounting GL until the gate below clears. |

---

## Blocked — Manufacturing Accounting live GL (after costing stack stable)

| Field | Value |
|-------|-------|
| Module | Manufacturing / Finance |
| Description | Live GL for Material Issue / FG Receipt / Production Variance. Event builder + flag-gated posting already exist; **enable only after** prerequisites below are stable. |
| Protection | Existing readiness gate (`GET …/manufacturing/accounting/readiness` + enablement sign-offs) — **do not replace**; keep flag OFF until gate + prerequisites pass. |
| Journal model (already in builder) | **Issue:** Dr WIP / Cr RM · **FG receipt:** Dr FG / Cr WIP · **Variance:** Dr/Cr Production Variance (sign flips debit/credit) |
| Prerequisites (all must be stable) | 1. Inventory Costing · 2. WO actual cost · 3. FG valuation · 4. Dispatch cost relief (COGS) · 5. Finance mappings (WIP/FG/RM/variance) |
| Status | **blocked** — not started for live enablement; scaffolding + readiness already shipped |
| Next step | Finish Inventory Costing UAT → prove WO actual + FG valuation → prove Dispatch COGS relief → map accounts → then enable via readiness gate |

---

## P1 — CRM Integrations

### CRM Commercial & Receivables (lightweight)

| Field | Value |
|-------|-------|
| Module | CRM / Commercial |
| Description | Proforma invoices (API), payment receipts, CRM tax invoices, payment allocation workspace, Customer 360 commercial tabs |
| Status | **done** (2026-07-27) — Proforma API + sync shipped; live UAT script `backend/scripts/test-crm-commercial-uat.ts` |
| Next step | Manual UI sign-off on vasant-trailers API mode |

### IndiaMART Lead Integration

| Field | Value |
|-------|-------|
| Module | CRM / Integrations / IndiaMART |
| Description | Pull + Push sync → enquiry inbox → dedupe → CrmLead |
| Status | **partial** — Phases 1–5 shipped; local go-live prep: `FIELD_ENCRYPTION_KEY` set; migrations present; Pull key + Test connection + UAT remain |
| Doc | `docs/crm/INDIAMART_GOLIVE.md` |
| Next step | Restart API → paste live `glusr_crm_key` in Settings → Test connection → Initial import / Sync → UAT checklist |

---

## P0 — Critical (blocks API-mode production CRM)

### P0-ADMIN: Admin Panel (IAM / org / security UX)

| Field | Value |
|-------|-------|
| Module | Admin / Platform |
| Description | Production Admin Panel over existing User/Role/Tenant/LegalEntity/Branch/Auth — no duplicate company or permission systems |
| Doc | `docs/admin/ADMIN_PANEL_PHASE1_AUDIT.md` |
| Status | **done** — Phases 1–10 + A3–A9 completion (Module Administrators designation, Effective Access route fix, admin security regression). Holds: editable password/MFA; blanket API module gates; LE/branch **query** enforcement |
| Next step | Product UAT of Admin Panel; optional later: editable security settings / scope enforcement on CRM lists |

### P0-CRM-ITEM: CRM/Sales Product Master → Item Master migration

| Field | Value |
|-------|-------|
| Module | CRM / Sales / Masters |
| Description | Architectural cut-over: CRM & Sales lines use `MasterItem` only; dual-read legacy `productId→fgItemId` during transition; do not drop `master_products` until Phase 10 |
| Doc | `docs/crm/CRM_PRODUCT_TO_ITEM_MIGRATION_MAP.md` |
| Status | **done** — Phases 3–10 complete for CRM Lead→SO (+ dispatch) and commercial proforma/tax lines (`itemId` only). Product Master kept for engineering. |
| Next step | FE cleanup of leftover CRM `productId` dual-read helpers where still present outside commercial |

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
| Reason | **Partial** — PO/GRN/QI/Invoice/Return + Setup + FE parity + GRNI + approver limits + **multi-unit UOM** + **GRN tolerance** + **PO versioning** + FIN-CLOSE-1 GR/IR, PPV, return→AP and **purchase invoice retro cost** are live-verified. Remaining product gaps: ITC placeholders and fuller dual-UOM display. Hostinger migration/redeploy remains a human operation. |
| Dependencies | Items, vendors (done); PR schema Phase 03 (done); PO lifecycle (done); Approvals queue (done); Setup 1A (done) |
| Next step | Human Hostinger migration/mapping/redeploy runbook; optional ITC and reporting enhancements. |
| Test required | Setup **13/13**; QI/return lifecycle; GRNI; invoice lifecycle; **purchase-completion-grn-costing** PASS |
| Status | **in_progress** (core loop ready for internal UAT) |

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
| Description | **Finance Settings Phase 1** + journals/AR/AP/treasury + **Period Close P1 + Close Control Hardening + year-end P&L→RE + accruals/prepaid + calendar/reopen + FX reval** (2026-07-30). |
| Next step | Treasury FX / intercompany; Budgeting Phase 2+ / GST filing as prioritized. |
| Test required | `tests/finance/finance-year-end-close.test.ts` + `finance-period-end-adjustments` + `finance-period-close-calendar-reopen` + `finance-fx-revaluation` + `period-close-hardening` |
| Status | partial (year-end + accruals/prepaid + calendar/reopen + FX reval shipped; treasury FX / IC still open) |

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

See [`PROJECT_STATUS.md`](PROJECT_STATUS.md) open risks. Highest ops: **redeploy production `.htaccess`** so `/api` returns JSON. Product backlog: **verify P1-1/P1-2 admin UIs**; then P2 mobile API E2E. Finance Money In/Out + year-end P&L close shipped — next: accruals/FX wizards or Dispatch invoice policy UI polish as prioritized.
