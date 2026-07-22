# API Conventions

Authoritative patterns from `backend/src/app.ts` and module routes. Base URL: **`/api/v1`**.

**Live OpenAPI (dev):** http://localhost:5000/api/docs — OpenAPI **1.4.0**. Hand-written entries live in `backend/src/config/swagger.ts`; remaining Express routes are filled by auto-generated stubs in `swagger.generated-paths.ts`. Regenerate stubs after adding routes:

```bash
cd backend && npm run swagger:generate
```

## Base URL & health

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /health` | No | `{ database, environment }` inside `data` |
| `GET /docs` | No | Swagger UI (development only) |

Frontend default: `VITE_API_BASE_URL=http://localhost:5000/api/v1`

## Authentication

Prefix: **`/api/v1/auth`**

| Method | Path | Auth | Body / notes |
|--------|------|------|--------------|
| POST | `/login` | No | `{ email, password, tenantSlug }` — rate limited (30/15min) |
| POST | `/refresh-token` | No | `{ refreshToken }` |
| POST | `/forgot-password` | No | `{ email, tenantSlug }` |
| POST | `/reset-password` | No | `{ token, password }` |
| POST | `/logout` | Bearer | `{ refreshToken? }` |
| POST | `/change-password` | Bearer | `{ currentPassword, newPassword }` |
| GET | `/me` | Bearer | Current user + roles + permissions |

**Headers:** `Authorization: Bearer <accessToken>`

Login response `data` includes: `accessToken`, `refreshToken`, `tenantId`, `tenantSlug`, `user` (id, name, email, roles, permissions).

## Tenant routes (authoritative pattern)

Two equivalent mounts (same router, `mergeParams: true`):

```
/api/v1/tenants/:tenantId/{resource}
/api/v1/t/:tenantSlug/{resource}
```

**Frontend uses slug form** via `tenantPath('/crm/leads')` → `/t/vasant-trailers/crm/leads`.

### Platform admin (no tenant in path)

| Prefix | Permission | Resources |
|--------|------------|-----------|
| `/tenants` | `tenant.manage` (Super Admin) | POST/GET list, GET/PATCH/DELETE `/:tenantId` |

### Tenant-scoped resources

| Prefix | Module |
|--------|--------|
| `/t/:tenantSlug/users` | User CRUD + role assignment |
| `/t/:tenantSlug/roles` | Role CRUD + permissions |
| `/t/:tenantSlug/crm/*` | Full CRM module |
| `/t/:tenantSlug/accounting/*` | Finance setup + journals + approvals (see below) |
| `/t/:tenantSlug/masters/*` | Generic master CRUD |
| `/t/:tenantSlug/masters/items` | Item CRUD + import |
| `/t/:tenantSlug/masters/vendors` | Vendor CRUD + import |
| `/t/:tenantSlug/masters/imports` | Batch import |
| `/t/:tenantSlug/masters/exports` | Batch export |
| `/t/:tenantSlug/lookups/*` | Lightweight lookup endpoints |

## CRM routes (`/crm`)

All require auth + tenant context + appropriate `crm.*` permission.

| Sub-path | Methods | Permission examples |
|----------|---------|---------------------|
| `/companies` | GET, POST | `crm.company.view`, `.create` — POST with `contactPerson` also upserts primary contact |
| `/companies/:id` | GET, PATCH, DELETE | `.view`, `.update`, `.delete` — PATCH contact fields sync primary contact |
| `/contacts` | GET, POST | `crm.contact.*` |
| `/contacts/:id` | GET, PATCH, DELETE | |
| `/leads` | GET, POST | `crm.lead.*` |
| `/leads/:id` | GET, PATCH, DELETE | |
| `/leads/:id/assign` | POST | `crm.lead.assign` |
| `/leads/:id/qualify` | POST | `crm.lead.qualify` |
| `/leads/:id/disqualify` | POST | `crm.lead.qualify` |
| `/leads/:id/convert` | POST | `crm.lead.convert` — requires qualified; 422 if not |
| `/leads/:id/change-stage` | POST | Change lead stage |
| `/leads/:id/status-history` \| `assignment-history` | GET | Audit trails |
| `/leads/bulk-assign` \| `bulk-status` \| `bulk-archive` \| `bulk-restore` | POST | Bulk ops |
| `/activities` | GET, POST | `crm.activity.*` |
| `/activities/:id` | GET, PATCH, DELETE | |
| `/activities/:id/complete` | POST | `crm.activity.complete` |
| `/opportunities` | GET, POST | `crm.opportunity.*` |
| `/opportunities/:id` | GET, PATCH, DELETE | |
| `/opportunities/:id/win` \| `lose` \| `reopen` | POST | `crm.opportunity.close` |
| `/opportunities/:id/assign` \| `move-stage` | POST | Assign / stage transition |
| `/opportunities/:id/*-history` | GET | stage / assignment / amount / status history |
| `/follow-ups` | GET, POST | `crm.follow_up.*` |
| `/follow-ups/:id` | GET, PATCH, DELETE | |
| `/follow-ups/:id/complete` \| `reschedule` \| `snooze` \| `cancel` | POST | Follow-up lifecycle |
| `/pipelines` | GET, POST | `crm.pipeline.view` / `.manage` |
| `/pipelines/:id` | GET, PATCH, DELETE | |
| `/imports/{companies\|contacts\|leads}` | POST | `crm.import.execute` |
| `/imports/…/template` | GET | `crm.import.view` — CSV template |
| `/quotations` | GET, POST | `crm.quotation.view` / `.create` |
| `/quotations/:id` | GET, PATCH, DELETE | `.view` / `.update` / `.delete` |
| `/quotations/:id/revisions` | POST | `crm.quotation.update` |
| `/quotations/:id/documents/:docId` | PATCH | `crm.quotation.update` |
| `/quotations/:id/documents/:docId/submit-approval` | POST | `crm.quotation.update` |
| `/quotations/:id/documents/:docId/approve` | POST | `crm.quotation.approve` — also sets `customerApproval=approved` (no separate Accept API) |
| `/quotations/:id/documents/:docId/reject` | POST | `crm.quotation.approve` |
| `/quotations/:id/documents/:docId/mark-sent` | POST | `crm.quotation.update` |
| `/quotations/:id/convert-to-sales-order` | POST | `crm.quotation.convert` + `crm.sales_order.create` — creates Open SO, wins linked opportunity; 409 on already-converted |
| `/quotation-templates` | GET, POST | `crm.quotation.view` / `.create` |
| `/quotation-templates/:id` | GET, PATCH, DELETE | |
| `/quotation-templates/:id/duplicate` | POST | `crm.quotation.create` |
| `/sales-orders` | GET, POST | `crm.sales_order.view` / `.create` — list + draft create |
| `/sales-orders/:id` | GET, PATCH, DELETE | Draft update/delete when status open |
| `/sales-orders/:id/confirm` \| `close` | POST | Confirm / close lifecycle |
| `/exports/:resource` | GET (CSV blob) | `crm.export.execute` |
| `/dashboard/metrics` | GET | `crm.dashboard.view` — query `?period=month`; response `data` includes KPIs, `panels`, and `charts` (pipeline/funnel/trend/urgency/owner series) |
| `/reports?reportId=` | GET | `crm.report.view` |
| `/search` | GET | `crm.search.view` — optional `limit` 1–50 (default 25) |
| `/masters/sync` | GET | Sync/seed CRM masters |
| `/masters/:kind` | GET, POST | `crm.master.*` |
| `/masters/:kind/lookup` | GET | Active options for dropdowns |
| `/masters/:kind/:id` | GET, PATCH, DELETE | |
| `/masters/:kind/:id/activate` \| `deactivate` | POST | |
| `/entities/:entityType/:entityId/notes` | GET, POST | `crm.note.*` |
| `/entities/notes/:noteId` | PATCH, DELETE | |
| `/entities/:entityType/:entityId/attachments` | GET, POST | `crm.attachment.*` |
| `/entities/attachments/:attachmentId/download` | GET (blob) | `crm.attachment.view` |
| `/entities/attachments/:attachmentId` | DELETE | `crm.attachment.delete` |

