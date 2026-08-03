# Purchase Invoice UI

Route: `/purchase/invoices`

## Flow

PO / GRN → Create Invoice → Submit (match) → Approve → Post → **Vendor Invoice draft** in Money Out.

## Post messaging (API)

Honest copy: Vendor Invoice draft is created; **GL / open AP posting** remains in Accounting Money Out.

## Actions

- Open in Money Out (when `vendorInvoiceId` linked)
- AP handoff section shows draft status

## Matching

Backend `evaluateMatching` uses Purchase Settings tolerances. FE shows MATCHED / EXCEPTION from API. Demo-only: hold + matching-exception approve buttons.

## Permissions

`purchase.invoice.view|create|edit|submit|approve|post|cancel`
