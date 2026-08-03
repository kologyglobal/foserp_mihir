# Purchase Completion UAT

## Automated

| Scenario | Evidence |
|----------|----------|
| GRN (no QI) → stock + cost entry | `tests/purchase-completion-grn-costing.test.ts` |
| QI lifecycle | `tests/purchase-qi-lifecycle.test.ts` |
| Invoice lifecycle + AP preview | `tests/purchase-invoice-lifecycle*.test.ts` |
| Return lifecycle | `tests/purchase-return-lifecycle.test.ts` |
| GRN lifecycle | `tests/goods-receipt-lifecycle.test.ts` |
| Inventory costing methods | `tests/inventory-costing-uat1-controlled.test.ts` |

## Manual SPA checklist (API mode)

1. PO → GRN submit (no QI) → View Cost Entries shows GRN-linked entry
2. PO → GRN (QI required) → QI accept/reject → stock status
3. Create Invoice from GRN → match → approve → post → Open in Money Out
4. Create Return from GRN → complete → ACCOUNTING_ADJUSTMENT_PENDING banner
5. Confirm demo never mixes when `VITE_USE_API=true`

## Deferred golden paths

- Full FIFO/MA/Standard/Specific purchase matrices (covered in Inventory Costing UAT; GRN uses same posting)
- Return → AP debit note auto
- Invoice rate retroactive cost adjustment
- Supplier performance dashboard aggregates
- Direct/indirect spend classification
