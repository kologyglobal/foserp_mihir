# Purchase GRN receiving tolerance

## Contract

- **Primary source:** Item Master `receivingToleranceId` → `MasterReceivingTolerance.percentage` (excess-only band vs **open/pending** qty).
- **FK rule:** When `receivingToleranceId != null`, master % applies always — including **0% (EXACT)**. Never use truthy checks on percentage.
- **Fallback:** When FK is null → Purchase Setup `allowOverReceipt` + `overReceiptTolerancePct`; else legacy `receivingTolerancePercentage` if non-zero; else 0%.
- **Variance:** `((received - open) / open) * 100` in primary UOM.
- **Weight path:** When item `receiptEntryMode` is `WEIGHT_ONLY` or `UNIT_AND_WEIGHT`, expected weight = `receivedUnit × standardWeightPerBaseUnit`; max = expected × (1 + tol%).
- Zero received: line status `NOT_RECEIVED` — no stock / no PO received delta.
- **Multi-line:** each line evaluated independently. Header approval when any line `requiresApproval`.
- **Partial under-receipt:** `PARTIAL` — no symmetric lower band; inventory for received qty; remainder stays open.
- **Outside band:** `EXCESS_OUTSIDE_TOLERANCE` (unit) and/or `WEIGHT_OVER_TOLERANCE` → `PENDING_TOLERANCE_APPROVAL` + `PurchaseApproval` (`GOODS_RECEIPT`). Short close uses `SHORT_CLOSE_REQUESTED` approval reason.

## Master

- Registry slug: `receiving-tolerances` (`/api/v1/t/:tenantSlug/masters/receiving-tolerances`)
- System seed per tenant: `EXACT` (0%), `STD10` (10%), `BULK20` (20%)
- Permissions: `master.receiving_tolerance.view|create|update|delete`
- Hostinger SQL: `backend/scripts/live-deploy-receiving-tolerance-master.sql`

## Line statuses

| Status | Meaning |
|--------|---------|
| EXACT | Received equals open |
| PARTIAL | Under open (excess-only model) |
| NOT_RECEIVED | Received = 0 |
| EXCESS_WITHIN_TOLERANCE | Over open but ≤ max allowed |
| EXCESS_OUTSIDE_TOLERANCE | Over max allowed → approval |

Weight statuses: `NOT_APPLICABLE`, `EXACT`, `EXCESS_WITHIN_TOLERANCE`, `EXCESS_OUTSIDE_TOLERANCE`.

## API

- `POST /purchase/grns/evaluate-lines` — authoritative preview (PO id + draft lines)
- `POST /purchase/grns/:id/submit` — may return `PENDING_TOLERANCE_APPROVAL`
- `POST /purchase/grns/:id/approve-tolerance` / `reject-tolerance`
- Unit: `backend/tests/purchase/grn-tolerance.test.ts`, `backend/tests/purchase/receiving-tolerance.test.ts` (`npm run test:grn-tolerance`)
- Frontend demo mirror: `frontend/src/services/purchase/grnTolerance.ts` (API mode should call evaluate-lines)

## Casting example (weight)

PO open 100 Nos; 10 Kg/Nos; 20% tolerance → expected weight 1000 Kg, max 1200 Kg. 1150 Kg = within; 1250 Kg = `WEIGHT_OVER_TOLERANCE`.

## PDF

GRN print shows **Ordered** and **Received / inward** as stacked dual qty (not separate vendor/stock columns):

```text
8 MTR
2.33 NOS
```

Top line = purchase / vendor unit; bottom = stock inward unit (factory count). Same UOM collapses to one line.
