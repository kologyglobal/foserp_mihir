# ERP Hardening Backlog

**Purpose:** Prioritized fixes to make the frontend/localStorage ERP functionally perfect **before** backend migration.  
**Source:** `ERP_PERFECTION_AUDIT.md` (2026-06-23)  
**Rule:** Do not start backend work until P0 items are closed.

---

## Priority Definitions

| Priority | Meaning | Target |
|----------|---------|--------|
| **P0** | Must fix before backend — breaks operability, data integrity, or build | Block migration planning |
| **P1** | Should fix before backend — factory staff cannot complete daily work without these | Complete before UAT sign-off |
| **P2** | Can wait until after backend — polish, analytics, nice-to-have | Post-migration or parallel track |

---

## P0 — Must Fix Before Backend

### P0-001 · Persist masterStore to localStorage

**Module:** Masters, Product  
**Problem:** All master CRUD (items, vendors, customers, products, warehouses) is lost on browser refresh while PO/WO/GRN/inventory persist. Factory cannot maintain master data.  
**Evidence:** `masterStore.ts` has no `persist()`; `persistConfig.ts` has no masters key.  
**Fix:**
- Add `ERP_STORAGE_KEYS.masters = 'vasant-erp-masters-v1'`
- Wrap `masterStore` with `persist()` + seed merge (same pattern as `bomStore`)
- Run `migrate-persist-masters.ts` pattern for existing sessions  
**Acceptance:** Create item → refresh → item still exists. MRP run still finds item.

---

### P0-002 · Fix broken GRN detail route

**Module:** GRN, Purchase  
**Problem:** GRN Register links to `/purchase/grns/:id` but route does not exist — 404 on click.  
**Evidence:** `PurchaseProductionPages.tsx` L38; `routes/index.tsx` has list only (L158).  
**Fix:**
- Add route `purchase/grns/:id` → `GrnDetailPage`
- Show GRN lines, accepted/rejected/quarantine qty, linked PO, incoming QC link, audit stamps  
**Acceptance:** Click GRN number in register → detail loads with correct data.

---

### P0-003 · Fix TypeScript build failures

**Module:** System  
**Problem:** `npm run build` fails — cannot produce clean production bundle.  
**Evidence:** 7 TS errors as of audit date:
- `dispatchStore.ts` — photo `category` missing on add; unused vars
- `QualityPages.tsx` — `woNo` possibly null (L238, L671)
- Unused imports in production pages  
**Fix:** Resolve all build errors; add build to pre-migration checklist.  
**Acceptance:** `npm run build` exits 0.

---

### P0-004 · Incoming QC decision UI on inspection detail

**Module:** Quality, GRN  
**Problem:** Store has `recordIncomingQcDecision` with accepted/rejected/quarantine qty, but `QcInspectionDetailPage` only calls `recordInspectionDecision` (in-process). Incoming inspections cannot be decided from UI except indirectly.  
**Evidence:** `QualityPages.tsx` L250–295; incoming queue links to detail page.  
**Fix:**
- Branch `QcInspectionDetailPage` by `inspection.category`
- Incoming: show GRN context, accepted/rejected/quarantine fields, pass/fail actions
- Final: show `FINAL_QC_CHECKLIST` toggles, pass/fail  
**Acceptance:** Post GRN with QC required → Incoming QC queue → open detail → record decision → quarantine releases to stock.

---

### P0-005 · Wire print views to routes

**Module:** Purchase, Dispatch, Quality  
**Problem:** Print components exist but are not reachable as standalone printable pages.  
**Evidence:**
- `PoPrintView` in `PurchaseProductionPages.tsx` — not routed
- `GatePassPrintView` in `DispatchProductionPages.tsx` — not routed
- No QC/NCR print view  
**Fix:**
- Add routes: `/purchase/orders/:id/print`, `/dispatch/:id/gate-pass`, `/quality/inspections/:id/print`, `/quality/ncr/:id/print`
- Add Print buttons on detail pages calling `window.print()` or navigate to print route  
**Acceptance:** PO detail → Print PO → print-ready layout. Dispatch → Print Gate Pass.

