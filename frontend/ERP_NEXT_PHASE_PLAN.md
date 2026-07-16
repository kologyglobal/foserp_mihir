# Vasant Trailer ERP — Next Phase Plan

**Document type:** Implementation Roadmap  
**Priority basis:** Manufacturing execution reliability and order fulfillment — **not UI polish**  
**Prerequisite reading:** [ERP_GAP_ANALYSIS.md](./ERP_GAP_ANALYSIS.md)  
**Anchor scenario:** SO-0001 · 2× 45 M3 Bulker · Pune plant

---

## Strategic Objective

Complete a **closed manufacturing loop** that a plant can run daily without data loss or workflow dead-ends:

```
Demand (SO) → Plan (MRP) → Procure (PR/PO/GRN) → Execute (WO/Routing/Job Cards/WIP) → Verify (QC) → Stock (FG) → Ship (Dispatch)
```

Invoice and analytics follow once material truth and shipment truth exist.

---

## Phase Overview

| Phase | Name | Duration (est.) | Outcome |
|-------|------|-----------------|---------|
| **0** | Execution Foundation | 1–2 weeks | No refresh data loss; gates enforced |
| **1** | Shop Floor Completion | 2–3 weeks | QC release, WIP rules, op gating, semi-FG |
| **2** | Procurement Hardening | 1–2 weeks | GRN module, PR dedup, receipt QC hold |
| **3** | Demand Chain | 2 weeks | SO CRUD + pegging + status sync |
| **4** | Fulfillment | 2–3 weeks | Dispatch + FG issue + SO ship qty |
| **5** | Commercial Close | 2 weeks | Invoice from dispatch |
| **6** | Planning & Reporting | Ongoing | Capacity, efficiency, executive KPIs |

---

## Phase 0 — Execution Foundation (P0)

> **Why first:** Manufacturing cannot be trusted if BOM/routing edits vanish on refresh while work orders persist stale references.

### 0.1 Persist Engineering Masters

| Task | Detail |
|------|--------|
| Add `persist` to `bomStore`, `routingStore`, `workCenterStore` | Same pattern as `workOrderStore` — `partialize` headers + lines + operations |
| Add `persist` to `masterStore` OR document intentional seed-only | Prefer persist for items/products/warehouses edited in session |
| Migration/version keys | Bump persist key suffix on schema change (`-v2`) |
| Acceptance | Edit routing op, refresh browser, change survives; WO still resolves routing |

**Files:** `src/store/bomStore.ts`, `routingStore.ts`, `workCenterStore.ts`, `masterStore.ts`, `persistConfig.ts`

### 0.2 CI Integration Tests

| Task | Detail |
|------|--------|
| Add `"test:wo-flow": "tsx scripts/test-wo-flow.ts"` to `package.json` | Gate regressions on manufacturing spine |
| Add `test:purchase-flow` script | PR → PO → GRN → ledger inward |
| Run in CI (GitHub Actions or local pre-push) | Minimum bar: 54+ WO checks pass |

### 0.3 Legacy Module Quarantine

| Task | Detail |
|------|--------|
| Move unwired modules to `src/modules/_legacy/` or delete | `sales`, `engineering`, `production`, `quality`, `dispatch`, `dashboard`, `MRPPage`, `InventoryPage` |
| Remove `types/erp.ts` consumption from live path | Consolidate on domain types |
| Remove duplicate `data/orders.ts` | Single SO source: `data/mrp/seed.ts` until SO module built |

**Exit criteria:** Refresh-safe masters; CI green; no dual SO/BOM data paths in active code.

---

## Phase 1 — Shop Floor Completion (P0)

> **Why second:** Job cards and WIP exist but production can "complete" with ops in `qc_hold` and WIP rules only work for bulker sequence numbers.

### 1.1 QC Release Workflow

