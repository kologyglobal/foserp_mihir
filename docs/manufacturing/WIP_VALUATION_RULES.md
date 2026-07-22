# WIP Valuation Rules

Source: `backend/src/modules/manufacturing/costing/workspace.service.ts` (`getWorkspaceSummary`, `listReconciliation`).

WIP value is **not** a stored balance. It is derived at query time as **cumulative actual cost − finished-goods capitalised**.

---

## Formula

For each work order, using its latest cost snapshot:

```
wipValue(WO) = snapshot.totalActualCost − Σ POSTED FINISHED_GOODS_RECEIVED amount (for that WO)
```

Tenant WIP value = Σ over the latest snapshot of every work order.

Implementation:

- Latest snapshot per WO = `workOrderCostSnapshot.findMany` ordered `productionOrderId asc, snapshotVersion desc`, `distinct: ['productionOrderId']`.
- FG capitalised per WO = `productionAccountingEvent.groupBy` where `eventType = FINISHED_GOODS_RECEIVED`, `status = POSTED`, summed `amount`.
- `wipValue = Σ (totalActualCost − fgCapitalised)`.

---

## Why this is consistent with the GL (when flag on)

- Absorption events **debit `WIP_INVENTORY`** (material/labour/machine/overhead/job-work into WIP).
- FG receipt events **credit `WIP_INVENTORY`, debit `FINISHED_GOODS_INVENTORY`** — moving accumulated cost out of WIP as goods are capitalised.
- So `cumulative actual − FG capitalised` mirrors the net WIP debit balance driven by those events.

---

## Notes & limits

- No `WIP_INVENTORY` valuation is persisted on the work order or in a manufacturing table; every read recomputes from snapshots + posted FG events.
- Only `POSTED` FG events reduce WIP value; `REVERSED` FG events are excluded via the compensating-event pattern (see `MANUFACTURING_REVERSAL_ACCOUNTING.md`).
- With the flag **off**, no events are `POSTED`, so `wipValue` equals cumulative actual cost — a costing view, not a GL balance.
- WIP value inherits any provisional material/job-work amounts in the snapshot; provisional cost is surfaced separately in the workspace summary.

---

## Workspace summary fields (`getWorkspaceSummary`)

| Field | Meaning |
|-------|---------|
| `unpostedCount` | events with `status = RECORDED` |
| `failedCount` | events with `status = FAILED` |
| `provisionalCount` | snapshots with `provisionalCost > 0` |
| `wipValue` | derived as above |
| `fgCapitalisedToday` | Σ `FINISHED_GOODS_RECEIVED` POSTED amount with `postedAt ≥ today` |
| `workOrdersReadyToClose` | count of `COMPLETED`/`CLOSED` production orders |

API: `GET /manufacturing/accounting/workspace/summary` (`manufacturing.accounting.view`).
