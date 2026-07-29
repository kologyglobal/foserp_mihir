# MFG Job Card Execution — Fuel Tank

> Canonical model: Job Cards = **routing stage groups** on the parent FG WO.  
> There is **no** separate `JobCard` table for Fuel Tank LOGICAL WIP.

---

## Mapping

| Product language | Code |
|------------------|------|
| Job Card | `ProductionOrderStage` (from `ManufacturingStageGroup`) |
| Route Card / op | `ProductionOrderOperation` |
| Dependencies | `ProductionOrderDependency` |
| Parent | `ProductionOrder` (FG only) |

---

## Fuel Tank Job Cards (release snapshot)

| Code | SFG / purpose |
|------|----------------|
| JC-SHELL | SFG-TANK-SHELL-5000L |
| JC-DISHED-END | SFG-DISHED-END-5000L |
| JC-SADDLE | SFG-SADDLE-SUPPORT-5000L |
| JC-NOZZLE | SFG-NOZZLE-MANHOLE-5000L |
| JC-FINAL-ASSEMBLY | SFG-FINAL-TANK-ASSY-5000L (+ paint materials on FG) |
| JC-TEST-FINISH | Hydro / paint QC / FG readiness |

Parallel start: Shell, Ends, Saddle, Nozzle.  
Final Assembly waits on predecessor stages/ops. No disconnected child WO documents.

---

## Status concepts (existing enums)

Use WO/stage/operation statuses already shipped (`READY`, `IN_PROGRESS`, QC pending via QI, hold/resume, completed). Do not add duplicate JobCard enums.

---

## UI

API WO Detail → **Route** tab shows stages (= Job Cards) with ops, WC/machine, progress.  
Operator: **My Work**. Supervisor: Control Room / WO detail.

See also: [`examples/FUEL_TANK_JOB_CARDS.md`](examples/FUEL_TANK_JOB_CARDS.md).
