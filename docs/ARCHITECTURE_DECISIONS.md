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
