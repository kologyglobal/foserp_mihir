# Project Status

Last verified against codebase: **2026-07-31** (HRMS UI/UX redesign — Zoho People–inspired FE). Prior **2026-07-31**: Phase 11 Exit & F&F; Phase 10 Loans; Phase 9 Payslip/Accounting/Payment; Phase 8 Statutory; Phase 7 Payroll. Prior **2026-07-30**: HRMS Phase 6 Salary Structures; Phase 5 Overtime; Leave + attendance; Phase 2 Shift/Roster; Phase 1 Employee. Prior **2026-07-29**: FIN-CLOSE-1 stop; MFG Fuel Tank READY.
**Canonical master routes:** see [`docs/MASTER_REGISTRY.md`](MASTER_REGISTRY.md). **CRM workflow diagrams:** see [`docs/CRM_WORKFLOW.md`](CRM_WORKFLOW.md).
**Completion rule:** A module is **Completed** only with UI + API + DB + permissions + tenant isolation + tests. Demo FE alone ≠ complete. Otherwise: Partially completed / Not started / Blocked / Deferred by design.

Legend: ✅ done · ⚠️ partial · ❌ missing · 🔒 deferred · ⏸ blocked

---

## How to read this

| Bucket | Meaning |
|--------|---------|
| **Production-ready (API mode)** | UI + API + DB + permissions + tenant isolation + live tests — usable with `VITE_USE_API=true` |
| **Demo-only** | Rich SPA / Zustand; no (or not for this module) backend. Never mark complete |
| **Deferred by design** | Transactional ERP backends (purchase, inventory, production, quality, finance/AP full; SO MRP/dispatch/invoice). **Accepted deferral** — not CRM verification defects (see `CRM_FE_API_DB_VERIFICATION_REPORT` G2/G3). SO Phase 1 (convert + draft CRUD + confirm/close) is shipped. |
| **Scaffolding** | Code exists but not shipped (e.g. accounting pages/store with no router/nav) |

---

## Summary by category

| Category | Modules |
|----------|---------|
| **Completed (API mode)** | **Auth** (login/JWT/self-service) + **Admin tenants/users/roles**; … **AR 3A–3C** (invoice/receipt/CN + allocation) + **3B6/3C6 Money In UI** + receipt/CN/allocation/journal reverse + corrections hub; **AP Money Out UI** + corrections + AP reversal history; Dispatch→SI invoice-ready + POD gate on manual create |
| **Not started** | HRMS EPFO-ESIC-TRACES portal filing / Form 16 / recruitment / ATS / performance management / LMS / employee self-service portal / interest-bearing loan products / live bank payment APIs … |
| **Partially completed** | **HRMS** through Phase 11 Exit & Full/Final Settlement in code (READY WITH CONDITIONS); mobile CRM; sales-order fulfilment beyond confirm/close; **Admin A8** broader demo-mix pack beyond security regression |
| **Scaffolding (not shipped)** | — (Accounting: some CoA/voucher demo surfaces; Period Close **P1 + hardening + year-end P&L→RE** live — accruals/prepaid/FX/calendar still demo; **Finance Settings** at `/accounting/settings` is Phase 1 dual-mode) |
| **Blocked** | — (none currently) |
| **Deferred by design** | Broad QMS beyond shipped Quality scope (CAPA/calibration/SPC — see `docs/quality/QUALITY_SCOPE_AND_DEFERRALS.md`); SO MRP / dispatch client production hardening leftovers |

---

## Open risks / ops

