# Project Status

Last verified against codebase: **2026-07-27** (Money In/Out reverse + AP reversal history + Dispatch→SI POD gate; Fuel Tank / Inventory Costing / prior notes).
**Canonical master routes:** see [`docs/MASTER_REGISTRY.md`](MASTER_REGISTRY.md). **CRM workflow diagrams:** [`docs/CRM_WORKFLOW.md`](CRM_WORKFLOW.md).
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
| **Completed (API mode)** | … **AR 3A–3C** (invoice/receipt/CN + allocation) + **3B6/3C6 Money In UI** + receipt/CN/allocation/journal reverse + corrections hub; **AP Money Out UI** + corrections + AP reversal history; Dispatch→SI invoice-ready + POD gate on manual create |
| **Not started** | — |
| **Partially completed** | Auth UI; mobile CRM (API hydrate, no offline); sales-order fulfilment beyond confirm/close; **user/role/tenant admin UI** (API wired; product UAT open); **Admin A8** broader demo-mix pack beyond security regression |
| **Scaffolding (not shipped)** | — (Accounting: some CoA/voucher demo surfaces; Period Close **P1 + hardening** live for lock/readiness — year-end/accruals still demo; **Finance Settings** at `/accounting/settings` is Phase 1 dual-mode) |
| **Blocked** | — (none currently) |
| **Deferred by design** | Purchase backends beyond RFQ award→draft PO (full PO lifecycle, GRN); inventory / production / quality / maintenance beyond shipped slices; finance **Dispatch partial/multi/consolidated invoice policy UI polish**; SO MRP / dispatch client production hardening |

---

## Open risks / ops

| Risk | Status |
|------|--------|
| Production deployment parity | **hPanel redeploy pending (2026-07-21)** — API health is JSON/connected, but live SPA still serves a July 17 Vite hash. Root Hostinger build/start/verification architecture is now fixed in code; configure hPanel per `HOSTINGER_GIT_DEPLOYMENT.md` and verify `/build-meta.json` before closing. |
| Local API-mode empty data | Backend must listen on `:5000`; not a demo/API mix bug |
| DB cleanup scripts | `cleanup-leads.ts`, `cleanup-opp-quotations.ts`, `cleanup-sales-orders.ts` — local one-offs; do not run on prod without intent |
| Accounting orphan UI | **Resolved 2026-07-15** — all `/accounting/*` deep links from the dashboard now resolve (dashboard live; other screens are placeholders, not 404s) |
| Inventory costing rollout | **Phase C BE + Phase 1 FE UI shipped (2026-07-27)** — costing workspace under Inventory → Costing; variance GL / full inventory↔GL trial balance still deferred. |

---

## Module status table

### Auth

| Aspect | Status | Notes |
|--------|--------|-------|
| Frontend | ⚠️ | Login page + `AuthProvider` + `ApiAuthGate` (API mode only) |
| Backend | ✅ | login, refresh, logout, forgot/reset/change password, me |
| DB | ✅ | users, refresh_tokens, password_reset_tokens |
| API | ✅ | `/api/v1/auth/*` |
| Tests | ⚠️ | Invalid login test (skip without DB); no dedicated auth suite |
| Demo mode | 🔒 | No login required |
| API mode | ✅ | JWT session + auto refresh |
| Remaining gap | Admin self-service UI; password policy tests |

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
| Frontend | ⚠️ | **2026-07-15:** `modules/systemAdmin/TenantAdminPages.tsx` — list/create (incl. first admin user)/edit/detail + suspend/activate/archive at `/admin/tenants`, gated by `isSuperAdminUser()`; not yet manually tested (shell unavailable) |
| Backend | ✅ | CRUD for Super Admin |
| DB | ✅ | tenants |
| API | ✅ | `/api/v1/tenants` |
| Tests | ⚠️ | Isolation tests create temp tenants; no FE test for new admin pages |
| Demo mode | ✅ | `data/admin/seed.ts` seed tenants |
| API mode | ⚠️ | Hydrates via `syncAdminTenantsFromApi()`; needs live smoke test |
| Remaining gap | Manual/live test pass; typecheck not run this session |

