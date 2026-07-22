# Dispatch Reporting Rules (Phase 7D)

Dispatch reports read the **Phase 7C0 thin-slice** ledger only: `OutboundDispatch` +
`OutboundDispatchLine`, `SalesOrderLineFulfilment`, and `CrmSalesOrder`. There is **no**
pick/pack, no `DeliveryChallan`, and no AR invoice link in this build.

Executors: `dispatch-readiness.ts`, `sales-order-fulfilment.ts`, `dispatch-performance.ts`,
`invoice-readiness.ts`.

---

## Dispatch Readiness (`dispatch-readiness`) — READY (with a documented limit)

- Open sales-order lines vs quantity already dispatched, via the CRM sales-order fulfilment
  service: `remainingQty = netOrderedQty − dispatchedQty` (dispatched from CONFIRMED
  `OutboundDispatchLine`; `netOrderedQty` is net of `SalesOrderLineFulfilment.cancelledQty`).
- Only lines with `remainingQty > 0` are shown. `readyToDispatch` reflects **`remainingQty > 0`
  only** — it is not a physical stock check.
- **FG stock is NOT joined:** SO lines reference master *products* while dispatch lines
  reference master *items*, and there is no reliable mapping between them yet. A warning states
  this on every result. Bounded to the 300 most recent open sales orders.

## Sales Order Fulfilment (`sales-order-fulfilment`) — READY

- `fulfilmentPercent = dispatchedQty / orderedQty × 100` from CONFIRMED dispatches linked by
  `salesOrderId`. Bounded to 300 sales orders.

## Dispatch Performance (`dispatch-performance`) — READY

- `leadTimeDays = dispatch.confirmedAt − salesOrder.orderDate`, only when linked to a sales
  order. `dateBasis: confirmedAt`. See `REPORT_CALCULATION_RULES.md` for the "on-time"
  discussion (no stored SLA flag; lateness is a derived exception).

## Invoice Readiness (`invoice-readiness`) — PARTIAL

- **Readiness flags only — no invoice document is created or checked.** `invoiceReady` is
  currently `true` whenever the dispatch is `CONFIRMED`, because there is no FK from
  `OutboundDispatch` to an AR invoice yet to detect an already-invoiced dispatch. Marked
  `PARTIAL`.

## Delivery Challans (`delivery-challans`) — UNAVAILABLE

- **Not implemented.** There is no `DeliveryChallan` model — Dispatch Phase 7C0 ships only
  `OutboundDispatch` + `SalesOrderLineFulfilment` (no `DeliveryChallan` / `DispatchRequirement`
  / pick-pack). Catalog lists it `disabled: true`; querying returns an empty result advising
  use of "Dispatch Readiness" or "Sales Order Fulfilment" instead.
- **Do not present a Delivery Challan register as a live report.**