| Risk | Status |
|------|--------|
| Production deployment parity | **hPanel redeploy pending (2026-07-21)** — API health is JSON/connected, but live SPA still serves a July 17 Vite hash. Root Hostinger build/start/verification architecture is now fixed in code; configure hPanel per `HOSTINGER_GIT_DEPLOYMENT.md` and verify `/build-meta.json` before closing. |
| Local API-mode empty data | Backend must listen on `:5000`; not a demo/API mix bug |
| DB cleanup scripts | `cleanup-leads.ts`, `cleanup-opp-quotations.ts`, `cleanup-sales-orders.ts` — local one-offs; do not run on prod without intent |
| Accounting orphan UI | **Resolved 2026-07-15** — all `/accounting/*` deep links from the dashboard now resolve (dashboard live; other screens are placeholders, not 404s) |
| Inventory costing rollout | **READY 2026-07-30 — live verified after migrate deploy.** Inventory pack: **9 files / 21 tests PASS, 0 skipped**; SPA UAT API harness **9/9 PASS**; Inventory↔GL parity **3/3 PASS** (operational RM = mapped GL, no Force Balance). Purchase invoice retro-cost integration is now closed under FIN-CLOSE-1; residual optional human SPA walk only. |
| Manufacturing Fuel Tank golden path | **MFG-GOLDEN-1** + **pilot A1–A9 + partial FG signed 2026-07-29** (`WO-000039` happy / `WO-000040` partial). Verdict **READY**. Optional live SPA UX walk only. |
| Maintenance V1 | Ticket-centric REPORT→REPAIR→TEST→CLOSE + spare ISSUE (`ISSUE_TO_MAINTENANCE`). Harness **PASS** (`MT-000003`/`MT-000004`, `STM-000187`). **READY** — human SPA/contractor sign-off optional; see `docs/maintenance/`. |
| Maintenance V1.1 | Machine Health read model, failure SAFETY + rootCause/repairAction, automatic downtime/MTTR display, repeat breakdown, MFG active-ticket banner, PR `sourceType=MAINTENANCE` + part backlink. Migration `20260730200000_maintenance_v11_machine_health`. **READY WITH CONDITIONS** until `test-maintenance-v1.ts` + `test-maintenance-v11.ts` PASS post-migrate. |
| Maintenance V2 | Preventive plans (`PM-`) → ticket (`PREVENTIVE`) → close recalculates next due. Checklist on plan/ticket. Dashboard PM due KPIs + compliance report. Migration `20260730210000_maintenance_v2_preventive`. **READY WITH CONDITIONS** until `test-maintenance-v2.ts` PASS. |
| HRMS Phase 5 Overtime | OT policy/records; detect/eligible/approve; FE `/hrms/overtime`. Migration `20260730270000_hrms_phase5_overtime`. **READY WITH CONDITIONS** — sync-permissions + FE verify. |
| HRMS Phase 6 Salary Structures | Components, versioned structures, assignment/revision, effective lookup + preview. FE `/hrms/payroll/setup/*` + employee Salary. Migration `20260730280000_hrms_phase6_salary_structure`. **READY WITH CONDITIONS** — migrate + vitest + sync-permissions. |
| HRMS Phase 7 Payroll | Period/run lifecycle; paid-days + prorated calc; review/finalize; exceptions. FE `/hrms/payroll/runs`. Migration `20260731010000_hrms_phase7_payroll`. **READY WITH CONDITIONS** — migrate + vitest + sync-permissions. |
| HRMS Phase 8 Statutory | PF/ESIC/PT/TDS/LWF rules + wage basis + PT slabs; employee profile overrides; payroll calc appends statutory lines; registers API/CSV. FE `/hrms/payroll/statutory*`. Migration `20260731030000_hrms_phase8_statutory`. **READY WITH CONDITIONS** — migrate + vitest + sync-permissions + UAT A–J. **Stop before portal filing / Form 16 / payslip / payroll GL / F&F.** TDS is foundation-only (manual override or review-required). |
| HRMS Phase 9 Payslip/Accounting/Payment | Immutable payslip snapshots + HTML/PDF; payroll accrual GL via shared `post()` + CoA mappings; salary payment batch DRAFT→READY→APPROVED→PAID (bank validation, duplicate guard, CSV, payment GL clears only `SALARY_PAYABLE`). FE: `/hrms/payroll/payslips`, run Accounting/Payments tabs, `/hrms/payroll/my-payslips`. Migration `20260731040000_hrms_phase9_payslip_accounting_payment`. **READY WITH CONDITIONS** — migrate + vitest live (9 skipped pending migrate) + sync-permissions + UAT A–M. **Stop before portal filing / Form 16 / live bank APIs / F&F / loans.** |
| HRMS Phase 10 Employee Loans & Salary Advances | Loan/advance lifecycle; recovery schedule; payroll `LOAN_RECOVERY`/`ADVANCE_RECOVERY` (confirm on finalize); GL disburse/repay via shared `post()`. FE `/hrms/loans*`, `/hrms/my-loans`. Migration `20260731050000_hrms_phase10_loans_advances`. **READY WITH CONDITIONS** — migrate + vitest live + sync-permissions + UAT. **Stop before interest products / F&F / portal filing / performance management.** |
| HRMS Phase 11 Exit & Full/Final Settlement | Exit lifecycle; clearance + assets; notice reconciliation; F&F calc/review/approve/post/pay (negative net → receivable, no pay). FE `/hrms/exits*`, `/hrms/fnf*`. Migration `20260731060000_hrms_phase11_exit_fnf`. **READY WITH CONDITIONS** — migrate + vitest live + sync-permissions + UAT. **Stop before recruitment / ATS / performance / LMS / portal filing.** |
| HRMS UI/UX redesign | Zoho People–inspired FE shell across `/hrms/*` (home, employee register/360, attendance, leave/OT, payroll guided steps, payslips, loans, exit/F&F, My HR). Shared `Hr*` components; APIs reused; no business-rule rewrites. Doc `docs/hrms/HRMS_UI_UX_REDESIGN.md`. **READY WITH CONDITIONS** — manual SPA UAT + drawer polish + linked-employee My HR. |
| Quality (scoped QMS) | Manufacturing 4A/4B/7B + Purchase incoming QI (incl. parameter checklist). **READY 2026-07-30 — live verified after migrate deploy: 23/23 PASS, 0 skipped** (4A 5/5, 4B 5/5, 7B 7/7, Purchase QI 6/6). The `awaitingQuality` failures were fixture drift — 4A/4B now seed strict `flexibleExecution: false`. Broad QMS deferred — `docs/quality/QUALITY_SCOPE_AND_DEFERRALS.md`. |
| FIN-CLOSE-1 accounting integration | **Code closure met 2026-07-30** — prior stop scope plus purchase invoice retro cost + **year-end P&L→RE**. **Human action remains:** Hostinger migrate deploy (incl. `20260730121000_finance_year_end_close`) + mapping runbook. Accruals/FX/AIS still deferred. |