**Export resources:** `companies`, `contacts`, `leads`, `opportunities`, `quotations`, `activities`, `follow-ups`

**Report IDs:** `pipeline`, `stage-wise`, `follow-up-due`, `sales-activity`, `quotation-revision`, `quotation-approval`, `won-lost`, `customer-pipeline`, `conversion-funnel`, `lead-register`, `lead-owner`, `lead-priority`, `lead-stage`, `lead-conversion`, `closed-leads`, `lead-active-inactive`

**Entity types (notes/attachments):** `COMPANY`, `CONTACT`, `LEAD`, `OPPORTUNITY`, `ACTIVITY`, `FOLLOW_UP`, `QUOTATION`

**CRM master kinds (`/crm/masters/:kind`):** `lead-sources`, `industries`, `territories`, `designations`, `departments`, `lead-stages`, `lead-priorities`, `lead-reasons`, `opportunity-stages`, `opportunity-priorities`, `activity-types`, `lost-reasons`, `commercial-terms`, `payment-terms`, `delivery-terms`, `warranty-terms`, `approval-rules`, `document-types`

## Master routes (`/masters/:resource`)

Registry resources: `countries`, `states`, `cities`, `uom`, `warehouses`, `locations`, `item-categories`, `hsn-sac`, `gst-groups`, `gst-rates`, `products`

| Method | Path | Action |
|--------|------|--------|
| GET | `/:resource` | List (paginated) |
| POST | `/:resource` | Create |
| GET | `/:resource/:id` | Get by id |
| PATCH | `/:resource/:id` | Update |
| DELETE | `/:resource/:id` | Soft delete |
| POST | `/:resource/:id/activate` | Set ACTIVE |
| POST | `/:resource/:id/deactivate` | Set INACTIVE |

Items: `/masters/items` — dedicated controller.  
Vendors: `/masters/vendors` — dedicated controller.

Master CSV import: `/masters/imports/{items|vendors|hsn-sac}` (+ `/template` GET).  
Master CSV export: `/masters/exports/{items|vendors|hsn-sac}`.

## Accounting routes (`/accounting`)

Prefix: **`/api/v1/t/:tenantSlug/accounting`**. Auth + tenant context required. Never send `tenantId` in bodies.

Live OpenAPI: `/api/docs` (tags **Accounting Journals**, **Accounting Receivables**, **Accounting Payables**, **Sales Invoices**, **Customer Receipts**, **Vendor Invoices**, **Accounting Approvals**, **Accounting Vouchers**, **Accounting Posting Events**).

### Sales invoices (`/receivables/invoices`) — Phase 3A3 + 3A4

| Method | Path | Permission | Notes |
|--------|------|------------|-------|
| GET | `/receivables/invoices` | `finance.ar.invoice.view` | Requires `legalEntityId`; filters status, customer, dates, search |
| POST | `/receivables/invoices` | `finance.ar.invoice.create` | Create DRAFT; server calculates amounts; `draftReference` only (no invoice number) |
| GET | `/receivables/invoices/:id` | `finance.ar.invoice.view` | Detail + lines + `allowedActions` + `validationSummary`; POSTED includes `receivableOpenItemId`, `outstandingAmount` |
| PUT | `/receivables/invoices/:id` | `finance.ar.invoice.edit` | DRAFT / READY_TO_POST; body includes `updatedAt` (optimistic lock) |
| POST | `/receivables/invoices/:id/validate` | `finance.ar.invoice.view` | Validation preview only — no amount/status persist |
| POST | `/receivables/invoices/:id/mark-ready` | `finance.ar.invoice.edit` | Full validation + number series preview (non-consuming) → READY_TO_POST |
| POST | `/receivables/invoices/:id/post` | `finance.ar.invoice.post` | Atomic post READY→POSTED; empty body OK; idempotent `SALES_INVOICE_POST:{id}:V1` |
| POST | `/receivables/invoices/:id/cancel` | `finance.ar.invoice.cancel` | Body `{ cancellationReason }` → CANCELLED |
| POST | `/receivables/invoices/:id/refresh-from-master/preview` | `finance.ar.invoice.edit` | DRAFT only; diff of customer snapshot vs live `CrmCompany` — `{ invoiceId, customerId, current, proposed, changedFields[] }` |
| POST | `/receivables/invoices/:id/refresh-from-master` | `finance.ar.invoice.edit` | DRAFT only; rewrites `customer*Snapshot` fields from live master; returns full detail |

