# Material Issue Semantics — ISSUE_TO_WO

**ADR:** ADR-037  
**Status:** Accepted (Phase 7A)  
**Date:** 2026-07-21

## Decision

`ISSUE_TO_WO` means **direct stock issue to Work Order custody** (Option A).

Warehouse on-hand **decreases immediately**. Material becomes the operational responsibility of the Work Order. It is **not** a transfer into a Production/WIP warehouse that remains unrestricted Inventory stock.

## Evidence (code)

- `postIssueToWorkOrder` → `referenceType: 'ISSUE_TO_WO'`, `movementType: 'ISSUE'` (signed negative qty).
- `postStockMovement` updates `InventoryStockBalance.onHandQty` / reservation fulfilment in the same transaction.
- Operational Stage Ledger consumption does **not** create a second Inventory stock-out.

## Rules

| Rule | Implication |
|------|-------------|
| Physical stock SoT | `InventoryStockMovement` only |
| No double decrement | Consumed/held qty is Production-derived; do not post a second ISSUE for “consumption” |
| Return | Separate `RETURN_FROM_WO` inward movement; original issue immutable |
| WIP warehouse | Used for **stocked semi-finished** WIP transfers (`WIP_TRANSFER`), not for RM issue custody |
| Reconciliation | Issued − Returned − Transferred Out ≈ held / unconsumed responsibility |

## Rejected

- Option B (RM → Production warehouse transfer on “issue”) without an explicit migration of historical movements and UI semantics.

## Impact

Phase 7A material position / reconciliation / close policies treat **issued** as WO custody, not still-on-hand RM.
