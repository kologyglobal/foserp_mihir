# Production ↔ Maintenance Integration (V1.1)

## Soft references on MaintenanceTicket

| Field | Maps to |
|-------|---------|
| `workOrderId` | `ProductionOrder.id` |
| `jobCardId` / `jobCardCode` | `ProductionOrderStage` |
| `operationId` / code / name | `ProductionOrderOperation` |
| `workCentreId` | Derived from machine |
| `sourceType` | MANUAL / MY_WORK / WORK_ORDER / JOB_CARD / OPERATION |

## Report Breakdown entry points

- My Work → query prefill machine + WO + stage/op
- Work Order detail → More → Report Breakdown
- Manual `/maintenance/tickets/new`

Operator enters: Problem, Priority, Failure Category (optional), Photo.

## Manufacturing banner

`ManufacturingActiveMaintenanceBanner` on My Work and WO detail when an open ticket exists for the machine:

MACHINE DOWN · MT-… · category · status · downtime · [View Maintenance]

Does **not** cancel/hold the WO automatically.
