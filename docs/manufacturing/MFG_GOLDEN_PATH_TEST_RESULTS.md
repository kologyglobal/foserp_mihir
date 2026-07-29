# MFG Golden Path Test Results — MFG-GOLDEN-1

**Date:** 2026-07-28  
**Tenant:** `vasant-trailers`  
**Command:**

```bash
cd backend
npx tsx scripts/seed-fuel-tank-pilot-items.ts
npx tsx scripts/seed-fuel-tank-mfg-setup.ts
npx tsx scripts/test-fuel-tank-wo-execution.ts
```

**Result:** **FUEL TANK FACTORY GOLDEN PATH — PASS**

---

## Run identity

| Field | Value |
|-------|-------|
| WO | `WO-000010` |
| Serial | `FT-5000L-52948875` |
| FG receipt | `FG-000002` |
| Material / WO / FG cost | ₹111,020.00 (exact match) |
| Stages | JC-SHELL … JC-TEST-FINISH (6) |
| Ops | 15 |
| BOM snapshot lines | 30 |
| Child WOs | 0 |
| SFG primary WO | Blocked (400 — no profile) |

---

## Checklist (harness)

| # | Criterion | Result |
|---|-----------|--------|
| 1 | One FG WO only | PASS |
| 2 | SFG Job Cards LOGICAL under FG | PASS |
| 3 | Route Card tracking | PASS |
| 4 | WC/Machine assignment | PASS |
| 5 | Material cost from Inventory Costing | PASS |
| 6 | QC gate + rework | PASS |
| 7 | Serial FG receipt | PASS |
| 8 | WO actual cost | PASS |
| 9 | FG valuation | PASS |
| 10 | Closure (COMPLETE + COMPLETED) | PASS |

---

## Acceptance map (phase §77) — summary

| Area | Evidence |
|------|----------|
| 1–11 Setup / release / snapshots / JCs / parallel / WC / machine | PASS harness + seed |
| 12–17 Materials / inventory cost / return-shortage | Issue+cost PASS; return/shortage = existing services + SPA |
| 18–27 Progress / QC / hold / machine OOS | QC+rework PASS; hold/OOS = SPA / existing APIs |
| 28–36 Child complete / Final Assy / FG / capitalisation | PASS (LOGICAL handover) |
| 37–38 Partial FG / derived progress | Partial = separate scenario; progress from backend stages |
| 39–45 Command center / tabs / timeline | Existing Api WO detail; live SPA sign-off open |
| 46–50 Close / corrections / dispatch readiness | COMPLETE PASS; CLOSE purpose blocked as designed |
| 51–52 SO → Demand → WO | Separate conversion tests; Fuel Tank run = manual FG WO |
| 53–56 UX / permissions | Existing My Work / roles; SPA UAT open |
| 57–60 API mode / concurrency / tenancy | Harness API-only; isolation covered elsewhere |
| 61–68 Scenarios B–I | Happy + rework PASS; others = existing + deferred SPA |
| 69–70 Cost/qty invariants | Material=WO=FG exact |
| 71–75 Perf / FE polish / regression pack | Not full soak this phase; no code regression introduced |
| 76 Docs | This pack + audit |

---

## Hard blockers (§78)

None observed on re-run. BOM/route snapshots immutable after release; Inventory cost = WO = FG; rework history retained; operational close clean.

---

## Verdict

**MANUFACTURING GOLDEN PATH — READY FOR CONTROLLED PILOT**

Conditions (non-blocking for pilot): live SPA checklist, SO-sourced Fuel Tank run in UI, shortage/return/partial/correction SPA sign-off, performance soak, illustrative ₹390k vs seeded ₹111k rates.
