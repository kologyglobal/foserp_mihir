# Fuel Tank — Job Cards

In FOS API mode, **Job Cards are route stage groups** (plus their operations) frozen onto the FG Work Order at release. There is no separate `JobCard` Prisma model.

## Mapping

| Spec Job Card | Stage code | Ops | Item output (logical) |
|---------------|------------|-----|------------------------|
| JC-SHELL | `JC-SHELL` | 10–30 | SFG-TANK-SHELL-5000L |
| JC-DISHED-END | `JC-DISHED-END` | 40–50 | SFG-DISHED-END-5000L |
| JC-SADDLE | `JC-SADDLE` | 60 | SFG-SADDLE-SUPPORT-5000L |
| JC-NOZZLE | `JC-NOZZLE` | 70 | SFG-NOZZLE-MANHOLE-5000L |
| JC-FINAL-ASSEMBLY | `JC-FINAL-ASSEMBLY` | 80–90 | SFG-FINAL-TANK-ASSY-5000L |
| JC-TEST-FINISH | `JC-TEST-FINISH` | 100–150 | FG (OP-150) |

## Rules

1. Work Order is created **only** for `FG-FUEL-TANK-5000L`.
2. SFG items have **no** manufacturing profile → independent SFG WO is rejected.
3. `generate-child-orders` returns **0** children (LOGICAL pilot).
4. On release, parent WO receives immutable route snapshot: 6 stages + 15 ops + deps.
5. Parallel JCs (SHELL / DISH / SADDLE / NOZZLE) can progress together.
6. FINAL-ASSEMBLY waits for predecessors (ops 30+50 then 60+70+80).
7. WO progress rolls up from stage/operation completion.

## Evidence

`test-fuel-tank-wo-execution.ts` (2026-07-23): WO-000027 released with all six JC stages; parallel JCs progressed to QC_PENDING.
