# Architecture Decisions

Format: **Decision / Reason / Impact / Alternatives rejected / Date**

---

## ADR-001: Dual-mode frontend (demo + API)

**Decision:** Single React app with `VITE_USE_API` flag toggling between Zustand demo stores and backend API hydration.

**Reason:** ERP has 40+ demo modules; building full backend incrementally without blocking UI demos or UAT scripts.

**Impact:** Bridge pattern required for writes; API mode must not merge seed data; two test surfaces (demo scripts vs live API tests).

**Alternatives rejected:** Separate demo/prod apps (maintenance burden); immediate full backend (too slow for CRM-first delivery).

**Date:** 2026-07 (inferred from codebase)

---

## ADR-002: Tenant slug routes as primary API alias

**Decision:** Frontend uses `/api/v1/t/:tenantSlug/…`; backend mirrors same handlers under `/api/v1/tenants/:tenantId/…`.

**Reason:** Human-readable URLs; slug in JWT session; avoids exposing UUIDs in browser paths.

**Impact:** `tenantPath()` helper; `resolveTenant` middleware resolves slug → id; both param shapes validated by `tenantRouteParamSchema`.

**Alternatives rejected:** Subdomain-only tenancy (DNS complexity); tenant id only in paths (poor UX).

**Date:** 2026-07-10

---

## ADR-003: UUID primary keys

**Decision:** All entities use `@id @default(uuid())` string UUIDs.

**Reason:** Safe for distributed creation, no sequential leakage, consistent across modules.

**Impact:** Frontend must treat ids as UUID strings; FK validation uses uuid Zod schemas.

**Alternatives rejected:** Auto-increment integers (tenant merge conflicts); ULID (team familiarity with UUID).

**Date:** 2026-07-10

---

## ADR-004: Soft delete via `deletedAt`

**Decision:** Business records soft-delete with nullable `deletedAt`; queries filter `deletedAt: null`.

**Reason:** Audit trail, recovery, referential safety in ERP context.

**Impact:** `tenantActiveFilter()` helper; delete endpoints set timestamp not row removal.

**Alternatives rejected:** Hard delete (data loss); `isDeleted` boolean (less audit-friendly).

**Date:** 2026-07-10

---

## ADR-005: Permission-based RBAC (not role-only)

**Decision:** Global `permissions` table; roles map via `role_permissions`; routes use `requirePermission('module.action')`.

**Reason:** Fine-grained control across CRM + masters; Super Admin via `tenant.manage`.

**Impact:** 140+ permission strings seeded; frontend mirrors with `canCrmPermission()` / session permissions.

**Alternatives rejected:** Role-name checks in code (fragile); ABAC (overkill for current scope).

**Date:** 2026-07-10

---

## ADR-006: CRM API bridge instead of direct store→fetch

**Decision:** `crmApiBridge.ts` wraps API calls, maps DTOs to frontend types, updates Zustand slices.

**Reason:** Keeps page components store-agnostic; centralizes field mapping and submit locks.

**Impact:** New CRM writes must go through bridge; demo mode continues using store actions directly.

**Alternatives rejected:** React Query everywhere (large refactor); pages calling `crmApi` directly (mapping duplication).

**Date:** 2026-07-10

---

## ADR-007: Polymorphic CRM notes & attachments

**Decision:** `crm_notes` and `crm_attachments` use `entityType` enum + `entityId`; routes under `/crm/entities/:entityType/:entityId/…`.

**Reason:** One CRUD implementation for all CRM 360 pages; consistent permissions (`crm.note.*`, `crm.attachment.*`).

**Impact:** Supported types: COMPANY, CONTACT, LEAD, OPPORTUNITY, ACTIVITY, FOLLOW_UP, QUOTATION.

**Alternatives rejected:** Per-entity note tables (schema bloat); JSON blob on parent row (no history/permissions).

**Date:** 2026-07-10 (updated 2026-07-13: QUOTATION added for Quotation 360 notes/attachments)

---

## ADR-008: Master data registry pattern

**Decision:** `master.registry.ts` drives generic CRUD for geography/UOM/warehouse/location/category/HSN/GST routes.

**Reason:** DRY for 10 similar master resources; consistent permission naming `master.{resource}.{action}`.