---

## Module status table

### Auth

| Aspect | Status | Notes |
|--------|--------|-------|
| Frontend | ✅ | Login + forgot/reset; `ChangePasswordPage` (`/account/change-password`); `ProfileSettingsPage` (`/settings/profile`); user-menu links; `AuthProvider` + `ApiAuthGate` |
| Backend | ✅ | login, refresh, logout, forgot/reset/change password, `GET/PATCH /me`; tenant password policy on change/reset **and** user create |
| DB | ✅ | users, refresh_tokens, password_reset_tokens |
| API | ✅ | `/api/v1/auth/*` |
| Tests | ✅ | FE `test:uat-01-auth` **24/24**; BE `auth-hardening` + `auth-self-service` — **live 2026-07-30: 9/9 PASS, 0 skipped** (profile, policy, forgot/reset, refresh/logout) |
| Demo mode | 🔒 | No login required |
| API mode | ✅ | JWT session + auto refresh + self-service |
| Remaining gap | — |

### Login activity

| Aspect | Status | Notes |
|--------|--------|-------|
| Frontend | ✅ | `/admin/security/login-activity` (API mode) |
| Backend | ✅ | `LoginActivity` writes on success/fail; list API |
| DB | ✅ | `login_activities` + user lock fields |
| API | ✅ | `GET /security/login-activity` (`security.view`) |
| Tests | ✅ | phase8 + `admin-security-regression` |
| Demo mode | 🔒 | API mode required empty state |
| API mode | ✅ | Register + lockout policy hint |
| Remaining gap | Export / richer filters optional |

### Tenants

| Aspect | Status | Notes |
|--------|--------|-------|
| Frontend | ✅ | `TenantAdminPages` at `/platform/tenants` (Super Admin); `/admin/tenants` redirects; create first admin + suspend/activate/archive |
| Backend | ✅ | CRUD for Super Admin; admin password floor vs `PASSWORD_MIN_LENGTH` |
| DB | ✅ | tenants |
| API | ✅ | `/api/v1/tenants` |
| Tests | ✅ | FE `test:admin-iam` structure PASS; BE `admin-tenants-users-roles-smoke` — **live 2026-07-30: 5/5 PASS, 0 skipped** (list/create/patch + non–super denied); `admin-security-regression` **6/6** |
| Demo mode | ✅ | `data/admin/seed.ts` seed tenants |
| API mode | ✅ | Hydrates via `syncAdminTenantsFromApi()` |
| Remaining gap | — |

