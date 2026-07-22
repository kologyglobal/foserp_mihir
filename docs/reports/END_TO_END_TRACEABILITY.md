# End-to-End Traceability (Phase 7D)

**Service:** `ops-reports/traceability/traceability.service.ts`
**Routes:** `GET /manufacturing/traceability/search`,
`GET /manufacturing/traceability/:entityType/:entityId`
**Permission:** `manufacturing.traceability.view` (export: `manufacturing.traceability.export`).

Traceability links operational records that **already reference each other in the schema** — it
never invents relationships.

---

## Search

- Substring search (bounded to 20 results per type) across document numbers:
  - `SALES_ORDER` (`CrmSalesOrder.salesOrderNo`)
  - `WORK_ORDER` (`ProductionOrder.orderNumber`)
  - `FG_RECEIPT` (`ProductionFinishedGoodsReceipt.receiptNumber`)
  - `DISPATCH` (`OutboundDispatch.dispatchNo`)
  - `INSPECTION` (`QualityInspection.inspectionNumber`)
  - `NCR` (`QualityNcr.ncrNumber`)
- Each hit returns `entityType`, `entityId`, `label`, and a status subtitle. Tenant-scoped.

## Lineage graph

Given a root entity, the service returns `{ root, nodes, edges, warnings }` following only real
FKs. Edge relationships by root type:

| Root | Edges built |
|------|-------------|
| `SALES_ORDER` | → work orders (`CONVERTED_TO_WORK_ORDER`), → dispatches (`FULFILLED_BY_DISPATCH`) |
| `WORK_ORDER` | ← sales order, → FG receipts (`PRODUCED_FG_RECEIPT`), → inspections (`INSPECTED_BY`), → NCRs (`HAS_NCR`) |
| `FG_RECEIPT` | ← work order, → inspection (via `qualityInspectionId`) |
| `DISPATCH` | ← sales order; dispatch lines carried in node detail |
| `INSPECTION` | ← work order, → NCRs (`RAISED_NCR`), → FG receipts |
| `NCR` | ← work order, ← inspection |

## Don't invent links

- Only relationships backed by an actual foreign key are drawn.
- **Job work** is deliberately **not** rendered as a lineage node type yet. When linked job work
  orders exist (e.g. on a work order, or an inspection/NCR linked to a job work order rather than
  a production order), the service adds a **warning** naming them instead of fabricating an edge.
- Missing links are surfaced honestly via `warnings`, never guessed.
- Every lookup is tenant-scoped; unknown entity types raise a validation error.
