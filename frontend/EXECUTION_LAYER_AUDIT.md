# Execution Layer Audit

**Date:** 23 June 2026  
**Scope:** Eight execution-layer capabilities delivered in the ERP Execution Layer Hardening pass  
**Method:** Codebase review — routes, navigation, global search, stores, adapters, tests (`scripts/test-execution-layer.ts`)  
**Build / tests:** `npm run build` PASS · `npm run test:execution-layer` **28/28 PASS**

## Scoring legend

| Score | Label | Meaning |
|------:|-------|---------|
| **0** | Missing | No route, screen, store wiring, or test |
| **1** | Partial | Exists but incomplete, embedded elsewhere, or untested path |
| **2** | Functional | End-to-end works for core scenarios; known gaps remain |
| **3** | Production Ready | Complete UX, navigation, validation, QC/inventory linkage, tests, print |

## Executive summary

| # | Area | Score | Verdict |
|---|------|------:|---------|
| 1 | Work Order 360 | **2** | Functional — full 360 UI; no dedicated sidebar entry; print is browser-only |
| 2 | Job Card Workbench | **2** | Functional — views + shop-floor actions; no photo attach; search lands on list |
| 3 | Job Work Order Register | **2** | Functional — adapter over subcontract WOs; status derived not persisted |
| 4 | Job Work Order Detail | **2** | Functional — send/receive/approve/close; Raise QC/NCR are navigation stubs |
| 5 | Material Send to Vendor | **2** | Functional — SUBCON_OUT posted; vehicle/driver metadata supported |
| 6 | Material Receive from Vendor | **2** | Functional — balance rules + SUBCON_IN; no quarantine movement on reject |
| 7 | Subcontract QC | **1** | Partial — types + create on receive; no QC decision UI for `subcontract_return` |
| 8 | Vendor 360 Job Work tab | **2** | Functional — KPIs + JWO table; metrics tested; no UI/E2E test |

**Overall execution layer maturity: 2 / 3 (Functional)** — core subcontract job-work loop works; subcontract QC completion and a few UX/discoverability items block Production Ready.

---

## Check matrix (all areas)

| Check | WO 360 | Job Cards | JWO Register | JWO Detail | Send | Receive | Sub QC | Vendor JW |
|-------|:------:|:---------:|:------------:|:----------:|:----:|:-------:|:------:|:---------:|
| Route exists | ✓ | ✓ | ✓ | ✓ | ✓¹ | ✓¹ | ✓² | ✓³ |
| Sidebar navigation | ◐ | ✓ | ✓ | ◐ | ◐ | ◐ | ◐ | ◐ |
| Global search indexing | ✓ | ✓ | ✓ | ✓ | ◐ | ◐ | ✗ | ◐ |
| Connected to WO/subcontract store | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| No duplicate data model | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Status flow works | ◐ | ✓ | ✓ | ✓ | ✓ | ✓ | ◐ | ✓ |
| Stock movement posts correctly | ◐ | — | — | — | ✓ | ✓ | ◐ | — |
| QC / NCR linkage works | ◐ | ◐ | — | ◐ | — | ✓ | ◐ | ✓ |
| Print route works | ◐ | — | — | ✓ | — | — | — | — |
| Tests exist | ◐ | ◐ | ✓ | ◐ | ✓ | ✓ | ◐ | ◐ |

✓ = pass · ◐ = partial · ✗ = missing · — = not applicable  
¹ Embedded in `/job-work/:id` · ² Store/types only; no dedicated QC screen · ³ Tab on Vendor 360; workspace at `/job-work/vendors/:vendorId`

---

## 1. Work Order 360

**Score: 2 — Functional**

