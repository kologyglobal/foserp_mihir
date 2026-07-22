# Manufacturing Accounting Reconciliation

Source: `backend/src/modules/manufacturing/costing/workspace.service.ts` (`listReconciliation`, `listUnposted`, `listFailed`, `listProvisional`, `listCloseReady`, `getWorkspaceSummary`).

The accounting workspace reconciles each work order's **operational cost** (latest snapshot `totalActualCost`) against **posted GL** (Σ `POSTED` event amounts) and classifies the gap.

---

## Reconciliation rows (`listReconciliation`)

For the latest snapshot per work order:

```
operationalCost = snapshot.totalActualCost
postedAmount    = Σ POSTED accounting-event amount for the WO
difference      = operationalCost − postedAmount
```

Status (first match wins):

| Status | Condition |
|--------|-----------|
| `BLOCKED` | the WO has any `FAILED` accounting event |
| `PROVISIONAL` | snapshot `provisionalCost > 0` |
| `UNPOSTED` | `postedAmount = 0` |
| `RECONCILED` | `|difference| ≤ 0.01` |
| `DIFFERENCE` | otherwise |

Each row returns `productionOrderId`, `orderNumber`, `operationalCost`, `postedAmount`, `difference`, `status`, `snapshotVersion`.

API: `GET /manufacturing/accounting/workspace/reconciliation` (`manufacturing.accounting.reconcile`).

---

## Workspace queues

| Endpoint | Returns |
|----------|---------|
| `/accounting/workspace/summary` | counts + `wipValue` + `fgCapitalisedToday` + `workOrdersReadyToClose` (see `WIP_VALUATION_RULES.md`) |
| `/accounting/workspace/unposted` | events with `status = RECORDED` (newest first) |
| `/accounting/workspace/failed` | events with `status = FAILED` (by `updatedAt`) |
| `/accounting/workspace/provisional` | snapshots with `provisionalCost > 0`, with order number/status |
| `/accounting/workspace/close-ready` | `COMPLETED`/`CLOSED` orders that have ≥1 cost snapshot and **no** `FAILED` events, with the latest snapshot |

All require `manufacturing.accounting.view` (reconciliation requires `manufacturing.accounting.reconcile`) and are tenant-scoped.

---

## How to work the queues

1. **Unposted** — recorded events awaiting a manual post (Stage 2). Validate then post.
2. **Failed** — inspect `failureReason` (classified `CONFIGURATION` / `OPERATIONAL` / `ACCOUNTING` / `TECHNICAL`); fix the cause, then retry. A WO stays `BLOCKED` in reconciliation until failures clear.
3. **Provisional** — snapshots relying on fallback material / unlinked job work; recalculate after real values/invoices arrive to clear the flag.
4. **Close-ready** — completed orders clean of failures; run financial-close preview then close to record the residual `PRODUCTION_VARIANCE`.

`RECONCILED` (difference within ₹0.01) is the target end-state per work order once posting and close are complete.
