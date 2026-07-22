# Manufacturing Phase 6B — Costing / Manufacturing GL (feature-flagged)

**Status:** Shipped (2026-07-20)  
**Depends on:** Inventory movements (3A), materials issue/return (3C), FG receipt on WO complete, Finance posting engine + default mappings  
**Gate:** `FinanceFeatureKey.MANUFACTURING_ACCOUNTING` on `FinanceFeatureControl` (**default off**)

## Principle (ADR-031 Accepted)

1. **Always** persist idempotent `ProductionAccountingEvent` rows when a legal entity exists.
2. Call `posting.service.post()` **only** when the feature flag is enabled, amount > 0, and the event type is MappingReady.
3. Flag off: events only (`SKIPPED_FLAG_OFF`) — no voucher / GL.
4. Inventory qty remains SoT; accounting WIP/FG balances do not replace stock.

## Event types (MVP postable)

| Event | Trigger | Idempotency | GL when flag on |
|-------|---------|-------------|-----------------|
| `MATERIAL_ISSUED` | Material issue | `PROD_MAT_ISSUE:{movementId}:V1` | Dr WIP / Cr RAW_MATERIAL |
| `MATERIAL_RETURNED` | Material return | `PROD_MAT_RETURN:{movementId}:V1` | Dr RAW_MATERIAL / Cr WIP |
| `FINISHED_GOODS_RECEIVED` | FG receipt on complete | `PROD_FG_RCV:{movementId}:V1` | Dr FG / Cr WIP |
| `SCRAP_RECORDED` | Builder ready | `PROD_SCRAP:{id}:V1` | Dr SCRAP_LOSS / Cr WIP (hook deferred) |

Other enum values exist for future hooks (reserve, consume, WIP move, close).

## API

Base: `/api/v1/t/:tenantSlug/manufacturing`

| Method | Path | Permission |
|--------|------|------------|
| GET | `/accounting/gate` | `manufacturing.cost.view` |
| GET | `/accounting/events` | `manufacturing.cost.view` |
| GET | `/accounting/events/:id` | `manufacturing.cost.view` |
| GET | `/work-orders/:id/costing/preview` | `manufacturing.cost.view` |

Cost preview does **not** require the flag — it aggregates movement values + events.

## Enable flag (ops)

```sql
-- or via finance feature-control API when exposed
INSERT INTO finance_feature_controls (id, tenantId, legalEntityId, featureKey, isEnabled, updatedAt)
VALUES (UUID(), :tenantId, :legalEntityId, 'MANUFACTURING_ACCOUNTING', 1, NOW());
```

Require default mappings: `RAW_MATERIAL_INVENTORY`, `WIP_INVENTORY`, `FINISHED_GOODS_INVENTORY` (and `SCRAP_LOSS` for scrap). Prefer MANUFACTURING CoA template.

## Tests

```bash
cd backend && npx tsx scripts/prisma-cli.ts migrate deploy && npx prisma generate
npx vitest run tests/manufacturing-phase6b.test.ts
cd ../frontend && npm run test:manufacturing-phase6b
```

## Deferred

| Out of scope | Notes |
|--------------|--------|
| Full variance / overhead / cost sheet SoT | Later |
| Auto GL reverse on 5C corrections | Inventory reverse only |
| Job-work AP costing | Separate |
| Enabling flag by default / seed on | Never |
| Rich dual-mode `/accounting/manufacturing/*` hydration | Demo shell remains; API gate/events/preview ready |
| Item standard-cost master / avg cost engine | Movement `rate`/`value` often 0 |
