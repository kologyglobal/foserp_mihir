# Phase 7D — Production, Quality & Dispatch Reporting

**Status:** Shipped (core) 2026-07-21 — **NEXT PHASE READINESS: READY WITH CONDITIONS**  
**Module:** `backend/src/modules/ops-reports/` + API-mode FE pages

## Gate

| Check | Result |
|-------|--------|
| Operational ledgers remain SoT | YES — reports read only |
| Tenant + permission enforced | YES |
| Server-side pagination/summary | YES |
| Shopfloor / control / WO / materials / WIP / JW | READY |
| Quality reports | READY (Incoming/supplier UNAVAILABLE) |
| Dispatch 7C0 fulfilment / performance | READY / PARTIAL |
| Delivery challan register | UNAVAILABLE (no challan model) |
| Cost / OEE | Not shown |
| Backend tests | `ops-reports-phase7d.test.ts` **13/13** |
| Frontend smoke | `test:manufacturing-phase7d` **64/64** |

## Architecture

- Report registry (`registry.ts`) + executors
- Common filters / timezone (tenant `timezone`)
- Saved views (`SavedReportView`)
- Exception actions (`OperationalExceptionAction`) — conditions remain derived
- CSV export (sync ≤ 10,000 rows)
- Routes: `/reports/manufacturing/*`, `/manufacturing/shopfloor/live`, `/manufacturing/traceability/*`, `/operations/exceptions`

## UNAVAILABLE / PARTIAL

| Report | Reason |
|--------|--------|
| `delivery-challans` | No DeliveryChallan model (Dispatch 7C0 only) |
| `supplier-quality` | No incoming GRN Quality |
| `invoice-readiness` | PARTIAL — readiness flags only; no invoice posting |
| `production-quality` | PARTIAL — first-pass acceptance labeled carefully |
| `dispatch-readiness` | Remaining qty based; FG stock join limited |

## Docs index

- `REPORTING_ARCHITECTURE.md`
- `REPORT_CATALOGUE.md`
- `REPORT_CALCULATION_RULES.md`
- `SAVED_VIEW_RULES.md`
- `REPORT_EXPORT_RULES.md`
- `SHOPFLOOR_LIVE_BOARD.md`
- `WIP_AGEING_RULES.md`
- `QUALITY_REPORTING_RULES.md`
- `DISPATCH_REPORTING_RULES.md`
- `END_TO_END_TRACEABILITY.md`
- `OPERATIONAL_EXCEPTION_CENTRE.md`
- `REPORT_PERFORMANCE_RESULTS.md`

## Deferred

OEE, finite scheduling, telemetry, SPC, data warehouse/BI, WIP valuation, profitability, Manufacturing GL activation, Sales Invoice creation, AI recommendations, full Dispatch 7C1–7C5 pick/pack/challan.

## Next

**PHASE 7E — Costing and Manufacturing Accounting Productionisation** (separate approval).
