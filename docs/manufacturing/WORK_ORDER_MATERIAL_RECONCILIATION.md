# Work Order Material Reconciliation (Phase 7A2)

**APIs:**
- `GET /manufacturing/work-orders/:id/materials/position`
- `GET /manufacturing/work-orders/:id/materials/reconciliation`

## Position (server-derived)

Per material line: required, reserved, issued, additional issued, returned, transferred in/out, held (net issued responsibility), shortage, readiness, reconciliation hints.

**Held / unconsumed (custody semantics):**

```
Net Issued Responsibility = Issued + Additional − Returned − Transferred Out
Held = Net Issued Responsibility
```

No invented “consumed” quantity when operational consumption is not separately posted (ADR-037).

## Reconciliation statuses

`NOT_STARTED` | `IN_PROGRESS` | `BALANCED` | `DIFFERENCE` | `BLOCKED`

Differences include shortage, additional issue, open reservation, held qty, partial issue, under-reserved.

## Close policy

See `WORK_ORDER_STOCK_CLOSE_POLICY.md`. Response includes `closePolicy` and `canClose`.

Do not auto-write-off differences; use Phase 5C / return / release actions.