---

### P0-006 · Normalize persisted document shapes on load

**Module:** Purchase, Quality, Dispatch (all persisted stores)  
**Problem:** Old localStorage sessions may lack new audit fields, status values, or `category` on inspections — can cause runtime errors or silent bad state.  
**Evidence:** Production hardening added fields without migration normalizers on rehydrate.  
**Fix:**
- Add `normalize*` functions on store load (pattern: `normalizeDispatch` in dispatchStore)
- Cover PR/PO/GRN/inspections created before hardening  
**Acceptance:** Load app with old localStorage blob → no console errors; documents display with fallback defaults.

---

## P1 — Should Fix Before Backend

### P1-001 · Sales Order module (minimum viable)

**Module:** Sales Order Closure, MRP  
**Problem:** SOs are seed-only. Factory cannot create or confirm orders without editing seed files.  
**Evidence:** No routes; `SalesPage.tsx` unwired; `mrpStore.salesOrders` from seed.  
**Fix:**
- Routes: `/sales`, `/sales/new`, `/sales/:id`
- CRUD: customer, product, qty, required date, status `open → confirmed`
- MRP run requires `confirmed` SO
- Retire or delete unwired `SalesPage.tsx`  
**Acceptance:** Create SO in UI → run MRP → WO/PR generated → SO status progresses to closed at end of cycle.

---

### P1-002 · Manual PR creation UI

**Module:** Purchase  
**Problem:** `createManualPr` exists in store (source: Manual/Reorder) but no UI.  
**Evidence:** `purchaseStore.ts` L155; grep shows no UI usage.  
**Fix:**
- Add "Create Manual PR" on purchase hub or requisition list
- Form: item, qty, warehouse, required date, source selector  
**Acceptance:** Manual PR → submit → approve → RFQ or PO path works.

---

### P1-003 · PR list source column and RFQ comparison UI

**Module:** Purchase  
**Problem:** PR register missing source column (MRP/Manual/Reorder). RFQ detail has minimal vendor comparison display.  
**Fix:**
- Add source, linked SO/WO/MRP run columns to PR list
- RFQ detail: landed cost table, preferred vendor flag, approval recommendation panel  
**Acceptance:** Planner can compare vendors and see recommendation without reading store directly.

---

### P1-004 · PO amendment UI

**Module:** Purchase  
**Problem:** `amendPo` in store creates revision but no UI.  
**Fix:**
- Amend button on approved/sent PO (not fully received)
- Revision history panel on PO detail  
**Acceptance:** Amend PO qty → revisionNo increments → audit trail shows amendment.

---

### P1-005 · Full AuditTrail on BOM, Routing, WO, Invoice

**Module:** BOM, Routing, Production, Invoice  
**Problem:** Transactional docs use `stampCreated/Approved` but engineering and finance docs use timestamps only.  
**Evidence:** `ERP_AUDIT_TRAIL.md`; inconsistent across modules.  
**Fix:**
- Extend `AuditTrail` to BomHeader, RoutingHeader, WorkOrder, Invoice
- Stamp on submit/approve/release/post actions  
**Acceptance:** BOM release shows approved_by and approved_at in UI.

---

### P1-006 · Quality: NCR print and QC certificate

**Module:** Quality  
**Problem:** No print-ready QC report or NCR document.  
**Fix:**
- `QcReportPrintView`, `NcrPrintView` components + routes
- Include inspection checklist, result, inspector, signatures block  
**Acceptance:** Closed inspection → Print QC Report.

---

### P1-007 · Cost calibration to reduce standard variance

**Module:** Costing  
**Problem:** 52.8% FG cost variance vs BOM standard in go-live sim — misleading for management reports.  
**Evidence:** `ERP_COST_CALIBRATION.md`, go-live output.  
**Fix:**
- Align item `standardRate` with calibrated procurement + routing hours
- Document overhead % basis on costing dashboard  
**Acceptance:** Go-live sim variance < 15% or documented with known exclusions.

---

### P1-008 · Re-MRP duplicate PR guard

