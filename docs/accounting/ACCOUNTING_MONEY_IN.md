# Accounting Money In — Customer Collections

Money In is the **canonical** surface for customer AR:

| Document | Owner |
|----------|--------|
| Posted sales invoices | `SalesInvoice` |
| Customer receipts | `CustomerReceipt` |
| Allocations | `CustomerReceiptAllocation*` |
| Advances / unallocated credits | Receipt open items (CREDIT) |
| Outstanding / ageing / GL | Receivables open items + posting engine |

## CRM relationship

- **Tax invoices:** Convert `CrmTaxInvoice` → SI via CRM pending / prefill (source `CRM_TAX_INVOICE`).
- **Payments:** Commercial `CrmPaymentReceipt` may create a **draft** CustomerReceipt
  (`sourceType=CRM_PAYMENT_RECEIPT`) — finance posts and allocates in Money In.
- Historical CRM receipts remain commercial-only until migrated (`commercialOnly` / migration status).

Full architecture: [`docs/CRM_ACCOUNTING_RECEIPT_ARCHITECTURE.md`](../CRM_ACCOUNTING_RECEIPT_ARCHITECTURE.md).

## Primary UI paths

```text
/accounting/money-in
/accounting/money-in/invoices
/accounting/money-in/receipts
/accounting/money-in/receipts/:id/allocate
/accounting/money-in/crm-pending
/accounting/money-in/crm-receipt-migration
/accounting/money-in/outstanding
/accounting/money-in/ageing
```

## API root

```text
/api/v1/t/:tenantSlug/accounting/receivables/*
```

Receipt lifecycle remains **draft → ready → post → allocate** (post-first). No auto-post from CRM.