**Impact:** Items and vendors have dedicated modules (complex validation/FKs) outside registry.

**Alternatives rejected:** One mega controller per resource copy-paste; GraphQL (team stack is REST).

**Date:** 2026-07-10

---

## ADR-009: MySQL + Prisma migrate

**Decision:** MySQL 8 with Prisma ORM; migrations in `backend/prisma/migrations/`.

**Reason:** Client requirement; Prisma type safety; Workbench compatibility.

**Impact:** Live tests require MySQL; `db:setup` for fresh environments.

**Alternatives rejected:** PostgreSQL (client infra); raw SQL only (slower iteration).

**Date:** 2026-07-10

---

## ADR-010: JWT access + refresh rotation

**Decision:** Short-lived access token (15m default) + refresh token stored hashed in DB; frontend auto-refresh on 401.

**Reason:** Stateless API scaling; revocable sessions; standard SPA pattern.

**Impact:** `client.ts` refreshPromise deduplication; logout revokes refresh token.

**Alternatives rejected:** Session cookies only (cross-origin complexity); long-lived access tokens (security).

**Date:** 2026-07-10

---

## ADR-011: CRM-first backend scope

**Decision:** Transactional ERP modules (PO, WO, inventory txn, finance) remain frontend-demo until explicitly scoped.

**Reason:** CRM + masters unblock sales pipeline; manufacturing modules are large separate phases.

**Impact:** Documented as "Deferred by design" in PROJECT_STATUS; no false "complete" labels.

**Alternatives rejected:** Big-bang backend (high risk); dropping demo modules (loses UAT value).

**Date:** 2026-07 (product direction)

---

## ADR-012: Standard API response envelope

**Decision:** All JSON responses use `{ success, message, data, meta?, errors? }`.

**Reason:** Predictable client parsing; pagination in `meta`; validation errors in `errors[]`.

**Impact:** `apiRequest()` throws `ApiError` when `success === false`.

**Alternatives rejected:** Raw REST bodies (inconsistent errors); GraphQL errors array.

**Date:** 2026-07-10

---

## ADR-013: CRM live E2E gated by env flag

**Decision:** `crm-e2e.test.ts` and `crm-tenant-isolation.test.ts` skip unless `RUN_CRM_E2E=true` (set by `npm run test:crm-live`).

**Reason:** CI/dev without MySQL should not fail; live suite validates real DB workflows.

**Impact:** Skipped tests are **not** counted as passed in TESTING_STATUS.

**Alternatives rejected:** Mock Prisma in E2E (misses real SQL constraints); always require MySQL (blocks contributors).

**Date:** 2026-07-10

---

## ADR-014: Attachment local filesystem storage

**Decision:** CRM attachments stored on disk (`CRM_UPLOAD_DIR`); DB holds metadata + `storageKey`.

**Reason:** Simple MVP; no S3 dependency for local dev.

**Impact:** Production will need storage migration strategy (future ADR).

**Alternatives rejected:** DB BLOB (size/backup issues); immediate S3 (ops overhead).

**Date:** 2026-07-10

---

## ADR-015: Quotation schema ahead of API (in progress)

**Decision:** `CrmQuotation` / `CrmQuotationDocument` models added to Prisma schema; export/report services reference them; **no migration or CRUD routes yet**.

**Reason:** Prepare for quotation backend phase; export/report queries designed early.

**Impact:** Quotation export API will fail until migration applied; frontend quotations remain demo-only.

**Alternatives rejected:** Remove schema until ready (delays report design).

**Date:** 2026-07-11 (verified schema/migration drift)

**Status:** Superseded by ADR-016 — migration and export/report paths now live; CRUD still pending.

---

## ADR-016: Quotation tables + server export before CRUD

**Decision:** Ship `crm_quotations` / `crm_quotation_documents` migration and server-side export/report endpoints before quotation CRUD APIs.

**Reason:** Unblock reporting and list CSV export in API mode without waiting for full editor/lifecycle backend.

**Impact:** `GET /crm/exports/quotations` and report IDs `quotation-revision`, `quotation-approval` work against MySQL; list/editor/360 still read Zustand until P0-2.

**Alternatives rejected:** Block all quotation backend until full CRUD (delays export parity).

**Date:** 2026-07-11

