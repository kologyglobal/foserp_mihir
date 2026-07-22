# Invoice UX Standard

Frontend waves (3–5) align Money In Sales Invoices and Money Out Vendor Invoices with CRM / Purchase shells. Wave 6 wired the FE to the contracts below: `accountingLookupsApi.ts` (lookups + eligibility), `receivablesApi`/`payablesApi` refresh helpers, `MasterRefreshModal` server preview/apply, and `source="accounting"` party pickers.

## Backend contracts FE should use

Base: `/api/v1/t/:tenantSlug/accounting` (also `/api/v1/tenants/:tenantId/accounting`).

### Lookups (paginated `{ data, meta: { page, limit, total, totalPages } }`)

| Method | Path | Query | Item shape (key fields) |
|--------|------|-------|-------------------------|
| GET | `/lookups/customers` | `search`, `page`, `limit`, `activeOnly`/`isActive` | `id, code, name, gstin, pan, stateCode, city, email, phone, contactPerson, creditDays, isActive` |
| GET | `/lookups/customers/:id` | — | same |
| GET | `/lookups/vendors` | `search`, `page`, `limit`, `activeOnly` | `id, code, name, gstin, pan, stateCode, city, paymentTermsDays, isActive, isBlocked` |
| GET | `/lookups/vendors/:id` | — | same |
| GET | `/lookups/items` | `search`, `page`, `limit`, `activeOnly`, `itemType` | `id, code, name, itemType, hsnCode, hsnId, gstGroupId, baseUomId, standardRate, status, isActive` |
| GET | `/lookups/items/:id` | — | same |
| GET | `/lookups/sales-orders` | `search`, `customerId`, `eligibleOnly` (default true), `page`, `limit` | `id, orderNumber, customerId, status, orderDate, customerPoNumber, qty` |
| GET | `/lookups/sales-orders/:id/invoice-eligibility` | `customerId?` | `{ eligible, documentId, documentNumber, documentDate, status, partyId, errors[], warnings[], snapshot }` |
| GET | `/lookups/purchase-orders` | `search`, `vendorId`, `eligibleOnly`, `page`, `limit` | `id, orderNumber, vendorId, status, orderDate, currencyCode, totalAmount` |
| GET | `/lookups/purchase-orders/:id/invoice-eligibility` | `vendorId?` | eligibility shape as SO |
| GET | `/lookups/grns` | `search`, `vendorId`, `purchaseOrderId`, `eligibleOnly`, `page`, `limit` | `id, grnNumber, vendorId, purchaseOrderId, purchaseOrderNumber, status, receiptDate` |
| GET | `/lookups/grns/:id/invoice-eligibility` | `vendorId?` | eligibility shape as SO |

Permissions: AR lookups need `finance.ar.invoice.view`; AP lookups need `finance.ap.vendor_invoice.view`; items accept either.

### Refresh from Master (DRAFT only)

| Method | Path | Response |
|--------|------|----------|
| POST | `/receivables/invoices/:id/refresh-from-master/preview` | `{ invoiceId, customerId, current, proposed, changedFields[] }` |
| POST | `/receivables/invoices/:id/refresh-from-master` | full sales invoice detail |
| POST | `/payables/vendor-invoices/:id/refresh-from-master/preview` | `{ invoiceId, vendorId, current, proposed, changedFields[] }` |
| POST | `/payables/vendor-invoices/:id/refresh-from-master` | full vendor invoice detail |

### Vendor invoice create/update

- Optional `sourceMode`: `DIRECT` \| `PURCHASE_ORDER` \| `GRN` \| `PURCHASE_ORDER_AND_GRN`
- `sourceLinks[]` with real PO/GRN UUIDs (fabricated IDs rejected)
- Response may include `sourceMode` + `metaWarnings`

## UX principles (for FE waves)

1. Closed selects show `— Select —` (`SELECT_PLACEHOLDER`); options only on open.
2. API failure shows unavailable — never mock fallback in API mode.
3. Posted documents render snapshots; if master missing, drill-down shows “Historical Party Snapshot”.
4. Keep Money In Customers / Money Out Vendors tabs (subledger position views, not masters).
5. Prefer CRM-style SI shell and Purchase-style VI shell (see plan Waves 3–4).

## Architecture reminder

No `FinanceCustomer` / `FinanceVendor`. Soft links only.
