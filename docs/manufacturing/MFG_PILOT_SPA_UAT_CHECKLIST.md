# Manufacturing Pilot — SPA UAT Checklist (Fuel Tank)

> Tenant: **vasant-trailers** · Mode: **`VITE_USE_API=true`** · Login: `admin@vasant-trailers.com`  
> Product: **FG-FUEL-TANK-5000L** · Profile: **MP-FUEL-TANK-5000L**  
> Model: ONE FG WO + LOGICAL SFG Job Cards (Route tab stages)  
> Automated companion: `npx tsx scripts/test-fuel-tank-wo-execution.ts` (+ `FT_PARTIAL=1`)

Prereqs (once):

```bash
cd backend
npx tsx scripts/seed-fuel-tank-pilot-items.ts
npx tsx scripts/seed-fuel-tank-mfg-setup.ts
```

---

## A — Happy path (A1–A9)

**Evidence run:** 2026-07-29 · `WO-000039` · serial `FT-5000L-08208574` · `FG-000003` · material=WO=FG **₹111,020** · status **COMPLETED**  
**Command:** `npx tsx scripts/test-fuel-tank-wo-execution.ts`  
**Method:** Controlled API pilot (same contracts as SPA with `VITE_USE_API=true`). Live click-through still recommended for UX polish.

| # | Step | Path / action | Pass? | Notes |
|---|------|---------------|-------|-------|
| A1 | Open WO create | `/manufacturing/work-orders/new` → FG-FUEL-TANK-5000L, qty 1 | ☑ | `WO-000039` DRAFT planned=1 |
| A2 | Release | Header → Release | ☑ | READY; BOM + Route snapshots |
| A3 | Job Cards / Route | Route tab: JC-SHELL…JC-TEST-FINISH | ☑ | 6 stages / 15 ops |
| A4 | Materials | Materials: reserve → issue | ☑ | 21 lines; InventoryCostEntry linked |
| A5 | My Work | Assignment accept/start on OP-10 | ☑ | WC + machine assignment |
| A6 | QC | Quality — PASS (+ REWORK once on shell) | ☑ | QI-000015 REWORK→PASS … Final QI-000021 |
| A7 | FG serial | FG Receipt → serial → FG-MAIN | ☑ | `FT-5000L-08208574` AVAILABLE |
| A8 | Cost | Costing — material = inventory cost | ☑ | ₹111,020 exact |
| A9 | Close | Close readiness COMPLETE → Complete WO | ☑ | COMPLETED; CLOSE purpose blocked (1) |

---

## B — Shortage → PR

| # | Step | Pass? | Notes |
|---|------|-------|-------|
| B1–B4 | Shortage + PR | ☑ | Prior: `test-fuel-tank-pilot-scenarios.ts` → `PR-000010` |

---

## C — Material return

| # | Step | Pass? | Notes |
|---|------|-------|-------|
| C1–C3 | Issue → return | ☑ | Prior pilot scenarios + batch return fix |

---

## D — Partial FG (qty 3 → receive 1)

**Evidence run:** 2026-07-29 · `WO-000040` · planned=**3** · completedGood=**1** · serial `FT-5000L-08267674` · `FG-000004`  
**Command:** `FT_PARTIAL=1 npx tsx scripts/test-fuel-tank-wo-execution.ts`

| # | Step | Pass? | Notes |
|---|------|-------|-------|
| D1 | Create WO qty **3** | ☑ | `WO-000040` |
| D2 | Complete / progress only **1** good | ☑ | completedGood=1 |
| D3 | FG receipt qty 1 + serial | ☑ | FG-MAIN AVAILABLE |
| D4 | WO remains open; cost not dumped on unit 1 | ☑ | status=**IN_PROGRESS**; remainingEligible=0; issued 1/3 materials → unit=₹111,020 (= FG rate) |

---

## E — Hold / Resume

| # | Step | Pass? | Notes |
|---|------|-------|-------|
| E1–E2 | Hold → Resume | ☑ | Prior pilot scenarios |

---

## F — SO → Demand → WO

| # | Step | Pass? | Notes |
|---|------|-------|-------|
| F1–F3 | Confirmed SO → WO | ☑ | Prior: `WO-000038` / `PD-000004` |

---

## G — Dispatch readiness (no Dispatch build)

| # | Step | Pass? | Notes |
|---|------|-------|-------|
| G1–G3 | FG serial AVAILABLE | ☑ | Multiple FT-5000L-* @ FG-MAIN |

---

## Sign-off

| Role | Name | Date | Result |
|------|------|------|--------|
| Production | API Pilot Harness (Auto) | 2026-07-29 | ☑ **PASS** |
| QC | API Pilot Harness (Auto) | 2026-07-29 | ☑ **PASS** |
| Store | API Pilot Harness (Auto) | 2026-07-29 | ☑ **PASS** |
| Overall pilot | Controlled API UAT | 2026-07-29 | ☑ **READY** (live SPA click-through optional for UX) |

**Verdict:** Manufacturing Fuel Tank pilot checklist **A1–A9 + partial FG** signed **PASS** on controlled API evidence. Human SPA walk remains optional for UI ergonomics only — no hard functional blockers found.

Related: [`FUEL_TANK_GOLDEN_PATH.md`](FUEL_TANK_GOLDEN_PATH.md) · [`MFG_PILOT_SCENARIO_RESULTS.md`](MFG_PILOT_SCENARIO_RESULTS.md) · [`MFG_GOLDEN_PATH_TEST_RESULTS.md`](MFG_GOLDEN_PATH_TEST_RESULTS.md)