### Users (system)

| Aspect | Status | Notes |
|--------|--------|-------|
| Frontend | ✅ | `UserAdminPages` list/invite/edit/detail + role assign at `/admin/users` |
| Backend | ✅ | CRUD + role assign under `/t/:slug/users`; `assertPasswordMeetsPolicy` on create |
| DB | ✅ | users, user_roles |
| API | ✅ | Permission-gated |
| Tests | ✅ | FE `test:admin-iam`; BE smoke + `admin-security-regression` / invitations suites |
| Demo mode | ✅ | `data/admin/seed.ts` seed users |
| API mode | ✅ | Hydrates via `syncAdminUsersFromApi()` |
| Remaining gap | — |

### Roles

| Aspect | Status | Notes |
|--------|--------|-------|
| Frontend | ✅ | `RoleAdminPages` list/create/edit/detail + permission matrix at `/admin/roles` |
| Backend | ✅ | `/t/:slug/roles` |
| DB | ✅ | roles, role_permissions |
| API | ✅ | |
| Tests | ✅ | FE `test:admin-iam`; BE smoke create/patch role + catalog |
| Demo mode | ✅ | `data/admin/seed.ts` seed roles + permission catalog |
| API mode | ✅ | Hydrates via `syncAdminRolesFromApi()` |
| Remaining gap | — |

### Permissions

| Aspect | Status | Notes |
|--------|--------|-------|
| Frontend | ✅ | CRM UI uses `canCrmPermission('crm.*')`; demo fallback only inside helper |
| Backend | ✅ | 140+ permissions seeded; middleware enforced |
| DB | ✅ | permissions, role_permissions |
| API | ✅ | Returned on login/me |
| Tests | ⚠️ | Indirect via E2E |
| Demo mode | 🔒 | Local permission utils + `sales.*` matrix for non-CRM ERP modules |
| API mode | ✅ | CRM gates match JWT; admin modules N/A |
| Remaining gap | Demo `salesStore` / transactional Sales still use `assertPermission('sales')` |

### CRM — Companies

| Aspect | Status | Notes |
|--------|--------|-------|
| Frontend | ✅ | List, form, 360, import |
| Backend | ✅ | CRUD + import |
| DB | ✅ | crm_companies |
| API | ✅ | |
| Tests | ✅ | E2E create/update/delete |
| Demo mode | ✅ | |
| API mode | ✅ | Bridge + sync |
| Remaining gap | Server export wired; merge/duplicate detection not done |

### CRM — Contacts

| Aspect | Status | Notes |
|--------|--------|-------|
| Frontend | ✅ | List, 360, import |
| Backend | ✅ | CRUD |
| DB | ✅ | crm_contacts |
| API | ✅ | |
| Tests | ✅ | E2E |
| Demo mode | ✅ | |
| API mode | ✅ | Notes + attachments on 360 |
| Remaining gap | — |

### CRM — Leads

| Aspect | Status | Notes |
|--------|--------|-------|
| Frontend | ✅ | List, 360, form, bulk actions |
| Backend | ✅ | CRUD, assign, qualify, disqualify, convert, bulk |
| DB | ✅ | crm_leads + history |
| API | ✅ | |
| Tests | ✅ | E2E full lifecycle |
| Demo mode | ✅ | |
| API mode | ✅ | Notes + attachments on 360 |
| Remaining gap | Reopen/archive endpoints if required by UI |

### CRM — Opportunities

| Aspect | Status | Notes |
|--------|--------|-------|
| Frontend | ✅ | Pipeline, 360, lines; Edit header via `useOpportunityEditor` |
| Backend | ✅ | CRUD, win/lose, move-stage, assign, reopen, soft-delete |
| DB | ✅ | crm_opportunities, lines, history tables |
| API | ✅ | |
| Tests | ✅ | E2E win/lose/convert; UAT-03 86/86 |
| Demo mode | ✅ | |
| API mode | ✅ | History panel API-backed; edit attachments via `EntityAttachmentsPanel` |
| Remaining gap | No optimistic concurrency (`version`/`If-Match`); Reopen only on closed 360 (edit is open-only) |

