# Cross-Module Creation Audit

**Date:** 23 Jun 2026  
**Scope:** Can users create required linked data from the page where they need it, without unnecessary navigation?

**Legend:** ✅ Fully Supported · ⚠️ Partially Supported · ❌ Missing · 🔒 Blocked by Permission · 🎨 Needs UX Improvement

---

## Executive Summary

| Area | Verdict | Go-live risk |
|------|---------|--------------|
| Sales pipeline (Inquiry → SO) | ⚠️ Partial | **Medium** — store flows work; inline quick-create missing |
| Production (WO / Job Card) | ⚠️ Partial | **Medium** — MRP-only WO; no contextual BOM blockers in UI |
| Purchase (PR → GRN) | ⚠️ Partial | **Low–Medium** — manual PR works; PO/GRN UI thin |
| Quality / Job Work | ⚠️ Partial | **Medium** — auto-triggered QC; subcontract return UI gap |
| Dispatch / Invoice | ✅ Mostly supported | **Low** — strong store gates |
| Master quick-create | ❌ Missing | **High** — drawer shell exists but unwired |

**Overall:** Backend creation chains are solid. **UX gap:** users must leave transactional screens for almost all missing master/reference data. `useQuickCreate()` in `RightDrawer.tsx` is a **navigation stub** (links to full master routes), with **zero call sites** in forms.

---

## 1. Inquiry Creation

| Capability | Status | Route | Component | Store / Action |
|------------|--------|-------|-----------|----------------|
| Select existing customer | ✅ | `/sales/inquiries/new` | `InquiryFormPage` (`SalesForms.tsx`) | `createInquiry` |
| Add new customer from inquiry page | ❌ | — | — | `masterStore.addCustomer` exists; **not wired** |
| Add new contact person | ❌ | — | — | Contacts live on customer master only |
| Add new product requirement | ⚠️ | `/sales/inquiries/new` | Dropdown only | `useActiveProducts()` — no inline create |
| Save customer + auto-select | ❌ | — | — | No drawer; no post-save hook |

**Classification:** ⚠️ Partially Supported · 🎨 Needs UX Improvement

**Expected UX gap:** No "Add Customer" button near customer dropdown. `useQuickCreate().createCustomer()` opens drawer that only links to `/masters/customers/new`.

**Go-live risk:** Medium — sales users with empty customer list must navigate to Masters, then back to Inquiry.

---

## 2. Quotation Creation

| Capability | Status | Route | Component | Store / Action |
|------------|--------|-------|-----------|----------------|
| Create from inquiry | ✅ | `/sales/inquiries/:id` | `InquiryDetailPage` | `createQuotationFromInquiry` |
| Add/select customer | ⚠️ | Inherited from inquiry | — | No quotation-level picker |
| Add/select product | ⚠️ | Inherited from inquiry | — | — |
| Add custom specification | ❌ | — | — | No spec lines on quotation |
| Add taxes/terms | ⚠️ | `/sales/quotations/:id` | Display only | `updateQuotationDraft` **exists, unused in UI** |
| Add payment/delivery terms | ⚠️ | — | Defaults in store | Hardcoded on create |
| Add revision | ✅ | `/sales/quotations/:id` | Price-only revision | `createQuotationRevision` |

**Classification:** ⚠️ Partially Supported

**Missing:** Standalone `/sales/quotations/new`; editable terms/taxes/discount before submit.

**Go-live risk:** Low–Medium — core Rev 1 flow works; commercial terms require store defaults or manual master edits.

---

## 3. Sales Order Creation

| Capability | Status | Route | Component | Store / Action |
|------------|--------|-------|-----------|----------------|
| Create from approved quotation | ✅ | `/sales/quotations/:id` | `QuotationDetailPage` | `createSalesOrderFromQuotation` → `mrpStore.addSalesOrderFromQuotation` |
| Direct SO (permission + reason) | ❌ | — | — | **No API** |
| Add/select customer/product | ⚠️ | From quotation | — | — |
| Select BOM/routing revision | ⚠️ | — | — | Auto from released BOM at freeze |
| Freeze product/BOM/routing | ⚠️ | `/sales/orders/:id` | Confirm button only | `freezeStore.createFreezeForSo` — **errors swallowed** |
| Delivery terms / customer PO ref | ❌ | — | — | Not on SO form |

