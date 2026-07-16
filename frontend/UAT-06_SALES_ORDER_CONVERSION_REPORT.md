# UAT-06 — Sales Order Conversion

**Date:** 2026-07-11
**Overall:** ✅ PASS (40/40)

## Scope

Validates CRM quotation → Sales Order handover in **demo mode** (`VITE_USE_API=false`) and **live API** conversion when backend is reachable.

| ID | Area | Test | Status | Notes |
|----|------|------|--------|-------|
| UAT-06.1 | Conversion flow | validateQuotationForSoConversion guards approved latest revision | PASS |  |
| UAT-06.2 | Line mapping | buildSalesOrderLinesFromQuotationDocument maps price lines | PASS |  |
| UAT-06.3 | Conversion flow | ConvertQuotationToSOAction routes to new SO form | PASS |  |
| UAT-06.4 | Conversion flow | SalesOrderCreatePage calls convertQuotationDocumentToSalesOrder | PASS |  |
| UAT-06.5 | SO numbering | mrpStore generates SO numbers via code series / documentNumbers | PASS |  |
| UAT-06.6 | Quotation linkage | Sales order 360 shows quotation link strip | PASS |  |
| UAT-06.7 | CRM handover | Quotation 360 shows handover-complete message after conversion | PASS |  |
| UAT-06.8 | CRM handover | CRM convert flow has no MRP / production / invoice actions | PASS |  |
| UAT-06.9 | Sales module | Sales order list/view/edit routes registered | PASS |  |
| UAT-06.10 | Duplicate guard | salesStore.createSalesOrderFromQuotation blocks existing salesOrderId | PASS |  |
| UAT-06.11 | Persistence | CRM + MRP + sales stores use persisted localStorage keys | PASS |  |
| UAT-06.12 | SO numbering | Code series maps SO- prefix to sales_order entity | PASS |  |
| UAT-06.13 | Conversion guard | Draft quotation cannot convert | PASS |  |
| UAT-06.14 | Conversion flow | Approved quotation can convert to sales order | PASS |  |
| UAT-06.15 | Conversion flow | convertQuotationDocumentToSalesOrder succeeds | PASS | SO-2026-0193 |
| UAT-06.16 | Customer data | SO customerId matches quotation customer | PASS | cust-abc |
| UAT-06.17 | Customer data | SO billing address matches customer master | PASS |  |
| UAT-06.18 | Line parity | SO line count matches quotation non-optional lines | PASS | 1 vs 1 |
| UAT-06.19 | Line parity | SO line qty, unit price, and line total match quotation | PASS |  |
| UAT-06.20 | Totals | SO grand total matches quotation summary | PASS | 2499999.92 vs 2499999.92 |
| UAT-06.21 | Quotation linkage | SO stores quotationId, quotationNo, and revision | PASS | QT-2026-0031 rev 1 |
| UAT-06.22 | Quotation linkage | SO stores quotation document id and revision | PASS |  |
| UAT-06.23 | SO numbering | SO number generated with SO- prefix and is unique | PASS | SO-2026-0193 |
| UAT-06.24 | SO numbering | New SO appended to sales order register | PASS |  |
| UAT-06.25 | Quotation linkage | Quotation document status becomes converted | PASS |  |
| UAT-06.26 | Quotation linkage | Sales quotation record links salesOrderId | PASS |  |
| UAT-06.27 | CRM handover | Opportunity status becomes won with salesOrderId | PASS |  |
| UAT-06.28 | Commercial terms | Payment and delivery terms carried to SO | PASS |  |
| UAT-06.29 | Handover fields | Customer PO and delivery fields stored on SO | PASS |  |
| UAT-06.30 | Duplicate guard | Second conversion attempt is blocked | PASS | Quotation is already converted to a Sales Order. |
| UAT-06.31 | Persistence | Persisted quotation document retains converted status + SO link | PASS |  |
| UAT-06.32 | Persistence | Persisted sales order retains quotation linkage | PASS |  |
| UAT-06.33 | Persistence | Persisted sales quotation retains salesOrderId | PASS |  |
| UAT-06.34 | CRM handover | CRM timeline logs sales_order_created activity | PASS |  |
| UAT-06.35 | CRM handover | Convert action shows View Sales Order when salesOrderId exists | PASS |  |
| UAT-06.36 | CRM handover | CRM sales-order register path separate from sales module execution | PASS |  |
| UAT-06.37 | Live API | Sales orders route reachable | PASS | HTTP 200 |
| UAT-06.38 | Live API | Convert approved quotation to SO | PASS | SO-000004 |
| UAT-06.39 | Live API | Duplicate SO conversion blocked | PASS | HTTP 422 |
| UAT-06.40 | Live API | SO persists after re-GET | PASS | SO-000004 |

## Manual sign-off checklist

- [ ] Open an **Approved** quotation (latest revision) in CRM → **Create Sales Order**
- [ ] Sales order form prefills customer, lines, payment/delivery terms from quotation
- [ ] Enter Customer PO + expected delivery → save → lands on Sales Order 360
- [ ] Verify SO number (`SO-…`) is unique in `/sales/orders` list
- [ ] SO 360 shows quotation link; amounts match quotation price table
- [ ] Return to quotation 360 — status **Converted**, handover message, **View Sales Order** button
- [ ] Refresh browser — SO and quotation linkage still present (demo localStorage)
- [ ] Attempt second conversion — blocked with clear message
- [ ] CRM quotation/opportunity views have no Run MRP / production / invoice actions
- [ ] MRP / production / dispatch run from **Sales** module only

## Demo credentials

- Tenant: `vasant-trailers`
- Email: `admin@vasant-trailers.com`
- Password: `Admin@123`

## Related automation

- `npm run test:crm-quotation-to-so-handover` — handover regression
- `npm run test:crm-multiline-quotation-to-so` — multi-line parity