---

## ADR-017: Dashboard chart series in metrics payload

**Decision:** Extend existing `GET /crm/dashboard/metrics` with a `charts` object rather than separate chart endpoints.

**Reason:** Single fetch for KPIs, panels, and chart series; matches frontend overlay pattern.

**Impact:** `dashboard-charts.service.ts` aggregates pipeline/funnel/trend/urgency/owner series; `CrmDashboardPage` uses `buildCrmDashboardChartSeries()` in API mode with store fallback in demo mode.

**Alternatives rejected:** Per-chart endpoints (extra round-trips); client-side aggregation from raw store (inaccurate in API mode).

**Date:** 2026-07-11

---

## ADR-018: Entity notes on 360 pages with activity/follow-up drawers

**Decision:** Reusable `EntityNotesPanel` + `CrmEntityDetailDrawer` for entity-scoped notes; `demoNotes` / `demoOnly` for legacy fields when API entity type missing.

**Reason:** Consistent notes UX across lead, opportunity, contact, company, and quotation 360 pages in both demo and API modes.

**Impact:** Activity/follow-up rows expose Notes buttons opening drawer; quotation 360 uses native `QUOTATION` entity notes/attachments in API mode (`demoNotes` / demo docs in demo mode).

**Alternatives rejected:** Inline-only legacy text panels (no API parity).

**Date:** 2026-07-11 (updated 2026-07-13: QUOTATION entity type shipped)

---

## ADR-019: Backend shared layer + quotations under CRM

**Decision:** Introduce `backend/src/shared/` for cross-module Prisma/audit/user helpers; keep quotations as a CRM submodule at `modules/crm/quotations/` with DTO types in `quotation.types.ts` and Prisma mapping in `quotation.mapper.ts`. Retain `crm.shared.ts` as a compat shim re-exporting from `shared/` until Phase 11 cleanup.

**Reason:** Aligns with `BACKEND_FOLDER_STRUCTURE.md` entity pattern without splitting CRM API surface or frontend quotation routes. Shared helpers reduce duplication across CRM entities while domain ownership stays in `modules/crm/`.

**Impact:**
- Canonical imports: `../../shared/index.js` (new code); existing `crm.shared.ts` imports still work
- Quotation routes remain `/api/v1/t/:tenantSlug/crm/quotations/*`
- `test:backend-structure` enforces layout; deferred moves (`utils/` → `shared/http/`) documented in `BACKEND_SHARED_CONSOLIDATION.md`

**Alternatives rejected:** Top-level `modules/quotations/` (breaks CRM permission namespace and frontend bridge); inline mappers in `quotation.types.ts` (file grew too large); moving all `utils/` in one PR (high import churn).

**Date:** 2026-07-11

---

## ADR-020: Canonical Production route `/manufacturing/*` (Proposed)

**Decision:** Keep `/manufacturing/*` as the canonical Production shell and future API mount prefix. Retain legacy redirects from `/production` hubs, `/work-orders` list, and `/job-work` list. Do not rename existing routes during implementation phases.

**Reason:** Nav, `MANUFACTURING_SIMPLE.md`, and route modules already standardize on manufacturing; renaming would break bookmarks and demo scripts without benefit.

**Impact:** New backend under `/api/v1/t/:tenantSlug/manufacturing/…`; permission namespace prefers `manufacturing.*` with `production.*` view aliases.

**Alternatives rejected:** Move everything to `/production/*` (churn); dual primary navs (confusion).

**Date:** 2026-07-20  
**Status:** Accepted (Phase 1 implemented 2026-07-20)

---

## ADR-021: Generic discrete-manufacturing engine (Proposed)

**Decision:** One Manufacturing Profile + BOM/routing/Production Order engine for MTS/MTO/ATO/ETO/job shop/repetitive/project and all reference products (trailer, pump, panel, bracket, machined part). No trailer-specific schema or code branches.

**Reason:** FOS targets Indian discrete manufacturers broadly; 45 M³ trailer is template #1 only.

**Impact:** Profile type + master data express variance; acceptance tests must include non-trailer fixtures.

**Alternatives rejected:** Trailer-first hardcoded stages; separate modules per industry.

**Date:** 2026-07-20  
**Status:** Accepted for masters (Phase 1); Production Order portion remains Phase 2