**Classification:** ⚠️ Partially Supported · 🔒 Direct SO blocked (by design)

**Rules met:** Preferred flow Quotation → SO enforced. Product must be `released` (`canUseProductInSales`).

**Go-live risk:** Medium — freeze failure silent on confirm; no freeze status panel on SO detail.

---

## 4. Work Order Creation

| Capability | Status | Route | Component | Store / Action |
|------------|--------|-------|-----------|----------------|
| Create from MRP | ✅ | `/work-orders/create-from-mrp` | `CreateWorkOrderFromMrpPage` | `createFromMrpRun` |
| Create from SO | ⚠️ | Via MRP only | `SalesOrderDetailPage` → MRP | No direct WO-from-SO page |
| Manual WO | ❌ | — | — | **No `createManualWorkOrder`** |
| Select released BOM/routing | ✅ | Store validation | — | `getReleasedBomForProduct`, `getReleasedRoutingForProduct` |
| Generate materials/operations | ✅ | On create | `workOrderEngine` | Auto from BOM/routing |
| BOM/routing blocker with actions | 🎨 | `/mrp/run` | Text only | Store: `"No Released BOM — cannot create Work Orders"` — **no Create BOM button** |

**Classification:** ⚠️ Partially Supported · 🔒 Manual WO blocked (no API)

**Go-live risk:** Medium — production planners must run MRP first; missing BOM shows generic store error, not contextual blocker.

---

## 5. Purchase Requisition Creation

| Capability | Status | Route | Component | Store / Action |
|------------|--------|-------|-----------|----------------|
| Create from MRP | ✅ | Auto on MRP run | `MRPRunDetailPage` | `createPrFromMrpRun` |
| Create manual PR | ✅ | `/purchase/requisitions/new` | `ManualPrFormPage` | `createManualPr` — `purchase.create` |
| Add/select item | ✅ | Dropdown | `usePurchasableItems()` | — |
| Add new item inline | ❌ | — | — | `useQuickCreate` unwired |
| Vendor suggestion | ⚠️ | MRP lines only | — | Manual PR has no vendor |
| Warehouse / required date | ✅ | Form fields | — | — |

**Classification:** ⚠️ Partially Supported

**Go-live risk:** Low — maintenance/emergency PR path exists.

---

## 6. Purchase Order Creation

| Capability | Status | Route | Component | Store / Action |
|------------|--------|-------|-----------|----------------|
| Create from PR | ✅ | `/purchase/requisitions/:id` | `PurchaseRequisitionDetailPage` | `createPoFromPr` |
| Create from RFQ | ✅ | `/purchase/rfqs/:id` | `RfqDetailPage` | `createPoFromRfq` |
| Manual PO | ❌ | — | — | Must originate from PR/RFQ |
| Add/select vendor | ✅ | PR/RFQ flows | Dropdown | Vendor must map to items |
| Add new vendor from PO | ❌ | — | — | `masterStore.addVendor` unwired |
| Payment/delivery terms | ⚠️ | PO detail | Vendor defaults | — |

**Classification:** ⚠️ Partially Supported

**UX bug:** "Direct PO" visible on **submitted** PRs; store requires **approved**.

**Go-live risk:** Low–Medium.

---

## 7. GRN Creation

| Capability | Status | Route | Component | Store / Action |
|------------|--------|-------|-----------|----------------|
| Create from sent PO | ✅ | `/purchase/orders/:id` | `PurchaseOrderDetailPage` | `postGrn` — `purchase.post` |
| Partial qty (UI) | ⚠️ | `/inventory/scan/receive` | `ScanToReceivePage` | Store supports partial; PO page is receive-all |
| Batch/lot/serial | ⚠️ | Scan flow | — | Partial |
| Incoming QC trigger | ✅ | Auto | — | `createIncomingInspection` |
| QR for accepted material | ✅ | `qrWorkflow` | — | — |
| Random item without PO | 🔒 | — | — | Blocked unless scan override |

