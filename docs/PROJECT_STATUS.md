# Project Status

Last verified against codebase: **2026-07-21** (Purchase Setup full persistence + Invoice/QI/Return; Accounting Phase 3C5 credit-note allocation backend verified 2026-07-18 — focused tests 11/11 and backend typecheck pass).
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
| **Completed (API mode)** | … **AR reporting Phase 3A5**; **Money In AR frontend Phase 3A6**; **AR receipt DB foundation Phase 3B1**; **AR receipt calculation/validation Phase 3B2**; **AR receipt draft workflow Phase 3B3**; **AR atomic receipt posting Phase 3B4**; **AR atomic receipt allocation Phase 3B5** (preview + allocate + history + customer-credits; no GL; no frontend); **customer credit notes Phase 3C1–3C4** (draft, minimal approval, atomic GL/open-item posting); **AR atomic credit-note allocation Phase 3C5** (preview + allocate + history, unified with receipt allocation history/customer-credits; no GL; no frontend) |
| **Partially completed** | Auth UI; mobile CRM (API hydrate, no offline); sales-order fulfilment beyond confirm/close; **user/role/tenant admin UI (frontend wired 2026-07-15, not test-verified)** |
| **Not started** | Login activity module |
| **Scaffolding (not shipped)** | — (Accounting operational screens: CoA demo, Vouchers, AR/AP, Bank, FA, Manufacturing Accounting, Tax, Reports, Budgeting, Commercial Commitments, Period Close — UI/mock only; **Finance Settings** at `/accounting/settings` is Phase 1 dual-mode, not a stub) |
| **Blocked** | — (none currently) |
| **Deferred by design** | Purchase backends beyond RFQ award→draft PO (full PO lifecycle, GRN); inventory / production / quality / maintenance; finance **Phase 3B6 receipt UI + Phase 3C6 credit-note UI + receipt/allocation/credit-note reversal**; SO MRP / dispatch |

---

## Open risks / ops

| Risk | Status |
|------|--------|
| Production deployment parity | **hPanel redeploy pending (2026-07-21)** — API health is JSON/connected, but live SPA still serves a July 17 Vite hash. Root Hostinger build/start/verification architecture is now fixed in code; configure hPanel per `HOSTINGER_GIT_DEPLOYMENT.md` and verify `/build-meta.json` before closing. |
| Local API-mode empty data | Backend must listen on `:5000`; not a demo/API mix bug |
| DB cleanup scripts | `cleanup-leads.ts`, `cleanup-opp-quotations.ts`, `cleanup-sales-orders.ts` — local one-offs; do not run on prod without intent |
| Accounting orphan UI | **Resolved 2026-07-15** — all `/accounting/*` deep links from the dashboard now resolve (dashboard live; other screens are placeholders, not 404s) |

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
| Frontend | ❌ | No login activity page |
| Backend | ⚠️ | `lastLoginAt` updated on login only |
| DB | ⚠️ | Field on `users`; no `login_events` table |
| API | ❌ | No list/export endpoint |
| Tests | ❌ | — |
| Demo mode | 🔒 | N/A |
| API mode | ⚠️ | Timestamp only |
| Remaining gap | Full audit trail module if required |

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
| Frontend | ⚠️ | Domain UI rich; PR/Planning/RFQ/PO/GRN/Approvals/Setup dual-mode API-backed; **Purchase Setup** full nested API persistence (all editable tabs). Notifications ON_HOLD read-only. Registered editors use **Cancel \| Save**. Invoice/returns/QI UI still partially demo-oriented for some screens. **FE typecheck PASS** (2026-07-21). |
| Backend | ⚠️ | PR + Planning + RFQ/VQ/comparison + PO + GRN + **Quality Inspection + Purchase Invoice + Purchase Return** lifecycles + Approvals + **Purchase Setup full persistence** with workflow enforcement. |
| DB | ⚠️ | Purchase schema + PO + inventory masters + GRN + Setup migrations (deploy on all envs) |
| API | ⚠️ | Existing routes plus `/purchase/invoices`, `/purchase/quality-inspections`, and `/purchase/returns` with explicit lifecycle actions. |
| Tests | ⚠️ | Invoice policy/lifecycle unit coverage **4/4**; backend typecheck pass. Existing setup, PO, GRN, approvals, Phase 15, and inventory-master suites remain. |
| Demo mode | ✅ | Full RFQ→VQ→comparison→award→PO + Planning→PO paths; Setup via `purchaseService` |
| API mode | ⚠️ | Backend APIs now cover PR through PO/GRN/QI/invoice/return; frontend hydration remains to be wired for QI/invoice/return. |
| Remaining gap | Inventory posting on GRN; QI/invoice/return frontend wiring; Setup deferred tabs; dashboard KPIs; reports |

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

### Accounting (finance setup Phase 1 live; operational screens mostly demo FE)

| Aspect | Status | Notes |
|--------|--------|-------|
| Frontend | ⚠️ | **2026-07-17:** Finance Settings Phase 1 + **Journals + Approvals** workspaces (`/accounting/entries/journals`, `/accounting/entries/approvals`, dual-mode). Post + GL drill-down on journal detail. Other operational workspaces still UI/mock |
| Backend | ⚠️ | Phase 1 setup + 2A ledger + 2B posting engine + **2C1 journals** + **2C2A approval** + **2C2B posting** + **3A1–3A5 AR sales invoice** + **3B1–3B5 customer receipt/allocation** + **3C1–3C4 customer credit notes** (draft, minimal approval, atomic GL/open-item posting) + **3C5 credit-note allocation** (subledger-only, unified with receipt allocation read APIs) |
| DB | ⚠️ | Setup + ledger + approval tables + manual journals on `AccountingVoucher`; GL via existing-voucher post path; `ReceivableOpenItem` DEBIT (invoice) / CREDIT (receipt/credit-note) rows on post; `CustomerCreditNoteAllocationBatch` / `CustomerCreditNoteAllocation` subledger tables (no GL) |
| API | ⚠️ | Setup + `/accounting/journals` (+ `post`, `ledger`) + `/accounting/approvals` + approve/send-back/reject; read-only voucher/GL/posting-event GET; `/accounting/receivables/invoices/:id/post`; `/accounting/receivables/receipts/:id/post`; `/accounting/receivables/credit-notes/:id/allocations` (+ `/preview`) |
| Tests | ⚠️ | finance-setup 8 + ledger 11 + posting-engine 13 + journals 11 + approvals 9 + journal-posting 8 + ar-foundation 18 + receipt-drafts 12 + receipt-posting 12 + receipt-allocation 11 + credit-note-foundation 3 + credit-note-posting 5 + **credit-note-allocation (new) 11/11** — see `TESTING_STATUS.md` for latest run counts |
| Demo mode | ✅ | Settings + journals + approvals + demo journal posting |
| API mode | ⚠️ | Journals workflow + multi-level approval + post approved journal to GL (same voucher id); AR invoice/receipt/credit-note atomic posting to GL; receipt + credit-note subledger allocation to invoice open items |
| Remaining gap | Phase **2C3** journal reversal; **3B6** receipt UI; **3C6** credit-note UI; receipt/allocation/credit-note reversal |

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