---

## ADR-022: Manufacturing Profile as process template (Proposed)

**Decision:** Introduce `ManufacturingProfile` binding finished item to default BOM, routing, quality plan ref, execution mode (Simple|Detailed), and demand style.

**Reason:** Avoid rebuilding process setup per Work Order; supports multiple manufacturing modes without UI forks.

**Impact:** WO create resolves active profile → BOM/routing; overrides permission-gated.

**Alternatives rejected:** WO-only ad-hoc operations without reusable template.

**Date:** 2026-07-20  
**Status:** Accepted (Phase 1 implemented 2026-07-20)

---

## ADR-023: BOM and routing version snapshots on release (Proposed)

**Decision:** On Production Order release, copy active BOM/routing versions into immutable snapshots. Later master edits do not change open orders.

**Reason:** Matches demo Route Master behavior and auditability for shopfloor.

**Impact:** Snapshot tables; activate masters separately from open WO execution.

**Alternatives rejected:** Live join to master BOM (unstable mid-job).

**Date:** 2026-07-20  
**Status:** Accepted for master versioning (Phase 1); WO snapshot on release remains Phase 2

---

## ADR-024: Stage groups vs detailed operations (Proposed)

**Decision:** Support both `ManufacturingStageGroup` (Simple mode / labour UX) and detailed `ManufacturingRoutingOperation` (Detailed mode). Dependencies allow parallel paths.

**Reason:** Supervisors need coarse stages; machining/job shop needs fine ops; trailer needs parallel fabrication.

**Impact:** Execution mode on profile/settings; daily update can target stage or op.

**Alternatives rejected:** Operations-only (too heavy for labour); stages-only (too coarse for machining).

**Date:** 2026-07-20  
**Status:** Accepted (Phase 1 implemented 2026-07-20)

---

## ADR-025: Logical vs stocked WIP (Proposed)

**Decision:** Production owns stage quantity ledger (logical WIP / intent). Inventory owns physical stock including optional WIP warehouses. No second stock ledger in Production.

**Reason:** Prevents double-counting and valuation drift; aligns with existing demo inventory SoT rule.

**Impact:** WIP movement posts intent then Inventory movement when Inventory backend exists.

**Alternatives rejected:** Production-maintained on-hand balances.

**Date:** 2026-07-20  
**Status:** Proposed

---

## ADR-026: Production stage ledger (Proposed)

**Decision:** Append-only `ProductionStageLedger` for good/rework/reject/scrap and stage transfers inside Production.

**Reason:** Enables negative-WIP prevention and audit without requiring Inventory for Phase 2 visibility.

**Impact:** Daily updates write ledger in a transaction with idempotency keys.

**Alternatives rejected:** Mutable counters only (weak audit).

**Date:** 2026-07-20  
**Status:** Proposed

---

## ADR-027: Inventory ownership of physical stock (Proposed)

**Decision:** Reservation, issue, return, FG/SFG/scrap stock quantities and batch/serial/heat are Inventory-owned. Production requests and stores references.

**Reason:** Single SoT for warehouse balances and valuation.

**Impact:** Phase 3A delivers Inventory ledger APIs; Phase 3C Production materials consume them. Without Inventory, Production materials stay pending.

**Alternatives rejected:** Embedding stock movements only in manufacturing module.

**Date:** 2026-07-20  
**Status:** Accepted (Phase 3A inventory ledger implemented 2026-07-20)

---

## ADR-028: Quality ownership outside Production (Accepted — Phase 4A)

**Decision:** Quality owns plans, inspections, dispositions, NCR. Production stores links and enforces holds via blockers. Do not duplicate QC workflow tables in Production.

**Reason:** Incoming, in-process, and final QC share one engine (demo already patterns this).

**Impact:** Phase 4A Quality API + mandatory hold blocks dependent ops and WO completion.

**Alternatives rejected:** QC fields hard-coded only on WO without Quality module.

**Date:** 2026-07-20  
**Status:** Accepted (Phase 4A inspections + NCR foundation shipped 2026-07-20)

---

## ADR-029: Sales Order demand conversion (Proposed)

