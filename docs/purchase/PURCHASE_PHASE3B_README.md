# Purchase Phase 3B — Purchase Requisition Foundation

**Status:** Backend full stack + FE API client (2026-07-20). Demo purchase UI remains for `VITE_USE_API=false`.

## Goal

Ship a real **Purchase Requisition** API so Production Phase 3C can raise shortages as PRs (not POs) — ADR-030.

## Included

| Capability | Detail |
|------------|--------|
| PR header + lines | Item, qty, warehouse, dates, production refs |
| Lifecycle | `DRAFT → SUBMITTED → APPROVED \| REJECTED \| CANCELLED` |
| Manual create | `POST /purchase/requisitions` |
| From production shortage | `POST /purchase/requisitions/from-production-shortage` |
| List by Work Order | `GET /purchase/requisitions/by-production-order/:id` |
| Code series | `PURCHASE_REQUISITION` → `PR-000001` |

Base: `/api/v1/t/:tenantSlug/purchase`.

## Production reference fields

Header and/or lines may carry:

- `productionOrderId` (FK)
- `stageId`, `operationId`, `bomLineId` (soft UUID refs)
- `salesOrderId` (FK)
- `salesOrderLineKey`, `projectRef`, `priority`, warehouse, required date

## Explicitly deferred

- RFQ / vendor quotation / comparison
- Purchase Order
- GRN / inventory receipt from PO
- Convert PR → RFQ/PO
- Full dual-mode Purchase SPA hydration
- Multi-level approval matrices / attachments as first-class

## Permissions

```
purchase.requisition.view|create|edit|submit|approve|cancel
```

(`cancel` also accepts `purchase.cancel`)

## Frontend

- Client: `frontend/src/services/api/purchaseApi.ts`
- Smoke: `npm run test:purchase-phase3b`
- Demo `purchaseStore` / purchase routes unchanged

## Tests

| Suite | Result |
|-------|--------|
| `backend/tests/purchase-phase3b.test.ts` | 11/11 |
| FE smoke | wiring checks |

## Next

**Phase 3C — Production materials integration:** material requirements from BOM, reserve/issue/return via Inventory 3A, shortage → this PR API, FG receipt gate.

Do not claim Purchase module complete — only PR foundation.