**Lifecycle:** `DRAFT` → mark-ready → `READY_TO_POST` → post → `POSTED`. Edit from READY reopens to `DRAFT`.  
**Post response (`POST …/post`):** `{ invoice, posting, receivableOpenItemId, idempotentReplay }` where `posting` includes `voucherNumber`, `postingEventId`, `ledgerEntryCount`.  
**Posted `allowedActions`:** all writes false; `viewAccounting: true` when user has view permission.  
**Stale update:** `409` code `SALES_INVOICE_STALE_UPDATE` when `updatedAt` mismatch.  
**Source types:** `DIRECT` or `SALES_ORDER` (+ `sourceDocumentId`); SO adapter read-only with duplicate-invoice warning.

### Vendor invoices (`/payables/vendor-invoices`) — Phase 4A3 + 4A4

| Method | Path | Permission | Notes |
|--------|------|------------|-------|
| GET | `/payables/vendor-invoices` | `finance.ap.vendor_invoice.view` | Requires `legalEntityId` |
| POST | `/payables/vendor-invoices` | `finance.ap.vendor_invoice.create` | DRAFT; server calculates via Phase 4A2; `draftReference` only |
| GET | `/payables/vendor-invoices/:id` | `finance.ap.vendor_invoice.view` | Detail + lines + `allowedActions`; POSTED includes voucher/open-item summary |
| PATCH | `/payables/vendor-invoices/:id` | `finance.ap.vendor_invoice.edit` | DRAFT only; `expectedUpdatedAt` |
| POST | `/payables/vendor-invoices/:id/validate` | `finance.ap.vendor_invoice.view` | Re-runs Phase 4A2; may refresh snapshots |
| POST | `/payables/vendor-invoices/:id/submit` | `finance.ap.vendor_invoice.submit` | Approval-required DRAFT → PENDING_APPROVAL; claims uniqueness key |
| POST | `/payables/vendor-invoices/:id/mark-ready` | `finance.ap.vendor_invoice.mark_ready` | Non-approval DRAFT → READY_TO_POST; claims uniqueness key |
| POST | `/payables/vendor-invoices/:id/approve` | `finance.ap.vendor_invoice.approve` | PENDING → READY_TO_POST |
| POST | `/payables/vendor-invoices/:id/reject` | `finance.ap.vendor_invoice.approve` | PENDING → REJECTED |
| POST | `/payables/vendor-invoices/:id/revise` | `finance.ap.vendor_invoice.edit` | REJECTED / READY → DRAFT |
| POST | `/payables/vendor-invoices/:id/cancel` | `finance.ap.vendor_invoice.cancel` | Releases uniqueness key when claimed |
| GET | `/payables/vendor-invoices/:id/approval` | `finance.ap.vendor_invoice.view` | Approval request + steps |
| POST | `/payables/vendor-invoices/:id/post` | `finance.ap.vendor_invoice.post` | Body `{ expectedUpdatedAt }`; atomic READY→POSTED; idempotent `VENDOR_INVOICE_POST:{id}:V1` |
| POST | `/payables/vendor-invoices/:id/refresh-from-master/preview` | `finance.ap.vendor_invoice.edit` | DRAFT only; diff of vendor snapshot vs live `MasterVendor` — `{ invoiceId, vendorId, current, proposed, changedFields[] }` |
| POST | `/payables/vendor-invoices/:id/refresh-from-master` | `finance.ap.vendor_invoice.edit` | DRAFT only; rewrites `vendor*Snapshot` fields from live master; returns full detail |

**Source modes (master reuse):** create/update accept optional `sourceMode` (`DIRECT` \| `PURCHASE_ORDER` \| `GRN` \| `PURCHASE_ORDER_AND_GRN`); `sourceLinks[]` must reference real tenant PO/GRN UUIDs with matching vendor — fabricated IDs are rejected (`accounting-source-document-resolver`).

**Frontend (Phase 4A5):** Money Out under `/accounting/money-out` — see `docs/accounting/AP_FRONTEND.md`. Bridge: `payablesApiBridge` (API mode only).

### Accounting master lookups (`/accounting/lookups`) — master reuse Wave 1

Read-only, tenant-scoped, paginated (`{ data, meta }`). AR endpoints need `finance.ar.invoice.view`; AP endpoints need `finance.ap.vendor_invoice.view`; items accept either. No `FinanceCustomer` / `FinanceVendor` tables — these resolve the real masters.

| Method | Path | Backing master | Query |
|--------|------|----------------|-------|
| GET | `/lookups/customers` (+ `/:id`) | `CrmCompany` | `search`, `page`, `limit`, `activeOnly` |
| GET | `/lookups/vendors` (+ `/:id`) | `MasterVendor` | `search`, `page`, `limit`, `activeOnly` |
| GET | `/lookups/items` (+ `/:id`) | `MasterItem` | `search`, `page`, `limit`, `activeOnly`, `itemType` |
| GET | `/lookups/sales-orders` | `CrmSalesOrder` | `search`, `customerId`, `eligibleOnly`, `page`, `limit` |
| GET | `/lookups/sales-orders/:id/invoice-eligibility` | — | `customerId?` → `{ eligible, errors[], warnings[], snapshot }` |
| GET | `/lookups/purchase-orders` | `PurchaseOrder` | `search`, `vendorId`, `eligibleOnly`, `page`, `limit` |
| GET | `/lookups/purchase-orders/:id/invoice-eligibility` | — | `vendorId?` → eligibility shape |
| GET | `/lookups/grns` | `GoodsReceipt` | `search`, `vendorId`, `purchaseOrderId`, `eligibleOnly`, `page`, `limit` |
| GET | `/lookups/grns/:id/invoice-eligibility` | — | `vendorId?` → eligibility shape |