**Classification:** ⚠️ Partially Supported

**Go-live risk:** Low — store logic strong; PO UI only full-balance receipt.

---

## 8. QC Inspection Creation

| Capability | Status | Route | Component | Store / Action |
|------------|--------|-------|-----------|----------------|
| From GRN | ✅ | Auto | `/quality/incoming` | `createIncomingInspection` |
| From operation | ✅ | Auto on job card complete | `/quality/queue` | `createPendingInspection` |
| Final QC | ⚠️ | QR scan / programmatic | `/quality/inspections/:id` | `createFinalInspection` — **no WO action button** |
| Subcontract return | ⚠️ | Auto on receive | — | **No decision UI** for `subcontract_return` |
| Dynamic inspection plan | ✅ | Master | `/quality/inspection-plans` | `QcMasterPages` |
| Missing plan blocker | 🎨 | Final QC detail | `QualityPages.tsx` | Message: *"Inspection plan required…"* + admin override |

**Classification:** ⚠️ Partially Supported · 🎨 Needs UX Improvement

**Go-live risk:** Medium — subcontract return QC undecidable in UI; in-process pass not blocked when plan empty (store gap).

---

## 9. Job Card Creation

| Capability | Status | Route | Component | Store / Action |
|------------|--------|-------|-----------|----------------|
| Generate from WO operation | ✅ | On `startProduction` | `JobCardPanel`, workbench | `buildJobCardsFromOperations` |
| Assign operator/team | ✅ | WO detail / workbench | — | `startJobCard` |
| Start/pause/complete | ✅ | `/production/job-cards` | `JobCardWorkbenchPage` | — |
| Request QC | ✅ | Auto when op requires QC | — | — |
| Free-floating job card | 🔒 | — | — | **No `createJobCard` API** |

**Classification:** ✅ Fully Supported (by design — not free-floating)

**Go-live risk:** Low.

---

## 10. Job Work Order Creation

| Capability | Status | Route | Component | Store / Action |
|------------|--------|-------|-----------|----------------|
| From subcontract WO | ✅ | MRP → subcontract WO | `/job-work` | `jobWorkAdapter` view |
| From outsourced operation | ⚠️ | Via subcontract WO type | — | — |
| Select vendor | ✅ | Send form | `JobWorkSendReceiveForms` | — |
| Add vendor if missing | ❌ | — | — | No quick-create |
| Material send/receive/challan/QR | ✅ | `/job-work/:id` | `JobWorkOrderDetailPage` | `jobWorkExecutionStore` |
| Subcontract QC | ⚠️ | Store only | — | Receive with `qcRequired` |

**Classification:** ⚠️ Partially Supported

**Go-live risk:** Medium — QC completion UI gap on return.

---

## 11. Dispatch Creation

| Capability | Status | Route | Component | Store / Action |
|------------|--------|-------|-----------|----------------|
| From FG stock / SO | ✅ | `/dispatch/plan` | `DispatchPlanPage` | `getReadyCandidates` → `createDispatchPlan` |
| Trailer serial / QR | ✅ | Auto identity | — | `suggestTrailerIdentity` |
| Transporter / driver / vehicle | ✅ | `/dispatch/:id` | Logistics form | `updateLogistics` |
| Gate pass | ✅ | `/dispatch/:id/gate-pass` | — | `approveSecurityGate` |
| Final QC gate | ✅ | Checklist + store | — | `hasFinalQcPassed` required |
| FG stock gate | ✅ | Store | — | `getOnHand` in FG Yard |

**Classification:** ✅ Fully Supported

**Go-live risk:** Low.

---

## 12. Invoice Creation

| Capability | Status | Route | Component | Store / Action |
|------------|--------|-------|-----------|----------------|
| Create from dispatch | ✅ | `/invoices/register`, dispatch detail | `InvoicePages` | `createFromDispatch` |
| Dispatched goods only | ✅ | Store gate | — | Status check on dispatch |
| Pull customer/tax/details | ✅ | Auto | — | GST from customer state |
| Post invoice | ✅ | Invoice detail | — | `postInvoice` |
| Record payment | ✅ | Invoice detail | — | `recordPayment` |
| Service/manual invoice | 🔒 | — | — | No standalone invoice API |