| Check | Result | Evidence |
|-------|--------|----------|
| Route exists | **Pass** | `/work-orders/:id/360` → `WorkOrder360Page` (`src/routes/index.tsx`) |
| Sidebar navigation | **Partial** | No sidebar tile; reachable via WO detail **WO 360** button (`WorkOrderPages.tsx`) and global search |
| Global search | **Pass** | `{woNo} 360` → `/work-orders/:id/360` (`GlobalSearch.tsx`) |
| Store connection | **Pass** | `useWorkOrder360` reads `workOrderStore`, `qualityStore`, `inventoryStore`, `jobWorkExecutionStore` (`workOrder360Metrics.ts`) |
| No duplicate model | **Pass** | Read-only aggregation; no new WO entity |
| Status flow | **Partial** | Displays WO status + derived KPIs; CTAs delegate to existing WO/issue/shop-floor flows |
| Stock movement | **Partial** | WIP tab lists `stockMovements` filtered by `workOrderId`; does not post movements itself |
| QC / NCR linkage | **Partial** | Tabs list inspections, reworks, NCRs with links to quality module |
| Print route | **Partial** | **Print WO** uses `window.print()`; no `/work-orders/:id/print` route |
| Tests | **Partial** | `test-execution-layer` validates underlying WO/materials/ops/cards data; no route or `useWorkOrder360` assertion |

**Notes:** Ten tabs implemented (Overview, Materials, Operations, Job Cards, QC & Rework, Subcontract, WIP, Costing, Timeline, Documents). Uses `Entity360Shell` pattern. Complements `WorkOrderDetailPage` as intended.

---

## 2. Job Card Workbench

**Score: 2 — Functional**

| Check | Result | Evidence |
|-------|--------|----------|
| Route exists | **Pass** | `/production/job-cards` → `JobCardWorkbenchPage` |
| Sidebar navigation | **Pass** | Production → **Job Cards** (`navigation.ts`) |
| Global search | **Partial** | Job card no → `/production/job-cards` (list, not deep-linked to card) |
| Store connection | **Pass** | `useJobCardWorkbench` + `startJobCard` / `pauseJobCard` / `completeJobCard` from `workOrderStore` |
| No duplicate model | **Pass** | Reuses `JobCardPanel` patterns from shop floor; no new job card entity |
| Status flow | **Pass** | Views: My Jobs, All Open, Waiting Material, In Progress, QC Pending, Rework, Completed |
| Stock movement | **N/A** | — |
| QC / NCR linkage | **Partial** | Inline `QcChecklistPanel` on complete; **Send to QC** navigates to `/quality/queue` |
| Print route | **N/A** | — |
| Tests | **Partial** | Test asserts job cards exist and link to WOs; no view-filter or action assertions |

**Gaps vs spec:** No **Attach photos** action; no explicit **Resume** button (re-start after pause); no per-card deep link from search.

---

## 3. Job Work Order Register

**Score: 2 — Functional**

| Check | Result | Evidence |
|-------|--------|----------|
| Route exists | **Pass** | `/job-work` → `JobWorkOrderRegisterPage` |
| Sidebar navigation | **Pass** | Production → **Job Work Orders** |
| Global search | **Pass** | `JWO-{woNo}` → `/job-work/:id` |
| Store connection | **Pass** | `useJobWorkOrders` → `jobWorkAdapter.toJobWorkOrderView` over `woType === 'subcontract'` |
| No duplicate model | **Pass** | `JobWorkOrderView` is a view-model; source = `WorkOrder` + `SubcontractShipment` + `JobWorkMeta` |
| Status flow | **Pass** | `deriveJwoStatus()` computed from shipments, meta, inspections |
| Stock movement | **N/A** | — |
| QC / NCR linkage | **N/A** | Display only on register |
| Print route | **N/A** | — |
| Tests | **Pass** | Subcontract WO appears as JWO; `JWO-` prefix verified |

---

## 4. Job Work Order Detail

**Score: 2 — Functional**

