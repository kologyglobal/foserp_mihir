# Kology Sales Flow

```text
Sales Order (confirmed)
  → optional Proforma → advance Receipt (Money In) → Allocate
  → Sales Invoice (Accounting AR) full | partial | remaining
  → Receipt → Allocate → Outstanding 0
```

- Canonical invoice: Accounting `SalesInvoice`
- Block over-invoicing
- No warehouse / stock / manufacturing / dispatch for SERVICES
- SO invoiceability: Total / Already Invoiced / Remaining
