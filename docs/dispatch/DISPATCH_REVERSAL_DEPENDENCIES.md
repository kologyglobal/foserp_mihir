# Dispatch Reversal Downstream Blockers

## Scope

**Shipped:** hard-block reverse when Finance has already claimed the outbound via Sales Invoice links or posted inventory/COGS events.

**COGS creation:** Posted Dispatch → `InventoryAccountingEvent` `FG_DISPATCH` → G/L when `INVENTORY_ACCOUNTING` is enabled — see [`DISPATCH_COGS.md`](./DISPATCH_COGS.md).

**Still deferred (by design):** Sales Invoice COGS pair (`ENABLE_SI_COGS_POSTING`) — leave OFF so cost is not double-posted.

## Codes

| Code | When |
|------|------|
| `SALES_INVOICE_POSTED` | ACTIVE `SalesInvoiceSourceLink` (`OUTBOUND_DISPATCH`) or header `sourceType=OUTBOUND_DISPATCH` on a **POSTED** invoice |
| `SALES_INVOICE_OPEN` | Same links / header on **DRAFT** or **READY_TO_POST** invoice |
| `COGS_OR_INV_ACCT_POSTED` | `InventoryAccountingEvent` for this outbound with `status=POSTED` and type `FG_DISPATCH` / `FG_DISPATCH_REVERSAL` |

`RECORDED` / `SKIPPED_*` inventory accounting events do **not** block.

## API

- `GET /dispatch/outbound/:id/reversal-dependencies` — list deps (no mutate)
- Reverse / create reversal / apply — hard **409** when deps exist
- Bypass: `force: true` **and** `dispatch.override` only

## Operator path

1. Reverse or release the Sales Invoice (links → `RELEASED`) / reverse COGS GL  
2. Then reverse Dispatch  
3. Supervisor override is exceptional (`force` + override permission)

## Related

- `docs/dispatch/DISPATCH_REVERSAL.md`
- Policy: `blockReversalWhenInvoiced` / `blockReversalWhenCogsPosted` in `dispatch-policy.ts`