**Module:** MRP, Purchase  
**Problem:** Running MRP again for same SO creates duplicate PRs.  
**Fix:**
- Skip `createPrFromMrpRun` if open PR exists for same MRP run + SO + item lines
- Or merge into existing draft PR  
**Acceptance:** Run MRP twice on same SO → single PR set (or explicit "PR already exists" message).

---

### P1-009 · GRN cancel / reversal flow (localStorage)

**Module:** GRN, Inventory  
**Problem:** No way to reverse erroneous GRN posting.  
**Fix:**
- `cancelGrn` with status check (not if stock consumed by WO)
- Reverse quarantine/accepted movements  
**Acceptance:** Cancel GRN before issue → stock restored; PO receipt qty reverted.

---

### P1-010 · Payment register / AR summary

**Module:** Payment, Invoice  
**Problem:** Payments only visible on invoice detail — no AR aging or payment list.  
**Fix:**
- `/invoices/receivables` or finance tab: open invoices, overdue, payment history
- Link from invoice dashboard  
**Acceptance:** Accounts can see all unpaid invoices without opening each detail.

---

### P1-011 · Remove or quarantine legacy mock pages

**Module:** System  
**Problem:** 8 unwired `*Page.tsx` files confuse developers and auditors.  
**Evidence:** Listed in `ERP_PERFECTION_AUDIT.md` § Legacy Code.  
**Fix:**
- Delete or move to `src/_legacy/` with README
- Ensure no imports from live modules  
**Acceptance:** Grep for `src/data/orders.ts` in live modules returns zero.

---

### P1-012 · Add CI test gate

**Module:** System  
**Problem:** 15 test scripts exist but nothing runs them on commit/PR.  
**Fix:**
- GitHub Actions: `npm run build && npm run simulate:go-live && npm run test:*` (core subset)
- Fail PR on test failure  
**Acceptance:** CI badge green on main branch.

---

### P1-013 · Enforce permission hooks in UI (non-admin)

**Module:** All transactional modules  
**Problem:** `assertPermission` in stores but UI shows all buttons; admin mock user bypasses everything.  
**Fix:**
- Hide/disable actions based on `canPermission()`
- Role switcher in dev settings for UAT (purchase clerk, QC, dispatch)  
**Acceptance:** Login as `quality` role → cannot approve PO; as `purchase` → cannot post GRN.

---

## P2 — Can Wait Until After Backend

### P2-001 · Global Reports / Analytics hub

**Module:** Reports  
**Problem:** Sidebar Analytics disabled; no `/reports` route.  
**Fix:** Executive dashboard: open SO, WIP value, pending dispatch, AR, pending QC, open PO.  
**Defer reason:** Backend will provide aggregation APIs; frontend hub can consume them.

---

### P2-002 · Traceability report UI

**Module:** Reports, Inventory  
**Problem:** Movements pegged in store but no single RM → FG → dispatch trace view.  
**Fix:** SO/serial search → movement chain + WO genealogy tree.  
**Defer reason:** Needs performant query — better with backend.

---

### P2-003 · WIP aging / valuation report

**Module:** WIP, Reports  
**Problem:** WIP movements exist; no aging by warehouse/WO.  
**Defer reason:** Reporting layer; not blocking daily transactions.

---

### P2-004 · Shop-floor supervisor queue

**Module:** Job Cards, Production  
**Problem:** Job cards only visible inside WO detail.  
**Fix:** `/production/shop-floor` — all in-progress job cards across WOs by work center.  
**Defer reason:** UX enhancement; tablet UI likely post-backend.

---

### P2-005 · Lot / serial / batch tracking

**Module:** Inventory, Quality, Dispatch  
**Problem:** Trailer/chassis on dispatch lines but no serial master at FG receipt.  
**Defer reason:** Master data model decision — backend schema design.

---

### P2-006 · Alternate BOM / routing / effectivity

**Module:** BOM, Routing  
**Problem:** Single BOM per product; no revision effectivity dates.  
**Defer reason:** Engineering process design; not needed for anchor scenario.

