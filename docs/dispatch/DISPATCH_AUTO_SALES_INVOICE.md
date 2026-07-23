# Auto Draft Sales Invoice from Dispatch

## Rule

```text
Posted Dispatch
→ DRAFT Sales Invoice (automatic)
→ Finance / Sales reviews
→ Post Invoice (manual)
```

Never auto-**post** the invoice in this release.

## Feature flag

`ENABLE_AUTO_SALES_INVOICE_FROM_DISPATCH`

- Default **ON** outside production
- Default **OFF** in production until explicitly enabled
- Set `true` / `false` to override

## Trigger

1. Dispatch posting commits and enqueues `SALES_ORDER_INVOICE_READY`.
2. Outbox drain runs `createDraftSalesInvoiceFromDispatchPosting`.
3. Creates (or returns existing) **DRAFT** SI with `sourceType = OUTBOUND_DISPATCH`.

## Controls

| Control | Behaviour |
|---------|-----------|
| Idempotent | Snapshot `autoFromDispatchPostingId` — one SI per posting |
| Partial dispatch | Invoice qty = invoice-ready qty (net posted − already linked) |
| Already invoiced | Excluded via ACTIVE `SalesInvoiceSourceLink` |
| Reversed / cancelled | Skip create; no new draft |
| Links | OUTBOUND_DISPATCH (+ SO / challan refs on links) |
| Snapshot | Customer party + SO commercial rates/discounts + addresses in `sourceDocumentSnapshot` |
| Status | Always `DRAFT` (`invoiceNumber` null) |

## Key files

- `dispatch-auto-sales-invoice.service.ts`
- `invoice-ready.service.ts` (`buildInvoicePrefillFromDispatchLines`)
- `dispatch-domain-events.service.ts` (`SALES_ORDER_INVOICE_READY` handler)
- `sales-invoice.repository.ts` (persists source links on create)

## Related

- Reverse is hard-blocked only when a **POSTED** SI source-links the outbound.
- On reverse apply, linked **DRAFT / READY_TO_POST** outbound SIs have links released and status set to **CANCELLED** (so reverse still works after auto-draft).
