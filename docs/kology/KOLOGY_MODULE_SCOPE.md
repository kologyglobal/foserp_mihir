# Kology Module Scope

Tenant packaging for `businessType = SERVICES`.

## Enabled

| Catalog key | UI |
|-------------|-----|
| `crm` | CRM + Sales (sales aliases to crm) |
| `accounting` | Money In/Out, Journals, GL, Bank & Cash |
| `masters` | Items (Services), vendors, customers, tax, payment terms, bank accounts, cost centres |
| `reports` | CRM / finance reports that remain relevant |

## Disabled (code retained)

`purchase`, `inventory`, `manufacturing`, `quality`, `dispatch`, `logistics`, `gate`

## Hidden commercial chrome (SERVICES)

- CRM Tax Invoices + CRM payment allocation (Accounting AR is SoT)
- Manufacturing Product master / trailer quotation templates
- SO Production, Dispatch, Reservation panels

See `KOLOGY_REUSE_AUDIT.md`.
