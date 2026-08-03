# Maintenance V2 — Preventive Maintenance

**Date:** 2026-07-30  
**Depends on:** Maintenance V1 / V1.1 (ticket execution unchanged)

## Model

- `PreventiveMaintenancePlan` — schedule only (`PM-######`)
- `PreventiveMaintenanceChecklistItem` — plan template lines
- `MaintenanceTicketChecklistItem` — execution copy on ticket
- `MaintenanceTicket.sourceType = PREVENTIVE` + `preventiveMaintenancePlanId` + due snapshots

## Flow

Plan due/overdue → **Create Ticket** → existing Start → Checklist/Parts/Photos → Test PASS → Close → `lastCompletedDate` + `nextDueDate` recalculated.

Machine is **not** set `OUT_OF_SERVICE` merely because PM is due or a PM ticket is created. Status moves to `UNDER_MAINTENANCE` only on Start Repair (existing rule).

## APIs

| Method | Path |
|--------|------|
| GET/POST | `/maintenance/preventive` |
| GET/PATCH | `/maintenance/preventive/:id` |
| POST | `/maintenance/preventive/:id/deactivate` |
| POST | `/maintenance/preventive/:id/create-ticket` |
| GET | `/maintenance/machines/:machineId/preventive` |
| GET | `/maintenance/reports/pm-compliance` |

## UI

`/maintenance/preventive`, `/new`, `/:id` — nav under Maintenance.

## Tests

`npx tsx scripts/test-maintenance-v2.ts`

## Deferred

IoT, predictive, AMC, warranty, calibration, OEE, meter-based PM, auto technician scheduling.