| Task | Detail |
|------|--------|
| Add `releaseQcHold(productionOperationId, inspectorId)` to `workOrderStore` | Transition op `qc_hold → completed`; log activity |
| Add `releaseJobCardQc(jobCardId)` | Sync job card status |
| Gate `completeWorkOrder` | Block if any op still `pending`, `in_progress`, or `qc_hold` |
| Optional: move failed QC to quarantine WIP (`QUARANTINE` warehouse exists in seed) | NCR spawn in Phase 6 |

**Data model additions (`types/workorder.ts` or `types/qc.ts`):**
```typescript
interface QcReleaseRecord {
  id: string
  productionOperationId: string
  jobCardId: string
  releasedBy: string
  releasedAt: string
  remarks: string
}
```

### 1.2 Configurable WIP Stage Rules

Replace hard-coded seq 30/90 in `workOrderStore` + `wipFlow.ts`.

| Task | Detail |
|------|--------|
| Add `wipStageRules` to routing operation or product config | `{ operationSequenceNo, fromWarehouseCode, toWarehouseCode, trigger: 'issue' | 'job_complete' }` |
| Seed bulker rules: issue→`WIP_TANK_ASM`; op 30 complete→transfer to `WIP_PAINTING`; FG→`FG_YARD` | Match current behavior via config not code |
| `resolveWipFlowStep` reads rules + ledger balances | Generic for ISO Tank routing when added |

**Files:** `src/types/routing.ts`, `src/data/routing/seed.ts`, `src/utils/wipFlow.ts`, `src/store/workOrderStore.ts`

### 1.3 Sub-Assembly Semi-Finish Receipt

| Task | Detail |
|------|--------|
| Add `postSemiFinishReceipt(woId)` for `manufactured_sub_assembly` WO type | On `completeWorkOrder`, post output item to configured WIP warehouse |
| Link sub-assembly stock to parent FG WO material consumption | Parent FG WO issues SA-TANK from WIP when tank asm WO completes |
| Extend `test-wo-flow.ts` | Validate tank sub-WO posts SA stock before FG WO consumes |

### 1.4 Operation Dependency Enforcement

| Task | Detail |
|------|--------|
| `startJobCard` blocked if prior sequence op not `completed` | Enforce routing sequence 10→20→…→100 |
| Outsourced op 90 linked hint to subcontract WO | Display link on WO detail; optional auto-status sync on subcontract receive |

**Exit criteria:** Cannot complete WO with open QC hold; WIP transfers driven by routing config; tank sub-assembly posts stock; tests ≥ 60 pass.

---

## Phase 2 — Procurement Hardening (P1)

> **Why third:** MRP auto-creates PRs but GRN is hidden and duplicate PRs can occur — material availability breaks the WO path silently.

### 2.1 GRN Module (Execution, Not UI-First)

| Task | Detail |
|------|--------|
| `GrnListPage` + `GrnDetailPage` routes | `/purchase/grns`, `/purchase/grns/:id` |
| `getGrns()`, `getGrnsByPo()` already in store — expose | |
| GRN print/PDF challan (minimal) | Stores use only |

### 2.2 PR Deduplication on MRP Re-Run

| Task | Detail |
|------|--------|
| Before `createPrFromMrpRun`, check open PR for same MRP run + SO | Update lines instead of create duplicate |
| Add `MrpRun.prIds[]` back-link | Traceability |

### 2.3 Receipt Quality Hold (Optional Gate)

| Task | Detail |
|------|--------|
| `postGrn` flag `holdForQc` → inward to `QUARANTINE` not main store | Release via QC module Phase 6 |
| Item master flag `requiresIncomingQc` | |

**Exit criteria:** GRN discoverable and auditable; re-MRP doesn't duplicate PRs; `test:purchase-flow` script passes.

---

## Phase 3 — Demand Chain (P1)

> **Why fourth:** Manufacturing executes against seed SO-0001 — real plant needs SO create/confirm/amend with pegging to WO and dispatch.

### 3.1 Sales Order Store + Engine