Frontend client: `frontend/src/services/api/accountingLookupsApi.ts`. Full contract: `docs/accounting/INVOICE_UX_STANDARD.md`.

### AP reconciliation (`/payables/reconciliation`) — Phase 4D2

| Method | Path | Permission | Notes |
|--------|------|------------|-------|
| POST | `/payables/reconciliation/runs` | `finance.ap.reconciliation.run` | Body `{ legalEntityId, asOfDate?, includeVendorLevel?, toleranceOverride? }`; persists run + account results + exceptions; no GL/open-item mutation |
| GET | `/payables/reconciliation/runs` | `finance.ap.reconciliation.view` | Requires `legalEntityId`; paginated history |
| GET | `/payables/reconciliation/runs/:id` | `finance.ap.reconciliation.view` | Run detail + `isStale` |
| GET | `/payables/reconciliation/runs/:id/accounts` | `finance.ap.reconciliation.view` | Per control account GL vs subledger |
| GET | `/payables/reconciliation/runs/:id/vendors` | `finance.ap.reconciliation.view` | Vendor-level party recon |
| GET | `/payables/reconciliation/runs/:id/exceptions` | `finance.ap.reconciliation.exception.view` | Filter by severity/category/acknowledged |
| GET | `/payables/reconciliation/runs/:id/export` | `finance.ap.reconciliation.export` | CSV download |
| GET | `/payables/reconciliation/exceptions/:id` | `finance.ap.reconciliation.exception.view` | Exception detail |
| POST | `/payables/reconciliation/exceptions/:id/acknowledge` | `finance.ap.reconciliation.exception.acknowledge` | INFO/WARNING only; body `{ note? }` |

**Run status:** `MATCHED` \| `MATCHED_WITH_WARNINGS` \| `MISMATCHED` \| `FAILED`. GL `baseCredit−baseDebit` vs AP `CREDIT outstanding−DEBIT outstanding` in base currency.

### AP close gate (`/payables/close-gate`) — Phase 4D2

| Method | Path | Permission | Notes |
|--------|------|------------|-------|
| POST | `/payables/close-gate/runs` | `finance.ap.close_gate.run` | Body `{ legalEntityId, periodId, runFreshReconciliation?, reconciliationRunId?, includeVendorLevel? }`; advisory only — **does not close period** |
| GET | `/payables/close-gate/runs` | `finance.ap.close_gate.view` | Requires `legalEntityId` |
| GET | `/payables/close-gate/latest` | `finance.ap.close_gate.view` | Query `legalEntityId` + `periodId` |
| GET | `/payables/close-gate/runs/:id` | `finance.ap.close_gate.view` | Run + checks |
| GET | `/payables/close-gate/runs/:id/export` | `finance.ap.close_gate.export` | CSV download |

**Gate status:** `PASS` \| `PASS_WITH_WARNINGS` \| `BLOCKED` \| `FAILED`.

**Posting:** Creates one SYSTEM voucher + GL + one CREDIT `PayableOpenItem` (outstanding = vendor payable). Does **not** create or allocate a vendor payment. `finance.voucher.post` alone is insufficient.

### Treasury — Bank & Cash (`/treasury/*`) — Phase 5A1 (setup only, no posting)

See `docs/accounting/BANK_CASH_ARCHITECTURE.md` for the full model. **No statement import/match/reconcile route exists** — do not add one without separate approval.

| Method | Path | Permission | Notes |
|--------|------|------------|-------|
| GET | `/treasury/accounts` | `finance.treasury.account.view` | Requires `legalEntityId`; filters `accountType`, `status` |
| POST | `/treasury/accounts` | `finance.treasury.account.create` | `bankProfile` required for `BANK`; GL account must match type/category rule; rejects a 2nd ACTIVE mapping to the same GL account |
| GET | `/treasury/accounts/:id` | `finance.treasury.account.view` | 404 outside caller's tenant |
| PUT | `/treasury/accounts/:id` | `finance.treasury.account.edit` | Body includes `expectedUpdatedAt` (optimistic lock) |
| POST | `/treasury/accounts/:id/activate` \| `/deactivate` \| `/close` | `finance.treasury.account.activate` \| `.deactivate` \| `.close` | `expectedUpdatedAt` required; `CLOSED` is terminal |
| GET / PUT | `/treasury/accounts/:id/reconciliation-profile` | `finance.treasury.reconciliation_settings.view` \| `.manage` | BANK accounts only (`400` otherwise); `lastReconciled*` fields rejected on PUT |
| GET | `/treasury/payment-account-mappings` | `finance.treasury.payment_mapping.view` | Filters `legalEntityId`, `paymentMethod`, `useCase`, `isActive` |
| POST | `/treasury/payment-account-mappings` | `finance.treasury.payment_mapping.manage` | `clearingAccountId` required when `role` is `CLEARING`/`SETTLEMENT`; `isDefault` conflict check |
| PUT / activate / deactivate on `/treasury/payment-account-mappings/:id` | `finance.treasury.payment_mapping.manage` | `expectedUpdatedAt` required |
| POST | `/treasury/payment-account-mappings/resolve` | `finance.treasury.payment_mapping.view` | Read-only; returns the winning mapping row (see `PAYMENT_ACCOUNT_MAPPING.md` for the resolution algorithm) |

