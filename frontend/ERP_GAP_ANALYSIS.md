# Vasant Trailer ERP — Gap Analysis

**Document type:** Solution Architecture Assessment  
**Scope:** Production lifecycle from Sales Order through Invoice  
**Codebase:** `trailer-erp` (React 19 + Zustand + TypeScript)  
**Assessment date:** June 2026  
**Method:** Static analysis of routes, stores, types, engines, seed data, and integration tests (`scripts/test-wo-flow.ts`)

---

## Executive Summary

The ERP has a **working manufacturing execution spine** for the anchor scenario (SO-0001 · 2× 45 M3 Bulker):

```
MRP → PR → PO → GRN → WO → Reserve → Issue → Routing Ops → Job Cards → WIP → FG Receipt
```

**54 automated integration checks pass** on this path. However, **commercial closure** (Dispatch, Invoice) and **formal quality release** are absent. **Master engineering data** (BOM, Routing) does not persist across browser refresh, creating a split-brain with transactional data that does persist.

| Maturity band | Stages |
|---------------|--------|
| **Production-ready (core path)** | MRP, Reservation, Work Order, Routing, Operations, Job Cards, WIP (bulker-specific), FG Receipt |
| **Functional but incomplete** | BOM, Purchase, GRN, Quality (checklist only) |
| **Seed / read-only only** | Sales Order |
| **Legacy mock (unwired)** | Engineering (drawings/ECO), Dispatch, Dashboard, legacy Production/Quality pages |
| **Not started** | Invoice |

---

## Lifecycle Stage Matrix

| Stage | Status | Store | Routed UI | Ledger / Engine | Test Coverage |
|-------|--------|-------|-----------|-----------------|---------------|
| Sales Order | Partial | `mrpStore` (read) | No dedicated module | Consumed by MRP | Seed only |
| Engineering | Partial | `bomStore`, `routingStore` | BOM + Routing masters | Revision workflow | Audit scripts |
| BOM | Partial | `bomStore` | Yes | Cost rollup | Audit scripts |
| MRP | Strong | `mrpStore` | Yes | `mrpEngine.ts` | Yes |
| Purchase | Strong | `purchaseStore` | Yes | PR→RFQ→PO | Via WO flow |
| GRN | Partial | `purchaseStore` | PO detail only | `postGrn` → inward | Via WO flow |
| Reservation | Strong | `inventoryStore` | Yes | Free-stock reduction | Yes |
| Work Order | Strong | `workOrderStore` | Yes | `workOrderEngine.ts` | Yes (39+) |
| Routing | Partial | `routingStore` | Yes | Approval + release gate | Yes |
| Operations | Partial | `workOrderStore` | WO tab | Generated on `startProduction` | Yes |
| Job Cards | Partial | `workOrderStore` | WO tab | Start/complete + QC gate | Yes |
| WIP | Partial | `inventoryStore` | WO flow panel | WIP_RECEIVE / WIP_TRANSFER | Yes |
| Quality | Partial | Embedded in WO | No module | Checklist on job card | Partial |
| FG Receipt | Strong | `workOrderStore` | WO action | FG_RECEIPT / WIP transfer | Yes |
| Dispatch | Missing | None | Legacy mock only | None | None |
| Invoice | Missing | None | None | None | None |

---

## Stage-by-Stage Analysis

### 1. Sales Order

| Dimension | Finding |
|-----------|---------|
| **Fully implemented** | Seed SO records (`SO-0001` anchor); SO consumed by MRP run input; SO reservation via `reserveAvailableForOrder`; pegging fields on MRP material lines (`salesOrderId`, `salesOrderNo`) |
| **Partially implemented** | SO list visible indirectly via MRP dashboard and WO creation; customer master exists but not linked to SO CRUD |
| **Missing** | SO create/edit/confirm/cancel; SO status machine (`draft → confirmed → in_production → dispatched → closed`); SO line items UI; delivery schedule; link to dispatch and invoice |
| **Technical debt** | Dual SO models: live `types/mrp.ts` vs legacy `types/erp.ts` + `data/orders.ts`; unwired `SalesPage.tsx` with decorative buttons |
| **Data model gaps** | No `SalesOrderLine` entity with product/qty/price; no SO revision/amendment; no pegging table (SO line ↔ WO ↔ dispatch line) |
| **Workflow gaps** | No approval gate before MRP; no credit hold; no partial shipment tracking |
| **Reporting gaps** | No SO backlog, open qty, or delivery promise report |

---

### 2. Engineering