| Task | Detail |
|------|--------|
| Create `salesOrderStore.ts` (or extend `mrpStore`) | `createOrder`, `confirmOrder`, `cancelOrder`, `amendQty` |
| Types: `SalesOrder`, `SalesOrderLine`, `SalesOrderStatus` | Replace seed-only model |
| Routes: `/sales/orders`, `/sales/orders/:id`, `/sales/orders/new` | Functional CRUD — simple forms acceptable |

### 3.2 SO Status Sync

| Event | SO Status Update |
|-------|------------------|
| MRP run | `planned` |
| First WO released | `in_production` |
| FG receipt qty ≥ ordered | `ready_to_dispatch` |
| Dispatch posted | `partially_shipped` / `shipped` |

### 3.3 Pegging Entity

| Task | Detail |
|------|--------|
| `DemandPegging` table in store | `{ salesOrderLineId, workOrderId?, purchaseRequisitionId?, dispatchLineId? }` |
| Visible on SO detail and WO detail | Execution traceability |

**Exit criteria:** Create SO → MRP → WO without seed; pegging visible end-to-end.

---

## Phase 4 — Fulfillment (P1)

> **Why fifth:** FG Yard receives stock but nothing leaves — SO never closes operationally.

### 4.1 Dispatch Store + Ledger

| Task | Detail |
|------|--------|
| `dispatchStore.ts` | `createDispatch`, `confirmDispatch`, `cancelDispatch` |
| Types: `DispatchOrder`, `DispatchLine`, `DispatchStatus` | New `types/dispatch.ts` — not legacy `erp.ts` |
| `postDispatchIssue` in `inventoryStore` | Issue from `FG_YARD`; ref type `DISPATCH` |
| Gate: dispatch qty ≤ FG free qty ≤ SO open qty | |

### 4.2 Delivery Challan

| Task | Detail |
|------|--------|
| Generate challan number `DC-YYYY-NNNN` | |
| Fields: vehicle, driver, customer ship-to from customer master | |
| Link to SO lines | |

### 4.3 SO Ship Qty Update

| Task | Detail |
|------|--------|
| On dispatch confirm, increment `SalesOrderLine.shippedQty` | |
| SO status → `shipped` when all lines fulfilled | |

**Exit criteria:** FG receipt → dispatch → FG ledger reduced; SO shows shipped qty; test script covers dispatch.

---

## Phase 5 — Commercial Close (P2)

> **Why sixth:** Invoice without dispatch truth creates AR mismatch.

### 5.1 Sales Invoice

| Task | Detail |
|------|--------|
| `invoiceStore.ts` | `createFromDispatch`, `postInvoice`, `cancelInvoice` |
| Types: `SalesInvoice`, `InvoiceLine`, `InvoiceTaxLine` | GST basic (CGST/SGST/IGST from customer state) |
| Route: `/sales/invoices` | |
| Link invoice line → dispatch line → SO line | 3-way trace |

### 5.2 Payment Recording (Minimal)

| Task | Detail |
|------|--------|
| `recordPayment(invoiceId, amount, date, reference)` | |
| AR balance = invoiced − paid | |

**Exit criteria:** Dispatch → invoice → payment closes SO commercially.

---

## Phase 6 — Planning & Reporting (P3)

> **After execution loop is closed** — not before.

### 6.1 Manufacturing Analytics (Data-First)

| Report | Source |
|--------|--------|
| Standard vs actual hours by work center | Job cards + routing |
| WO material variance (required vs issued) | WO material lines + ledger |
| WIP aging by warehouse | Ledger WIP_* movements |
| SO fulfillment funnel | SO → WO → FG → dispatch |
| Open PO / PR aging | purchaseStore |
| FPY / QC hold duration | QcReleaseRecord + job cards |

Implement as **store selectors + CSV export** before dashboard UI.

### 6.2 Capacity Planning (Later)

| Task | Detail |
|------|--------|
| Work center calendar + available hours | |
| Rough-cut capacity check on MRP WO generation | Flag overload exceptions |
| **Not in near term:** finite scheduling optimizer | |

