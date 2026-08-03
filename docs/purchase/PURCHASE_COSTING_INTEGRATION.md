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

Vendor Invoice posting now calls the Inventory Costing retro-adjustment service for GRN-linked lines:

- FIFO / Specific: revalue the remaining receipt layer exactly.
- Moving Average: capitalise the invoiced delta attributable to current on-hand.
- Standard Cost: retain the delta in Purchase Price Variance.
- Consumed quantity remains in `PURCHASE_PRICE_VARIANCE`; remaining quantity posts to `RAW_MATERIAL_INVENTORY`.
- Original GRN cost entries are immutable. Additive correction/reversal entries are idempotent.
- Vendor Invoice reversal removes the delta still on hand and reclassifies any already-consumed portion to PPV.

The integrated live proof also confirms Inventory↔GL remains matched without Force Balance.

## Deep links

GRN → `/inventory/costing/entries?search={grnNumber}`
