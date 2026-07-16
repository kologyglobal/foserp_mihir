# CRM Quotation to Sales Order Handover — Completion Report

**Project:** Vasant Trailer ERP  
**Sprint:** CRM Quotation → Sales Order Handover  
**Date:** 29 June 2026  

---

## Executive Summary

CRM now owns the complete pre-sales lifecycle through Sales Order creation. After conversion, CRM shows linked Sales Orders as read-only references. MRP, production, dispatch, invoice, and payment execution remain in the Sales / ERP modules.

**Final verdict: CRM to Sales Order Handover Ready**

---

## 1. CRM Scope Clarified

| CRM owns | Sales / ERP owns (post-SO) |
|----------|----------------------------|
| Lead, Customer, Contact, Opportunity | Sales Order execution |
| Follow-up, Activity | SO confirmation |
| Quotation, Approval, Revision | MRP |
| Convert to Sales Order | Production, Dispatch |
| Handover complete message | Invoice, Payment |

CRM surfaces no `Run MRP`, Work Order, Dispatch, or Invoice actions after quotation conversion.

---

## 2. Convert to Sales Order Button

Added via `ConvertQuotationToSOAction` + `ConvertQuotationToSOModal`:

- Quotation list (card + table row)
- Quotation 360 command bar + status panel
- Quotation preview toolbar
- Opportunity 360 quotation tab
- Customer 360 via linked quotation views

**Visibility rules:**
- Shown only when latest revision is **Approved**
- Disabled for Draft, Sent, Under Approval, Rejected, Expired
- Replaced with **Open Sales Order** after conversion

---

## 3. Conversion Validations

`src/utils/crmQuotationSoConversion.ts` validates before conversion:

- Customer + billing address
- Contact person
- Approved status + latest revision
- Price lines (qty, unit price, GST, grand total)
- Payment terms, delivery terms, validity
- Approval history complete

Blocked states show: *"Only latest approved quotation revision can be converted to Sales Order."*

---

## 4. Conversion Modal

Modal title: **Convert Quotation to Sales Order**

Displays quotation summary (customer, product, amounts, terms) plus handover fields:

- Customer PO Number / Date
- Expected Delivery Date
- Delivery Location
- Internal Remarks

Actions: Cancel · Convert to Sales Order

---

## 5. Sales Order Data Mapping

Extended `SalesOrder` type (`src/types/mrp.ts`) with:

- Source (`quotation` | `direct`)
- Customer PO, delivery location, billing/shipping addresses
- Basic amount, GST amount, commercial fields
- `SalesOrderLine[]` with full commercial breakdown
- Status `open` displayed as **Draft SO** in list UI

Conversion chain: `crmStore.convertQuotationDocumentToSalesOrder` → `salesStore.createSalesOrderFromQuotation` → `mrpStore.addSalesOrderFromQuotation`

---

## 6. Sales Module — Menu & Pages

**Sidebar:** Sales → Sales Orders (`/sales/orders`)

| Route | Page |
|-------|------|
| `/sales/orders` | Enhanced list (KPIs, source filter, View/Edit) |
| `/sales/orders/new` | Direct SO with management warning |
| `/sales/orders/:id` | SO 360 view (MRP/production stays here) |
| `/sales/orders/:id/edit` | Draft SO edit + save |

---

## 7. CRM Post-Conversion Behavior

After conversion:

- Quotation `status = converted`, locked, stores `salesOrderId` / `salesOrderNo`
- Opportunity `status = won`
- Timeline: *"Quotation QT-XXXX Rev X converted to Sales Order SO-XXXX."*
- Handover complete message on Quotation 360
- **Open Sales Order** button replaces Convert

---

## 8. CRM Dashboard Metrics

Added to `buildCrmDashboardMetrics`:

- Approved Quotations Not Converted
- Converted to Sales Order This Month
- Quotation → SO Conversion Rate

---

## 9. Operational Actions Removed from CRM

Verified: no MRP / production / dispatch / invoice triggers in CRM quotation surfaces. `getWonDealNextErpStep` now directs users to Sales module for SO follow-up.

---

## 10. Tests

**Script:** `npm run test:crm-quotation-to-so-handover`  
**Result:** 24/24 passed

Wired into:

- `test:ci`
- `test:uat`
- `test:eeta-100`
- `test:full-system-uat`

---

## 11. Remaining Gaps

| Gap | Priority |
|-----|----------|
| Direct SO confirmation without quotation link (confirm gate still expects quotation) | Medium |
| Customer 360 dedicated Sales Orders tab (reference shown via opportunity/quotation links) | Low |
| Sales owner filter on SO list | Low |
| Print/export on SO list row actions | Low |
| Amendment workflow for confirmed SO commercial changes | Future sprint |

---

## Files Changed (key)

- `src/utils/crmQuotationSoConversion.ts` — validation + preview
- `src/components/crm/ConvertQuotationToSOAction.tsx` — button + modal
- `src/store/crmStore.ts` — handover conversion
- `src/store/salesStore.ts` — extended SO creation + direct SO
- `src/store/mrpStore.ts` — extended SO model + draft update
- `src/types/mrp.ts`, `src/types/crm.ts` — type extensions
- `src/modules/sales/SalesPages.tsx` — enhanced SO list
- `src/modules/sales/SalesOrderFormPage.tsx` — new/edit pages
- `scripts/test-crm-quotation-to-so-handover.ts` — test suite

---

**Sign-off:** CRM pre-sales handover to Sales Order is implemented, tested, and ready for UAT.