| Dimension | Finding |
|-----------|---------|
| **Fully implemented** | Product master with FG item link; BOM multi-level tree; Routing with operation sequence, work centers, QC flags |
| **Partially implemented** | BOM/Routing revision and approval (`submit → approve → release`); product detail shows released BOM + routing status |
| **Missing** | Drawing register; ECO (Engineering Change Order) workflow; ECO-driven automatic BOM/routing revise; CAD/document attachments |
| **Technical debt** | Unwired `EngineeringPage.tsx` uses legacy `data/engineering.ts`; ECO types exist only in `types/erp.ts` |
| **Data model gaps** | No `EngineeringDrawing`, `ECO`, `ECOLine` in live domain types; no effectivity date enforcement at WO creation time |
| **Workflow gaps** | Manual BOM/routing revise — not triggered by ECO; no "engineering freeze" per SO |
| **Reporting gaps** | No ECO log, drawing status, or revision history report |

---

### 3. BOM

| Dimension | Finding |
|-----------|---------|
| **Fully implemented** | Multi-level BOM tree UI; buy/make/subcontract/phantom rules; cost rollup; clone/revise; approval bar; MRP uses **released BOM only**; WO material explosion from BOM |
| **Partially implemented** | BOM export CSV; inactive item validation on submit |
| **Missing** | BOM effectivity by date/customer; alternate BOMs; substitute items at issue time |
| **Technical debt** | **`bomStore` not persisted** — edits lost on refresh while WO/MRP/inventory persist; no server-side validation |
| **Data model gaps** | No `BomSubstitute`, `BomAlternate`, `BomSite` (plant-specific); scrap factor on lines exists but no yield/recovery tracking |
| **Workflow gaps** | Cannot block WO if BOM revision drifts mid-production; no automatic cost refresh on item rate change |
| **Reporting gaps** | No BOM comparison across revisions in UI (modal exists for compare but limited); no where-used report |

---

### 4. MRP

| Dimension | Finding |
|-----------|---------|
| **Fully implemented** | `runMrp` / `runMrpForOrder`; multi-SO run; material shortage aggregation; WO requirement generation (`MrpWoRequirement`); auto PR creation; optional auto-reserve; production-ready flag per SO; dashboard KPIs |
| **Partially implemented** | Pegging to BOM lines; lead time offset (via item master); exception flags (`delayed`, shortage) |
| **Missing** | Planned order firming; MRP regeneration without duplicate PRs; capacity-constrained MRP; safety stock policies |
| **Technical debt** | `createPrFromMrpRun` on every run can duplicate PRs; legacy `MRPPage.tsx` + `data/mrp.ts` unused |
| **Data model gaps** | No frozen MRP snapshot immutability flag; no `MrpException` resolution workflow entity |
| **Workflow gaps** | No planner review/approve MRP run before PR release; SO status not updated after MRP |
| **Reporting gaps** | No MRP action message report (buy/make/transfer/defer); no pegging trace export |

---

### 5. Purchase

| Dimension | Finding |
|-----------|---------|
| **Fully implemented** | PR create from MRP; PR submit/approve; RFQ with multi-vendor quotes; PO from PR or RFQ; PO list/detail; vendor master integration |
| **Partially implemented** | Item-vendor map for sourcing; PO partial receipt via GRN |
| **Missing** | PO approval hierarchy; blanket PO; landed cost; GST/tax lines; payment terms enforcement |
| **Technical debt** | Purchase persisted but vendor/item rates not versioned at PO time |
| **Data model gaps** | No `PurchaseOrderTaxLine`, `PoApprovalLog`; RFQ comparison scoring not stored |
| **Workflow gaps** | No PR consolidation across MRP runs; no automatic PO from preferred vendor without RFQ |
| **Reporting gaps** | No open PO aging, vendor performance, or PR→PO cycle time report |

---

### 6. GRN (Goods Receipt Note)

| Dimension | Finding |
|-----------|---------|
| **Fully implemented** | `postGrn(poId, lines)`; per-line inward to inventory ledger; PO status update (`partial` / `received`); movement reference `GRN` |
| **Partially implemented** | Receive-all shortcut on PO detail |
| **Missing** | Standalone GRN module (list, detail, print); GRN against PO without full PO navigation; quality hold on receipt; batch/lot/heat number |
| **Technical debt** | GRN buried inside `PurchaseOrderDetailPage` — not discoverable from inventory menu |
| **Data model gaps** | No `GrnLine` inspection status; no quarantine warehouse routing on failed QC at receipt |
| **Workflow gaps** | No GRN cancel/reversal; no 3-way match (PO–GRN–Invoice) foundation |
| **Reporting gaps** | No GRN register, pending receipt vs PO report |

