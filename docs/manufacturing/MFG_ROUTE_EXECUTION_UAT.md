# MFG Route Execution UAT — Fuel Tank

## Route

| Field | Value |
|-------|-------|
| Product name | RT-FUEL-TANK-5000L |
| System code | `RT-000001` |
| Type | PARALLEL / mixed dependencies |
| Status | ACTIVE / certified (immutable after certify) |

## Ops (15) — summary

Cutting → Forming → Welding (Shell); parallel Ends / Saddle / Nozzle; Assembly deps; Hydro; Blast; Paint; Final QC; FG Store.

On WO release: `ProductionOrderRoutingSnapshot` + stages/ops/deps frozen. Master edits do not mutate released WO.

## UAT checks (harness 2026-07-28)

| Check | Result |
|-------|--------|
| Snapshot created on release | PASS (`WO-000010`) |
| 6 stages / 15 ops | PASS |
| WC on all ops | PASS (15/15) |
| Machine optional (10/15 assigned) | PASS |
| Assignment accept/start OP-10 | PASS |
| QC-gated progression + rework on JC-SHELL | PASS |
| Final QC before FG | PASS |

Hold/resume, OUT_OF_SERVICE machine, and planned-vs-actual time: covered by existing Manufacturing services; exercise in live SPA when signing off operator UX. Harness focuses factory close path.