### Users (system)

| Aspect | Status | Notes |
|--------|--------|-------|
| Frontend | ⚠️ | **2026-07-15:** `modules/systemAdmin/UserAdminPages.tsx` — list/invite/edit/detail + role assign/remove at `/admin/users` (pre-existing from an earlier interrupted session; wired into routes/nav this session); not yet manually tested |
| Backend | ✅ | CRUD + role assign under `/t/:slug/users` |
| DB | ✅ | users, user_roles |
| API | ✅ | Permission-gated |
| Tests | ⚠️ | Used in E2E login; no FE test for admin pages |
| Demo mode | ✅ | `data/admin/seed.ts` seed users |
| API mode | ⚠️ | Hydrates via `syncAdminUsersFromApi()`; needs live smoke test |
| Remaining gap | Manual/live test pass; typecheck not run this session |

### Roles

| Aspect | Status | Notes |
|--------|--------|-------|
| Frontend | ⚠️ | **2026-07-15:** `modules/systemAdmin/RoleAdminPages.tsx` — list/create/edit/detail at `/admin/roles` with grouped permission-matrix editor; system roles read-only; not yet manually tested |
| Backend | ✅ | `/t/:slug/roles` |
| DB | ✅ | roles, role_permissions |
| API | ✅ | |
| Tests | ⚠️ | Seed roles in E2E; no FE test for admin pages |
| Demo mode | ✅ | `data/admin/seed.ts` seed roles + permission catalog |
| API mode | ⚠️ | Hydrates via `syncAdminRolesFromApi()`; needs live smoke test |
| Remaining gap | Manual/live test pass; typecheck not run this session |

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
| Remaining gap | ITC / vendor-outstanding placeholders; formal GR/IR clearing GL (qty GRNI report shipped); QI parameter checklist persistence |

### Inventory / Production / Quality / Maintenance / Finance (invoices)

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

### Accounting (Money In / Money Out API-mode flows live; some period-close / AIS still open)

| Aspect | Status | Notes |
|--------|--------|-------|
| Frontend | ⚠️ | **2026-07-27:** Money In (invoices, invoice-ready, receipts, credit notes, allocate, corrections/reversals) + Money Out (vendor invoices/payments/adjustments, allocate, corrections, reversal history) live in API mode. Journals + Approvals + Bank & Cash UAT. |
| Backend | ⚠️ | Phase 1–5D + AR 3A–3C + AP 4A–4D + journal reverse + receipt/CN/allocation reverse + AP reversal history list + Dispatch→SI source links + POD gate on manual SI |
| DB | ⚠️ | Setup + ledger + approval tables + manual journals on `AccountingVoucher`; GL via existing-voucher post path; `ReceivableOpenItem` DEBIT (invoice) / CREDIT (receipt/credit-note) rows on post; `CustomerCreditNoteAllocationBatch` / `CustomerCreditNoteAllocation` subledger tables (no GL) |
| API | ⚠️ | Setup + journals (+ reverse) + AR invoice/receipt/credit-note post/allocate/reverse + AP vendor docs/payments/adjustments/allocations/reversals + `GET /accounting/payables/reversals` |
| Tests | ⚠️ | finance suites + money-in/money-out FE scripts — see `TESTING_STATUS.md` |
| Demo mode | ✅ | Settings + journals + approvals + demo journal posting; Money In/Out prefer API mode for full reverse flows |
| API mode | ⚠️ | Full Money In/Out user flows + journal reverse + Dispatch invoice-ready → SI (POD when policy on) |
| Remaining gap | Dispatch partial/multi/consolidated invoice **policy UI** polish; period close year-end; AIS/FX/intercompany |

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
