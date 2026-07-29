# MFG Material Cost UAT — Fuel Tank

## Invariant (IV-MFG-1)

```text
SUM(InventoryCostEntry for ISSUE_TO_WO linked to WO)
  = WorkOrderCostSnapshot.material / actualMaterial
```

Manufacturing must **not** invent material unit costs. Issue posts Inventory → cost entry → WO cost consumes that entry.

## Happy-path evidence (2026-07-28)

| Metric | Value |
|--------|-------|
| WO | `WO-000010` |
| ISSUE_TO_WO movements | 21 valued |
| InventoryCostEntry rows | 21 |
| Material cost | **₹111,020.00** |
| WO actual total / unit | **₹111,020.00** |
| FG receipt rate/value | **₹111,020.00** |

Exact match: Inventory = WO = FG.

## Return / shortage

- Material return: compensating inventory + cost (existing services); exercise in SPA / correction UAT.
- Shortage → PR: existing shortage→PR path; Fuel Tank harness uses full WIP stock (no shortage in happy path).

## Permissions

Cost columns on Materials / Costing tabs are permission-aware (`manufacturing.cost.*` / finance viewers).
