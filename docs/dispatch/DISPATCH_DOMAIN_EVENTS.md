# Dispatch Domain Events Outbox (Phase 7C5)

## Purpose

Reliable **signal** bus for Dispatch posting / reverse.

## Event types

| Type | When |
|------|------|
| `DISPATCH_POSTED` | Hardened / legacy post creates `DispatchPosting` |
| `SALES_ORDER_DISPATCH_FULFILMENT_CHANGED` | Post or reverse changes net dispatched qty |
| `SALES_ORDER_INVOICE_READY` | Post with sales order — drains to **auto DRAFT Sales Invoice** when flag ON |
| `DISPATCH_REVERSED` | Reversal applied |

## Lifecycle

1. **Enqueue** `PENDING` in the same DB transaction as post / reverse apply.
2. **Drain** after commit (`drainDispatchDomainOutbox`) runs in-process handlers and marks `PUBLISHED`.
3. Failures → `FAILED` + backoff; retry via API.

## Consumers

- `SALES_ORDER_INVOICE_READY` → `createDraftSalesInvoiceFromDispatchPosting` — see [`DISPATCH_AUTO_SALES_INVOICE.md`](./DISPATCH_AUTO_SALES_INVOICE.md).
- COGS G/L is created by Inventory Accounting on FG stock issue — see [`DISPATCH_COGS.md`](./DISPATCH_COGS.md) (not via this outbox).
- Other handlers acknowledge + log.

## Related

- Enqueue / drain: `dispatch-domain-events.service.ts`
- Auto SI: `dispatch-auto-sales-invoice.service.ts`
- COGS: `DISPATCH_COGS.md`
