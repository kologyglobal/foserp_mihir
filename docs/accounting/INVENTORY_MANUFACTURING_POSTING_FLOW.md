# Inventory / Manufacturing Posting Flow (Accounting)

> IV-MFG-1 · 2026-07-28

## Separation

```text
Stock movement → Inventory Costing → (inventory accounting events as designed)
Material issue → ProductionAccountingEvent → central posting → GL (when flag + readiness)
FG receipt → ProductionAccountingEvent + Inventory FG cost entry
```

React never posts journals. Use manufacturing posting orchestrator + finance voucher engine.

## Material issue (when MANUFACTURING_ACCOUNTING enabled)

Typical mapping intent:

- Dr WIP  
- Cr Raw Material Inventory  

Amount must match Inventory-posted cost (`|movement.value|` / cost entry total), not a manufacturing-side revaluation.

## FG receipt

- Dr Finished Goods  
- Cr WIP  

Basis: capitalised WO cost / proportional 7E logic already in manufacturing services.

## Gates (do not weaken)

WIP / FG / variance (and other required) mappings · open period · no failed events · inventory reconcile sign-off · pilot finance sign-off · feature flag off by default.

## Deferred

Company-wide GL enablement, COGS redesign, inventory↔GL trial-balance polish, purchase price-difference retroactive WO rewrite.