| Check | Result | Evidence |
|-------|--------|----------|
| Route exists | **Pass** | `/job-work/:id` → `JobWorkOrderDetailPage` |
| Sidebar navigation | **Partial** | Via register; no direct sidebar entry for detail |
| Global search | **Pass** | JWO and challan indexed |
| Store connection | **Pass** | Detail + `jobWorkExecutionStore` orchestration over `workOrderStore` |
| No duplicate model | **Pass** | Same adapter as register |
| Status flow | **Pass** | Approve, Send, Receive, Close actions; close blocked on balance/QC pending |
| Stock movement | **Pass** | Via send/receive forms (see §5–6) |
| QC / NCR linkage | **Partial** | **Raise QC** / **Raise NCR** navigate to generic quality pages; receive path creates NCR/inspection |
| Print route | **Pass** | Link to `/job-work/:id/print` |
| Tests | **Partial** | Close-with-balance and challan data tested; detail UI not E2E tested |

**JWO status flow (derived):** Draft → Approved (`JobWorkMeta.approvedAt`) → In Process (material sent) → Partially Received → Received → QC Pending (pending `subcontract_return` inspection) → Closed (`closeJobWork` + meta).

---

## 5. Material Send to Vendor

**Score: 2 — Functional**

| Check | Result | Evidence |
|-------|--------|----------|
| Route / UI | **Pass** | `SendJobWorkForm` on JWO detail (`JobWorkSendReceiveForms.tsx`) |
| Sidebar / search | **Partial** | Reachable via Job Work module only |
| Store connection | **Pass** | `jobWorkExecutionStore.sendJobWorkMaterial` → `workOrderStore.sendSubcontractMaterial` |
| No duplicate model | **Pass** | Extends existing `SubcontractShipment` (optional `vehicleNo`, `driver`) |
| Status flow | **Pass** | Auto-approves if not approved; shipment status `sent` |
| Stock movement | **Pass** | `inventoryStore.postSubcontractOut` → `SUBCON_OUT` (tested) |
| QC / NCR | **N/A** | — |
| Print | **Partial** | Challan printable after send via print route |
| Tests | **Pass** | Send success, SUBCON_OUT, vehicle metadata (`test-execution-layer`) |

**Fields implemented:** Vendor, source WO line, item, qty, warehouse, challan no, vehicle no, driver, expected return date.

---

## 6. Material Receive from Vendor

**Score: 2 — Functional**

| Check | Result | Evidence |
|-------|--------|----------|
| Route / UI | **Pass** | `ReceiveJobWorkForm` on JWO detail |
| Store connection | **Pass** | `receiveJobWorkMaterial` → `receiveSubcontractMaterial` + quality hooks |
| No duplicate model | **Pass** | Updates existing shipment record |
| Status flow | **Pass** | Balance check: `sentQty - received - rejected - rework`; partial/received shipment status |
| Stock movement | **Pass** | Accepted qty → `postSubcontractIn` → `SUBCON_IN` (tested) |
| QC / NCR linkage | **Pass** | Rejected qty → `createSubcontractReturnNcr`; `qcRequired` → `createSubcontractReturnInspection` |
| Tests | **Pass** | Receive, reject→NCR, balance close-block (28 tests) |

**Gaps:** Rejected qty does **not** post quarantine inventory movement (NCR only). `reworkQty` tracked on shipment but no stock transaction. QC-required accepted qty posts inventory **before** QC decision (may need hold/quarantine for Production Ready).

---

## 7. Subcontract QC

**Score: 1 — Partial**

| Check | Result | Evidence |
|-------|--------|----------|
| Route exists | **Partial** | No dedicated subcontract QC queue; inspections appear in generic `/quality/queue` |
| Sidebar navigation | **Partial** | Quality → QC Queue (not labelled Subcontract Return) |
| Global search | **Missing** | Inspection nos not indexed by category in `GlobalSearch.tsx` |
| Store connection | **Pass** | `QcInspectionCategory` includes `subcontract_return`; `NcrSource` includes `subcontract_return` |
| No duplicate model | **Pass** | Uses existing `QcInspection` / `NonConformanceReport` with `vendorId`, `subcontractShipmentId` |
| Status flow | **Partial** | Pending inspection created on receive; **no pass/fail decision handler** for subcontract return |
| Stock movement | **Partial** | No quarantine transfer on reject; no release-from-QC movement on pass |
| QC / NCR linkage | **Partial** | NCR on reject tested and linked to vendor/JWO/WO; pass flow untested |
| Print | **N/A** | — |
| Tests | **Partial** | Reject → NCR only; no subcontract_return inspection completion test |

