# Receivables Frontend ↔ API Contract (Wave 0)

> **Status:** Wave 5 complete + SO/invoice source interconnect — 2026-07-22  
> **Rule:** When this doc and code disagree, **code wins**. Update this doc after each wave.  
> **Product decision:** Existing legacy Receivables UI is the functional contract. Do not redesign screens. Wire live APIs underneath; keep Money In as a compatibility alias to the same product.

---

## Wave 5 changelog (2026-07-22) — AR disputes persistence + APIs + UI

**Shipped (8B-R-011 Wave 5):**

- **Prisma `ArDispute`** (`ar_disputes`) with status/type/priority enums, soft delete, FKs to
  `SalesInvoice` + optional `ReceivableOpenItem`. Migration `20260722030000_ar_disputes`.
- **REST** under `/accounting/receivables/disputes`: `GET /`, `GET /:id`, `POST /`, `PUT /:id`,
  `POST /:id/transition`, `DELETE /:id` with permissions `finance.ar.dispute.view|create|edit`.
- **Open-item side effect (no GL):** create / non-terminal status → open item `DISPUTED`; last
  terminal resolve/reject/close/delete restores `OPEN` / `PARTIALLY_SETTLED` / `SETTLED` from amounts.
- **FE:** route no longer `arPendingRoute`; `receivablesLiveService` maps DTOs ↔ legacy
  `CustomerDispute`; `getCustomerDisputes` / `createDispute` / `updateDispute` dual-mode;
  API permissions grant `manage_dispute` from `finance.ar.dispute.*`; `DisputesPage` raises/edits via
  `DisputeDrawer` (customer picker when creating from register); customer 360 loads live disputes.

**Non-goals:** no GL/voucher, no auto credit-note, no attachments service, no collection/hold engine (W6).

**Wave 5 gate:** migration applied · Prisma client generated · dispute module typechecks.

**Interconnect (same day):** dispute DTO `sourceContext` derives CRM sales orders / dispatches from
`SalesInvoice` header + ACTIVE `SalesInvoiceSourceLink`s; list accepts `salesOrderId`; FE register
links to `/crm/sales-orders/:id`. CRM commercial-position money includes `activeDisputeCount` /
`disputedAmount`. AP mirrors with `ApDispute` + VendorInvoice `sourceLinks` (PO/GRN) under
`/accounting/payables/disputes`.

---

## Wave 4 changelog (2026-07-22) — ageing engine + reports/export

**Shipped (8B-R-011 Wave 4):**

- **Live ageing honors filters.** `getLiveReceivableAgeing` now passes `reportDate` / `customerId` /
  backend `ageingBasis` (`due_date` | `invoice_age`) to `GET …/outstanding` and cross-checks
  `GET …/ageing` for limitations. UI bases map as: Due Date → `due_date`; Posting Date → `invoice_age`
  (BE ages from posting date); Invoice Date → client-side age on `invoiceDate` with
  `INVOICE_DATE_AGED_CLIENT_SIDE` note.
- **Legacy 91–180 / 180+ matrix preserved.** Buckets are recomputed from the selected basis date so
  the approved FE columns stay intact (BE uses 91–120 / Above 120).
- **As-of honesty.** Past `asOfDate` surfaces `AGEING_USES_CURRENT_BALANCES` (balances are current;
  only day counts use the as-of date) — shown as a reporting banner on `ReceivablesAgeingPage`.
- **Export `scope: 'ageing'`** implemented client-side (customer matrix + invoice-wise sheet from the
  same live/demo ageing result). Excel/PDF still download as CSV/text (no server PDF exporter).
- **Demo ageing consistency.** Demo summary + invoice-wise rows now respect the selected basis
  (previously only the customer matrix did).

**Deferred (explicit):** true historical AR balances as-of date; server PDF export; BE bucket schema
change to 91–180/181+.

**Wave 4 gate:** `tsc -b` PASS · `test:money-in` 93/93.

---

## Wave 3 changelog (2026-07-22) — receipts allocation register + live allocation flow

**Shipped (8B-R-011 Wave 3):**

