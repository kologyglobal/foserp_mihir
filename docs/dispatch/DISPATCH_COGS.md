# COGS (Cost of Goods Sold) from Dispatch

## Rule (FOS)

```text
Post Dispatch
→ Reduce FG inventory (stock movement)
→ Create InventoryAccountingEvent (FG_DISPATCH / COGS)
→ Post through central Accounting engine
   only when Finance configuration is enabled for the Legal Entity
```

```text
Dr Cost of Goods Sold
Cr Finished Goods Inventory
```

Sales Invoice posts **revenue** separately (receivable / sales / GST).  
Do **not** also post COGS on Sales Invoice (`ENABLE_SI_COGS_POSTING` stays OFF).

## Ownership (non-negotiable)

| Layer | Responsibility |
|-------|----------------|
| **Dispatch UI / pages** | Confirm/post outbound only — **never** create COGS, vouchers, or account lines |
| **DispatchPostingService** | Reduce FG qty; thin hook `tryRecordInventoryAccountingEventsForMovements` |
| **Inventory Accounting** | Create COGS event; gate on `INVENTORY_ACCOUNTING` per **Legal Entity**; call central `post()` |
| **Finance default mappings** | Resolve `COST_OF_GOODS_SOLD` + `FINISHED_GOODS_INVENTORY` accounts per LE |

## Legal Entity policy

- Feature flag: `FinanceFeatureControl` key `INVENTORY_ACCOUNTING` (**per legal entity**)
- Enable: `PUT /inventory/accounting/feature-controls/:legalEntityId`
- Requires mappings: `COST_OF_GOODS_SOLD`, `FINISHED_GOODS_INVENTORY` for that LE
- Flag off → event status `SKIPPED_FLAG_OFF` (stock still posts; no G/L)
- Zero movement value → `SKIPPED_ZERO`

## Example

Fuel Tank FG cost ₹4,00,000 (`avgRate` on stock). Post dispatch of 1 tank → COGS voucher ₹4,00,000 when the LE flag is on.

## Controls

| Control | Behaviour |
|---------|-----------|
| Idempotent | One event per movement (`INV_ACCT:{movementId}:V1`) |
| Partial dispatch | Amount = qty × movement rate |
| Reverse | Compensating `FG_DISPATCH_REVERSAL` via same inventory-accounting path |
| Reverse blocker | Posted inv-acct → `COGS_OR_INV_ACCT_POSTED` |

## Key files

- `dispatch-posting.service.ts` — FG issue + thin accounting hook
- `inventory-accounting-event.service.ts` — event + central `post()`
- `inventory-accounting-builder.service.ts` — mapping pair
- `inventory-accounting-feature.service.ts` — LE enable / readiness
- `inventory-accounting-gate.service.ts` — `isInventoryAccountingEnabled(tenant, LE)`

## Related

- Auto Draft SI: [`DISPATCH_AUTO_SALES_INVOICE.md`](./DISPATCH_AUTO_SALES_INVOICE.md)
- Reverse deps: [`DISPATCH_REVERSAL_DEPENDENCIES.md`](./DISPATCH_REVERSAL_DEPENDENCIES.md)
