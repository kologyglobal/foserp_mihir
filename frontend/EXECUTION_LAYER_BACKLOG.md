# Execution Layer Backlog

**Date:** 23 June 2026  
**Source:** `EXECUTION_LAYER_AUDIT.md`  
**Goal:** Move execution layer from **Functional (2)** to **Production Ready (3)**  
**Current tests:** `npm run test:execution-layer` — 28/28 PASS

---

## Priority legend

| Priority | Meaning |
|----------|---------|
| **P0** | Blocks production use or data integrity |
| **P1** | Required for Production Ready score |
| **P2** | UX / discoverability / polish |
| **P3** | Nice-to-have |

---

## P0 — Data integrity & QC completion

### BL-001 Subcontract return QC decision UI
**Area:** Subcontract QC · **Score today:** 1  
**Problem:** `createSubcontractReturnInspection` creates pending records, but `QcInspectionDetailPage` has no branch for `category === 'subcontract_return'`. Inspectors cannot pass/fail from UI.  
**Acceptance:**
- [ ] Add `SubcontractReturnQcDetail` (or extend detail page) for pass/reject/rework
- [ ] Store method `recordSubcontractReturnDecision(inspectionId, { inspector, result, acceptedQty, rejectedQty, remarks })`
- [ ] On pass: release inventory from QC hold (if hold implemented) or mark inspection complete
- [ ] On reject: optional NCR if not already raised
- [ ] JWO status transitions to/from `qc_pending` correctly
- [ ] Test: QC required receive → pending inspection → pass decision

**Files:** `QualityPages.tsx`, `qualityStore.ts`, `jobWorkExecutionStore.ts`

---

### BL-002 Quarantine movement on subcontract reject
**Area:** Material Receive · **Score today:** 2  
**Problem:** Spec requires rejected qty to create NCR **or** quarantine movement. NCR exists; quarantine stock transfer does not.  
**Acceptance:**
- [ ] On rejected receive qty, post to quarantine warehouse (reuse `getQuarantineWarehouseId` pattern from incoming QC)
- [ ] NCR remains linked to vendor, shipment, WO
- [ ] Test: reject receive → quarantine movement + NCR

**Files:** `jobWorkExecutionStore.ts`, `inventoryStore.ts`, `test-execution-layer.ts`

---

### BL-003 QC-hold inventory on receive when QC required
**Area:** Material Receive · **Score today:** 2  
**Problem:** Accepted qty posts `SUBCON_IN` immediately even when `qcRequired=true`; should land in QC pending / quarantine until inspection passes.  
**Acceptance:**
- [ ] Define receive path: QC required → post to quarantine or QC WIP, not free stock
- [ ] Release to receipt warehouse on QC pass (BL-001)
- [ ] Test: receive with QC required → no free stock until pass

**Files:** `jobWorkExecutionStore.ts`, `inventoryStore.ts`

---

## P1 — Production Ready completeness

### BL-004 WO 360 dedicated navigation & print route
**Area:** Work Order 360 · **Score today:** 2  
**Acceptance:**
- [ ] Sidebar entry: **Work Order 360** (hub or docs link — e.g. from WO list with last-opened WO, or static help tile)
- [ ] Optional route `/work-orders/:id/print` with formatted WO summary (match challan print pattern)
- [ ] Breadcrumb label in `pageNavigation.ts` for `/work-orders/:id/360`
- [ ] Test or smoke: route resolves

**Files:** `navigation.ts`, `pageNavigation.ts`, new print page optional

---

### BL-005 Job Card Workbench — resume, photos, deep links
**Area:** Job Card Workbench · **Score today:** 2  
**Acceptance:**
- [ ] **Resume** action for paused cards (reuse `startJobCard` or add `resumeJobCard` if needed)
- [ ] **Attach photos** — minimal: remarks + file metadata stub or attachment store field on job card
- [ ] Global search job card → `/production/job-cards?card={id}` with selection
- [ ] Test: view filters return expected subsets

**Files:** `JobCardWorkbenchPage.tsx`, `GlobalSearch.tsx`, `workOrderStore.ts` (if attachment field)

---

### BL-006 JWO Detail — inline Raise QC / NCR
**Area:** Job Work Order Detail · **Score today:** 2  
**Acceptance:**
- [ ] **Raise QC** opens receive form with QC required or creates inspection for selected shipment
- [ ] **Raise NCR** opens form prefilled with vendor, WO, shipment, item
- [ ] Remove dead navigation to empty quality pages

**Files:** `JobWorkOrderDetailPage.tsx`, `JobWorkSendReceiveForms.tsx`

---

### BL-007 Subcontract QC queue visibility
**Area:** Subcontract QC · **Score today:** 1  
**Acceptance:**
- [ ] QC Queue filter/tab: **Subcontract Return** (`category === 'subcontract_return'`)
- [ ] Badge count on Quality workspace
- [ ] Global search: inspection no → `/quality/inspections/:id`
- [ ] Inspection plan template for subcontract return checklist (optional)

**Files:** `QualityPages.tsx`, `GlobalSearch.tsx`, `quality/inspectionPlans.ts`

---