- **Allocations register live.** `/accounting/receivables/allocations` (`AllocationsPage`) no longer
  redirects in API mode — it renders in both modes off the dual-mode `getCustomerReceipts`. Honors
  `?customerId=` deep links from the invoice register / outstanding pages (with a clear-filter affordance).
  "Allocate" on a posted receipt in API mode routes to the live allocation workbench
  (`receipts/:id/allocate`, batch API); drafts go to the edit form; demo behavior unchanged.
- **Live allocation adapters** (`receivablesLiveService.ts`):
  `getLiveOpenInvoicesForAllocation` (customer open items → allocatable legacy invoices),
  `allocateLiveReceipt` (legacy invoice-id lines → open-item-id allocation batch via
  `POST /receipts/:id/allocations` with idempotency key), and `getLiveReceiptAllocationLines`
  (posted allocation history → legacy `ReceiptAllocationLine[]`). `getCustomerReceiptById` now attaches
  live allocation history to posted receipts, so legacy allocation grids/posting preview show real settlements.
- **Mode-aware service:** `getOpenInvoicesForAllocation` and `allocateReceiptDemo` delegate to the live
  adapters in API mode. Auto-allocation preview (`getReceiptAllocationPreviewByMethod`) works in both modes
  since it composes on top of `getOpenInvoicesForAllocation`.
- **Known W3 scope notes:** a tenant-wide allocation *history* register has no backend endpoint
  (only per-receipt/per-invoice history) — the register lists pending/unallocated receipts, matching the
  approved legacy design. `GET /customer-credits` exists on the backend but is not yet wired to a screen.

**Wave 3 gate:** `tsc -b` PASS · `test:money-in` 93/93.

---

## Wave 2 changelog (2026-07-22) — approved legacy screens render live data

**Shipped (8B-R-011 Wave 2 core):**

- **Legacy screens are the product UI in both modes.** `accountingRoutes.tsx`: dashboard
  (`/accounting/receivables`), outstanding, customers register + customer 360, invoice register,
  ageing, receipts register, and credit-notes register now render the **approved legacy pages
  unconditionally**. Document forms/detail/allocate keep the dual-mode Money In pages
  (`invoices/new|:id|:id/edit`, `receipts/new|:id|:id/edit|:id/allocate`, credit-note documents,
  reconciliation).
- **Live adapter layer.** New `frontend/src/services/accounting/receivablesLiveService.ts` maps live
  AR DTOs (`moneyIn.ts`) onto the legacy view models (`types/receivables.ts`): open items → receivable
  invoices (due-date ageing buckets, derived Open/Partially Paid/Due Soon/Overdue/Disputed/Paid/Cancelled),
  sales invoices (register incl. Paid/Cancelled tabs), receipts (payment mode/status maps, derived
  allocation status), credit notes (purpose/status maps incl. Applied/Partially Applied), customer
  summaries → outstanding rows, dashboard KPIs/panels, ageing matrix, customer AR 360 card, and a
  client-side customer statement built from posted invoices/receipts/CNs. Paginates through the
  backend's 100-row cap (`drainPaged`/`drainList`).
- **Mode-aware service entry points.** `receivablesService.ts` read functions
  (`getReceivablesDashboard`, `getCustomerOutstanding`, `getReceivableInvoices`, `getReceivableAgeing`,
  `getCustomerReceipts`, `getCreditNotes`, `getCustomerReceivableCard`, `getReceivableCustomerById`,
  `getCustomerReceiptById`, `getReceivableLookups`, `getCustomerStatementPreview`) delegate to the live
  service when `VITE_USE_API=true`; receipt lifecycle (`postReceiptDemo`, `reverseReceiptDemo`,
  `getReceiptPostingPreview`, submit via `updateCustomerReceipt`) routes to the live bridge
  (post / reverse / validate / mark-ready). Demo mode is untouched.
- **No seed leakage in API mode.** Commercial-commitments seed panels on the dashboard and outstanding
  pages are skipped in API mode; exports build from the (now live) service reads.
