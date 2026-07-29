# Fuel Tank Golden Path — MFG-GOLDEN-1

> Product: **FG-FUEL-TANK-5000L** · Model: **ONE FG WO + LOGICAL SFG Job Cards**  
> Detail masters: [`examples/FUEL_TANK_*.md`](examples/) · Audit: [`MFG_GOLDEN_PATH_AUDIT.md`](MFG_GOLDEN_PATH_AUDIT.md)

---

## Chain (must prove)

```text
Sales Order / Manual Demand
  → FG Work Order (qty 1 NOS)
  → Release (BOM + Route snapshots)
  → Job Cards JC-SHELL … JC-TEST-FINISH
  → Material reserve / issue (Inventory Cost Entry)
  → Parallel stage execution + QC
  → Final Assembly (deps) + Final QC
  → FG serial receipt @ WO unitActualCost
  → Close readiness → COMPLETED (operational)
```

---

## Setup keys

| Master | Code |
|--------|------|
| FG | `FG-FUEL-TANK-5000L` |
| SFGs | `SFG-TANK-SHELL-5000L`, `SFG-DISHED-END-5000L`, `SFG-SADDLE-SUPPORT-5000L`, `SFG-NOZZLE-MANHOLE-5000L`, `SFG-FINAL-TANK-ASSY-5000L` |
| BOM | `BOM-FUEL-TANK-5000L` V1 |
| Route | `RT-000001` (PARALLEL / mixed deps) — product name RT-FUEL-TANK-5000L |
| Profile | `MP-FUEL-TANK-5000L` (`LOGICAL_WIP`, no child POs) |
| FG serial example | `FT-5000L-********` |
| Warehouses | WIP, FG-MAIN (+ RM/BO/consumables as profiled) |

---

## Scripts

```bash
cd backend
npx tsx scripts/seed-fuel-tank-pilot-items.ts
npx tsx scripts/seed-fuel-tank-mfg-setup.ts
npx tsx scripts/test-fuel-tank-wo-execution.ts
```

Requires MySQL + `vasant-trailers` tenant + `admin@vasant-trailers.com`. API mode only — no Zustand demo.

---

## Evidence pointer

Controlled factory close: see [`examples/FUEL_TANK_UAT.md`](examples/FUEL_TANK_UAT.md) and [`MFG_GOLDEN_PATH_TEST_RESULTS.md`](MFG_GOLDEN_PATH_TEST_RESULTS.md).

**Cost note:** Seeded UAT values are inventory rates (e.g. ₹111,020 material=WO=FG). The brief’s ₹390k figure is illustrative only.