**Critical gap:** `QcInspectionDetailPage` handles `incoming`, `in_process`, `final` only — **not** `subcontract_return` (`QualityPages.tsx`). Pending subcontract inspections cannot be decided from UI.

---

## 8. Vendor 360 Job Work tab

**Score: 2 — Functional**

| Check | Result | Evidence |
|-------|--------|----------|
| Route exists | **Pass** | Tab on `/masters/vendors/:id` (Vendor360Page); workspace `/job-work/vendors/:vendorId` |
| Sidebar navigation | **Partial** | Vendor Master → vendor detail; Job Work tab not a top-level nav item |
| Global search | **Partial** | Vendor searchable; JWO searchable separately; tab not indexed |
| Store connection | **Pass** | `useVendorJobWorkMetrics` from subcontract WOs, shipments, NCRs |
| No duplicate model | **Pass** | Read-only metrics over adapter |
| Status flow | **Pass** | Open JWO, balance, on-time %, rejection %, turnaround days |
| Stock movement | **N/A** | — |
| QC / NCR linkage | **Pass** | Subcontract NCRs listed; vendor NCR filter includes `vendorId` |
| Print | **N/A** | — |
| Tests | **Partial** | Metrics hook validated in integration test; no UI/E2E test |

**Tab contents:** Open JWO count, material with vendor, pending return, job work spend, rejection %, on-time return %, avg turnaround days, JWO table, link to vendor job work workspace.

---

## Architecture confirmation

### Adapter pattern (no duplicate JWO entity)

```
WorkOrder (woType=subcontract)
  + SubcontractShipment[]     ← workOrderStore
  + JobWorkMeta               ← jobWorkExecutionStore (approve, rate, closedAt)
  + QcInspection / NCR        ← qualityStore
        ↓
  jobWorkAdapter.toJobWorkOrderView() → JobWorkOrderView
```

### Core manufacturing logic unchanged

- `sendSubcontractMaterial` / `receiveSubcontractMaterial` in `workOrderStore.ts` retain original behaviour
- Execution layer wraps via `jobWorkExecutionStore.ts`

### Test command

```bash
npm run test:execution-layer
```

Coverage: WO 360 data, job cards, JWO register, send/receive movements, reject NCR, vendor metrics, close balance guard, challan print data.

---

## Score rollup by criterion

| Criterion | Avg score | Weakest area |
|-----------|----------:|--------------|
| Route exists | 2.0 | Subcontract QC (embedded only) |
| Sidebar navigation | 1.4 | WO 360, JWO detail, subcontract QC |
| Global search | 1.6 | Subcontract QC inspections |
| Store connection | 3.0 | — |
| No duplicate model | 3.0 | — |
| Status flow | 2.0 | Subcontract QC decision path |
| Stock movement | 2.0 | Receive reject quarantine |
| QC / NCR linkage | 1.7 | Subcontract QC UI |
| Print route | 1.5 | WO 360 print |
| Tests | 1.6 | UI/E2E, QC pass flow |

---

## Related documents

| Document | Purpose |
|----------|---------|
| `EXECUTION_LAYER_COMPLETION_REPORT.md` | Implementation deliverables summary |
| `EXECUTION_LAYER_BACKLOG.md` | Prioritized gaps to reach Production Ready |
| `ERP_EXECUTION_LAYER_AUDIT.md` | Pre-hardening baseline (superseded for capability status) |

---

*Audit generated from codebase state after Execution Layer Hardening. Re-run after backlog items ship.*