- **Known W2 gaps (deliberate, neutral placeholders):** credit limit/hold/utilisation, collection
  owner/activities/promises, dispute documents (flags only), reminders/audit trail, salesperson/territory/
  customer-group dimensions, receipt "Pending Approval" (live `READY_TO_POST` ⇒ Approved), draft invoices
  excluded from the receivable register (managed via document forms/detail until the work-queue view ships).

**Wave 2 gate:** `tsc -b` PASS · `test:money-in` 93/93 · `test:accounting-master-reuse` 39/39.

---

## Wave 1 changelog (2026-07-22) — routing flip + gateway + JWT permissions

**Shipped (8B-R-011):**

- **Receivables is canonical in API mode.** `frontend/src/routes/accountingRoutes.tsx`: `legacyArRoute`
  (which redirected `/accounting/receivables/*` → `/accounting/money-in`) replaced by `arRoute(apiEl, demoEl)`
  — API mode renders the **live Money In components** under `/accounting/receivables/*` (no seed data,
  no demo fallback); demo mode keeps the legacy seed pages.
- **Money In → Receivables aliases.** `moneyInRoute()` + `<MoneyInAliasRedirect>` prefix-swap every
  `/accounting/money-in/*` URL to `/accounting/receivables/*` in API mode (params/query preserved);
  demo mode still renders Money In pages so demo flows are unaffected.
- **Missing routes added** under Receivables: `invoices/new`, `invoices/:id`, `invoices/:id/edit`,
  `receipts/:id/allocate`, `credit-notes/new|:id|:id/edit|:id/allocate`, `reconciliation`,
  and `customers/:customerId` (360). Singular legacy URLs (`invoice/:invoiceId`, `customer/:customerId`)
  redirect to the canonical plural paths. Not-yet-live screens (collections/reminders → W6,
  reconciliation → W7) use `arPendingRoute()` (demo page in demo mode; redirect to overview in API mode).
  Allocations (W3) and disputes (W5) are live under `/accounting/receivables/*`.
- **Strict data-access boundary.** New `frontend/src/services/accounting/receivablesGateway.ts`:
  `ReceivablesGateway` interface + `ApiReceivablesGateway` (live `/accounting/receivables/*`, mapped errors,
  no fallback) + `DemoReceivablesGateway` (seed store) + `getReceivablesGateway()` factory that never
  constructs the demo gateway in API mode. Wraps the register/overview read surface for Wave 2 to consume;
  document CRUD still flows through `receivablesApiBridge`.
- **JWT permissions.** `frontend/src/utils/permissions/receivables.ts`: `useReceivablesPermissions` /
  `hasReceivablesPermission` now resolve the legacy `accounting.receivables.*` capability surface from
  authoritative JWT `finance.ar.*` grants in API mode (workspace admin ⇒ all); demo role packs only in
  demo mode; never falls back to demo packs when `VITE_USE_API=true`. Capabilities without a live backend
  yet (dispute/collection/promise/reminder/credit-hold) resolve false until their wave ships.

**Wave 1 gate:**

| Check | Result |
|-------|--------|
| `frontend` typecheck (`tsc -b`) | PASS |
| `frontend` `test:money-in` | 93/93 PASS (legacy demo AR routes preserved) |
| `frontend` `test:accounting-master-reuse` | 39/39 PASS |
| `frontend` `test:route-integrity` | Pre-existing RED — baseline (855, 2026-07-21) predates the uncommitted mfg/dispatch/gate/companies merge pile (55 unrelated extras). AR deltas (3 renames + 13 adds) are intentional; full baseline **not** regenerated to avoid blessing the merge pile (Wave 1 non-goal). |
| Live API-mode smoke (Receivables register ← MySQL) | Pending — needs backend + MySQL running |

---

## 1. Ownership verdict

