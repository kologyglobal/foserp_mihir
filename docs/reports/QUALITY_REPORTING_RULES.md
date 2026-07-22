# Quality Reporting Rules (Phase 7D)

Quality reports read `QualityInspection` and `QualityNcr` (Phase 4A/4B). There is **no incoming
GRN / supplier inspection source** in this build, so supplier quality is UNAVAILABLE.

Executors: `quality-dashboard.ts`, `quality-inspections.ts`, `production-quality.ts`,
`ncr-register.ts`, `rework-rejection.ts`.

---

## Quality Dashboard (`quality-dashboard`) — READY

- Counts of `QualityInspection` grouped by category/status and `QualityNcr` grouped by
  severity/status within the date range (`dateBasis: requestedAt`).

## Quality Inspections (`quality-inspections`) — READY

- One row per `QualityInspection` in range: decision, disposition, inspected/accepted/rejected/
  rework quantities, requested/decided timestamps.

## Production Quality / First-Pass Yield (`production-quality`) — PARTIAL

- `firstPassYieldPercent = acceptedQty / inspectedQty × 100`, aggregated per item.
- **Caveat:** decision-based, not rework-excluded. The schema captures the accepted/rework/
  rejected split at decision time but not whether an accepted unit passed on the first attempt
  without a prior rework loop. Directional, not audit-grade. (Marked `PARTIAL` in the registry.)

## NCR Register (`ncr-register`) — READY

- One row per `QualityNcr`. `ageDays = now − createdAt` for open NCRs; closed NCRs show age at
  closure.

## Rework & Rejection (`rework-rejection`) — READY

- Aggregated from `ProductionOrderStage` totals by product item + stage name; rates computed
  against `(good + rework + rejected + scrap)`.

## Supplier / Incoming Quality (`supplier-quality`) — UNAVAILABLE

- **Not implemented.** There is no GRN / incoming-inspection model in this build, so there is
  no source data. The catalog lists it as `disabled: true`; querying it returns an empty result
  with the reason:
  > "Supplier/incoming quality is not implemented. There is no GRN module in this build, so
  > there is no incoming-inspection source data to report on."
- **Do not present incoming/supplier QC as a live report.**