---

### P2-007 · Work center shift calendar and capacity

**Module:** Work Centers, MRP  
**Problem:** Infinite capacity assumed.  
**Defer reason:** APS scope — post go-live phase.

---

### P2-008 · Partial SA receipt

**Module:** Semi-Finished Receipt  
**Problem:** All-or-nothing SA receipt qty.  
**Defer reason:** Edge case for current batch manufacturing model.

---

### P2-009 · E-invoice / email PDF server

**Module:** Invoice  
**Problem:** Print works in browser only.  
**Defer reason:** Requires backend + GST integration.

---

### P2-010 · Photo / document blob storage

**Module:** Dispatch, Quality  
**Problem:** Loading photos stored as base64 in localStorage — size limits.  
**Defer reason:** Backend file storage required.

---

### P2-011 · Standard cost revision tied to BOM release

**Module:** Costing, BOM  
**Problem:** Item standard rates static; not auto-updated on BOM release.  
**Defer reason:** Cost accounting process — can manual-calibrate pre-backend (P1-007).

---

### P2-012 · Lead → Inquiry → Quotation pipeline

**Module:** Sales  
**Problem:** No CRM/commercial pipeline before SO.  
**Defer reason:** Separate commercial module scope.

---

### P2-013 · 3-way match (PO / GRN / Invoice)

**Module:** Purchase, GRN, Invoice  
**Problem:** No vendor invoice matching.  
**Defer reason:** Accounts payable scope — post backend.

---

### P2-014 · Multi-user / real auth / server audit

**Module:** System  
**Problem:** Mock session user; client-written audit stamps.  
**Defer reason:** Explicitly out of scope until backend (`ERP_AUDIT_TRAIL.md`, `ERP_RBAC_PERMISSIONS.md`).

---

## Backlog Summary

| Priority | Count | Theme |
|----------|-------|-------|
| **P0** | 6 | Persist masters, broken routes, build, QC UI, print routes, data normalization |
| **P1** | 13 | SO module, purchase UI gaps, audit consistency, cost calibration, CI, permissions |
| **P2** | 14 | Analytics, traceability, APS, serials, backend-only features |

---

## Recommended Fix Order (Sprint Plan)

### Sprint 1 — Data integrity (P0)
1. P0-001 Persist masterStore  
2. P0-003 Fix TypeScript build  
3. P0-006 Normalize persisted shapes  
4. P0-002 GRN detail route  

### Sprint 2 — Quality & documents (P0)
5. P0-004 Incoming/final QC UI  
6. P0-005 Print route wiring  

### Sprint 3 — Commercial front (P1)
7. P1-001 Sales Order module  
8. P1-002 Manual PR UI  
9. P1-003 PR/RFQ UI polish  

### Sprint 4 — Factory hardening (P1)
10. P1-004 PO amendment UI  
11. P1-005 AuditTrail extension  
12. P1-008 Re-MRP duplicate guard  
13. P1-012 CI test gate  

### Sprint 5 — Finance & cleanup (P1)
14. P1-007 Cost calibration  
15. P1-010 Payment register  
16. P1-011 Remove legacy mock pages  
17. P1-013 Permission UI enforcement  

---

## Definition of Done — Frontend Perfection

Before backend migration starts, ALL of the following must be true:

- [ ] All **P0** items closed  
- [ ] Average module score ≥ **2.5** (currently 2.0)  
- [ ] Masters + Product score ≥ **2** (persisted)  
- [ ] Sales Order Closure score ≥ **2** (SO CRUD UI)  
- [ ] Reports score ≥ **2** (or global hub live)  
- [ ] `npm run build` passes  
- [ ] `npm run simulate:go-live` — 9/9 checks  
- [ ] All production tests pass (`test:purchase:production`, `test:quality:production`, `test:dispatch:production`)  
- [ ] No broken in-app routes (grep `TableLink` vs `routes/index.tsx`)  
- [ ] Legacy mock pages removed or isolated  

---

*Backlog derived from code audit — not a feature wish list. Items marked P2 are explicitly deferred until backend exists.*