---

### 7. Reservation

| Dimension | Finding |
|-----------|---------|
| **Fully implemented** | SO and WO demand types; manual CRUD on `/inventory/reservations`; MRP auto-reserve; WO `reserveMaterials`; reservation reduces free stock only (ledger unchanged); pegging by `demandId` + `referenceNo` |
| **Partially implemented** | Reservation fulfill on issue (implicit via WO issue, not explicit fulfill call) |
| **Missing** | Reservation expiry; partial reservation transfer between WOs; reservation priority rules |
| **Technical debt** | Fixed earlier: Zustand `.filter()` in selectors caused infinite re-renders — pattern must stay out of selectors |
| **Data model gaps** | No reservation audit trail entity; no link reservation line ↔ specific SO line |
| **Workflow gaps** | No auto-reserve at SO confirm (only at MRP run); no reservation conflict resolution UI |
| **Reporting gaps** | Reservations page shows list but no SO/WO pegging summary report |

---

### 8. Work Order

| Dimension | Finding |
|-----------|---------|
| **Fully implemented** | Full status machine (`draft → planned → released → material_reserved → issued → in_production → completed → fg_received → closed`); create from MRP; multi-WO per SO (FG + sub-assemblies + subcontract); material lines with reserve/issue; subcontract send/receive; FG receipt; activity timeline; **requires released BOM + routing** |
| **Partially implemented** | WO config (`per_sub_assembly` vs `one_per_trailer`); parent/child WO linking via MRP requirements |
| **Missing** | WO reschedule; WO split/merge; operation-level material backflush; labour cost posting |
| **Technical debt** | **`workOrderStore` persisted** but references BOM/routing IDs that reset on refresh; subcontract paint WO separate from FG WO routing paint op |
| **Data model gaps** | No `WorkOrderSchedule` (finite capacity); no `WorkOrderCost` actual vs standard; no batch/serial on WO output |
| **Workflow gaps** | No WO hold/scrap/rework; `completeWorkOrder` does not verify all production ops complete; sub-assembly WO completion does not auto-receive semi-finished stock |
| **Reporting gaps** | No WO WIP aging, material variance, or SO pegging report |

---

### 9. Routing

| Dimension | Finding |
|-----------|---------|
| **Fully implemented** | Routing header + operations; work center assignment; standard/setup/run hours; QC required + outsourced flags; QC checklist template per operation; approval workflow (`draft → submitted → approved → released`); revise with obsolete prior revision; production eligibility gate |
| **Partially implemented** | Work center master; product detail shows routing versions |
| **Missing** | Alternate routings; parallel operations; operation overlapping; routing cost rollup to WO |
| **Technical debt** | **`routingStore` + `workCenterStore` not persisted**; infinite re-render fixed in RoutingPages (selector anti-pattern) |
| **Data model gaps** | No `RoutingOperationMaterial` (operation-level BOM); no `WorkCenterCalendar` / shift capacity |
| **Workflow gaps** | Cannot assign different routing per SO qty break; no routing effectivity enforcement at `startProduction` beyond released status |
| **Reporting gaps** | No routing standard hours vs actual comparison (actuals in job cards not aggregated) |

---

### 10. Operations (Production Operations)

| Dimension | Finding |
|-----------|---------|
| **Fully implemented** | Runtime ops copied from routing on `startProduction`; per-WO operation list with status; outsourced + QC flags preserved; standard hours scaled by WO qty |
| **Partially implemented** | Operation status sync from job card (`pending → in_progress → completed/qc_hold`) |
| **Missing** | Operation scheduling (start/end datetime); dependency enforcement (cannot start op 40 before op 30); machine/labor capacity loading |
| **Technical debt** | Ops regenerated only once — no re-sync if routing revised mid-flight |
| **Data model gaps** | No `OperationSchedule`, `OperationDependency`; no actual start/end at operation level (only on job card) |
| **Workflow gaps** | No skip operation; no rework operation insert; outsourced op 90 (Painting) not linked to subcontract WO automatically |
| **Reporting gaps** | No operation efficiency (standard vs actual hours rollup) |

---

### 11. Job Cards

