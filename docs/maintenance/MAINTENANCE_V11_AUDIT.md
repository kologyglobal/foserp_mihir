# Maintenance V1.1 — Repository Audit

**Date:** 2026-07-30  
**Scope:** Upgrade V1 (READY) → V1.1 Machine Health & Management Hardening  
**Rule:** Do not rebuild V1. Reuse existing models/APIs/UI.

---

## Verdict of audit

| Area | Status |
|------|--------|
| Ticket lifecycle REPORT→REPAIR→TEST→CLOSE | **EXISTS** — keep as-is |
| Machine status sync | **EXISTS** |
| ISSUE_TO_MAINTENANCE + cost entry | **EXISTS** |
| Failure category enum | **EXISTS** (add SAFETY) |
| WO / JC / operation / workCentre refs | **EXISTS** |
| My Work / WO Report Breakdown deep-links | **EXISTS** |
| Downtime minutes on close | **EXISTS** |
| repairStartedAt | **EXISTS** |
| repairDetails | **EXISTS** (split → rootCause + repairAction) |
| Dashboard + reports + contractor aggregates | **EXISTS** |
| Machine history | **EXISTS** |
| Dedicated rootCause / repairAction | **MISSING** → add |
| repairEndedAt / explicit MTTR fields | **PARTIAL** → add repairEndedAt |
| Machine Health read model + UI | **MISSING** → add |
| Repeat breakdown detection | **MISSING** → add |
| Manufacturing active-ticket banner | **MISSING** → add |
| PR sourceType=MAINTENANCE persistence | **MISSING** → add columns |
| MaintenancePart.purchaseRequisitionId write | **PARTIAL** (column unused) → wire |
| Failure category on Report form | **PARTIAL** (API yes, UI no) → wire |
| Close requires TEST=PASS | **PARTIAL** (docs say yes; code does not) → harden |

---

## Existing models (reuse)

- `MaintenanceTicket`, `MaintenancePart`, `MaintenanceAttachment`
- `ManufacturingMachine` + status enum
- Soft refs: `workOrderId` (= ProductionOrder), `jobCardId` (= ProductionOrderStage), `operationId`
- `InventoryReferenceType.ISSUE_TO_MAINTENANCE`
- `MasterVendor` as contractor
- Permissions: `maintenance.view|create|start|update|test|close|cost.*|report.view`

## Schema deltas for V1.1

1. `MaintenanceFailureCategory` += `SAFETY`
2. `MaintenanceTicket.rootCause` Text?
3. `MaintenanceTicket.repairAction` Text?
4. `MaintenanceTicket.repairEndedAt` DateTime? (set on TEST PASS)
5. `PurchaseRequisition.sourceType` VarChar? (`MAINTENANCE` | …)
6. `PurchaseRequisition.sourceId` String?
7. `PurchaseRequisition.sourceDocumentNumber` VarChar?

No new operational ledger. Machine Health is a **read model API only**.

## Deferred (Phase 35)

PM scheduler, calendar, AMC, warranty, calibration, IoT, OEE, predictive AI, CAPA/FMEA, full CMMS WOs.
