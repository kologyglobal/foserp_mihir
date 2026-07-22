# Production ↔ Inventory Integration (Phase 7A)

## Ownership

| Domain | Owns |
|--------|------|
| **Inventory** | On-hand stock, balances (derived), reservations, issue/return/transfer movements, stocked WIP & FG quantities |
| **Production** | WO requirements, readiness, logical WIP, stage qty, FG eligibility & receipt documents, reconciliation |
| **Quality** | Inspection / hold / NCR / accept-reject |
| **Accounting** | Valuation / GL (flag-gated Phase 6B) |

## Hard rules

1. `InventoryStockMovement` is the physical stock source of truth.  
2. Production never writes `InventoryStockBalance` directly.  
3. Inventory never mutates Stage Ledger quantities.  
4. `ISSUE_TO_WO` = WO custody (ADR-037) — one stock decrement; no second consumption stock-out.  
5. FG receipt posts Inventory + `ProductionFinishedGoodsReceipt` atomically.  
6. Phase 5C reverses FG movement **and** updates receipt `reversedQuantity` / status.

## Key endpoints

- Inventory: existing issue-to-WO / return-from-WO / FG receipt movements  
- Manufacturing: warehouse mappings, material position/recon, store workbench queues, FG eligibility/receipts, close readiness