### 6.3 NCR Module (Later)

| Task | Detail |
|------|--------|
| `ncrStore` — create from failed QC checklist | |
| Dispositions: rework, scrap, use-as-is | |
| Spawn rework WO | |

---

## Priority Backlog (Ranked)

| Rank | Item | Phase | Rationale |
|------|------|-------|-----------|
| 1 | Persist BOM + routing + work centers | 0 | Prevents stale WO references |
| 2 | QC release + WO complete gating | 1 | Unblocks honest production status |
| 3 | Configurable WIP stage rules | 1 | Removes bulker-only hardcoding |
| 4 | Sub-assembly semi-finish receipt | 1 | FG WO cannot consume phantom SA |
| 5 | Operation sequence enforcement | 1 | Prevents out-of-order job cards |
| 6 | CI test scripts in package.json | 0 | Regression safety net |
| 7 | GRN list module + PR dedup | 2 | Material availability truth |
| 8 | SO CRUD + status machine | 3 | Real demand entry |
| 9 | Demand pegging entity | 3 | Traceability |
| 10 | Dispatch store + FG issue | 4 | Physical fulfillment |
| 11 | Sales invoice from dispatch | 5 | Commercial close |
| 12 | MES shop floor queue (all open job cards) | 6 | Supervisor visibility — **after** core gates |
| 13 | Executive dashboard | 6 | **Last** — needs underlying data |
| 14 | Legacy module deletion | 0 | Reduce confusion |

---

## Explicitly Deprioritized (UI-First Items)

Do **not** build these until Phase 1–4 execution gates pass:

- Kanban production board
- Mobile shop floor app shell without QC release backend
- Chart-heavy dashboard without ledger-backed KPIs
- Custom report designer
- Multi-plant / multi-company
- User roles & permissions (use single role until workflows stabilize)

---

## Suggested Sprint Map (8-Week View)

| Week | Focus | Deliverable |
|------|-------|-------------|
| 1 | Phase 0 | Persist masters; CI tests; legacy quarantine |
| 2 | Phase 1a | QC release; WO complete gating |
| 3 | Phase 1b | WIP rules config; sub-assembly receipt |
| 4 | Phase 1c | Op sequence enforcement; extend tests to 65+ |
| 5 | Phase 2 | GRN module; PR dedup; purchase test script |
| 6 | Phase 3 | SO store + CRUD + pegging |
| 7 | Phase 4 | Dispatch + FG issue + SO ship qty |
| 8 | Phase 5 | Invoice from dispatch; end-to-end demo SO-0002 |

---

## End-to-End Acceptance Test (Phase 5 Complete)

New script: `scripts/test-order-to-cash.ts`

```
1. Create SO (2× 45 M3 Bulker, customer ABC Cement)
2. Confirm SO
3. Run MRP → PR → approve → PO → GRN (shortage items)
4. Create WO from MRP
5. Plan → release → reserve → issue (verify WIP_RECEIVE)
6. Start production → complete all job cards (with QC checklists + release)
7. Complete WO → FG receipt to FG_YARD
8. Create dispatch → confirm (verify FG issue ledger)
9. Create invoice from dispatch
10. Assert: SO status = shipped; FG on-hand reduced; AR balance = invoice total
```

---

## Architecture Principles (Carry Forward)

1. **Movement ledger is stock truth** — extend with `DISPATCH`, don't add balance tables
2. **Released BOM + routing gates** — never weaken for convenience
3. **Reservation ≠ issue** — free stock only until issue
4. **No `.filter()` in Zustand selectors** — use raw slice + `useMemo`
5. **Persist transactional + master data consistently** — or neither
6. **Engine before UI** — every phase delivers store methods + tests before pages

---

## Document Control

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.0 | Jun 2026 | Solution Architecture | Initial plan from gap analysis |

---

*This plan prioritizes what the Pune plant needs to **execute and trace** a trailer order — not what looks complete in a demo UI.*
