# Cross-Module Creation Backlog

Prioritized work items from `CROSS_MODULE_CREATION_AUDIT.md`.  
**Priority:** P0 = go-live blocker · P1 = high friction · P2 = polish

---

## P0 — Go-Live Blockers

| ID | Item | Scenario | Route / Component | Effort |
|----|------|----------|-------------------|--------|
| P0-01 | **Wire Customer quick-create drawer on Inquiry form** — Add Customer button → right drawer with inline form → `masterStore.addCustomer` → auto-select in dropdown | Inquiry | `SalesForms.tsx` / `InquiryFormPage` | M |
| P0-02 | **Wire Vendor quick-create on PO/PR flows** — same pattern for vendor picker | PO, PR | `PurchasePages.tsx`, `ManualPrFormPage.tsx` | M |
| P0-03 | **Implement inline quick-create forms in `RightDrawer`** — replace navigation stubs with real mini-forms (customer, vendor, item minimum) | Master | `RightDrawer.tsx` + new `QuickCreateForms.tsx` | L |
| P0-04 | **Contextual BOM/routing blocker on WO create** — when `No Released BOM`, show panel with links: Create BOM, Product 360, pick another product | WO | `CreateWorkOrderFromMrpPage.tsx` | M |

---

## P1 — High User Friction

| ID | Item | Scenario | Route / Component | Effort |
|----|------|----------|-------------------|--------|
| P1-01 | **Quotation terms editor** — wire `updateQuotationDraft` for payment/delivery terms, discount, validity before submit | Quotation | `QuotationDetailPage` | S |
| P1-02 | **SO freeze feedback** — surface `createFreezeForSo` result on confirm; show frozen BOM/routing revision on SO detail | Sales Order | `SalesOrderDetailPage`, `mrpStore.confirmSalesOrder` | M |
| P1-03 | **Direct SO with permission + reason** — `createDirectSalesOrder` gated by `sales.override` + reason field; validate product/BOM/routing/price/date | Sales Order | New form + `salesStore` | L |
| P1-04 | **GRN partial receipt on PO detail** — line-level qty inputs (store already supports) | GRN | `PurchaseOrderDetailPage` | S |
| P1-05 | **Final QC action on WO detail** — "Create Final Inspection" button when FG received | QC | `WorkOrderPages.tsx` / `WorkOrder360Page` | S |
| P1-06 | **Subcontract return QC decision UI** — dedicated panel for `subcontract_return` category | QC | `QualityPages.tsx` + `qualityStore` | M |
| P1-07 | **Item quick-create on Manual PR** — drawer for authorized `masters.create` users | PR | `ManualPrFormPage.tsx` | M |
| P1-08 | **Fix Direct PO button** — hide on submitted PRs; show only when `approved` | PO | `PurchaseRequisitionDetailPage` | S |
| P1-09 | **ActionGuard on sales/production buttons** — hide Create/Confirm/MRP when permission missing | All sales/production | `SalesPages.tsx`, `WorkOrderPages.tsx` | M |

---

## P2 — Polish & Completeness

| ID | Item | Scenario | Effort |
|----|------|----------|--------|
| P2-01 | Contact person quick-add on inquiry (extend customer drawer or sub-form) | Inquiry | M |
| P2-02 | Product quick-create on inquiry (engineering review status default) | Inquiry | M |
| P2-03 | Standalone quotation create route `/sales/quotations/new` | Quotation | M |
| P2-04 | Manual WO for `production_head` with reason + released BOM/routing validation | WO | L |
| P2-05 | Manual PO for emergency buys with reason | PO | M |
| P2-06 | Transporter quick-create on dispatch logistics form | Dispatch | S |
| P2-07 | Payment terms master + quick-create on quotation/SO | Quotation, SO | M |
| P2-08 | Inspection plan quick-link from final QC blocker → `/quality/inspection-plans/new` | QC | S |
| P2-09 | In-process QC store enforcement when plan empty (align with UI warning) | QC | S |
| P2-10 | MRP PR deduplication — avoid duplicate PRs on re-run | PR | S |
| P2-11 | `production.create` permission on `workOrderStore.createFromMrpRun` | WO | S |
| P2-12 | Customer PO reference + delivery terms on SO detail | SO | S |

---

## Quick-Create Drawer Checklist (P0-03 detail)

For each entity, implement:

- [ ] Opens without leaving current page (`useQuickCreate` + inline form)
- [ ] Saves via existing store action (`addCustomer`, `addVendor`, `addItem`, …)
- [ ] Updates dropdown source immediately (Zustand `getState()`)
- [ ] Auto-selects newly created record in parent form
- [ ] Respects `assertPermission` for module
- [ ] Shows field validation errors inline
- [ ] Duplicate detection (GSTIN / code uniqueness)

**Entities (priority order):** Customer → Vendor → Item → Product → Warehouse → Payment Terms → Transporter → Work Center → Inspection Plan → QC Parameter

---

## Permission Matrix for Quick-Create

| Entity | Who can quick-create | Who can approve/release |
|--------|----------------------|-------------------------|
| Customer | `sales.create` | — |
| Vendor | `purchase.create` (request) | `masters.edit` / vendor activation |
| Item | `masters.create` (store roles) | — |
| Product / BOM / Routing | `engineering.create` | `engineering.release` |
| QC Parameter / Plan | `quality.create` | `quality.approve` |
| Warehouse | `masters.create` | `masters.edit` |

---

## Suggested Sprint Order

**Sprint A (1 week):** P0-01, P0-02, P1-08, P1-01, P1-04, P1-05  
**Sprint B (1 week):** P0-03 (customer/vendor/item forms), P0-04, P1-02, P1-09  
**Sprint C (1 week):** P1-06, P1-03, P2-04, P2-05  

---

## Test Gate

All backlog items should keep `npm run test:cross-module-creation` green and add UI tests when drawers ship:

1. After P0-01: flip test `1.1` to expect `useQuickCreate` in `SalesForms.tsx`
2. After P0-02: flip test `9.1` for purchase forms
3. After P1-03: add direct SO permission + reason tests
4. After P2-04: add manual WO permission tests
