# CRM Tax Invoice → Money In AR Bridge

## Flow

```text
CRM user creates Tax Invoice (draft)
  → posts invoice
  → accountingStatus = pending_review (tagged with createdByName)

Accounting → Money In → CRM Tax Invoices
  → Convert to Money In
  → /accounting/money-in/invoices/new (prefill, sourceType=CRM_TAX_INVOICE)
  → Save draft → links CrmTaxInvoice.salesInvoiceId (converted)
  → Mark ready → Post (ReceivableOpenItem)

Money In receipt + allocation
  → syncs amountPaid / balanceDue / paymentStatus back to CrmTaxInvoice
  → visible on Sales Tax Invoices + Customer 360
```

## APIs

| Method | Path | Permission |
|--------|------|------------|
| GET | `/accounting/receivables/invoices/crm-pending` | `finance.ar.invoice.view` |
| POST | `/accounting/receivables/invoices/prefill-from-crm-tax-invoice` | `finance.ar.invoice.create` |

Create SI with `sourceType: CRM_TAX_INVOICE` + `sourceDocumentId` = CRM tax invoice id.

## Rules

- After conversion, CRM commercial allocation against that invoice is blocked — use Money In.
- Pending-review CRM invoices also cannot take CRM allocations until converted.
- Existing posted CRM tax invoices are backfilled to `pending_review` by migration.