| Concern | Canonical ownership | Do not do |
|---------|---------------------|-----------|
| Customer master | `CrmCompany` soft link | Create `FinanceCustomer` |
| Sales invoices | Existing `SalesInvoice` + Money In / BE services | Second invoice model |
| Receipts / allocations | Existing `CustomerReceipt` + allocation batches | Second allocation engine |
| Credit notes | Existing `CustomerCreditNote` | Duplicate CN stack |
| Open items / posting / GL | `ReceivableOpenItem` + central posting engine | Second posting path |
| Live API namespace | `/api/v1/t/:tenantSlug/accounting/receivables/*` | Demo-only namespace |
| Live FE today | `/accounting/money-in/*` via `receivablesApiBridge` | Keep two AR products |
| Target FE (Wave 1+) | `/accounting/receivables/*` preserves legacy chrome | Blank-slate redesign |
| Demo FE permissions | `accounting.receivables.*` (demo packs only) | Treat as JWT permissions |
| Live FE/BE permissions | `finance.ar.*` | Invent parallel `finance.receivables.*` without mapping |

**Greenfield needed (true gaps):** reminder templates/send, collection cases/activities, promises to pay, planned receipt allocations, overview KPIs matching legacy richness, credit-hold, customer statement export, browser E2E.

---

## 2. Baseline verification (2026-07-22)

| Check | Result |
|-------|--------|
| `backend` Prisma validate | PASS |
| `backend` `finance-ar-reporting.test.ts` | **10/10 PASS** (live MySQL) |
| `frontend` typecheck | PASS |
| `frontend` `test:money-in` | **93/93 PASS** |
| `backend` full typecheck | FAIL — ~298 pre-existing errors in quality/purchase/ops-reports/manufacturing/dispatch (stale Prisma client / merge drift). **Zero accounting/receivables errors.** |
| Working tree | Dirty `main` with large uncommitted mfg/dispatch/purchase migration pile + AR/master-reuse edits |
| Migration risk | Multiple timestamp collisions (`20260720160000`, `20260720250000`, `20260720280000`, `20260721010000`, …). **No new AR migration / deploy until uniqueness verified.** |

Safe AR regression commands (non-destructive):

```text
cd backend && npx tsx scripts/prisma-cli.ts validate
cd backend && npx tsx scripts/prisma-cli.ts migrate status
cd backend && npx vitest run tests/finance/finance-ar-*.test.ts --no-file-parallelism --hookTimeout=120000
cd backend && npm run verify:finance-integrity
cd frontend && npm run typecheck
cd frontend && npm run test:money-in
cd frontend && npm run test:accounting-master-reuse
```

---

## 3. Route contract

### 3.1 Mounted today (`frontend/src/routes/accountingRoutes.tsx`)

**Money In (live dual-mode):**

```text
/accounting/money-in
/accounting/money-in/invoices[/new|/:id|/edit]
/accounting/money-in/receipts[/new|/:id|/edit|/:id/allocate]
/accounting/money-in/credit-notes[/new|/:id|/edit|/:id/allocate]
/accounting/money-in/outstanding
/accounting/money-in/customers[/:customerId]
/accounting/money-in/ageing
/accounting/money-in/reconciliation
```

**Legacy Receivables (demo only; API mode → `/accounting/money-in`):**

```text
/accounting/receivables
/accounting/receivables/outstanding          (= customers list)
/accounting/receivables/customers
/accounting/receivables/invoices
/accounting/receivables/invoice/:invoiceId    (singular)
/accounting/receivables/ageing
/accounting/receivables/collections
/accounting/receivables/receipts[/new|/:receiptId|/edit]
/accounting/receivables/allocations
/accounting/receivables/credit-notes          (list only)
/accounting/receivables/disputes
/accounting/receivables/reminders
/accounting/receivables/customer/:customerId  (360)
```

API gate today:

```ts
const legacyArRoute = (element) =>
  isApiMode() ? <Navigate to="/accounting/money-in" replace /> : element
```

### 3.2 Requested family vs code

| Requested | Code | Action |
|-----------|------|--------|
| `/receivables/invoices/new` | Missing (Money In has it) | Add under Receivables in Wave 1 |
| `/receivables/invoices/:id` | Uses `invoice/:invoiceId` | Keep singular **or** add alias; do not break bookmarks without redirect |
| `/receivables/receipts/:id/allocate` | Missing under Receivables | Add; reuse Money In allocate page |
| `/receivables/reconciliation` | Missing under Receivables | Add; reuse Money In page |
| `/receivables/customers` vs outstanding | Both map to customer outstanding list | Preserve both; clarify open-item vs customer rollup views |
| Money In → Receivables redirects | Opposite today | Wave 1 flips direction |

