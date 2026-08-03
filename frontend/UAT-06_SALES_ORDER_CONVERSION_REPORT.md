# UAT-06 — Sales Order Conversion

**Date:** 2026-07-29
**Overall:** ❌ FAIL (13/17)

## Scope

Validates CRM quotation → Sales Order handover in **demo mode** (`VITE_USE_API=false`) and **live API** conversion when backend is reachable.

| ID | Area | Test | Status | Notes |
|----|------|------|--------|-------|
| UAT-06.1 | Conversion flow | validateQuotationForSoConversion guards approved latest revision | PASS |  |
| UAT-06.2 | Line mapping | buildSalesOrderLinesFromQuotationDocument maps price lines | PASS |  |
| UAT-06.3 | Conversion flow | ConvertQuotationToSOAction routes to new SO form | FAIL |  |
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
| UAT-06.14 | Conversion flow | Approved quotation can convert to sales order | FAIL |  |
| UAT-06.15 | Conversion flow | convertQuotationDocumentToSalesOrder succeeds | FAIL | Select an Item for Standard trailer requirement. |
| UAT-06.37 | Live API | Sales orders route reachable | PASS | HTTP 200 |
| UAT-06.38 | Live API | SO conversion live test | FAIL | Validation failed |

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