### CRM — Activities

| Aspect | Status | Notes |
|--------|--------|-------|
| Frontend | ✅ | Timeline, log activity; unified feed on Contact/Company/Quotation 360 |
| Backend | ✅ | CRUD + complete |
| DB | ✅ | crm_activities |
| API | ✅ | |
| Tests | ✅ | E2E |
| Demo mode | ✅ | |
| API mode | ✅ | |
| Remaining gap | — |

### CRM — Follow-ups

| Aspect | Status | Notes |
|--------|--------|-------|
| Frontend | ✅ | Drawer, list, dashboard panels; Lead/Opp timeline Edit/Delete |
| Backend | ✅ | CRUD + complete/reschedule/snooze/cancel |
| DB | ✅ | crm_follow_ups |
| API | ✅ | |
| Tests | ✅ | Live E2E create/update/delete |
| Demo mode | ✅ | |
| API mode | ✅ | Bridge update/delete |
| Remaining gap | — |

### CRM — Dashboard

| Aspect | Status | Notes |
|--------|--------|-------|
| Frontend | ✅ | KPI + chart + panel overlay from API when `VITE_USE_API=true` |
| Backend | ✅ | `/dashboard/metrics` with `panels` (incl. quotation approval queue) + `charts` |
| DB | ✅ | Aggregates from CRM tables + `crm_quotation_documents` |
| API | ✅ | |
| Tests | ✅ | Live: panel shape + pending_approval row in metrics |
| Demo mode | ✅ | Local metrics / store approval queue |
| API mode | ✅ | `panels.pendingApprovalQuotations` |
| Remaining gap | — |

### CRM — Reports

| Aspect | Status | Notes |
|--------|--------|-------|
| Frontend | ✅ | 16 reports via `useCrmReport` |
| Backend | ✅ | `/reports?reportId=` |
| DB | ✅ | Query-based |
| API | ✅ | |
| Tests | ⚠️ | Demo integration #16; limited live report asserts |
| Demo mode | ✅ | |
| API mode | ✅ | Quotation reports API-backed (empty until quotation rows exist) |
| Remaining gap | Broader live report coverage |

### CRM — Search

| Aspect | Status | Notes |
|--------|--------|-------|
| Frontend | ✅ | `GlobalSearch` + `useCrmGlobalSearch` |
| Backend | ✅ | `/crm/search` |
| DB | ✅ | |
| API | ✅ | |
| Tests | ✅ | Live E2E companies/contacts/leads/opportunities (2026-07-14) |
| Demo mode | ✅ | Local search |
| API mode | ✅ | |
| Remaining gap | — |

### CRM — Forecast

| Aspect | Status | Notes |
|--------|--------|-------|
| Frontend | ✅ | `useCrmSalesForecast` (API mode; no demo mix) |
| Backend | ✅ | `GET /crm/forecast` |
| DB | ✅ | Opportunity aggregates |
| API | ✅ | |
| Tests | ✅ | Unit + live tenant-scoped |
| Demo mode | ✅ | Local rollup |
| API mode | ✅ | |
| Remaining gap | — |

### CRM — Masters (dropdowns)

| Aspect | Status | Notes |
|--------|--------|-------|
| Frontend | ✅ | Phase 12 list/drawer/import/bulk aligned with CRM leads |
| Backend | ✅ | `/crm/masters/:kind` |
| DB | ✅ | crm_masters |
| API | ✅ | |
| Tests | ⚠️ | `test:crm-masters` (demo) |
| Demo mode | ✅ | |
| API mode | ✅ | via `crmMasterApiBridge` |
| Remaining gap | — |

### Notes

| Aspect | Status | Notes |
|--------|--------|-------|
| Frontend | ✅ | 360 pages + activity/follow-up drawers; `useEntityNotes` |
| Backend | ✅ | `/crm/entities/.../notes` |
| DB | ✅ | crm_notes |
| API | ✅ | |
| Tests | ✅ | Live E2E on LEAD |
| Demo mode | ✅ | |
| API mode | ✅ | Incl. `QUOTATION` |
| Remaining gap | — |

