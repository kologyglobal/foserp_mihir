# Machine Health — Maintenance V1.1

**Status:** Implemented as a **read model** (no second operational ledger).

## API

| Method | Path | Permission |
|--------|------|------------|
| GET | `/maintenance/machine-health` | `maintenance.view` |
| GET | `/maintenance/machine-health/:machineId` | `maintenance.view` |
| GET | `/maintenance/active-ticket?machineId=` | `maintenance.view` |

## Health statuses (deterministic)

| Status | Meaning |
|--------|---------|
| DOWN | Machine `OUT_OF_SERVICE` |
| MAINTENANCE | Machine `UNDER_MAINTENANCE` |
| ATTENTION | Repeat breakdown (≥3/30d default), waiting-for-part, or ≥24h downtime in 30d |
| AVAILABLE | Otherwise |

Physical availability remains `ManufacturingMachine.status`. Health is interpretation only.

## Repeat breakdown

Default: **≥ 3** tickets in the last **30** days (`repeatBreakdownCount` / `repeatBreakdownDays` query params).

## UI

`/maintenance/machine-health` — filters Period / Status / Failure Category; attention strip; drill to Machine History.
