# CRM Gap Analysis

## Critical gaps

| Gap | Impact | Recommendation |
|-----|--------|----------------|
| Notes / attachments | Users cannot persist comments/files in API mode | Add `crm_notes`, `crm_attachments` tables + CRUD |
| CRM masters in API mode | Hardcoded dropdowns (sources, lost reasons, etc.) | Backend master module or extend pipeline seed |
| Bulk lead operations | N+1 API calls from UI | `POST /leads/bulk-assign`, bulk status |
| Opportunity PATCH bypass | Can win/lose via PATCH | Add workflow sanitizer like leads |
| Export APIs | Export buttons may be client-only | `GET /crm/exports/:entity` |
| Global search UI | Backend exists, no header integration | Wire AppShell search to `/crm/search` — **done** |
| ~~Dashboard chart / quotation approval panels~~ | ~~Still computed from synced store~~ | **Closed (P1-3 / P1-3b):** `GET /crm/dashboard/metrics` → `charts` + `panels.pendingApprovalQuotations`; demo keeps store derivation |
| Lead reopen / archive | UI may expose but no backend | Add lifecycle endpoints if designed |
| Opportunity stage/amount history | Not persisted | History tables + GET endpoints |
| Duplicate detection / merge | Not implemented | Phase 2 enhancement |

## Medium gaps

| Gap | Notes |
|-----|-------|
| Frontend `sales.*` permissions on some CRM pages | Migrate to `canCrmPermission()` |
| Mobile call/WhatsApp | Opens native/tel links — acceptable |
| Company 360 linked counts | Computed client-side after sync |
| Average sales cycle metric | Not in dashboard API yet |
| Owner-wise performance report | Partial via lead-owner report |
| Role seed on existing DBs | Re-run seed or migration for new crm.dashboard.view perms |

## Intentionally out of scope (per project direction)

- Purchase / inventory / production / quality / finance **transaction backends** (deferred ERP)
- Sales-order fulfilment beyond Phase 1 confirm/close (MRP / dispatch / invoice)
- ~~Quotation backend~~ / ~~SO convert backend~~ — **shipped** (see `PROJECT_STATUS.md`)

## Demo mode preservation

All gaps above affect **API mode only**. Demo mode (`VITE_USE_API=false`) continues using Zustand stores and local mock data unchanged.

## Completion criteria tracking

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Every designed CRM page works in API mode | Mostly — admin UIs / some masters gaps; commercial CRM path Working |
| 2 | Every write action works | Mostly — bulk/history gaps |
| 3 | Dashboard uses backend metrics | **Yes** — KPIs + panels (incl. quotation approval) + charts from `/dashboard/metrics` |
| 4 | Reports use backend APIs | Yes for 14 reports |
| 5 | Mobile uses same backend | Yes via sync |
| 6 | Hardcoded arrays removed in API mode | Masters still hardcoded |
| 7 | Permissions FE + BE | In progress |
| 8 | Tenant isolation tests | Started |
| 9 | Lead-to-win/lost E2E | Partial in crm-e2e.test.ts |
| 10 | Notes/attachments | **Done** |
| 11 | Import/export | **Done** (import + `runCrmExport`) |
| 12 | Builds pass | Verify each release |
| 13 | Demo unchanged | Yes |
| 14 | Data persists after refresh | Yes for API-backed entities |