**Money fields** (`overdraftLimit`, `imprestLimit`, `autoMatchToleranceAmount`, `lastReconciledBalance`) are always returned as fixed 4-decimal strings. **Bank account numbers are never returned** — only `accountNumberLast4` / `accountNumberMasked`.

### Bank reconciliation (`/treasury/bank-reconciliation*`) — Phase 5A3

| Method | Path | Permission | Notes |
|--------|------|------------|-------|
| GET | `/treasury/bank-reconciliation` | `finance.bank.reconciliation.view` | Session list |
| GET | `/treasury/bank-reconciliation/history` | `.view` | Match history |
| GET | `/treasury/bank-reconciliation/exceptions` | `.view` | Open/resolved exceptions |
| GET | `/treasury/bank-statements/:id/reconciliation` | `.view` | Workspace (lazy session create) |
| GET | `/treasury/bank-statements/:id/reconciliation/summary` | `.view` | Balances / difference |
| POST | `…/run-auto-match` | `.run_auto_match` | Exact DIRECT only when unique; clearing → suggestions |
| GET/POST | suggestions accept/reject | `.match` | Stale check on accept |
| GET | `…/lines/:lineId/reconciliation-candidates` | `.view` | Scored candidates |
| POST | `/treasury/bank-reconciliation/preview` | `.view` | No writes; server resolves posting mode |
| POST | `/treasury/bank-reconciliation/matches` | `.match` (+ `.clearing_post` when clearing) | Idempotent; direct = no GL |
| POST | `…/matches/:id/unmatch` | `.unmatch` | Clearing → exact reversal voucher |
| POST | `…/lines/:lineId/create-journal-draft` | `.adjustment_draft_create` + `finance.journal.create` | Draft only |
| POST | `…/finalize` \| `…/reopen` | `.finalize` / `.reopen` | Finalize creates no accounting |

See `docs/accounting/BANK_RECONCILIATION_ARCHITECTURE.md`.

### Treasury transfers (`/treasury/transfers`) — Phase 5B1

| Method | Path | Permission | Notes |
|--------|------|------------|-------|
| GET/POST | `/treasury/transfers` | `.view` / `.create` | List / create draft |
| GET/PATCH | `/treasury/transfers/:id` | `.view` / `.edit` | Detail / update draft |
| POST | `…/validate` | `.view` | No status change |
| POST | `…/submit` \| `…/approve` \| `…/reject` \| `…/revise` \| `…/mark-ready` \| `…/cancel` | matching transfer perms | Workflow |
| POST | `…/post` | `.post` | DIRECT only — one voucher |
| POST | `…/dispatch` \| `…/receive` | `.dispatch` / `.receive` | IN_TRANSIT legs |
| GET/POST | `…/reversal-preview` \| `…/reverse` | `.view` / `.reverse` | Blocked if active bank recon |

Direct creates one voucher; in-transit creates source dispatch + destination receipt. Approval never posts automatically.

### Treasury liquidity (`/treasury/liquidity`) — Phase 5C1

| Method | Path | Permission | Notes |
|--------|------|------------|-------|
| GET | `/treasury/liquidity/cash-position` | `finance.treasury.liquidity.view` | As-of book balances for BANK+CASH |
| GET | `/treasury/liquidity/daily` | `.liquidity.view` | Book + in-transit + uncleared cheques + unmatched statement |
| GET | `/treasury/liquidity/forecast` | `.liquidity.view` | Query `horizonDays` (7/14/30) |
| GET | `/treasury/liquidity/closing-controls` | `finance.treasury.closing.view` | Soft checklist only |
| GET | `/treasury/liquidity/dashboard` | `.liquidity.view` | Composed position + liquidity + forecast + controls |
| GET/POST | `/treasury/liquidity/day-closes` | `.closing.view` / `.closing.manage` | Soft day-close OPEN→REVIEWED→CLOSED |
| POST | `/treasury/liquidity/day-closes/:id/{review,close,reopen}` | `.closing.manage` | Does **not** lock GL periods |

See `docs/accounting/TREASURY_LIQUIDITY_ARCHITECTURE.md`.

### Fixed Assets (`/fixed-assets`) — Phase 1–3

| Method | Path | Permission | Notes |
|--------|------|------------|-------|
| GET | `/fixed-assets/overview` | `finance.fa.view` | KPIs by legal entity |
| GET/POST | `/fixed-assets/categories` | `.view` / `.create` | Category master + GL accounts |
| GET/PATCH | `/fixed-assets/categories/:id` | `.view` / `.edit` | |
| GET/POST | `/fixed-assets/assets` | `.view` / `.create` | Register |
| GET/PATCH | `/fixed-assets/assets/:id` | `.view` / `.edit` | Draft / pending capitalization only |
| POST | `/fixed-assets/assets/:id/capitalize` | `.capitalize` | Idempotent `FIXED_ASSET_CAPITALIZE:{id}:V1` |
| POST | `/fixed-assets/depreciation-runs/preview` | `.depreciate` | Straight-line preview |
| POST | `/fixed-assets/depreciation-runs` | `.depreciate` | Post run `FIXED_ASSET_DEPRECIATE:{runId}:V1` |
| POST | `/fixed-assets/assets/:id/dispose/preview` | `.dispose` | Gain/loss; optional `disposeCostAmount` for partial |
| POST | `/fixed-assets/assets/:id/dispose` | `.dispose` | Full: `FIXED_ASSET_DISPOSE:{id}:V1`; partial: `FIXED_ASSET_PARTIAL_DISPOSE:{disposalId}:V1` |
| GET/POST | `/fixed-assets/transfers` | `.view` or `.transfer` / `.transfer` | Intra-LE location transfer drafts |
| GET | `/fixed-assets/transfers/:id` | `.view` or `.transfer` | |
| POST | `/fixed-assets/transfers/:id/complete` | `.transfer` | Updates asset location fields — **no GL** |

### Budgeting (`/budgeting`) — Phase 1

