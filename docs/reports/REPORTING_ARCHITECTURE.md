# Reporting Architecture (Phase 7D)

**Module:** `backend/src/modules/ops-reports/`
**Status:** Shipped (core) — READY WITH CONDITIONS

Phase 7D adds a read-only reporting layer over the existing manufacturing, quality and
dispatch operational ledgers. It **never** writes to those ledgers and **never** invents a
second source of truth. Every number is derived at query time from the live tables.

---

## Building blocks

| Piece | File | Responsibility |
|-------|------|----------------|
| **Registry** | `registry.ts` | Static metadata for every report (key, module, permission, columns, filters, `dateBasis`, `calculationNotes`, `availability`). No data access. |
| **Types** | `types.ts` | `ReportDefinition`, `ExecutorContext`, `ExecutorOutput`, `ReportResult`, `ReportAvailability` (`READY`/`PARTIAL`/`UNAVAILABLE`). |
| **Executors** | `executors/*.ts` + `executors/index.ts` | One async function per `READY`/`PARTIAL` report key. Reads Prisma, returns rows/summary/chart/warnings. Mapped by key in `REPORT_EXECUTORS`. |
| **Query service** | `query.service.ts` | Resolves definition → checks permission → parses filters → resolves timezone → runs executor → builds `ReportResult`. Short-circuits `UNAVAILABLE` reports before touching an executor. |
| **Catalog service** | `catalog.service.ts` | Lists reports the caller may see; `UNAVAILABLE` reports are returned with `disabled: true` (shown, not hidden, so the UI can explain why). |
| **Export service** | `export.service.ts` | CSV export reusing the same executor + filters (see `REPORT_EXPORT_RULES.md`). |
| **Filters** | `filters.ts` | Shared Zod schema for all reports; unknown keys are ignored, not rejected. |
| **Timezone** | `timezone.ts` | Resolves tenant `timezone` (default `Asia/Kolkata`) and converts wall-clock date filters to UTC ranges via `Intl` (no extra dependency). |
| **Response** | `response.ts` | `buildReportResult` / `buildUnavailableReportResult` + server-side pagination. |
| **Saved views** | `saved-views/` | Personal/shared/default per-report view persistence (`SavedReportView`) — see `SAVED_VIEW_RULES.md`. |
| **Shopfloor** | `shopfloor/` | Live board service + dedicated route — see `SHOPFLOOR_LIVE_BOARD.md`. |
| **Traceability** | `traceability/` | Cross-module search + lineage — see `END_TO_END_TRACEABILITY.md`. |
| **Exceptions** | `exceptions/` | Derived operational exceptions + `OperationalExceptionAction` workflow — see `OPERATIONAL_EXCEPTION_CENTRE.md`. |

---

## Request flow

```text
POST /reports/manufacturing/:reportKey/query
  → authenticate + attachRequestContext + resolveTenant + requireTenantAccess
  → findReportDefinition(reportKey)          (404 if unknown)
  → assertCanViewReport(definition, perms)   (403 if missing permission)
  → reportFiltersSchema.parse(body)
  → resolveTenantTimezone(tenantId)
  → if availability === 'UNAVAILABLE' → buildUnavailableReportResult (no executor)
  → REPORT_EXECUTORS[reportKey](ctx)
  → buildReportResult (paginate + attach metadata)
```

Every `ReportResult` carries: `columns`, `rows` (paginated), `pagination`, optional
`summary`/`groups`/`chartData`, `warnings`, `dataFreshness`, `allowedActions`, and
`availability`.

---

## Routes

Mounted under both `/api/v1/tenants/:tenantId/...` and `/api/v1/t/:tenantSlug/...`.

| Route | Purpose |
|-------|---------|
| `GET  /reports/manufacturing/catalog` | List permitted reports (incl. disabled ones). |
| `POST /reports/manufacturing/:reportKey/query` | Run a report (paginated). |
| `POST /reports/manufacturing/:reportKey/export` | CSV export (sync, ≤ 10,000 rows). |
| `GET/POST/PATCH/DELETE /reports/saved-views[...]` | Saved view CRUD + `set-default`. |
| `GET  /manufacturing/shopfloor/live` | Live shopfloor board (30s client poll). |
| `GET  /manufacturing/traceability/search` | Cross-module search. |
| `GET  /manufacturing/traceability/:entityType/:entityId` | Lineage graph. |
| `GET  /operations/exceptions` (+ `/summary`, `/:key/acknowledge|assign|resolve`) | Operational Exception Centre. |

---

## Source-of-truth (SoT) rules

1. **Operational ledgers stay SoT.** Reports read `ProductionOrder`, `ProductionOrderStage`,
   `DailyProductionBatch/Line`, `ProductionOrderMaterial`, `ProductionDowntime`,
   `ProductionIssue`, `JobWorkOrder`, `QualityInspection`, `QualityNcr`, `CrmSalesOrder`,
   `OutboundDispatch`, `SalesOrderLineFulfilment`, `ProductionFinishedGoodsReceipt`.
2. **No second warehouse / no parallel stock ledger.** Inventory remains the physical stock
   SoT. WIP reports show custody (issued − returned), not a competing stock balance.
3. **No mock KPIs.** There are no hard-coded, seeded, or placeholder metrics. Reports either
   compute from live data or declare `availability: UNAVAILABLE` / `PARTIAL` with a warning.
4. **No OEE / capacity-utilisation / cost KPIs** in Phase 7D (explicitly out of scope).
   Cost/manufacturing-accounting reporting stays flag-gated (Phase 6B / 7E).
5. **Tenant + permission enforced on every call**; `tenant.manage` is a super-permission.
6. **Server-side pagination & summary** — the executor computes the full bounded set, the
   response layer paginates. Executors cap unbounded scans (e.g. 3000–5000 rows) and emit a
   warning when the cap is hit.
