# Sales Invoice ↔ CRM Integration

## Party

- `SalesInvoice.customerId` soft-links to `CrmCompany`.
- Resolved via `customer-party` / `accounting-customer-resolver`.
- Create/update/validate/post revalidate: tenant match, not deleted, active/eligible.
- Party snapshots (`customer*Snapshot`) persist at draft write; posted docs render snapshots.
- DRAFT-only **Refresh from Master** preview + apply endpoints rewrite party snapshots from live `CrmCompany`.

## Source modes

| Mode | Meaning |
|------|---------|
| `DIRECT` | No sales order; `sourceDocumentId` must be omitted |
| `SALES_ORDER` | Requires `sourceDocumentId` → `CrmSalesOrder` |
| `OUTBOUND_DISPATCH` | Requires `sourceDocumentId` → confirmed `OutboundDispatch` + `sourceLinks[]` consuming dispatch-line qty |

### Invoice-ready quantity (O2C)

```text
Invoice-Ready Qty = Confirmed Dispatched Qty − ACTIVE previously-invoiced qty
```

Returned physical qty is deferred (treat as 0). Consumption is stored on soft `SalesInvoiceSourceLink` rows (`ACTIVE` / `RELEASED` on cancel or reverse). No second invoice system in CRM/Dispatch.

Eligibility (application-validated):

- SO exists for tenant, not soft-deleted
- Status in whitelist (`open`, `confirmed`, `in_production`, `ready_dispatch`, `dispatched`)
- Rejects `cancelled` / `canceled` for SO source; closed SO may still invoice remaining dispatched qty (commercial)
- `companyId` must equal invoice `customerId`
- Dispatch source: status must be `CONFIRMED`; hard remaining-qty on create/update/post
- Warning when another non-cancelled SI already links the SO

### Project snapshots

Optional `projectRef` + `projectNameSnapshot` on `CrmSalesOrder`, `SalesInvoice`, and `SalesInvoiceLine` (no Project master in this phase). Cost centre continues via `SalesInvoiceLine.costCentreId`.

## Lookups & invoice-ready

- `GET …/accounting/lookups/customers`
- `GET …/accounting/lookups/customers/:id`
- `GET …/accounting/lookups/sales-orders`
- `GET …/accounting/lookups/sales-orders/:id/invoice-eligibility`
- `GET …/accounting/lookups/dispatches`
- `GET …/accounting/lookups/dispatches/:id/invoice-eligibility`
- `GET …/accounting/receivables/invoices/invoice-ready`
- `POST …/accounting/receivables/invoices/prefill-from-dispatch`

## CRM commercial position (read-only)

- `GET …/crm/sales-orders/:id/commercial-position`
- `GET …/crm/companies/:id/commercial-position`
- Ops tiles: CRM/dispatch view. Money tiles require `finance.ar.view` / `finance.ar.invoice.view`.
- Never persist Ordered/Dispatched/Invoiced/Collected/Outstanding on the SO.

## Settlement labels

Document statuses remain `DRAFT` / `READY_TO_POST` / `POSTED` / `CANCELLED` / `REVERSED`.
Derived collection labels (`UNPAID` / `PARTIALLY_PAID` / `PAID` / `OVERDUE`) come from `ReceivableOpenItem` + due date — exposed as `settlementStatus` on SI DTO.

## COGS (optional)

Env `ENABLE_SI_COGS_POSTING=true` (default off) may append Dr COGS / Cr FG Stock on SI post when FG cost + mappings exist. No GL from Dispatch confirm.

## Frontend + tests

- Money In: Invoice Ready · Overdue · Collections worklists; SI form accepts dispatch prefill + project fields.
- Coverage: `backend/tests/unit/o2c-settlement-status.test.ts`; `backend/tests/o2c-wave5-commercial-position.test.ts`; FE `test:money-in`.

## Guardrails

- Do **not** create `FinanceCustomer` or a second invoice/collection module.
- Do **not** add Prisma FK from `SalesInvoice` to `CrmCompany` / `CrmSalesOrder` / `OutboundDispatch`.
- Do **not** auto-post revenue from Dispatch; physical sales returns deferred.