| Method | Path | Permission | Notes |
|--------|------|------------|-------|
| GET | `/budgeting/overview` | `finance.budget.view` | KPIs by legal entity |
| GET/POST | `/budgeting/versions` | `.view` / `.create` | Budget versions |
| GET/PATCH | `/budgeting/versions/:id` | `.view` / `.edit` | |
| POST | `/budgeting/versions/:id/submit` | `.edit` | → PENDING_APPROVAL |
| POST | `/budgeting/versions/:id/approve` | `.approve` | → APPROVED |
| POST | `/budgeting/versions/:id/lock` | `.approve` | → LOCKED |
| GET/POST | `/budgeting/versions/:id/lines` | `.view` / `.edit` | Annual lines (12 FY months) |
| PATCH/DELETE | `/budgeting/versions/:id/lines/:lineId` | `.edit` | |
| GET | `/budgeting/budget-vs-actual` | `.view` | Budget lines + posted GL actuals |

### Bank connectors (`/treasury/bank-connectors`) — Phase 5D1–5D3

| Method | Path | Permission | Notes |
|--------|------|------------|-------|
| GET | `/treasury/bank-connectors/providers` | `.view` | Provider catalog |
| CRUD + enable/disable | `/treasury/bank-connectors` | `.view` / `.manage` | |
| POST | `…/:id/test-connection` | `.manage` | |
| POST | `…/:id/sync` | `.sync` | MT940/CAMT → `BANK_API` (sandbox/REST/live SFTP) |
| POST | `…/:id/consents/start\|callback\|revoke` | `.manage` | Open Banking consent scaffold only |

**Dispose GL:** Dr accum dep + proceeds account (if any) + `ASSET_DISPOSAL_LOSS`; Cr asset cost + `ASSET_DISPOSAL_GAIN`. Eligible statuses: ACTIVE, IDLE, FULLY_DEPRECIATED. Partial dispose keeps the asset active with reduced cost/accum/NBV.

See `docs/accounting/FIXED_ASSETS_STATUS.md`.

### Customer receipts (`/receivables/receipts`) — Phase 3B3–3B5

| Method | Path | Permission | Notes |
|--------|------|------------|-------|
| GET | `/receivables/receipts` | `finance.ar.receipt.view` | Requires `legalEntityId`; filters status, customer, paymentMethod, dates, search |
| POST | `/receivables/receipts` | `finance.ar.receipt.create` | Create DRAFT; server recalculates via Phase 3B2; `draftReference` only (`receiptNumber` null) |
| GET | `/receivables/receipts/:id` | `finance.ar.receipt.view` | Detail + TDS + bankCharges/otherDeductions + `allowedActions` + `validationSummary`; when POSTED also `receiptNumber`, `creditOpenItem`, `ledgerEntryCount` |
| PUT | `/receivables/receipts/:id` | `finance.ar.receipt.edit` | DRAFT / READY_TO_POST; body includes `updatedAt` (optimistic lock); READY edit → DRAFT |
| POST | `/receivables/receipts/:id/validate` | `finance.ar.receipt.view` | Phase 3B2 validation preview; optional `proposedAllocations` (not persisted) |
| POST | `/receivables/receipts/:id/mark-ready` | `finance.ar.receipt.edit` | Full validation + CUSTOMER_RECEIPT series preview (non-consuming) → READY_TO_POST |
| POST | `/receivables/receipts/:id/post` | `finance.ar.receipt.post` | Atomic post READY_TO_POST→POSTED; empty body OK; idempotent `CUSTOMER_RECEIPT_POST:{id}:V1` |
| POST | `/receivables/receipts/:id/cancel` | `finance.ar.receipt.cancel` | Body `{ cancellationReason }` → CANCELLED |
| POST | `/receivables/receipts/:receiptId/allocations/preview` | `finance.ar.allocation.view` | Read-only preview; no writes |
| POST | `/receivables/receipts/:receiptId/allocations` | `finance.ar.allocation.create` | Atomic multi-invoice allocation; requires `Idempotency-Key`; **no GL** |
| GET | `/receivables/receipts/:receiptId/allocations` | `finance.ar.allocation.view` | Allocation history for receipt |
| GET | `/receivables/invoices/:invoiceId/allocations` | `finance.ar.allocation.view` | Allocations applied to invoice |
| GET | `/receivables/customer-credits` | `finance.ar.view` | Outstanding CREDIT open items (customer advances) |

**Lifecycle:** `DRAFT` → mark-ready → `READY_TO_POST` → post → `POSTED` → allocate (optional, multiple batches). Edit from READY reopens to `DRAFT`. Cancel from DRAFT/READY.  
**Post response (`POST …/post`):** `{ receipt, posting, creditOpenItemId, idempotentReplay }`. Dr bank/cash (+ TDS + bank charges + other deductions), Cr customer receivable = gross receipt amount; creates a `CREDIT`-side `ReceivableOpenItem`.  
**Allocation (`POST …/allocations`):** Updates debit/credit open items + receipt allocated/unallocated only. Does **not** create AccountingVoucher, GL, PostingEvent, or consume number series. Same-customer / same-legal-entity / same-currency; forex base incompatibility blocked. Remaining credit = customer advance.  
**Posted `allowedActions`:** `allocate: true` when credit outstanding > 0 + `finance.ar.allocation.create`; `viewAllocations` with view perm; `reverse: true` when POSTED + `finance.ar.receipt.reverse` and no POSTED allocations remain.
**Allocation reverse (`POST …/allocations/:batchId/reverse`):** subledger-only (no GL/voucher/number series); body `{ reason }` + `Idempotency-Key`; perm `finance.ar.allocation.reverse`. Reverts debit + credit open items and header allocated/unallocated, flips lines + batch to `REVERSED`. Idempotent: same key+payload → replay; mismatch → 409 (`RECEIPT_ALLOCATION_PAYLOAD_MISMATCH`). Non-existent batch → 404 (`RECEIPT_ALLOCATION_BATCH_NOT_FOUND`); non-POSTED batch → 422 (`RECEIPT_ALLOCATION_BATCH_NOT_REVERSIBLE`).
**Document reverse (`POST …/receipts/:id/reverse`):** perm `finance.ar.receipt.reverse`; body `{ reason }` + `Idempotency-Key`. Requires no POSTED allocations (else 422 `CUSTOMER_RECEIPT_ALLOCATIONS_MUST_BE_REVERSED`) and a fully-unallocated credit open item. Posts a REVERSAL voucher (swaps debit↔credit), closes the credit open item, links original↔reversal vouchers, sets status `REVERSED` + `reversalVoucherId`; `receiptNumber` preserved. Idempotent replay when already `REVERSED`. Response `{ receipt, posting, reversalVoucherId, idempotentReplay }`.
**Stale update:** `409` code `CUSTOMER_RECEIPT_STALE_UPDATE`. Concurrent post: `409` code `CUSTOMER_RECEIPT_CONCURRENT_POST`. Concurrent allocation: `409` `RECEIPT_ALLOCATION_CONCURRENT_CHANGE`.  
**Draft reference:** `RCPT-DRAFT-YYYYMMDD-XXXXXX` (does not consume FinanceNumberSeries); `receiptNumber` issued from `CUSTOMER_RECEIPT` series at post time.

