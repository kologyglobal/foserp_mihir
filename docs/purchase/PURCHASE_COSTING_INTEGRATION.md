# Purchase ↔ Inventory Costing integration

## Principle

Inventory Costing is the sole valuation authority.

## Receipt cost source

GRN inward uses PO line rate (canonical purchase-inventory posting). Document as `receiptCostSource = PO_RATE` unless landed-cost extension exists (not this phase).

## Method behaviour

| Method | On GRN inward |
|--------|----------------|
| FIFO | OPEN layer |
| MA | Update avg / stock value |
| STANDARD_COST | Value at standard + variance if actual ≠ standard |
| SPECIFIC | Requires serial/lot |

## Purchase Invoice rate difference

Retroactive stock revaluation from invoice ≠ GRN rate is **PURCHASE_INVOICE_COST_ADJUSTMENT_DEFERRED** unless Inventory Costing adjustment API is called. Do not fake valuation in Purchase.

## Deep links

GRN → `/inventory/costing/entries?search={grnNumber}`