**Decision:** Only `confirmed` Sales Orders may convert. Partial conversion allowed with remaining qty tracking on `ProductionDemand`. Multiple WOs per line allowed until remaining is zero. Idempotent convert keys prevent duplicates.

**Reason:** CRM Phase 1 has confirm/close but no fulfilment qtys; Production must not over-commit.

**Impact:** Extend SO soft status toward `in_production`; optionally normalize SO lines later.

**Alternatives rejected:** Convert from draft SO; unlimited convert without remaining.

**Date:** 2026-07-20  
**Status:** Accepted (Phase 2A implemented 2026-07-20)

---

## ADR-030: Purchase Requisition from Production shortage (Proposed)

**Decision:** Production shortages create Purchase Requisitions (not POs) by default, carrying WO/stage/BOM line/item/qty/date/warehouse/SO/project/priority references. Direct PO remains Purchase-settings controlled.

**Reason:** Matches demo `createPurchaseRequisitionFromShortageDemo` and procurement control.

**Impact:** Phase 3 depends on Purchase PR API; Production shows procurement status read-only.

**Alternatives rejected:** Auto-create PO from shopfloor.

**Date:** 2026-07-20  
**Status:** Accepted (Phase 3B PR API implemented 2026-07-20)

---

## ADR-031: Manufacturing accounting deferral (Proposed)

**Decision:** Persist `ProductionAccountingEvent` rows with idempotency keys; call `posting.service.post()` **only** when `FinanceFeatureKey.MANUFACTURING_ACCOUNTING` is enabled for the legal entity (default off). Mapping keys WIP/FG/RM/scrap used for MappingReady events. Flag off = events only (`SKIPPED_FLAG_OFF`).

**Reason:** Posting engine is production-ready; manufacturing valuation (`rate`/`value`) is still thin — fail closed on missing mappings when flag on.

**Impact:** Phase 6B shipped; demo `/accounting/manufacturing/*` remains non-GL until FE hydration. See `PRODUCTION_PHASE6B_README.md`.

**Alternatives rejected:** Post GL on every material issue without a flag; invent a parallel posting engine.

**Date:** 2026-07-20  
**Status:** Accepted (Phase 6B)

---

## ADR-037: Material issue semantics — WO custody (Accepted — Phase 7A)

**Decision:** `ISSUE_TO_WO` is **direct warehouse stock issue to Work Order custody**. On-hand decreases immediately; material becomes WO responsibility. It is **not** an RM→Production warehouse transfer that leaves stock unrestricted.

**Reason:** Matches current `postIssueToWorkOrder` / signed ISSUE movements; Stage Ledger consumption must not post a second physical stock-out.

**Impact:** Reconciliation = Issued − Returned − Transferred Out (held/unconsumed). Stocked WIP uses separate `WIP_TRANSFER` paths. See `docs/manufacturing/MATERIAL_ISSUE_SEMANTICS.md`.

**Alternatives rejected:** Redefining issue as warehouse transfer without migration of historical movements.

**Date:** 2026-07-21  
**Status:** Accepted (Phase 7A)

---

## ADR-038: Reporting reads operational ledgers, no second SoT (Accepted — Phase 7D)

**Decision:** Phase 7D manufacturing/quality/dispatch reporting (`backend/src/modules/ops-reports/`) is a **read-only** layer over the existing operational ledgers. Reports compute every metric at query time from the live tables and never persist derived aggregates. There is **no second warehouse and no parallel stock ledger** — Inventory stays the physical stock SoT; WIP reports show custody (issued − returned), not a competing balance. When the source foundation is missing, a report declares `availability: UNAVAILABLE` (empty result + reason) rather than fabricating data; incomplete-but-computable reports declare `PARTIAL` with a caveat. Cost / manufacturing-accounting reporting stays **flag-gated** (Phase 6B / 7E), and no OEE / capacity-utilisation KPIs are produced.

**Reason:** Preserve auditability and a single source of truth; ship honest visibility without pretending to have modules (GRN incoming QC, Delivery Challan, invoicing) that do not exist in this build.

**Impact:** `delivery-challans` and `supplier-quality` are `UNAVAILABLE`; `invoice-readiness` and `production-quality` are `PARTIAL`. Exceptions are derived live (workflow-only `OperationalExceptionAction`); traceability follows real FKs only. Docs under `docs/reports/`.