### 3.3 Wave 1 target routing

| Money In path | Redirect / alias to |
|---------------|---------------------|
| `/accounting/money-in` | `/accounting/receivables` |
| `…/invoices*` | `…/receivables/invoices*` |
| `…/receipts*` | `…/receivables/receipts*` |
| `…/credit-notes*` | `…/receivables/credit-notes*` |
| `…/outstanding` | `…/receivables/outstanding` |
| `…/customers*` | `…/receivables/customers*` (+ 360 under `customer/:id`) |
| `…/ageing` | `…/receivables/ageing` |
| `…/reconciliation` | `…/receivables/reconciliation` |

Both families must resolve to the **same components, APIs, and records**.

---

## 4. Screen → API map

### Legend

- **Reuse:** BE endpoint exists; wire FE / adapt DTO shape  
- **Extend:** BE exists but missing fields/filters vs UI  
- **Add:** No BE model/API  

### 4.1 Overview — `/accounting/receivables`

| UI | Current source | Backend | Wave |
|----|----------------|---------|------|
| Page | `ReceivablesDashboardPage.tsx` | — | 1–2 |
| KPIs (Total/Current/Overdue/Due week/Receipts/Unallocated/Over credit/Avg days) | `receivablesService.getReceivablesDashboard` (demo) | `GET /receivables/overview` — **Extend** to match legacy KPI set | 2 |
| Panels (ageing, top customers, due soon, overdue, recent receipts/activities, alerts) | demo seed | Overview + outstanding/ageing/customers — **Extend** | 2 / 6 |
| Record Receipt / Statement / Reminder / Export | demo | Receipt create + **Add** statement/reminder/export | 3 / 6 / 4 |

**Money In today:** `MoneyInOverviewPage` — thinner (4 cards). Preserve legacy chrome when making Receivables canonical.

### 4.2 Customer outstanding — `/receivables/outstanding` | `/customers`

| UI | Source | Backend | Wave |
|----|--------|---------|------|
| Customer rollup KPIs + grid | `getCustomerOutstanding` | `GET /receivables/customers` — **Extend** filters (group/salesperson/territory/credit/dispute/promise) | 2 |
| Row: receipt / allocate / activity / promise / reminder / credit hold / statement | demo drawers | Receipt/allocate **Reuse**; activity/promise/reminder/hold/statement **Add** | 3 / 6 |
| Open-item register (Money In style) | Money In outstanding | `GET /receivables/outstanding` — **Reuse** | 2 |

### 4.3 Invoice register — `/receivables/invoices`

| UI | Source | Backend | Wave |
|----|--------|---------|------|
| Settlement tabs (Open/Partial/Due Soon/Overdue/Disputed/Paid) | demo | `GET /receivables/invoices` — **Extend** settlement/due/dispute dimensions (do not overload lifecycle status) | 2 |
| Lifecycle create/edit/post | Money In only | `/receivables/invoices` CRUD + validate/mark-ready/post/cancel/reverse — **Reuse** | 1–2 |
| Dispute row action | `DisputeDrawer` | **Add** dispute APIs | 5 |

### 4.4 Invoice detail — `/receivables/invoice/:invoiceId` (+ Money In `…/invoices/:id`)

| UI | Source | Backend | Wave |
|----|--------|---------|------|
| Header + lines + tax + lifecycle | Money In detail / legacy settlement detail | `GET/PUT …/invoices/:id` + lifecycle — **Reuse**; enrich related histories | 2 |
| Related receipts / CN / disputes / reminders / collection | mostly demo | Allocation/history **Reuse**; disputes/reminders/collection **Add** | 3 / 5 / 6 |
| Refresh from master (DRAFT) | Money In | `…/refresh-from-master[/preview]` — **Reuse** | 1 |

### 4.5 Ageing — `/receivables/ageing`

| UI | Source | Backend | Wave |
|----|--------|---------|------|
| Bucket KPIs + customer matrix + invoice detail | demo + Money In page | `GET /receivables/ageing` — **Reuse/Extend** buckets (align 121–180 / 181+ if required) | 4 |
| Export | demo | **Add** export | 4 |

