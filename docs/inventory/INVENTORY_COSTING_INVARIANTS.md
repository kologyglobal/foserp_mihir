# Inventory Costing — Invariants

Hard rules. Violation ⇒ **NOT READY** / production blocker.

## Cross-method

1. Every posted `InventoryStockMovement` that affects valued stock has exactly one `InventoryCostEntry` (idempotent upsert on movement id).
2. `InventoryCostEntry.totalCost` equals the valuation `value` used to update stock (not a re-round from DB-truncated `movement.rate`).
3. Corrections create new movements/entries — they do not rewrite original POSTED history.
4. Duplicate idempotency key returns the same movement; cost entry count remains 1.
5. Queries always filter `tenantId` from route context — never from request body.
6. Manufacturing material cost prefers `InventoryCostEntry` (IV-MFG-1); it must not re-run FIFO/MA.

## Moving Weighted Average

7. Issues use current `avgRate` (caller rate ignored).
8. `stockValue` tracks engine formula (`qty × avgRate` after receipts/issues per posting service).
9. Returns do not invent FIFO layer restore under MA.

## FIFO

10. `SUM(OPEN layer remainingQuantity)` reconciles to costed on-hand within qty tolerance (0.0001).
11. `SUM(OPEN layer remainingValue)` reconciles to stock value within 0.01 (when layers expected).
12. Issues fail-closed if insufficient OPEN qty.
13. `RETURN_FROM_WO` restores original layer costs when restore plan applies.
14. Inter-warehouse transfer receive uses dispatch cost entry unit cost (no artificial P/L).

## Standard Cost

15. Posting fail-closed without usable active standard / `standardRate` > 0.
16. Inventory relief/receipt at standard; purchase vs standard is variance — not silent MA/FIFO.
17. Changing standard version does not rewrite historical cost entries.

## Specific Identification

18. Movements require serial or lot.
19. Issue cost is identity cost — never the average of unrelated units.
20. Unidentified OPEN pool layers are flagged `SPECIFIC_COST_NOT_IDENTIFIED`.

## Reconciliation / GL

21. Recon does not force-balance or mutate costs.
22. When Inventory Accounting is disabled, GL shows **Not Available** — never fake ₹0.

## Method change

23. Historical entries retain posted `valuationMethod` / costs.
24. BLOCKED readiness requires `force=true` + reason to execute.
25. Preview comes from backend — UI does not invent readiness.
