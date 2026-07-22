# Report Export Rules (Phase 7D)

**Service:** `ops-reports/export.service.ts` · **Route:** `POST /reports/manufacturing/:reportKey/export`

Export is a **synchronous CSV** download that reuses the exact same executor, filters and
permission model as the on-screen report — so what you export always matches what you see.

---

## Format

- Output is CSV. A short header block precedes the data:
  - report title
  - `Generated At,<ISO timestamp>`
  - `Timezone,<tenant timezone>`
  - `Filters,<JSON of applied filters>`
  - `Warnings,<pipe-joined>` (only when the report emitted warnings)
  - `Row Count,<totalRows>`
  - blank line, then the column header row (using column labels), then one row per record.
- Values are CSV-escaped (quotes, commas, newlines handled); objects are JSON-stringified;
  null/undefined become empty strings.

## 10,000-row synchronous limit

- `EXPORT_SYNC_ROW_LIMIT = 10000`. Export runs the report with `pageSizeOverride = 10000`
  (page 1), i.e. a single bounded page rather than the UI's paginated page size.
- This is a **synchronous** cap for Phase 7D — there is no async/queued large-export job. If a
  result would exceed the executor's own scan caps (e.g. 3000–5000 rows) the report already
  emits a "narrow your filters" warning, which is preserved in the CSV header.

## Same filters, same permissions

- The export body is validated with the **same** `reportFiltersSchema` as `query`, so identical
  filters produce identical rows.
- **View permission** is enforced first (same `assertCanViewReport` as query).
- **Export permission** is enforced additionally via `assertCanExportReport`:
  - `tenant.manage` or `manufacturing.reports.export` may export any report;
  - `TRACEABILITY`-module reports may also be exported with `manufacturing.traceability.export`.
- Reports with `exportSupported = false` (the `UNAVAILABLE` reports `delivery-challans` and
  `supplier-quality`) reject export with `ReportExportNotSupportedError`.