**Alternatives rejected:** Persisting a reporting warehouse / KPI cube; hard-coded or seeded placeholder KPIs; enabling cost KPIs before Phase 7E; drawing traceability links that no FK supports.

**Date:** 2026-07-21  
**Status:** Accepted (Phase 7D)

---

## ADR-032: Simple vs Detailed execution mode (Proposed)

**Decision:** Default Simple mode (stage-focused, optional auto-consumption, WO-centric actions). Detailed mode unlocks per-op times, explicit issues, runtime change workflows via profile/settings.

**Reason:** Labour UX must stay simple; advanced users need depth without a second product.

**Impact:** Settings + profile `executionMode`; UI progressive disclosure.

**Alternatives rejected:** Always-detailed MES screens for all roles.

**Date:** 2026-07-20  
**Status:** Accepted (Phase 1 profile field; Phase 2B Simple/Detailed UX via assignments + Daily Update)

---

## ADR-033: Single progress path for supervisor and operator (Accepted)

**Decision:** Daily Production batch lines and operator task completion both post exclusively through `recordProgress` / `correctProgress` (Phase 2A Stage Ledger). Assignment and Daily Production services never update Stage totals directly.

**Reason:** Avoid two disconnected production quantity systems; preserve auditability and dependency readiness.

**Impact:** Atomic batch submit uses optional transaction client on progress service; corrections always reverse+repost.

**Alternatives rejected:** Separate supervisor totals table; direct Stage column updates from Daily Production controller.

**Date:** 2026-07-20  
**Status:** Accepted (Phase 2B)

---

## ADR-034: Soft Shift and Employee references in Phase 2B (Accepted)

**Decision:** Use `shiftCode`/`shiftLabel` and optional string `employeeId` without FK until HR Shift/Employee masters exist. Operator identity for auth is `userId` (User).

**Reason:** Do not build an HR module inside Production Phase 2B; keep fields migratable to FKs later.

**Impact:** Documented temporary soft references; unique active-assignment checks use shiftCode when present.

**Alternatives rejected:** Full Shift master in 2B; inventing a parallel Operator master.

**Date:** 2026-07-20  
**Status:** Accepted (Phase 2B)

---

## ADR-035: Manufacturing-local runtime change approval (Accepted — Phase 5A)

**Decision:** Work Order runtime changes (`ProductionRuntimeChange`) use manufacturing-local submit → approve/reject → apply, gated by `ManufacturingRuntimeChangeRule` and `manufacturing.runtime_change.*` permissions. Do **not** register runtime changes on Finance `ApprovalDocumentType` or create `FinanceApprovalRequest` rows.

**Reason:** Runtime changes are shop-floor exceptions with production risk/tolerance rules, not GL document approvals. Reuse the *pattern* (request → decide → apply) without coupling Production to Finance approval workspace.

**Impact:** Approve/reject live under `/manufacturing/work-orders/:id/runtime-changes/...`. Finance approval UI stays unchanged. Rules seed per tenant on first risk evaluation.

**Alternatives rejected:** Extending Finance approval document types for RC-*; dual-writing finance + manufacturing approvals.

**Date:** 2026-07-20  
**Status:** Accepted (Phase 5A)

---

## ADR-036: Manufacturing corrections use compensating transactions (Accepted — Phase 5C)

**Decision:** Posted Production/Inventory/Job Work documents are never edited or deleted. Corrections create a `ManufacturingTransactionCorrection` request, optional manufacturing-local approval, compensating domain transactions, and `ManufacturingTransactionReversalLink` rows. Reuse Finance’s *pattern* (append reverse + link + idempotency), not Finance posting/approval engines or GL.

**Reason:** Preserve auditability and keep Inventory/Stage Ledger as SoT while allowing controlled operational fixes.

**Impact:** APIs under `/manufacturing/corrections`. Quality decisions are superseded, not overwritten. WO split correction blocked until split ships. No cascade reverse.

**Alternatives rejected:** In-place quantity updates; FinanceApprovalDocumentType for shop-floor corrections; silent cascade.

**Date:** 2026-07-20  
**Status:** Accepted (Phase 5C)

---

## ADR-039: Manufacturing costing reuses DefaultAccountMapping; movement-value costing; central posting only (Accepted — Phase 7E)