| Dimension | Finding |
|-----------|---------|
| **Fully implemented** | Auto-generated one per operation on production start; shop floor team assignment; start/end time + actual hours; remarks; QC checklist gate before complete; activity log entries |
| **Partially implemented** | Welding QC checklist (penetration, joint, leak test) seeded; generic checklists for Cutting/Testing |
| **Missing** | Cross-WO job card queue for shop floor; mobile/tablet shop view; labour cost rate application; machine downtime capture |
| **Technical debt** | Job cards only visible inside single WO detail — no production supervisor dashboard |
| **Data model gaps** | No `JobCardLabourLine` (multi-worker); no `JobCardMachineLine`; no attachment/photo on QC fail |
| **Workflow gaps** | No job card pause/hold; no reassignment audit; completed job card cannot be reopened |
| **Reporting gaps** | No shop floor load by team/work center; no labour efficiency report |

---

### 12. WIP (Work In Progress)

| Dimension | Finding |
|-----------|---------|
| **Fully implemented** | Warehouses: `WIP_TANK_ASM`, `WIP_PAINTING`; material flow panel on WO; ledger postings: `WIP_RECEIVE` on issue, `WIP_TRANSFER` tank→paint on Tank Assembly job complete, FG receipt from paint WIP when stock exists |
| **Partially implemented** | Visual flow: RM Store → Issue → WIP Tank Assembly → WIP Painting → FG Yard |
| **Missing** | Generic WIP stage mapping from routing (currently hard-coded seq 30 = tank, seq 90 = painting); WIP valuation report; scrap at WIP stage |
| **Technical debt** | WIP logic embedded in `workOrderStore` with magic sequence numbers; subcontract receive posts to `WIP_PAINTING` but tank transfer uses `outputItemId` which may not match FG item |
| **Data model gaps** | No `WipBalance` entity (derived from ledger only — OK for MVP); no `WipStageRule` configuration per product/routing |
| **Workflow gaps** | Issue posts raw materials to WIP Tank — no consumption/backflush off WIP on op complete; no quarantine WIP path |
| **Reporting gaps** | No WIP aging by stage/warehouse; no WIP valuation by SO |

---

### 13. Quality

| Dimension | Finding |
|-----------|---------|
| **Fully implemented** | Routing `qcRequired` flag; QC checklist template on routing operations; job card checklist UI; `allQcChecksPassed` gate on complete; operation → `qc_hold` after QC-required job card complete |
| **Partially implemented** | Seed checklists for Welding, Cutting, Testing |
| **Missing** | **QC release** (`qc_hold → completed`); final inspection module; NCR (Non-Conformance Report); quarantine stock move on fail; QC inspector role/sign-off |
| **Technical debt** | Unwired `QualityPage.tsx` with static `data/quality.ts`; legacy `QCInspection` / `NCR` types in `types/erp.ts` with no store |
| **Data model gaps** | No `QualityInspection`, `NCR`, `NCRDisposition`, `QuarantineHold` in live types; job card QC is boolean pass only — no measured values |
| **Workflow gaps** | Production can `completeWorkOrder` while ops still in `qc_hold`; no rework WO spawn on QC fail |
| **Reporting gaps** | No FPY (first pass yield), NCR pareto, or QC turnaround report |

---

### 14. FG Receipt (Finished Goods Receipt)

| Dimension | Finding |
|-----------|---------|
| **Fully implemented** | `postFgReceipt` on completed FG WO; posts to `FG_YARD`; creates `FgReceipt` record; `FG_RECEIPT` ledger entry; WO status → `fg_received`; WIP transfer path when painting WIP has stock |
| **Partially implemented** | FG receipt tab on WO detail |
| **Missing** | FG receipt for partial qty; FG batch/serial; FG inspection before yard entry; multi-FG item per WO |
| **Technical debt** | Falls back to direct inward if WIP painting stock insufficient — masks WIP flow gaps |
| **Data model gaps** | No link FG receipt line ↔ SO line; no `FgReceiptQc` gate |
| **Workflow gaps** | Sub-assembly WO completion does not post semi-finished receipt to WIP/FG; only `finished_goods` WO type allowed |
| **Reporting gaps** | No FG production summary by period/product; no SO fulfillment qty vs FG received |

---

### 15. Dispatch

| Dimension | Finding |
|-----------|---------|
| **Fully implemented** | Nothing in live ERP path |
| **Partially implemented** | Legacy `DispatchPage.tsx` + `data/dispatch.ts` + types in `types/erp.ts` — **not routed**; sidebar entry disabled |
| **Missing** | Entire dispatch workflow: delivery challan, vehicle/driver, pick from FG Yard, issue stock on dispatch, SO qty shipped update, POD |
| **Technical debt** | Mock UI creates false impression of capability |
| **Data model gaps** | No live `DispatchOrder`, `DispatchLine`, `DeliveryChallan` types in domain layer |
| **Workflow gaps** | No gate "dispatch only after QC pass + FG available + SO balance"; no partial dispatch |
| **Reporting gaps** | No dispatch register, on-time delivery, or pending shipment report |