### AR reporting (`/receivables/*`) — Phase 3A5 (read-only GET)

| Method | Path | Permission | Notes |
|--------|------|------------|-------|
| GET | `/receivables/overview` | `finance.ar.view` | Totals, ready-to-post count, posted-this-month, data-quality exceptions |
| GET | `/receivables/outstanding` | `finance.ar.view` | Paginated open items + invoice join; default active outstanding filter |
| GET | `/receivables/ageing` | `finance.ar.view` | Bucket totals; `ageingBasis=due_date\|invoice_age`; past dates → `limitations: [AGEING_USES_CURRENT_BALANCES]` |
| GET | `/receivables/customers` | `finance.ar.view` | Customer summary list grouped by `customerId` |
| GET | `/receivables/customers/:customerId` | `finance.ar.view` | Single customer summary |
| GET | `/receivables/customers/:customerId/open-items` | `finance.ar.view` | Customer-scoped outstanding list |
| GET | `/receivables/reconciliation` | `finance.ar.reconcile.view` | Subledger vs GL; HTTP 200 with `status` MATCHED\|MISMATCH\|DATA_INCOMPLETE |

**Reporting field names:** API `outstandingAmount` = `ReceivableOpenItem.openAmount`; base currency uses `baseOpenAmount`.  
**Status flags:** derive `isDisputed` / `isOnHold` from `status === DISPUTED|ON_HOLD` (no DB booleans).  
**Errors:** `RECEIVABLE_REPORT_DATE_IN_FUTURE`, `AR_HISTORICAL_AS_OF_NOT_SUPPORTED`, `RECEIVABLE_INVALID_AMOUNT_RANGE`, etc.  
**No writes:** reporting routes must not mutate invoices, open items, vouchers, GL, posting events, number series, or audit logs.

### Manual journals (`/journals`)

| Method | Path | Permission | Notes |
|--------|------|------------|-------|
| GET | `/journals` | `finance.voucher.view` | Requires `legalEntityId`; optional `status`, date range, pagination |
| POST | `/journals` | `finance.voucher.create` | Create DRAFT voucher + lines (no number, no GL) |
| GET | `/journals/:id` | `finance.voucher.view` | Detail + `allowedActions` |
| PUT | `/journals/:id` | `finance.voucher.edit` | DRAFT / SENT_BACK only |
| POST | `/journals/:id/validate` | `finance.voucher.view` | Validation report + approval requirement |
| POST | `/journals/:id/submit` | `finance.voucher.submit` | → `PENDING_APPROVAL` or `APPROVED`; no GL |
| POST | `/journals/:id/cancel` | `finance.voucher.cancel` | Body `{ cancellationReason }` |
| GET | `/journals/:id/audit` | `finance.audit.view` | Audit trail |
| GET | `/journals/:id/approvals` | view / approve / audit | Approval timeline (all cycles) |
| POST | `/journals/:id/approve` | `finance.voucher.approve` | Optional `{ comments }`; maker-checker |
| POST | `/journals/:id/send-back` | `finance.voucher.approve` | Required `{ comments }` → SENT_BACK |
| POST | `/journals/:id/reject` | `finance.voucher.approve` | Required `{ comments }` → REJECTED |
| POST | `/journals/:id/post` | `finance.voucher.post` | Post **existing** approved journal to GL (2C2B) |
| POST | `/journals/:id/reverse` | `finance.voucher.reverse` | Reverse **posted** manual journal via REVERSAL voucher (2C3) |
| GET | `/journals/:id/ledger` | `finance.gl.view` \| `finance.voucher.view` | Read-only GL rows |

**Post response (`POST …/post`):** `{ journal, posting }` where `posting` includes `voucherNumber`, `postingEventId`, `idempotentReplay`, `ledgerEntryCount`.  
Idempotent event key: `MANUAL_JOURNAL_POST:{voucherId}:V1`. Does **not** create a second voucher.

**Reverse response (`POST …/reverse`):** `{ journal, posting, reversalVoucherId, idempotentReplay }`. Body `{ reason }`.  
Creates a new REVERSAL voucher (Dr↔Cr swapped); original → `REVERSED` with `reversedByVoucherId`; original `JO-` number kept.  
Idempotent event key: `MANUAL_JOURNAL_REVERSE:{voucherId}:V1` (replay when already `REVERSED`).

**Status flow:** `DRAFT` → submit → `PENDING_APPROVAL` / `APPROVED` → (approve levels) → `APPROVED` → post → `POSTED` → reverse → `REVERSED`.  
Send-back → `SENT_BACK` (editable, resubmit creates new approval cycle). Reject → `REJECTED` (read-only).