### Attachments

| Aspect | Status | Notes |
|--------|--------|-------|
| Frontend | ✅ | API panels; required Attachment Master type before upload |
| Backend | ✅ | Upload metadata + filesystem; `documentType` required |
| DB | ✅ | crm_attachments (+ QUOTATION enum) |
| API | ✅ | |
| Tests | ✅ | Live typed upload + list |
| Demo mode | ✅ | |
| API mode | ✅ | Quotation 360 via `EntityAttachmentsPanel` |
| Remaining gap | Optional download assertion |

### Master data (geography, UOM, warehouse, location)

| Aspect | Status | Notes |
|--------|--------|-------|
| Frontend | ✅ | Pages + `useMasterApiSync` |
| Backend | ✅ | Registry CRUD |
| DB | ✅ | Migrated |
| API | ✅ | |
| Tests | ✅ | masters + tenant isolation |
| Demo mode | ✅ | |
| API mode | ✅ | |
| Remaining gap | — |

### Master data (item category, HSN, GST, item, vendor, products)

| Aspect | Status | Notes |
|--------|--------|-------|
| Frontend | ✅ | Pages + batch sync + lookups; products hydrated |
| Backend | ✅ | Registry + items/vendors/products modules |
| DB | ✅ | Migrated (incl. `master_products`) |
| API | ✅ | Import/export |
| Tests | ✅ | master-batch, master-import |
| Demo mode | ✅ | |
| API mode | ✅ | |
| Remaining gap | BOM, work-center, routing remain demo |

### Items / Vendors

| Aspect | Status | Notes |
|--------|--------|-------|
| Frontend | ✅ | Item + vendor masters + lookups |
| Backend | ✅ | `/masters/items`, `/masters/vendors` |
| DB | ✅ | master_items, master_vendors |
| API | ✅ | |
| Tests | ✅ | master-batch |
| Demo mode | ✅ | |
| API mode | ✅ | |
| Remaining gap | — |

### Quotations

| Aspect | Status | Notes |
|--------|--------|-------|
| Frontend | ✅ | List/editor/360; shared `useQuotationConversion` / `QuotationConversionDialog` (list, 360, smart overview); UX: Modal Esc/backdrop, warning callout |
| Backend | ✅ | CRUD + document lifecycle + convert (`crm.quotation.convert` + `crm.sales_order.create`) |
| DB | ✅ | Extended columns; code series `QUOTATION` |
| API | ✅ | `/crm/quotations` + `POST …/convert-to-sales-order` |
| Tests | ✅ | Live convert success, 409 duplicate, lost-opp block (`test:crm-live` 50/50 as of 2026-07-15) |
| Demo mode | ✅ | Same convert UX via store |
| API mode | ✅ | Bridge updates quotation + SO + opp Won |
| Remaining gap | No tenant company-config for Sent shortcuts / credit / inventory warnings; no `convertedAt`/`convertedBy` columns (changeHistory JSON) |

### Quotation templates

| Aspect | Status | Notes |
|--------|--------|-------|
| Frontend | ✅ | Template builder + API hydrate/bridge |
| Backend | ✅ | `/crm/quotation-templates` CRUD + duplicate |
| DB | ✅ | `crm_quotation_templates` |
| API | ✅ | |
| Tests | ✅ | Live CRUD + duplicate E2E; demo builder script |
| Demo mode | ✅ | Seed: 1 template (`STANDARD-TRAILER`) |
| API mode | ✅ | Hydrated on login |
| Remaining gap | — |

### Sales orders (CRM Phase 1)

| Aspect | Status | Notes |
|--------|--------|-------|
| Frontend | ✅ | Convert dialog + View SO; direct SO create/edit/confirm |
| Backend | ✅ | Convert → Open SO + win opp; draft CRUD + confirm/close |
| DB | ✅ | `crm_sales_orders` + migration `directSoReason` (`20260714223000`) |
| API | ✅ | Convert + `POST/PATCH/DELETE /sales-orders`, confirm/close, GET |
| Tests | ✅ | Live: convert + 409 + lost block + direct create→confirm→close + draft delete |
| Demo mode | ✅ | |
| API mode | ✅ | Commercial path only |
| Remaining gap | **Accepted deferral:** MRP / dispatch / invoice posting (verification report G2) |