---

### 16. Invoice

| Dimension | Finding |
|-----------|---------|
| **Fully implemented** | Nothing |
| **Partially implemented** | Customer master exists (potential bill-to); product standard price on product master |
| **Missing** | Entire AR module: sales invoice, tax, payment, credit note, SO→invoice link |
| **Technical debt** | N/A — greenfield |
| **Data model gaps** | No `SalesInvoice`, `InvoiceLine`, `Payment`, `GstLine` entities |
| **Workflow gaps** | No dispatch-to-invoice trigger; no proforma; no e-invoice |
| **Reporting gaps** | No AR aging, revenue by product, or SO-to-cash report |

---

## Cross-Cutting Gaps

### Persistence Split-Brain

| Persisted (localStorage) | Not Persisted (resets to seed) |
|--------------------------|--------------------------------|
| Inventory ledger + reservations | Master data (items, products, warehouses) |
| MRP runs + SO copies | BOM headers/lines |
| Purchase PR/RFQ/PO/GRN | Routing + work centers |
| Work orders + job cards + ops | |

**Impact:** User can create WOs against a routing, refresh browser, routing reverts to seed while WO retains stale `routingHeaderId`. **Critical for production execution reliability.**

### Movement Ledger (Strength)

Single source of truth: `inventoryStore.stockMovements`. All stock derived via `computeOnHand`. Reference types cover procurement and manufacturing. **This is architecturally correct** and should be extended (not replaced) for dispatch and invoice cost of goods.

### Dual Codebase Layer

| Layer | Location | Status |
|-------|----------|--------|
| Live ERP | `src/modules/{mrp,purchase,workorder,inventory,masters}` | Routed |
| Legacy prototype | `src/modules/{sales,engineering,production,quality,dispatch,dashboard}` | Unwired, mock data |

**Recommendation:** Delete or quarantine legacy modules to prevent architectural drift.

### Test Coverage

| Script | Coverage |
|--------|----------|
| `scripts/test-wo-flow.ts` | MRP→WO→reserve→issue→WIP→job card→QC→FG (54 checks) |
| `scripts/audit-mrp-foundation.ts` | BOM + MRP engine |
| `scripts/simulate-e2e.ts` | Seed-level only |
| **Missing** | Purchase/GRN E2E, dispatch, invoice, QC release, multi-SO regression |

Tests are **not wired to CI** (`package.json` has no test script).

### Reporting

| Available | Missing |
|-----------|---------|
| Inventory ledger + CSV export | Executive dashboard (routed) |
| MRP dashboard KPIs | Production efficiency |
| Purchase dashboard counts | WIP valuation |
| BOM cost summary | SO fulfillment |
| | Dispatch / AR aging |

Sidebar **Reports → Analytics** is disabled.

---

## Architecture Compliance vs Manufacturing Rules

| Rule | Status |
|------|--------|
| MRP uses released BOM only | Enforced |
| Production uses released routing only | Enforced (`startProduction` gate) |
| Stock from movement ledger | Enforced |
| Reservation reduces free stock only | Enforced |
| No production without routing | Enforced |
| QC hold blocks next op | **Not enforced** (no release, complete WO allowed) |
| Dispatch reduces FG stock | **Not implemented** |
| SO qty tracks ship/invoice | **Not implemented** |

---

## Gap Severity Summary

| Severity | Items |
|----------|-------|
| **P0 — Blocks reliable MES** | BOM/routing persistence; QC release workflow; generic WIP stage rules; WO complete gating on ops/QC |
| **P1 — Blocks order fulfillment** | SO lifecycle; sub-assembly semi-finish receipt; dispatch + FG issue; GRN module |
| **P2 — Blocks commercial close** | Invoice / AR; SO shipment pegging |
| **P3 — Operational excellence** | Scheduling/capacity; shop floor queue; NCR; reporting suite |
| **P4 — Cleanup** | Legacy module removal; CI test pipeline; master data persistence |

---

*Generated from codebase analysis. Anchor product: 45 M3 Bulker (`SO-0001`, `RTG-45M3-BULKER-001`, `bom-bulker-a`).*