### BL-008 Rework qty stock semantics
**Area:** Material Receive · **Score today:** 2  
**Acceptance:**
- [ ] Document or implement: rework qty stays at vendor / WIP flag — no false "received" stock
- [ ] Balance formula already includes `reworkQty`; validate UI labels explain non-returned rework
- [ ] Test: partial receive + rework + balance

**Files:** `jobWorkAdapter.ts`, `JobWorkSendReceiveForms.tsx`, tests

---

### BL-009 Persisted JWO status vs derived-only
**Area:** JWO Register / Detail · **Score today:** 2  
**Acceptance:**
- [ ] Map `material_sent` status explicitly (currently jumps approved → in_process when sent)
- [ ] Optional: sync `JobWorkMeta` milestone timestamps (approvedAt, sentAt, closedAt) for audit
- [ ] Status filter on register matches user-facing flow diagram

**Files:** `jobWorkAdapter.ts`, `types/jobWork.ts`

---

## P2 — Discoverability & vendor experience

### BL-010 Vendor 360 Job Work discoverability
**Area:** Vendor 360 Job Work · **Score today:** 2  
**Acceptance:**
- [ ] Global search: vendor name → Vendor 360 with `?tab=job_work` hint or direct workspace
- [ ] Vendor list row action: **Job Work** when open JWO > 0
- [ ] KPI strip on vendor list (open JWO count) optional

**Files:** `Vendor360Page.tsx`, `VendorPages.tsx`, `GlobalSearch.tsx`

---

### BL-011 Execution layer page indexing
**Area:** Navigation / search · **Score today:** 1.6 avg  
**Acceptance:**
- [ ] Add keywords to `searchablePages` for Work Order 360 pattern, Job Work workspace
- [ ] Production workspace tiles link to Job Cards + Job Work register

**Files:** `navigation.ts`, workspace pages

---

### BL-012 WO 360 test coverage expansion
**Area:** Tests · **Score today:** 1.6 avg  
**Acceptance:**
- [ ] Unit test `useWorkOrder360` KPI calculations (material readiness, blockers, days delayed)
- [ ] Integration: subcontract tab shows JWO link when `woType === 'subcontract'`
- [ ] Add `test:execution-layer` cases to CI regression (`test:regression` script)

**Files:** `scripts/test-execution-layer.ts`, `package.json`

---

## P3 — Polish

### BL-013 Job Work challan print — PDF styling
**Area:** Print · **Score today:** 2  
**Acceptance:**
- [ ] Company header, signature blocks, terms on `JobWorkChallanPrintPage`
- [ ] Print CSS `@media print` consistent with PO print pattern

**Files:** `JobWorkChallanPrintPage.tsx`, `index.css`

---

### BL-014 Job Card Workbench — operator mode
**Area:** Job Card Workbench  
**Acceptance:**
- [ ] Tablet layout parity with Shop Floor Queue (larger touch targets)
- [ ] Optional: shared hook `useJobCardActions` extracted from Shop Floor + Workbench

**Files:** `JobCardWorkbenchPage.tsx`, `ShopFloorJobQueuePage.tsx`

---

### BL-015 Vendor job work costing
**Area:** Vendor 360 · **Score today:** 2  
**Acceptance:**
- [ ] Job work spend uses shipment rate × received qty from `JobWorkMeta.rate`
- [ ] Compare to PO spend on vendor performance tab
- [ ] Cost rollup in WO 360 costing tab for subcontract lines

**Files:** `entity360Metrics.ts`, `workOrder360Metrics.ts`, costing module

---

## Suggested sprint plan

| Sprint | Items | Outcome |
|--------|-------|---------|
| **Sprint 1** | BL-001, BL-002, BL-003 | Subcontract QC + inventory integrity — **P0 cleared** |
| **Sprint 2** | BL-004, BL-006, BL-007, BL-012 | Navigation, QC queue, tests in CI |
| **Sprint 3** | BL-005, BL-008, BL-009, BL-010 | Workbench polish, JWO status clarity, vendor UX |
| **Backlog** | BL-011, BL-013–BL-015 | Polish |

---

## Definition of Done — Production Ready (score 3)

An area scores **3** when ALL of the following hold:

1. Dedicated or clearly reachable route with breadcrumbs  
2. Listed in sidebar or parent workspace with count/badge where applicable  
3. Indexed in global search (entity + key actions)  
4. Reads/writes only through existing WO/subcontract/quality stores or documented adapter  
5. No parallel persisted entity for the same business object  
6. Documented status transitions enforced in store with validation messages  
7. Inventory movements correct for send, receive, reject, QC hold, and release  
8. QC and NCR linked to vendor, JWO/shipment, and source WO where applicable  
9. Print route or print stylesheet where specified  
10. At least one automated test per happy path and one guard-rail (balance, QC block, etc.)

---

## Quick reference — current routes

| Capability | Route |
|------------|-------|
| Work Order 360 | `/work-orders/:id/360` |
| Job Card Workbench | `/production/job-cards` |
| Job Work Register | `/job-work` |
| Job Work Detail | `/job-work/:id` |
| Job Work Challan Print | `/job-work/:id/print` |
| Vendor Job Work Workspace | `/job-work/vendors/:vendorId` |
| Vendor 360 Job Work tab | `/masters/vendors/:id` → Job Work tab |

---

*Backlog derived from EXECUTION_LAYER_AUDIT.md. Update item status inline or via issue tracker when implementing.*
