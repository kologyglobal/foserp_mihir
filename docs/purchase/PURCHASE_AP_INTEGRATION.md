# Purchase ↔ AP integration

## SoT

Accounting `VendorInvoice` is the vendor liability SoT.

## Handoff

Purchase Invoice **post** → `handoffPurchaseInvoiceToVendorInvoiceDraft` → draft VI (reuses existing link).

Purchase does **not** post GL or open-item payment from the Purchase module.

## UI

- AP handoff panel on invoice detail
- Open in Money Out → `/accounting/money-out/vendor-invoices/:id`

## Returns

No automatic AP credit from Purchase Return → `ACCOUNTING_ADJUSTMENT_PENDING`.