**Decision:** Manufacturing costing/accounting (`backend/src/modules/manufacturing/costing/` + `accounting/`) resolves **all** GL accounts through the finance **`DefaultAccountMapping`** table — there is **no parallel `ManufacturingAccountMapping` table**. Actual **material cost is read from `InventoryStockMovement.value`**; when a movement value is ≤ 0 a **provisional fallback** (`|quantity| × item.standardRate`) is used and the cost is flagged provisional (never rewriting the underlying movement). GL is posted **only** through the central finance `post()` engine via idempotent `ProductionAccountingEvent` rows and `DefaultAccountMapping` debit/credit key pairs. The `MANUFACTURING_ACCOUNTING` `FinanceFeatureControl` flag is **off by default** per legal entity; costing works without it, and posting (absorption/variance/close) is **manual**. Shop-floor auto-posting exists in code but is gated by the flag (Stage 4 auto not enabled).

**Reason:** Keep one account-mapping source of truth and one posting engine so manufacturing GL cannot drift from finance; ship honest costing over a thin inventory valuation layer (no moving-average/FIFO engine) instead of inventing valuation; fail safe with the flag off until a controlled pilot.

**Impact:** Phase 7E ships costing policies, WO cost snapshots/entries, readiness, manual post/retry, proportional FG capitalisation, financial-close residual variance, and compensating `MANUFACTURING_REVERSAL`. **READY FOR MANUAL ACCOUNTING PILOT.** `STANDARD_WITH_VARIANCE` costing, variance decomposition, COGS/Delivery Challan/Sales Invoice, payroll, ABC and OEE remain deferred. Docs under `docs/manufacturing/` (`PRODUCTION_PHASE7E_README.md` + costing/policy/material/labour/job-work/WIP/FG/variance/posting/mapping/reversal/flag/reconciliation).

**Alternatives rejected:** A parallel `ManufacturingAccountMapping` table; a manufacturing-owned posting/GL path; a moving-average/standard-cost revaluation engine invented inside manufacturing; enabling auto-posting by default.

**Date:** 2026-07-21  
**Status:** Accepted (Phase 7E)

---

## ADR-040: Packing as operational allocation (Accepted — Dispatch Phase 7C3)

**Decision:** Packing uses **PACKING_AS_OPERATIONAL_ALLOCATION**. Pack / unpack / move allocate picked goods into packages via append-only packing events and package lines. They do **not** change Inventory on-hand, create stock movements, consume reservations, update Sales Order fulfilment, or create Delivery Challans. Authoritative packable qty = net picked − net packed. Soft lot/serial/heat refs only until Inventory tracking masters ship.

**Reason:** Indian discrete manufacturing needs verified package identity before challan/posting, without premature stock-out or fake fulfilment.

**Impact:** Models under `DispatchPackingSession` / `DispatchPackage*`; 7C0 confirm gated when packing incomplete or mismatched; Phase 7C4 challan and 7C5 post remain separate.

**Alternatives rejected:** Staging warehouse transfer on pack; packing that posts FG_DISPATCH; treating reserved qty as packed; packing that updates SO dispatched qty.

**Date:** 2026-07-21  
**Status:** Accepted (Phase 7C3)

---

## ADR-041: Delivery Challan as document only (Accepted — Dispatch Phase 7C4)

**Decision:** Delivery Challans use **DELIVERY_CHALLAN_AS_DOCUMENT_ONLY**. Draft/review/issue/print capture immutable business snapshots from verified packing. Issuance does **not** post Inventory, consume reservations, update Sales Order fulfilment, or create Accounting entries. Official numbers use **NUMBER_ON_ISSUE**. Pilot document storage is immutable HTML (browser print for PDF). Phase 7C5 owns FG_DISPATCH + fulfilment.

**Reason:** Indian manufacturing needs an auditable movement document before stock-out without premature fulfilment or GL.

**Impact:** `DeliveryChallan*` models; 7C0 confirm gated when a challan exists until ISSUED + qty match; workbench challan queues.

**Alternatives rejected:** Treating challan issue as stock-out; inventing challan qty from reservation/pick; e-Way API verification claims.

**Date:** 2026-07-21  
**Status:** Accepted (Phase 7C4)
