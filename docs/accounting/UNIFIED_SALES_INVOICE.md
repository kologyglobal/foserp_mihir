# Unified Sales Invoice (CRM + Money In)

**Canonical document:** Accounting `SalesInvoice` (`sales_invoices`).

CRM Tax Invoice and Money In Sales Invoice are **one** business entity:

- One UUID, one invoice number (SI series at post), one status
- CRM create/update/post go through `crm-unified-sales-invoice.service.ts` → `SalesInvoice`
- Money In lists/details use the same rows
- Payments, allocations, credit notes, GST, ageing attach to `SalesInvoice` only

## Lifecycle

```text
Quotation → Sales Order → SalesInvoice (DRAFT)
  → Mark Ready (CRM “Post” or Money In)
  → Post GL (finance.ar.invoice.post)
  → Receipt allocate / credit notes / open items
```

CRM “Post” marks **READY_TO_POST**. GL post runs only if the user also has `finance.ar.invoice.post`.

## Legacy

- `crm_tax_invoices` retained for historical rows; `SalesInvoice.legacyCrmTaxInvoiceId` redirects old CRM IDs
- Migration: `20260804020000_unify_sales_invoice_commercial` stamps converted pairs
- Script: `npx tsx scripts/migrate-crm-tax-invoices-to-sales-invoices.ts` for CRM-only rows
- Convert queue `/accounting/money-in/crm-pending` redirects to invoices list
- Payment sync CRM←AR is a **no-op**

## Deprecated bridge

See former flow in git history / `CRM_TAX_INVOICE_MONEY_IN_BRIDGE.md` (pointer only).
