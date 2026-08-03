# Maintenance V1 — Architecture

**Status:** READY (ticket lifecycle + spare ISSUE)  
**Module flag:** `maintenance` (depends on `manufacturing`)  
**Central document:** Maintenance Ticket (`MT-######`)

## Principle

Keep Maintenance extremely simple for manufacturing SMEs:

**Report → Repair → Test → Close**

Not a full CMMS/EAM.

## Models

| Model | Role |
|-------|------|
| `MaintenanceTicket` | Central lifecycle document |
| `MaintenancePart` | Simple part usage lines |
| `MaintenanceAttachment` | Photos (BEFORE/DURING/AFTER) |

### Reused

- `ManufacturingMachine` + status (`AVAILABLE` / `OUT_OF_SERVICE` / `UNDER_MAINTENANCE` / `IN_USE`)
- `MasterVendor` as contractor
- `MasterItem` optional on part lines
- `CodeSeries` entity `MAINTENANCE_TICKET` → prefix `MT`
- Audit via `createAuditLog`
- Tenant module catalog key `maintenance`

## Machine status mapping

| Business | Canonical status |
|----------|------------------|
| Breakdown reported (DOWN) | `OUT_OF_SERVICE` |
| Repair started | `UNDER_MAINTENANCE` |
| Ticket closed (PASS) | `AVAILABLE` (only if no other open ticket) |

## Ticket statuses

`REPORTED` → `IN_REPAIR` → `TESTING` → `CLOSED`  
Exceptions: `ON_HOLD`, `WAITING_FOR_PART` (+ `CANCELLED` for hygiene)

## APIs

Base: `/api/v1/t/:tenantSlug/maintenance`

| Method | Path | Permission |
|--------|------|------------|
| GET | `/dashboard` | `maintenance.view` |
| GET | `/tickets` | `maintenance.view` |
| POST | `/tickets` | `maintenance.create` |
| GET | `/tickets/:id` | `maintenance.view` |
| POST | `/tickets/:id/start-repair` | `maintenance.start` |
| PATCH | `/tickets/:id` | `maintenance.update` |
| POST | `/tickets/:id/parts` | `maintenance.update` |
| POST | `/tickets/:id/photos` | `maintenance.update` |
| POST | `/tickets/:id/test` | `maintenance.test` |
| POST | `/tickets/:id/close` | `maintenance.close` |
| GET | `/tickets/:id/close-readiness` | `maintenance.view` |
| POST | `/tickets/:id/hold` / `/resume` | `maintenance.update` |
| GET | `/machines/:machineId/history` | `maintenance.view` |
| GET | `/reports` | `maintenance.report.view` |

## Cost & downtime

- Totals (`partsCost` + `serviceCost` + `otherCost` = `totalCost`) recomputed **backend-only**
- Downtime = `reportedAt` → `closedAt` (minutes stored on close)

## Frontend routes

- `/maintenance` — dashboard
- `/maintenance/tickets` — list
- `/maintenance/tickets/new` — report breakdown
- `/maintenance/tickets/:id` — single detail page
- `/maintenance/machines/:machineId/history`
- `/maintenance/reports`

API mode only (`VITE_USE_API=true`). Demo mode shows API-required page (no demo leakage).

## Manufacturing integration

- My Work: **Report Breakdown** → prefilled create form
- Work Order detail: **Report Breakdown** in More actions
- Machine eligibility remains Manufacturing’s responsibility; Maintenance only updates machine status

## Inventory / Purchase

- Stockable spare lines (`itemId` + `warehouseId`) post Inventory ISSUE via `postStockMovement` with `referenceType=ISSUE_TO_MAINTENANCE`, `referenceNo=ticketNumber`; fail-closed on insufficient stock
- Free-text / non-stockable lines remain ticket-only (no silent “posted” claim)
- Part shortage → Create PR deep-link (`source=MAINTENANCE` + purpose/remarks); no Maintenance PO
- PM scheduler deferred