**Not exposed:** `POST /accounting/postings`, `POST /accounting/vouchers/:id/post`.

### Approval inbox (`/approvals`)

| Method | Path | Permission | Notes |
|--------|------|------------|-------|
| GET | `/approvals` | approve / view / audit | Query `legalEntityId` + `view=my_pending\|submitted_by_me\|completed_by_me\|all` |
| GET | `/approvals/:id` | approve / view / audit | Request + steps + `allowedActions` |

`view=all` requires broader finance management (`finance.settings.manage` / `tenant.manage`).

### Read-only ledger surfaces

| Method | Path | Permission |
|--------|------|------------|
| GET | `/vouchers/:id` | `finance.voucher.view` |
| GET | `/vouchers/:id/ledger` | `finance.gl.view` |
| GET | `/posting-events/:id` | `finance.posting_event.view` |

Finance setup (legal entities, branches, FY, periods, COA, settings, number series, approval **rules** config) lives under the same `/accounting` prefix — see Swagger and finance module routes.

## Response format

### Success

```json
{
  "success": true,
  "message": "Human-readable message",
  "data": { },
  "meta": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 }
}
```

- `meta` is `null` for single-resource responses.
- `201 Created` uses same shape via `sendCreated()`.

### Error

```json
{
  "success": false,
  "message": "Error summary",
  "errors": [{ "field": "email", "message": "Invalid email" }]
}
```

| Status | Typical cause |
|--------|---------------|
| 400 | Validation (Zod / business rule) |
| 401 | Missing/invalid token |
| 403 | Missing permission / tenant mismatch |
| 404 | Not found / unknown resource slug |
| 409 | Unique constraint (Prisma P2002) |
| 429 | Auth rate limit |
| 500 | Unhandled / DB error |

## Pagination & list queries

Standard query params (via `paginationSchema`):

| Param | Default | Max |
|-------|---------|-----|
| `page` | 1 | — |
| `limit` | 20 | 100 |
| `search` | — | trim string |
| `sortBy` | — | field name |
| `sortOrder` | `desc` | `asc` \| `desc` |

## Auth & permissions summary

1. Extract JWT → `req.context` (userId, tenantId).
2. `attachRequestContext` loads roles + permissions from DB.
3. `resolveTenant` sets `req.tenantId` from route slug/id.
4. `requirePermission('x.y.z')` — Super Admin (`tenant.manage`) bypasses all checks.

**Never accept `tenantId` in request bodies** — tenant scope comes from route + JWT only.

Optional header: `x-tenant-id` (Super Admin context switching).

## Lifecycle action endpoints (explicit transitions)

Do not change protected lifecycle fields through generic PATCH. Use dedicated endpoints:

| Entity | Endpoint | Action |
|--------|----------|--------|
| Lead | `POST /leads/:id/assign` | Assign owner |
| Lead | `POST /leads/:id/qualify` | Qualify |
| Lead | `POST /leads/:id/disqualify` | Disqualify |
| Lead | `POST /leads/:id/convert` | Convert qualified lead to opportunity |
| Activity | `POST /activities/:id/complete` | Mark complete |
| Opportunity | `POST /opportunities/:id/win` | Win deal |
| Opportunity | `POST /opportunities/:id/lose` | Lose deal |
| Opportunity | `POST /opportunities/:id/move-stage` | Stage transition |
| Quotation | `POST /quotations/:id/revisions` | New revision |
| Quotation doc | `POST …/documents/:docId/submit-approval` | Submit |
| Quotation doc | `POST …/documents/:docId/approve` \| `reject` | Approval (approve = commercial + customerApproval) |
| Quotation doc | `POST …/documents/:docId/mark-sent` | Mark sent |
| Quotation | `POST /quotations/:id/convert-to-sales-order` | Create sales order (convert-only) |
| Quotation template | `POST /quotation-templates/:id/duplicate` | Duplicate |
| Journal | `POST /accounting/journals/:id/submit` | Submit draft (approval or auto-approve) |
| Journal | `POST /accounting/journals/:id/approve` \| `send-back` \| `reject` | Approval decisions |
| Journal | `POST /accounting/journals/:id/post` | Post approved journal to GL |
| Journal | `POST /accounting/journals/:id/reverse` | Reverse posted journal (REVERSAL voucher) |
| Master | `POST /masters/:resource/:id/activate` | Activate |
| Master | `POST /masters/:resource/:id/deactivate` | Deactivate |

## Lookup endpoints

Lightweight read-only lists under `/t/:tenantSlug/lookups/`:

| Path | Notes |
|------|--------|
| `/lookups/{resource}` | Registry slugs only (`countries`, `states`, `cities`, `uom`, `warehouses`, `locations`, `item-categories`, `hsn-sac`, `gst-groups`, `gst-rates`, `products`) |
| `/lookups/items` | Dedicated item dropdown lookup |
| `/lookups/vendors` | Dedicated vendor dropdown lookup |

Used by transactional forms (`useItemLookup`, `useVendorLookup`). Cached via `lookupCache.ts`.

## Frontend client usage

```typescript
import { apiRequest, tenantPath } from './client'

// GET list
await apiRequest<Lead[]>(`${tenantPath('/crm/leads')}?page=1&limit=50`)

// POST create
await apiRequest<Lead>(tenantPath('/crm/leads'), {
  method: 'POST',
  body: JSON.stringify(payload),
})

// CSV / file download
await apiDownloadBlob(tenantPath('/crm/exports/leads'))
```

Session stored in `localStorage` key `fos-erp-auth`.

## Field naming: API ↔ frontend

Backend CRM DTOs often use **frontend-compatible aliases** (e.g. `customerName` → company `name`, `customerId` → `companyId`). Mapping documented in `FRONTEND_BACKEND_INTEGRATION.md`. When adding fields, update **both** validation schema and bridge mapper.