### Purchase (PR–Return/Invoice/QI + Setup API)

| Aspect | Status | Notes |
|--------|--------|-------|
| Frontend | ✅ | Domain UI; PR→Return dual-mode via `purchaseApiFacade` (QI/Invoice/Return parity + GRNI report + approver limits 2026-07-27). |
| Backend | ✅ | PR + Planning + RFQ/VQ + PO + GRN + QI + Invoice + Return + Approvals + Setup; QI fail-closed inventory; matrix role + per-user ₹ limits; GRNI report. |
| DB | ✅ | Purchase schema + GRN/QI/Invoice/Return migrations |
| API | ✅ | `/purchase/invoices`, `/quality-inspections`, `/returns` with lifecycle actions incl. QI hold + return approve |
| Tests | ✅ | Lifecycle suites + matrix role unit; QI/return stock movement asserts with seeded `itemId` |
| Demo mode | ✅ | Full RFQ→VQ→comparison→award→PO + Planning→PO paths; Setup via `purchaseService` |
| API mode | ✅ | Facade wired for QI/Invoice/Return; stub actions hidden |
| Remaining gap | ITC / vendor-outstanding placeholders; formal GR/IR clearing GL (qty GRNI report shipped) |

### Quality (manufacturing QC + Purchase incoming QI)

| Aspect | Status | Notes |
|--------|--------|-------|
| Frontend | ✅ | Dual-mode: Api* QC queue/detail/NCR/plans/parameters/reports; Incoming queue live from Purchase; Purchase QI detail checklist |
| Backend | ✅ | Phases 4A/4B/7B quality engine + Purchase QI lifecycle + parameter checklist API |
| DB | ✅ | `quality_*` / `mfg_quality_inspections` + `purchase_quality_inspections` (+ parameters migration `20260730110000`) |
| API | ✅ | `/quality/*` + `/purchase/quality-inspections` (Zod, permissions, tenantId) |
| Tests | ✅ | **Live 2026-07-30: 4 files / 23 tests PASS, 0 failed, 0 skipped** — `quality-phase4a` 5/5, `quality-phase4b` 5/5, `quality-phase7b` 7/7, `purchase-qi-lifecycle` 6/6 (after QI params migration deploy) |
| Demo mode | ✅ | qualityStore + Purchase demo QI parameters |
| API mode | ✅ | qualityRoutes + purchaseApiFacade |
| Remaining gap | **READY** — QI params migration deployed and live suites green (live-DB evidence condition closed). Broad QMS (CAPA/calibration/SPC/supplier scorecards) **deferred by design** — see `docs/quality/QUALITY_SCOPE_AND_DEFERRALS.md` |

### HRMS (Indian payroll-safe workforce)

| Aspect | Status | Notes |
|--------|--------|-------|
| Frontend | ⚠️ | Leave/OT/payroll/payslips/payments/loans + Phase 11 `/hrms/exits*`, `/hrms/fnf*` |
| Backend | ⚠️ | Payroll + salary + statutory + OT + leave + attendance + Phase 10 `/hrms/loans/*` + Phase 11 `/hrms/exits/*`, `/hrms/fnf/*` |
| DB | ⚠️ | Migrations through `20260731060000_hrms_phase11_exit_fnf` |
| API | ⚠️ | `/api/v1/t/:tenantSlug/hrms/*` + module flag `hrms` |
| Tests | ⚠️ | Phase 11 unit **7/7 PASS** local (2026-07-31, `computeNotice`); Phase 11 live **11 skipped** (no DB reachable this session — see `HRMS_PHASE11_TEST_RESULTS.md`); Phase 10 unit 5/5 PASS prior session; stage migrate + sync-permissions pending confirm |
| Demo mode | ❌ | API-required banner |
| API mode | ⚠️ | Dual-mode gate |
| Remaining gap | **READY WITH CONDITIONS** — migrate `20260731060000_hrms_phase11_exit_fnf` + `db:sync-permissions` + live vitest PASS + UAT. **Stop before recruitment / ATS / performance management / LMS / employee portal filing.** Docs: `docs/hrms/HRMS_PHASE11_*` |

