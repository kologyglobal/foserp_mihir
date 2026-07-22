# Accounting Master Reuse

Architecture baseline for Accounting AR/AP party and line masters.

## Hard rules

1. **No `FinanceCustomer` / `FinanceVendor` tables.** Accounting must not invent parallel party masters.
2. **AR customer** = soft link `SalesInvoice.customerId` → `CrmCompany` (via customer-party / accounting-customer-resolver). No Prisma FK.
3. **AP vendor** = soft link `VendorInvoice.vendorId` → `MasterVendor` (via accounting-vendor-resolver). No Prisma FK.
4. **Source documents** (Sales Order, Purchase Order, GRN) are soft references only — existence, tenant, and party match are application-validated.
5. Snapshots on invoices are the historical SoT for posted documents. Refresh-from-master is **DRAFT-only**.

## Resolver boundary

Adapters live under `backend/src/modules/accounting/shared/master-resolvers/`:

| Resolver | Master |
|----------|--------|
| `accounting-customer-resolver` | `CrmCompany` (wraps customer-party) |
| `accounting-vendor-resolver` | `MasterVendor` |
| `accounting-item-resolver` | `MasterItem` |
| `accounting-tax-resolver` | HSN / GST group / GST rate |
| `accounting-location-resolver` | Finance `Branch` |
| `accounting-payment-terms-resolver` | CRM `payment-terms` masters + days |
| `accounting-source-document-resolver` | SO / PO / GRN eligibility |

## Lookup APIs

Tenant-scoped under `/api/v1/t/:tenantSlug/accounting/lookups/…` (also `/tenants/:tenantId/…`):

- `customers`, `vendors`, `items`
- `sales-orders` (+ `/:id/invoice-eligibility`)
- `purchase-orders`, `grns` (+ eligibility)

## Frontend wiring (Wave 6)

- Client: `frontend/src/services/api/accountingLookupsApi.ts` (all lookup + eligibility endpoints).
- Refresh helpers: `receivablesApi.ts` / `payablesApi.ts` → `preview…RefreshFromMaster` / `apply…RefreshFromMaster`; used by `MasterRefreshModal` (server diff in API mode, DRAFT-only).
- Pickers: `CustomerMasterSelect` / `VendorMasterSelect` with `source="accounting"`; SI SO picker and VI PO/GRN pickers call the lookups with `eligibleOnly`. Store fallback in demo mode; **no mock fallback in API mode**.

## Test coverage (Wave 6)

- `backend/tests/finance/finance-ar-master-reuse.test.ts` (11) — CrmCompany resolve, unknown/cross-tenant/inactive rejection, DIRECT vs SALES_ORDER, snapshot stability + refresh-from-master, lookup/eligibility endpoints, no-FinanceCustomer/FinanceVendor guardrail.
- `backend/tests/finance/finance-ap-vendor-invoice-master-reuse.test.ts` (13) — MasterVendor resolve, blocked/cross-tenant/CRM-id rejection, fabricated PO UUIDs, PO/GRN vendor match, source-mode derivation, refresh-from-master, lookup/eligibility endpoints.
- `frontend/scripts/verify-accounting-master-reuse.ts` (39, `npm run test:accounting-master-reuse`) — static e2e-intent smokes.

## Out of scope

- Posting / approval / allocation / reversal engine redesign
- Merging Purchase Invoice into Vendor Invoice
- Adding Prisma FKs for UI convenience
