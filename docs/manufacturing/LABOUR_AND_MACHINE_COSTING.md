# Labour & Machine Costing

Source: `backend/src/modules/manufacturing/costing/work-order-cost.service.ts` (operations + daily-line sections).

Labour and machine cost = **minutes × rate ÷ 60**. Actual minutes come only from recorded `DailyProductionLine` rows. The calculator never invents time.

---

## Actual time source — `DailyProductionLine`

For each `dailyLine` on the work order:

- `labourMinutes = line.labourMinutes ?? 0`
- `machineMinutes = line.machineMinutes ?? 0`
- `labourAmount = labourMinutes / 60 × labourRate`
- `machineAmount = machineMinutes / 60 × machineRate`

A `LABOUR` cost entry is written only when `labourMinutes > 0`; a `MACHINE` entry only when `machineMinutes > 0`. Entry `sourceEntityType = DAILY_PRODUCTION_LINE`, `durationMinutes` stored, `provisional = false` (recorded time is treated as real).

> There is **no synthetic or estimated actual time**. If no daily line recorded minutes, there is no actual labour/machine cost for that work order.

---

## Rate resolution (policy-driven)

| Rate | `labourRateSource` / `machineRateSource` | Resolved value |
|------|------------------------------------------|----------------|
| Labour | `TENANT_DEFAULT` | `policy.defaultLabourRate` |
| Labour | `WORK_CENTRE_RATE` (default) | `line.workCentre.costRate` → else `policy.defaultLabourRate` |
| Machine | `WORK_CENTRE_RATE` | `line.workCentre.costRate` → else `policy.defaultMachineRate` |
| Machine | `MACHINE_RATE` (default) | `line.machine.costRate` → else `line.workCentre.costRate` → else `policy.defaultMachineRate` |

`manufacturing_machines.costRate` (added in the Phase 7E migration) supplies the machine rate.

---

## Planned time

Planned labour/machine minutes come from `operations`:

`plannedMinutes = setupTimeMinutes + (runTimeBasis = PER_UNIT ? runTimeValue × plannedQuantity : runTimeValue)`

Both planned labour and planned machine use the same operation minutes; rates resolve as above from the operation's work centre / machine. Planned figures feed `plannedLabourCost` / `plannedMachineCost` only.

---

## Warnings

| Warning | When |
|---------|------|
| `INCOMPLETE_LABOUR_RATE:<id>` | minutes > 0 but resolved labour rate ≤ 0 |
| `INCOMPLETE_MACHINE_RATE:<id>` | minutes > 0 but resolved machine rate ≤ 0 |
| `INCOMPLETE_LABOUR_TIME` / `INCOMPLETE_MACHINE_TIME` | no operations at all, or no daily lines while WO is `IN_PROGRESS/COMPLETED/CLOSED` |

Incomplete rate/time warnings drive the snapshot `completenessStatus` (`INCOMPLETE_*`) and block absorption/close until resolved.

---

## Absorption accounting

Actual labour/machine costs are posted (when enabled) via manual **absorption events** `LABOUR_ABSORPTION` and `MACHINE_ABSORPTION` (debit WIP, credit the absorption clearing account). See `MANUFACTURING_POSTING_EVENTS.md` and `MANUFACTURING_ACCOUNT_MAPPING.md`. These represent **absorbed cost into WIP**, not payroll — payroll / true labour cost is deferred.
