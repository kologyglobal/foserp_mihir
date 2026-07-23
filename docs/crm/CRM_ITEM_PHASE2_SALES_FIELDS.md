# CRM Item Phase 2 — MasterItem sales commercial fields

**Date:** 2026-07-23  
**Status:** Done (foundation) — CRM pickers still Product-based until Phases 5–6.

## Scope shipped

| Change | Detail |
|--------|--------|
| Schema | `MasterItem` sales fields + `ItemSalesFulfilmentMethod` enum |
| Migration | `20260723210000_master_item_sales_fields` (idempotent ALTERs + type backfill + Product price copy) |
| API | Create/update Zod; list/lookup `salesAllowed` filter; lookup returns sales fields |
| Defaults | `item-sales-defaults.ts` — FG/service/bought_out → `salesAllowed`; fulfilment by type |
| FE | Item form **Sales** section; DTO/`itemToApiPayload`/`mapItemDto` |
| Metrics | `backend/scripts/crm-item-migration-metrics.ts` |

## Fields

| Field | Notes |
|-------|-------|
| `salesDescription` | Commercial text (≠ engineering description) |
| `salesUomId` | Optional; else base UOM |
| `defaultSalesRate` | **Interim CRM sales price SoT** — do not use `standardRate` |
| `salesLeadDays` | Copied from Product when linked |
| `salesAllowed` | CRM picker gate (Phase 6 uses `salesAllowed=true`) |
| `defaultFulfilmentMethod` | STOCK / PURCHASE / PRODUCTION / SUBCONTRACT / SERVICE / MANUAL |
| `productionAllowed` | Explicit MFG allowance |

## Agreements (Phase 2 DoR)

1. **Pricing interim:** `defaultSalesRate` only; customer/group price lists deferred.  
2. **Lead storage:** keep encoded JSON through dual-read Phase 5; new `crm_lead_interest_lines` table deferred.

## Commands

```bash
cd backend
npx tsx scripts/prisma-cli.ts migrate deploy
npx prisma generate
npx tsx scripts/crm-item-migration-metrics.ts
# optional: --tenant=vasant-trailers
```

## Explicit non-goals (later phases)

- Do not switch CRM Product pickers (Phase 6)
- Do not backfill document `itemId` (Phase 4)
- Do not drop `master_products` (Phase 10)
