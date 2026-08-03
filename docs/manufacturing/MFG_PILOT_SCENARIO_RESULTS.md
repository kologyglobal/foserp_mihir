# MFG Pilot Scenario Test Results — 2026-07-29

**Tenant:** `vasant-trailers`  
**Command:** `npx tsx scripts/test-fuel-tank-pilot-scenarios.ts`  
**Result:** **PASS** (21/21 steps)

| Scenario | Coverage | Result |
|----------|----------|--------|
| F | `partialCompletionAllowed=true` (qty-3 SPA still manual) | PASS |
| H | Hold (MATERIAL) → Resume | PASS |
| B | Shortage on RM-MS-PLATE-006 → `PR-000010` `PRODUCTION_SHORTAGE` | PASS |
| E | Issue 50 → return 10; stock + returnedQty; InventoryCostEntry | PASS |
| I | Confirmed SO → Demand `PD-000004` → WO `WO-000038` `SALES_ORDER` | PASS |
| D | FG serial AVAILABLE @ FG-MAIN (e.g. `FT-5000L-52948875`); onHand=2 | PASS |

## Code fix shipped with pilot

Material **return** now accepts `batchId` / `batchNumber` for batch-tracked RMs (parity with issue). Without this, Fuel Tank plate returns failed with “Batch number is required”.

## Still open (human SPA)

- Full UI walk A1–A9 (`MFG_PILOT_SPA_UAT_CHECKLIST.md`)
- Partial FG qty 3 → receive 1 (profile flag proven; execution SPA)
- Adjacent: Inventory Costing SPA / Purchase return→AP / Dispatch client sign-off

## Happy path (prior)

`test-fuel-tank-wo-execution.ts` — PASS 2026-07-28 (`WO-000010`).