### 4.6 Receipts — list / editor / detail / allocate

| UI | Source | Backend | Wave |
|----|--------|---------|------|
| List + lifecycle | demo + Money In | `/receivables/receipts` — **Reuse** | 1 / 3 |
| Rich editor with planned allocation tab | legacy editor | Receipt draft **Reuse**; planned allocations **Add** model + APIs | 3 |
| Post / Post-and-allocate | demo / Money In allocate-after-post | Post **Reuse**; atomic post+allocate **Extend** | 3 |
| Per-receipt allocate | Money In | allocation preview/create/reverse — **Reuse** | 3 |

### 4.7 Allocations register — `/receivables/allocations`

| UI | Source | Backend | Wave |
|----|--------|---------|------|
| Pending unallocated receipts worklist | filtered demo receipts | **Extend** dedicated allocation register (batches/lines) | 3 |
| Reverse from register | demo | allocation reverse — **Reuse** per batch | 3 |

### 4.8 Credit notes — `/receivables/credit-notes`

| UI | Source | Backend | Wave |
|----|--------|---------|------|
| List | demo | `/receivables/credit-notes` — **Reuse** | 1 / 2 |
| Create/detail/allocate | Money In only (legacy list-only) | CN + allocation APIs — **Reuse**; mount under Receivables | 1 / 3 |

### 4.9 Disputes — `/receivables/disputes`

| UI | Source | Backend | Wave |
|----|--------|---------|------|
| Register + drawer | **live** (`ArDispute` APIs + dual-mode adapters) | **Shipped** `ArDispute` + REST; open-item `DISPUTED` flag (no GL) | 5 ✅ |

### 4.10 Reminders — `/receivables/reminders`

| UI | Source | Backend | Wave |
|----|--------|---------|------|
| Reminder centre + preview | seed only | **Add** templates + reminders + outbox/send (disable send if no provider) | 6 |

### 4.11 Collections — `/receivables/collections`

| UI | Source | Backend | Wave |
|----|--------|---------|------|
| Worklist tabs + activity + promises | seed mutations | **Add** collection case / activity / promise + priority service (no GL) | 6 |

### 4.12 Customer AR 360 — `/receivables/customer/:customerId`

| UI | Source | Backend | Wave |
|----|--------|---------|------|
| Multi-tab 360 + FactBox | `getCustomerReceivableCard` | `GET /receivables/customers/:id` + open-items — **Extend** with histories | 2 / 5 / 6 |

### 4.13 Reconciliation — `/receivables/reconciliation` (add)

| UI | Source | Backend | Wave |
|----|--------|---------|------|
| AR↔GL | Money In page | `GET /receivables/reconciliation` — **Reuse**; optional persisted run later | 7 |

---

## 5. Existing backend API surface (reuse)

Prefix: `/api/v1/t/:tenantSlug/accounting/receivables`

| Area | Paths |
|------|-------|
| Reporting | `GET /overview`, `/outstanding`, `/ageing`, `/customers`, `/customers/:id`, `/customers/:id/open-items`, `/reconciliation` |
| Invoices | `GET/POST /invoices`, `GET/PUT /:id`, `POST …/validate|mark-ready|cancel|post|reverse`, `…/refresh-from-master[/preview]` |
| Receipts | `GET/POST /receipts`, `GET/PUT /:id`, lifecycle + post/reverse |
| Receipt allocations | `POST …/receipts/:id/allocations[/preview]`, list, reverse batch; invoice allocations list; customer-credits |
| Credit notes | Full draft/approval/post/reverse under `/credit-notes` |
| CN allocations | Parallel allocation routes under `/credit-notes/:id/allocations` |
| Disputes | `GET/POST /disputes`, `GET/PUT/DELETE /disputes/:id`, `POST /disputes/:id/transition` |
| Lookups | `/accounting/lookups/customers|items|sales-orders|…` |

Shared: posting engine, vouchers, GL, posting events, periods, finance approvals, treasury accounts, GST extract, CrmCompany resolver.

---

## 6. Permissions map

