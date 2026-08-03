# Fuel Tank — UAT Checklist

## Model

**LOGICAL SFG under ONE FG WO** — `childProductionOrdersEnabled=false`, `wipTrackingMethod=LOGICAL_WIP`.  
SFG Job Cards (JC-SHELL … JC-TEST-FINISH) live on the parent FG work order. No SFG child WOs.

## Prerequisites

```bash
cd backend
npx tsx scripts/seed-fuel-tank-pilot-items.ts
npx tsx scripts/seed-fuel-tank-mfg-setup.ts
npx tsx scripts/test-fuel-tank-wo-execution.ts
```

Login: `admin@vasant-trailers.com` · Tenant: `vasant-trailers` · `VITE_USE_API=true`

## Factory golden path evidence (2026-07-28 re-run — MFG-GOLDEN-1)

**Command:** `npx tsx scripts/test-fuel-tank-wo-execution.ts`  
**WO:** `WO-000010` · **Serial:** `FT-5000L-52948875` · **FG receipt:** `FG-000002` · **FG warehouse:** `FG-MAIN`  
**Material cost (inventory ISSUE_TO_WO):** ₹111,020.00 · **WO actual total:** ₹111,020.00 · **FG receipt rate/value:** ₹111,020.00  

Prior PASS: 2026-07-27 (`WO-000009` / `FT-5000L-43550266`). See also [`../MFG_GOLDEN_PATH_TEST_RESULTS.md`](../MFG_GOLDEN_PATH_TEST_RESULTS.md).

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | One FG WO only | **PASS** | `WO-000010`; SFG WO create rejected (no profile); `generate-child-orders` → childCount=0 |
| 2 | SFG Job Cards generated correctly | **PASS** | 6 LOGICAL JCs on FG WO: JC-SHELL, JC-DISHED-END, JC-SADDLE, JC-NOZZLE, JC-FINAL-ASSEMBLY, JC-TEST-FINISH (15 ops) |
| 3 | Route Card tracking | **PASS** | Routing snapshot + stage/op progress through all JCs; opsWithWC=15/15 |
| 4 | Work Centre/Machine assignment | **PASS** | Assignment on OP-10 with WC + machine; accept/start |
| 5 | Material cost from Inventory Costing | **PASS** | 21 ISSUE_TO_WO movements valued; 21 `InventoryCostEntry` rows; materialCost=111020.00 (from stock rates, not invented) |
| 6 | QC gate (+ rework) | **PASS** | In-process QC PASS on all JCs; **REWORK then PASS** on JC-SHELL (`QI-000008`); Final QC `QI-000014` PASSED |
| 7 | Serial-numbered FG receipt | **PASS** | `FG-000002` serial `FT-5000L-52948875` → InventorySerial AVAILABLE @ FG-MAIN |
| 8 | WO actual cost | **PASS** | `POST …/cost/calculate` persist → actualMaterial=111020 total=111020 unit=111020 |
| 9 | FG valuation | **PASS** | FG_RECEIPT movement rate/value = WO `unitActualCost` (111020) |
| 10 | Closure | **PASS** | Close readiness COMPLETE ready; CLOSE purpose blocked (1); `POST …/complete` → **COMPLETED** |

### Setup / prior criteria (still green)

| # | Criterion | Result |
|---|-----------|--------|
| 1–3 | FG + SFG + RM/BO/CON items | PASS (25 items) |
| 4–8 | Multilevel BOM create / certify / read-only ACTIVE | PASS |
| 9–11 | Route auto-code `RT-000001`, PARALLEL, name editable while DRAFT | PASS |
| 12–16 | WC mandatory, Machine optional/filtered, time UOM, QC plans | PASS |
| 17–20 | Deps, certify, ACTIVE read-only | PASS |
| 21–24 | Profile + warehouses + readiness + active | PASS |
| 25–27 | FG WO only; SFG WO blocked; no child WOs | PASS |
| 28–32 | JC snapshot 6×15; parallel JC progress | PASS |
| 33–37 | QC / material / FG serial receipt / close | **PASS** (was PARTIAL; now covered by golden-path script) |
| 38–40 | Tenant isolation / permissions / API data | PASS |

## Manual UI spots

| Area | Path |
|------|------|
| Items | `/masters/items` → filter `FUEL` / `5000` |
| BOM | `/manufacturing/setup/boms` → `BOM-FUEL-TANK-5000L` |
| Route | `/manufacturing/setup/routings` → `RT-000001` |
| Profile | `/manufacturing/setup/profiles` → `MP-FUEL-TANK-5000L` |
| WO | `/manufacturing/work-orders` → `WO-000010` (or latest FG fuel tank WO) |

## Notes

- Opening stock for UAT is posted at each item’s `standardRate` so ISSUE_TO_WO inherits inventory costing rates/layers (no fake WO costs).
- FG serial receipt posts inventory with `serialNumber` (qty=1) so serial-tracked FG stock is created.
- Operational closure is status **COMPLETED** via `/complete` (enum `CLOSED` is reserved for later financial close paths).

## Decision

**FUEL TANK FACTORY GOLDEN PATH — PASS (READY FOR CONTROLLED PILOT)** — MFG-GOLDEN-1 2026-07-28