**Classification:** ✅ Fully Supported (dispatch path)

**Go-live risk:** Low.

---

## 13. Master Data Quick-Create Drawers

| Drawer | Status | Implementation | Auto-select | Permission |
|--------|--------|----------------|-------------|------------|
| Customer | ❌ | Stub link → `/masters/customers/new` | No | `masters.create` (on full form) |
| Contact Person | ❌ | — | — | — |
| Vendor | ❌ | Stub link | No | `masters.create` |
| Item | ❌ | Stub link | No | `masters.create` |
| Product | ❌ | — | — | `engineering.create` |
| Warehouse | ❌ | — | — | `masters.create` |
| Payment Terms | ❌ | — | — | — |
| Tax Category | ❌ | — | — | — |
| Transporter | ❌ | — | — | — |
| Work Center | ❌ | — | — | `engineering.create` |
| Inspection Plan | ❌ | Full page only | — | `quality.create` |
| QC Parameter | ❌ | Full page only | — | `quality.create` |

**File:** `src/components/design-system/RightDrawer.tsx` — `useQuickCreate()` **never imported** by transactional forms.

**Classification:** ❌ Missing (infrastructure only)

**Go-live risk:** **High** for daily operations — every missing master forces context switch.

---

## 14. Contextual Blockers (UX Requirements)

| Scenario | Current behavior | Expected |
|----------|------------------|----------|
| Product missing released BOM | Store error string | Blocker panel: Create BOM · Open Product 360 · Select another product |
| SO freeze failed | Silent (try/catch) | Show freeze status + engineering links |
| Final QC no plan | Warning text + override field | Link: Create Inspection Plan |
| MRP no released BOM | Red text on MRP page | Action buttons to engineering |

**Classification:** 🎨 Needs UX Improvement across modules

---

## 15. Permission Rules

| Role capability | Store enforced? | UI enforced? |
|-----------------|-----------------|--------------|
| `sales.create` — inquiry/quote/SO | ✅ Partial | ❌ No ActionGuard on sales pages |
| `sales.approve` — confirm SO, customer approval | ✅ | ❌ |
| `purchase.create` — manual PR, PO | ✅ | ❌ (PO approve uses ActionGuard) |
| `production.create` — WO create | ❌ **Not on WO store** | ❌ |
| `masters.create` — customer/vendor/item | ✅ on master forms | N/A (no inline) |
| `engineering.release` — BOM/routing | ✅ | On engineering pages |
| `quality.create` — parameters/plans | ✅ | On QC master pages |

**Classification:** 🔒 Blocked by Permission at store layer for most mutations; **UI does not hide unauthorized actions**.

---

## 16. Test Coverage

```bash
npm run test:cross-module-creation   # 19 checks
npm run test:ci                      # includes cross-module suite
```

Tests validate store creation chains + document UI gaps (quick-create drawer not wired).

---

## Summary Matrix

| # | Scenario | Classification | Go-live risk |
|---|----------|----------------|--------------|
| 1 | Inquiry | ⚠️ Partial | Medium |
| 2 | Quotation | ⚠️ Partial | Low–Medium |
| 3 | Sales Order | ⚠️ Partial | Medium |
| 4 | Work Order | ⚠️ Partial | Medium |
| 5 | Purchase Requisition | ⚠️ Partial | Low |
| 6 | Purchase Order | ⚠️ Partial | Low–Medium |
| 7 | GRN | ⚠️ Partial | Low |
| 8 | QC Inspection | ⚠️ Partial | Medium |
| 9 | Job Card | ✅ Full | Low |
| 10 | Job Work Order | ⚠️ Partial | Medium |
| 11 | Dispatch | ✅ Full | Low |
| 12 | Invoice | ✅ Full | Low |
| 13 | Master quick-create | ❌ Missing | **High** |
