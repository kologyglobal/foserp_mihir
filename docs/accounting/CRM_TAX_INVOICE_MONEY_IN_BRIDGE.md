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
  → syncs amountPaid / balanceDue / paymentStatus / lastPaymentDate back to CrmTaxInvoice
  → visible on Sales Tax Invoices + Customer 360
```

CRM payment receipts are a separate commercial document. Record cash in books via  
**Record in Money In** (`CustomerReceipt` with `sourceType=CRM_PAYMENT_RECEIPT`) — never GL from CRM.  
See `docs/CRM_ACCOUNTING_RECEIPT_ARCHITECTURE.md`.

## APIs

| Method | Path | Permission |
|--------|------|------------|
| GET | `/accounting/receivables/invoices/crm-pending` | `finance.ar.invoice.view` |
| POST | `/accounting/receivables/invoices/prefill-from-crm-tax-invoice` | `finance.ar.invoice.create` |
| POST | `/crm/commercial/receipts/:id/create-accounting-draft` | draft create + `finance.ar.receipt.create` |

Create SI with `sourceType: CRM_TAX_INVOICE` + `sourceDocumentId` = CRM tax invoice id.

## Rules

- After conversion, CRM commercial allocation against that invoice is blocked — use Money In.
- Pending-review CRM invoices also cannot take CRM allocations until converted.
- Existing posted CRM tax invoices are backfilled to `pending_review` by migration.
- CRM allocate/reverse returns: *This invoice is managed by Accounting Money In…*