| Layer | Namespace | Notes |
|-------|-----------|-------|
| Live BE + Money In FE | `finance.ar.*` (26 keys) | SoT — keep |
| Legacy Receivables FE | `accounting.receivables.*` | Demo role packs only; **no JWT path** |
| Plan suggested `finance.receivables.*` | Not in catalog | Prefer **alias map** onto `finance.ar.*` + add only missing granular keys (dispute/reminder/collection/report) |

Wave 1 requirement: `useReceivablesPermissions` must resolve JWT `finance.ar.*` (+ new keys) in API mode; never fall back to demo packs when `VITE_USE_API=true`.

---

## 7. Data access boundary (Wave 1)

```ts
interface ReceivablesGateway {
  getOverview(...): Promise<ReceivablesOverview>
  listInvoices(...): Promise<PagedResult<InvoiceRow>>
  // … receipts, allocations, disputes, reminders, collections …
}
```

| Mode | Implementation |
|------|----------------|
| `VITE_USE_API=true` | `ApiReceivablesGateway` only — typed clients → live APIs; controlled errors; **no demo fallback** |
| `VITE_USE_API=false` | `DemoReceivablesGateway` → existing `receivablesService` / seed |

Money In bridge (`receivablesApiBridge`) remains the document CRUD path until pages are consolidated; gateway wraps register/overview/collection surfaces.

---

## 8. Prisma / migration rules for later waves

**Reuse only:** `SalesInvoice*`, `CustomerReceipt*`, `CustomerCreditNote*`, allocation batches/lines, `ReceivableOpenItem`, voucher/GL/posting event, `CrmCompany`, `AuditLog`, treasury accounts.

**Candidate adds (only after schema search confirms absence):**

```text
ArDispute
ArReminderTemplate / ArReminder
ArCollectionCase / ArCollectionActivity
ArPromiseToPay
CustomerReceiptAllocationPlan
```

New migration timestamp must be unique after current max and must avoid collisions with the uncommitted mfg/dispatch/purchase set. Prefer `npx tsx scripts/prisma-cli.ts migrate deploy` after `migrate status` is clean.

---

## 9. Test baseline vs plan gaps

| Present | Missing vs plan |
|---------|-----------------|
| ~19 `finance-ar-*.test.ts` (~217 cases) | 14 planned `receivables-*.test.ts` |
| FE `test:money-in` 93/93; master-reuse 39/39 | Browser E2E / Playwright harness |
| AR reporting 10/10 | Dispute/reminder/collection/promise suites |
| Integrity script | Dedicated overview KPI equality suite |

Skips without MySQL ≠ passes.

---

## 10. Wave gates (condensed)

| Wave | Gate |
|------|------|
| **0** | This contract; ownership clear; baseline recorded; no undocumented route |
| **1** | Receivables canonical in API mode; Money In aliases; gateway; no demo fallback; CrmCompany selectors |
| **2** | Overview + invoice register/detail + outstanding + customer 360 live from MySQL |
| **3** | Receipts + planned alloc + post/post-and-allocate + allocation register |
| **4** | Ageing + reports/exports reconcile to open items |
| **5** | Disputes functional; no automatic GL change |
| **6** | Reminders + collections + promises API-backed |
| **7** | Reconciliation + permissions + tenant isolation + E2E + docs + production readiness |

---

## 11. Explicit non-goals for this program

- Do not start AP / budgeting / FA / tax filing after AR.
- Do not auto-fix the dirty merge migration pile as part of AR Wave 1.
- Do not replace Money In document services — alias and adapt.
- Do not simplify legacy UI because an API is missing; implement the API.

---

## 12. Source audits

Wave 0 evidence assembled from code inspection of:

- `frontend/src/routes/accountingRoutes.tsx`
- `frontend/src/modules/accounting/*Receivable*` / Money In pages
- `frontend/src/services/accounting/receivablesService.ts`
- `frontend/src/services/bridges/receivablesApiBridge.ts`
- `backend/src/modules/accounting/receivables/**`
- `backend/src/constants/permissions.ts`
- `docs/TESTING_STATUS.md`, `docs/PROJECT_MEMORY.md`