### Inventory / Production / Maintenance / Finance (invoices)

| Aspect | Status | Notes |
|--------|--------|-------|
| Frontend | ✅ | Rich demo UIs; Finance nav → `/invoices`. **2026-07-17:** Manufacturing Phases 1–6 demo FE + **Route Master / WO Operations** (`/manufacturing/routes`, Operations tab on WO, Shopfloor current/next op) — see `MANUFACTURING_SIMPLE.md`. Legacy `/production` hubs redirect |
| Backend | 🔒 | Deferred by design |
| DB | 🔒 | — |
| API | 🔒 | — |
| Tests | ⚠️ | Demo scripts where present; route integrity baseline includes `/manufacturing/*` |
| Demo mode | ✅ | Full simple manufacturing shell |
| API mode | ❌ | |
| Remaining gap | Manufacturing backend when prioritized |

### Accounting (Money In / Money Out + period lock / year-end P&L close live; accruals/AIS open)

| Aspect | Status | Notes |
|--------|--------|-------|
| Frontend | ⚠️ | Money In/Out live in API mode. **CRM payment receipts can hand off to Money In drafts** (not auto-post); commercial allocation blocked after TI convert. Period Close lock/readiness + **year-end wizard posts P&L→RE**. Accruals/prepaid/FX/calendar still demo. Journals + Approvals + Bank & Cash UAT. |
| Backend | ⚠️ | Phase 1–5D + AR/AP reverse + journal reverse + **year-end close** + FY lock hardened |
| DB | ⚠️ | + `YearEndCloseRun` (`year_end_close_runs`); AR/AP open items + allocation tables as before |
| API | ⚠️ | + `GET/POST …/financial-years/:id/year-end-preview\|year-end-close`; FY close requires year-end run + all periods CLOSED |
| Tests | ⚠️ | `finance-year-end-close` + period-close hardening + AR/AP finance suites — see `TESTING_STATUS.md` |
| Demo mode | ✅ | Settings/journals/approvals; year-end preview seed-only in demo |
| API mode | ⚠️ | Full Money In/Out + year-end P&L close; Dispatch invoice-ready → SI |
| Remaining gap | Accruals/prepaid/FX reval wizards; Dispatch invoice policy UI polish; live TPP AIS/FX/intercompany (SIMULATED AIS separate) |

**Module verdict:** **READY WITH CONDITIONS** — AR/AP Money In/Out + period lock + year-end P&L→RE live with test evidence. Conditions: human SPA year-end walk; Hostinger migrate deploy; do not treat accruals/FX/AIS screens as live.

### Mobile CRM

| Aspect | Status | Notes |
|--------|--------|-------|
| Frontend | ✅ | `MobileCrmPages`, pipeline nav, follow-ups |
| Backend | ⚠️ | Same CRM APIs via store sync |
| DB | ✅ | Shared CRM tables |
| API | ⚠️ | No mobile-specific endpoints |
| Tests | ✅ | Demo pipeline / integration |
| Demo mode | ✅ | |
| API mode | ⚠️ | Hydrate via `useCrmApiSync`; no offline queue |
| Remaining gap | API-mode mobile E2E |

---

## Build health (2026-07-15)

| Check | Result |
|-------|--------|
| Backend `npm run typecheck` | ✅ Pass (convert / SO sessions) |
| Frontend typecheck (changed CRM files) | ✅ Pass for convert/editor paths; repo may have unrelated pre-existing TS noise |
| Frontend typecheck (admin UI session) | ⚠️ **Not run** — shell tool returned no exit status all attempts (same instability as the interrupted prior session); all new/changed files manually cross-checked against shared component prop types instead. Run `npm run typecheck` before trusting this line. |
| Backend `npm run test:crm-live` | ✅ **50/50** (e2e 43 + tenant isolation 7) — convert + Phase 1 SO |
| Backend `npm test` (no live) | ✅ See `TESTING_STATUS.md` (39 passed / 49 skipped on 2026-07-14 forecast run) |
| Frontend `npm run test:crm-integration` | ✅ 18 passed (demo) |
| Opportunity UAT-03 | ✅ 86/86 |

Authoritative run log: [`docs/TESTING_STATUS.md`](TESTING_STATUS.md).
