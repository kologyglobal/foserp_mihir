# Manufacturing Variance Rules

Source: `backend/src/modules/manufacturing/costing/posting-orchestrator.service.ts` (`financialClosePreview`, `financialClose`), `work-order-cost.service.ts`.

Variance at financial close remains the residual difference between accumulated actual cost and posted GL cost. Policies using `STANDARD_WITH_VARIANCE` additionally calculate informational component variances.

## Standard component variances

For `STANDARD_WITH_VARIANCE`, planned cost is the work order standard and `varianceAmount = actualTotal − standardTotal`. Cost details include `VARIANCE` entries for material price, material usage, labour rate, labour efficiency, and any remaining conversion variance. These entries explain the snapshot; financial-close posting continues to use the controlled aggregate `PRODUCTION_VARIANCE` event.

Finished-goods receipts under this method capitalise at `totalPlannedCost / plannedQuantity`. Scrap and rework are separately allocated at the current actual unit cost and retained on the snapshot without being added again to total actual cost.

---

## Snapshot variance (informational)

Every snapshot stores `varianceAmount = totalActualCost − totalPostedCost`, where `totalPostedCost` = Σ `POSTED` accounting-event amounts for the work order. This is a live indicator, not a posted figure.

---

## Residual variance at financial close

`financialClosePreview(WO)`:

- Loads the production order, latest snapshot, and accounting readiness.
- `residualVariance = snapshot.totalActualCost − Σ POSTED event amount`.
- Blockers: readiness blockers, plus `WORK_ORDER_NOT_COMPLETED` (status not `COMPLETED`/`CLOSED`) and `COST_NOT_CALCULATED` (no snapshot).

`financialClose(WO)`:

- Idempotency key `P7E_CLOSE:<WO>:V1` — a second close returns `422` (`InvalidStateError`).
- Requires `preview.ready` and a snapshot; otherwise `ValidationError` listing blockers.
- Records **one** `PRODUCTION_VARIANCE` event with `amount = |residualVariance|`, `sourceDocumentType = WORK_ORDER_FINANCIAL_CLOSE`, payload carrying the signed `varianceAmount`, `attemptPost: false` (recorded, then posted manually).

---

## Posting the variance

`PRODUCTION_VARIANCE` maps to **debit `PRODUCTION_VARIANCE`, credit `WIP_INVENTORY`**. When the signed variance is **negative** (posted exceeds actual), the builder **flips** debit/credit so the residual clears WIP in the correct direction. The amount is always posted as its absolute value.

---

## Remaining unsupported variance categories

The following are **not** produced anywhere in code and must be reported as *Not Available*:

- Machine / overhead **spending** vs **volume/absorption** variance
- Scrap/rework yield variance against an engineered standard (captured costs exist, but no standard yield baseline exists)

---

## API

- `POST /work-orders/:id/financial-close/preview` (`manufacturing.accounting.financial_close`)
- `POST /work-orders/:id/financial-close` (same permission)
