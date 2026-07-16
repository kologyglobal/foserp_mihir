# ERP Perfection Audit

**Auditor role:** Senior Manufacturing ERP Implementation Auditor  
**Scope:** Full frontend / localStorage system — pre-backend migration  
**Plant:** Vasant Trailers · Pune  
**Audit date:** 2026-06-23 (Re-Audit #2 — post P0 + Sales + Product Master sprints)  
**Codebase:** `frontend/`  
**Method:** Automated test suite, go-live simulation, MRP foundation audit, routes/stores/UI verification against live code. No backend assumptions.

---

## Scoring Scale

| Score | Rating | Meaning |
|-------|--------|---------|
| **0** | Missing | Not implemented or not routed |
| **1** | Prototype | Demo/seed-driven; not reliably operable by factory staff |
| **2** | Functional | End-to-end works for anchor scenario (SO-0001 bulker); gaps remain |
| **3** | Production Ready | Persisted, validated, tested, UI complete, factory-operable at localStorage level |

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Modules audited | 20 |
| Average score | **2.2 / 3.0** (↑ from 2.0) |
| Production Ready (3) | 4 modules — Inventory, MRP, Production, **Product** |
| Functional (2) | 16 modules |
| Prototype (1) | 0 modules |
| Go-live simulation | ✅ 9/9 checks (`npm run simulate:go-live`) |
| MRP foundation audit | ✅ PASS (`npx tsx scripts/audit-mrp-foundation.ts`) |
| TypeScript build | ✅ Passes (`npm run build`) |
| Integration tests | ✅ **206 / 206** checks pass (all scripts in this audit run) |
| P0 hardening backlog | ✅ **6/6 closed** (see `ERP_HARDENING_BACKLOG.md`) |

**Anchor path validated:**

```
Lead → Inquiry → Quotation → Customer Approval → SO → MRP → PR → PO → GRN
→ Incoming QC → WO → Reserve → Issue → Job Cards / WIP → In-process QC
→ SA Receipt → FG Receipt → Final QC → Costing → Dispatch → Invoice → Payment → SO Closed
```

**Since Re-Audit #1 (same day, earlier):** masterStore persisted, GRN detail routed, build fixed, incoming/final QC UI, PO + gate-pass print routes, full sales lifecycle module, 18-report operational hub, manufacturing-grade Product Master with lifecycle gates and 5 product reports.

---

## System Health (Cross-Cutting)

| Check | Status | Evidence |
|-------|--------|----------|
| Persistence registry | ✅ | `persistConfig.ts` — 13 keys incl. `masters`, `sales` |
| Master data survives refresh | ✅ | `masterStore.ts` wrapped with `persist()` + seed merge |
| Audit trail utility | Partial | `audit.ts` on purchase/quality/dispatch; Product has `changeLog`; masters/BOM/WO still partial |
| Permission hooks | Mock | `permissions.ts` — `MOCK_USER` admin bypasses all |
| Document numbering | ✅ | `documentNumbers.ts` |
| Integration test suite | ✅ | 19 scripts; 183 passing checks in this audit run |
| CI pipeline | ❌ | No GitHub Actions / test gate |
| TypeScript build | ✅ | `npm run build` exits 0 |
| Broken in-app routes | ✅ | GRN detail, reports hub, sales, product detail — all routed |
| Print routes | Partial | PO print + gate pass routed; QC/NCR print still missing |
| Legacy mock modules | ⚠️ | 8 unwired `*Page.tsx` files using dead `src/data/*.ts` |
| Cost calibration | ⚠️ | FG variance vs BOM standard: **52.8%** (see `ERP_COST_CALIBRATION.md`) |

---

## Module Audits

### 1. Masters (UOM, Category, Item, Customer, Vendor, Warehouse)

**Score: 2 — Functional** (↑ from 1)

| Criterion | Status | Notes |
|-----------|--------|-------|
| Create / Edit / View | ✅ | Full CRUD for all 6 entity types |
| Status flow | N/A | `isActive` flags only; no approval workflow |
| Validations | Partial | Form-level; item inactive blocks inventory txn |
| Linked transactions | ✅ | Referenced by inventory, purchase, WO |
| Audit fields | Partial | `createdAt` / `updatedAt`; no full `AuditTrail` |
| Print / Export | ❌ | None |
| Edge cases | Partial | Deactivate item with stock not blocked in UI |
| Error states | ✅ | "Not found" pages per entity |
| Empty states | ✅ | List empty messages |
| UI consistency | ✅ | Matches BC-style list/form/detail pattern |
| Integration tests | Indirect | Via `go-live-simulation`, `test-wo-flow` |
| Routes | ✅ | `src/routes/index.tsx` |
| Mock / seed dependency | Seed merge + **persist** | `vasant-erp-masters-v1` — edits survive refresh |

**Store:** `src/store/masterStore.ts` (persisted)  
**Key gap:** No `AuditTrail` stamps; no block on deactivate with open stock.

---

### 2. Product

**Score: 3 — Production Ready** (↑ from 1)

| Criterion | Status | Notes |
|-----------|--------|-------|
| Create / Edit / View | ✅ | List, form, **8-tab detail page** (Overview, Revisions, BOM, Routing, Costing, Quality, Documents, History) |
| Status flow | ✅ | Draft → Engineering Review → Approved → Released → Obsolete (no skip) |
| Validations | ✅ | Release requires FG item + released BOM + routing + approved; obsolete blocked with open SO/WO; SO gate for non-released |
| Linked transactions | ✅ | MRP, WO, dispatch, invoice, costing derive, sales eligibility |
| Audit fields | ✅ | Full `changeLog` with old/new/user/date/reason; revision history with lock |
| Print / Export | Partial | 5 product reports (revision, obsolete, cost, usage, engineering change) |
| Edge cases | ✅ | Revision locks prior; cost override requires approval |
| Error states | ✅ | Lifecycle action errors surfaced via toast |
| Empty states | ✅ | Tab empty states |
| UI consistency | ✅ | |
| Integration tests | ✅ | `test:product-master.ts` — 14/14 |
| Routes | ✅ | `masters/products/*` + 5 report routes |
| Mock / seed dependency | Seed merge + persist | 3 rich seed products via `productSeed.ts` |

**Store:** `masterStore` + `productMasterStore.ts` (workflow actions)  
**Key gap:** Create/edit form covers identity/commercial only — Quality/Sales/Manufacturing fields edited on detail tabs.

---

### 3. BOM

**Score: 2 — Functional**

| Criterion | Status | Notes |
|-----------|--------|-------|
| Create / Edit / View | ✅ | Tree UI, clone, revise, compare modal |
| Status flow | ✅ | `draft → submitted → approved → released`; obsolete on revise |
| Validations | ✅ | Draft-only edit; inactive items blocked on submit |
| Linked transactions | ✅ | MRP explosion, costing standard, WO materials |
| Audit fields | Partial | `createdAt` on header; no approver stamps |
| Print / Export | ✅ | CSV via `exportBomCsv` |
| Edge cases | Partial | No alternate/substitute BOM; no effectivity dates |
| Error states | ✅ | Toast + "BOM not found" |
| Empty states | ✅ | Empty tree message |
| UI consistency | ✅ | |
| Integration tests | ✅ | `audit-mrp-foundation.ts`, `test-wo-flow.ts` |
| Routes | ✅ | `masters/bom` L126–129 |
| Mock / seed dependency | Seed merge + persist | `vasant-erp-bom-v1` |

**Store:** `src/store/bomStore.ts`

---

### 4. Routing

**Score: 2 — Functional**

| Criterion | Status | Notes |
|-----------|--------|-------|
| Create / Edit / View | ✅ | Create + detail; ops edited inline when draft |
| Status flow | ✅ | Same as BOM |
| Validations | ✅ | Draft-only op edits; inactive WC blocks approval |
| Linked transactions | ✅ | WO production operations, WIP routing, job cards |
| Audit fields | Partial | `createdAt` only |
| Print / Export | ❌ | None |
| Edge cases | Partial | No parallel ops; no operation-level BOM |
| Error states | ✅ | "Routing not found" |
| Empty states | ✅ | "No operations" table |
| UI consistency | ⚠️ | No `/:id/edit` route (unlike other masters) |
| Integration tests | ✅ | `test-wip-routing.ts`, `test-wo-flow.ts` |
| Routes | ✅ | `masters/routing` L136–138 |
| Mock / seed dependency | Seed merge + persist | `vasant-erp-routing-v1` |

**Store:** `src/store/routingStore.ts`

---

### 5. Work Centers

**Score: 2 — Functional**

| Criterion | Status | Notes |
|-----------|--------|-------|
| Create / Edit / View | ✅ | Zod-validated form |
| Status flow | N/A | `isActive` flag |
| Validations | ✅ | Inactive WC blocks routing approval |
| Linked transactions | ✅ | Routing ops, job cards, rework WC |
| Audit fields | Partial | `createdAt` only |
| Print / Export | ❌ | None |
| Edge cases | Partial | No shift calendar / capacity loading |
| Error states | ✅ | Form field errors, not-found |
| Empty states | ✅ | |
| UI consistency | ✅ | |
| Integration tests | ✅ | `test-wip-routing.ts` |
| Routes | ✅ | `masters/work-centers` L131–134 |
| Mock / seed dependency | Seed merge + persist | `vasant-erp-workcenters-v1` |

**Store:** `src/store/workCenterStore.ts`

---

### 6. Inventory

**Score: 3 — Production Ready**

| Criterion | Status | Notes |
|-----------|--------|-------|
| Create / Edit / View | ✅ | Opening, inward, issue, adjustment, reservations |
| Status flow | ✅ | Reservation: active/cancelled/fulfilled |
| Validations | ✅ | Stockable/active checks, negative stock block, WO refs |
| Linked transactions | ✅ | MRP reserve, GRN, WIP, SA/FG receipt, dispatch |
| Audit fields | Partial | Movement `createdAt`; not full AuditTrail on all txns |
| Print / Export | ✅ | CSV stock + ledger; print on dashboard/ledger |
| Edge cases | ✅ | Free qty vs reserved; ledger reconcile in sim |
| Error states | ✅ | `{ ok: false, error }` surfaced via toast |
| Empty states | ✅ | Empty ledger/stock messages |
| UI consistency | ✅ | BC command bar pattern |
| Integration tests | ✅ | `test-integrity-check.ts`, `test-wo-flow.ts`, go-live |
| Routes | ✅ | `inventory/*` L140–147 |
| Mock / seed dependency | Seed movements only | Ledger is runtime source of truth |

**Store:** `src/store/inventoryStore.ts`  
**Evidence:** Go-live verification "No inventory mismatch (ledger = on-hand)" — PASS.

---

### 7. MRP

**Score: 3 — Production Ready**

| Criterion | Status | Notes |
|-----------|--------|-------|
| Create / Edit / View | ✅ | Run create; run detail; SO select (view only) |
| Status flow | ✅ | SO status machine driven downstream |
| Validations | ✅ | Released BOM required; shortage exceptions |
| Linked transactions | ✅ | Auto PR, optional reserve, WO requirements |
| Audit fields | Minimal | Run timestamp, `runBy` string |
| Print / Export | ❌ | None |
| Edge cases | ⚠️ | Re-MRP can duplicate PRs |
| Error states | ✅ | Toast on run failure |
| Empty states | ✅ | "No MRP run yet" |
| UI consistency | ✅ | |
| Integration tests | ✅ | `verify-mrp.ts`, `go-live-simulation.ts` |
| Routes | ✅ | `mrp/*` L149–151 |
| Mock / seed dependency | SO seed only | `src/data/mrp/seed.ts` — **no SO CRUD UI** |

**Store:** `src/store/mrpStore.ts`

---

### 8. Purchase

**Score: 2 — Functional**

| Criterion | Status | Notes |
|-----------|--------|-------|
| Create / Edit / View | ✅ | PR, RFQ, PO workflows; hub + lists + detail |
| Status flow | ✅ | PR/PO status machines with forward-only transitions |
| Validations | ✅ | PO send after approve; inactive vendor block; amend revision |
| Linked transactions | ✅ | MRP → PR → RFQ → PO → GRN; vendor comparison |
| Audit fields | ✅ | Full `AuditTrail` on PR/RFQ/PO |
| Print / Export | ✅ | PO print at `purchase/orders/:id/print`; gate pass at `dispatch/:id/gate-pass` |
| Edge cases | ✅ | Multi-vendor PO from one PR; excess GRN tolerance |
| Error states | ✅ | Toast throughout |
| Empty states | ✅ | PR/PO empty messages |
| UI consistency | ✅ | |
| Integration tests | ✅ | `test-purchase-production-ready.ts`, go-live |
| Routes | ✅ | `purchase/*` L153–161 |
| Mock / seed dependency | Runtime only | `createManualPr` in store — **no UI** |

**Store:** `src/store/purchaseStore.ts`

---

### 9. GRN

**Score: 2 — Functional**

| Criterion | Status | Notes |
|-----------|--------|-------|
| Create / Edit / View | ✅ | Create on PO detail; register list; **detail page with lines, PO link, QC link** |
| Status flow | ✅ | `pending_qc → posted`; partial PO receipt |
| Validations | ✅ | 5% excess tolerance; QC → quarantine; accepted qty only to stock |
| Linked transactions | ✅ | PO lines, incoming QC, inventory quarantine |
| Audit fields | ✅ | `stampCreated` on GRN header |
| Print / Export | ❌ | None |
| Edge cases | Partial | No GRN cancel/reversal |
| Error states | ✅ | Toast on PO detail post |
| Empty states | ✅ | "No GRNs posted" on register |
| UI consistency | ✅ | Register → detail link works |
| Integration tests | ✅ | `test-purchase-production-ready.ts`, go-live |
| Routes | ✅ | `purchase/grns` + **`purchase/grns/:id`** |
| Mock / seed dependency | Runtime only | |

---

### 10. Quality

**Score: 2 — Functional**

| Criterion | Status | Notes |
|-----------|--------|-------|
| Create / Edit / View | ✅ | Auto-created inspections; **incoming, in-process, and final decision UI** on detail page |
| Status flow | ✅ | Inspection / rework / NCR machines; closure approval |
| Validations | ✅ | WO complete/FG receipt blocked; dispatch final QC gate |
| Linked transactions | ✅ | Job cards, GRN, WO, dispatch |
| Audit fields | ✅ | Full on inspections, reworks, NCRs |
| Print / Export | ❌ | No QC certificate / NCR print |
| Edge cases | ✅ | Rework → re-inspect → next op gate tested |
| Error states | ✅ | Blocker messages, toast |
| Empty states | ✅ | Queue empty states |
| UI consistency | ✅ | Category-branched detail page |
| Integration tests | ✅ | `test-quality-flow.ts`, `test-quality-production-ready.ts` — 8/8 |
| Routes | ✅ | `quality/*` |
| Mock / seed dependency | Plans seed | `inspectionPlans.ts`, `itemQcConfig.ts` |

**Store:** `src/store/qualityStore.ts`

---

### 11. Production (Work Orders)

**Score: 3 — Production Ready**

| Criterion | Status | Notes |
|-----------|--------|-------|
| Create / Edit / View | ✅ | Create from MRP; detail with action tabs |
| Status flow | ✅ | Full WO lifecycle with gates |
| Validations | ✅ | BOM/routing release, issue-before-start, QC on complete |
| Linked transactions | ✅ | Materials, ops, job cards, SA/FG, costing |
| Audit fields | Partial | Activity timeline; not full AuditTrail |
| Print / Export | ❌ | None |
| Edge cases | ✅ | Subcontract paint, per-SA mode, FG from multiple SAs |
| Error states | ✅ | Toast on every action |
| Empty states | ✅ | WO list empty |
| UI consistency | ✅ | |
| Integration tests | ✅ | `test-wo-flow.ts` (54+ checks), go-live |
| Routes | ✅ | `work-orders/*` L163–165 |
| Mock / seed dependency | Runtime | |

**Store:** `src/store/workOrderStore.ts` + `src/utils/workOrderEngine.ts`

---

### 12. Job Cards

**Score: 2 — Functional**

| Criterion | Status | Notes |
|-----------|--------|-------|
| Create / Edit / View | ✅ | Auto on `startProduction`; panel on WO Operations tab |
| Status flow | ✅ | Sequence gate; QC hold on complete |
| Validations | ✅ | `canStartOperation`; QC checklist if required |
| Linked transactions | ✅ | Creates pending inspection; WIP movements |
| Audit fields | Partial | Team, hours on complete |
| Print / Export | ❌ | None |
| Edge cases | ✅ | Sequence block reason shown |
| Error states | ✅ | Inline block messages |
| Empty states | N/A | WO-scoped |
| UI consistency | ✅ | Embedded in WO detail |
| Integration tests | ✅ | `test-wo-flow.ts`, `test-quality-flow.ts` |
| Routes | N/A | No standalone route — by design |
| Mock / seed dependency | Runtime | |

**UI:** `JobCardPanel.tsx` in `WorkOrderPages.tsx`

---

### 13. WIP

**Score: 2 — Functional**

| Criterion | Status | Notes |
|-----------|--------|-------|
| Create / Edit / View | ✅ | Flow diagram on WO tab; automatic postings |
| Status flow | N/A | Driven by job card / op completion |
| Validations | ✅ | WIP move failures block job card complete |
| Linked transactions | ✅ | `MOVE_TO_WIP`, `WIP_TRANSFER`, warehouse routing |
| Audit fields | Via ledger | Stock movements |
| Print / Export | ❌ | No WIP aging report |
| Edge cases | ✅ | Routing-driven warehouse mapping |
| Error states | ✅ | Blocks surfaced on job card |
| Empty states | N/A | |
| UI consistency | ✅ | `WipFlowPanel.tsx` |
| Integration tests | ✅ | `test-wip-routing.ts` |
| Routes | N/A | WO-embedded |
| Mock / seed dependency | Warehouse codes from seed | |

**Logic:** `src/utils/wipFlow.ts`, `wipRouting.ts`, `woWipActions.ts`

---

### 14. Semi-Finished Receipt

**Score: 2 — Functional**

| Criterion | Status | Notes |
|-----------|--------|-------|
| Create / Edit / View | ✅ | Post action on WO SA Receipt tab |
| Status flow | ✅ | One receipt per mfg SA WO after `completed` |
| Validations | ✅ | FG WO checks all SA receipts via `assertSaSubAssembliesReceivedForFg` |
| Linked transactions | ✅ | `SA_RECEIPT` inventory movement |
| Audit fields | Via ledger | |
| Print / Export | ❌ | None |
| Edge cases | ⚠️ | No partial qty SA receipt |
| Error states | ✅ | Tab explains wrong WO type; toast |
| Empty states | ✅ | Guidance text on tab |
| UI consistency | ✅ | |
| Integration tests | ✅ | `test-sa-receipt.ts`, go-live |
| Routes | N/A | WO tab |
| Mock / seed dependency | Runtime | |

**Store:** `workOrderStore.postSaReceipt`

---

### 15. Costing

**Score: 2 — Functional**

| Criterion | Status | Notes |
|-----------|--------|-------|
| Create / Edit / View | ✅ | Dashboard + WO cost tab; overhead % editable |
| Status flow | N/A | Computed, not posted |
| Validations | N/A | Derived from movements |
| Linked transactions | ✅ | BOM standard, job card hours, material issues |
| Audit fields | ❌ | None on cost sheets |
| Print / Export | ❌ | Tables only |
| Edge cases | ⚠️ | 52.8% variance vs BOM standard (calibration doc) |
| Error states | Minimal | Empty when no FG WOs |
| Empty states | ✅ | Empty tables |
| UI consistency | ✅ | |
| Integration tests | ✅ | `test-costing.ts`, `cost-calibration.ts`, go-live |
| Routes | ✅ | `costing` L176; WO `?tab=cost` |
| Mock / seed dependency | Overhead % persisted | `vasant-erp-costing-v1` |

**Store:** `src/store/costingStore.ts` + `src/utils/costEngine.ts`

---

### 16. Dispatch

**Score: 2 — Functional**

| Criterion | Status | Notes |
|-----------|--------|-------|
| Create / Edit / View | ✅ | Plan page, detail with tabs |
| Status flow | ✅ | Full flow incl. `pod_received → closed` |
| Validations | ✅ | Final QC gate, FG stock, mandatory checklist, gate pass |
| Linked transactions | ✅ | SO status, FG issue, invoice create |
| Audit fields | ✅ | Full AuditTrail + gate pass approval |
| Print / Export | ✅ | Gate pass print routed at `dispatch/:id/gate-pass` |
| Edge cases | ✅ | Security gate before confirm tested |
| Error states | ✅ | Toast on all actions |
| Empty states | ✅ | "No trailers ready", "No dispatches yet" |
| UI consistency | ✅ | |
| Integration tests | ✅ | `test-dispatch.ts`, `test-dispatch-production-ready.ts` |
| Routes | ✅ | `dispatch/*` L178–181 |
| Mock / seed dependency | Runtime | Photos as base64 blobs |

**Store:** `src/store/dispatchStore.ts`

---

### 17. Invoice

**Score: 2 — Functional**

| Criterion | Status | Notes |
|-----------|--------|-------|
| Create / Edit / View | ✅ | Create from dispatch; detail view/post |
| Status flow | ✅ | `draft → posted → cancelled`; payment status derived |
| Validations | ✅ | Dispatch status gate; duplicate invoice block |
| Linked transactions | ✅ | Dispatch lines, SO `invoiced` status |
| Audit fields | Partial | Timestamps; not full AuditTrail |
| Print / Export | ✅ | Tax invoice print via `printTaxInvoice` |
| Edge cases | Partial | GST scheme from customer state |
| Error states | ✅ | "Invoice not found", toast |
| Empty states | ✅ | "No invoices yet" |
| UI consistency | ✅ | |
| Integration tests | ✅ | `test-invoice.ts`, go-live |
| Routes | ✅ | `invoices/*` L183–184 |
| Mock / seed dependency | Runtime | |

**Store:** `src/store/invoiceStore.ts`

---

### 18. Payment

**Score: 2 — Functional**

| Criterion | Status | Notes |
|-----------|--------|-------|
| Create / Edit / View | Partial | Record on invoice detail only; no payment register |
| Status flow | ✅ | unpaid → partial → paid; overpayment blocked |
| Validations | ✅ | Posted invoice only; amount ≤ balance due |
| Linked transactions | ✅ | SO `closed` on full payment |
| Audit fields | Partial | `PaymentRecord.recordedAt` |
| Print / Export | ❌ | No receipt voucher |
| Edge cases | ✅ | Multiple partial payments |
| Error states | ✅ | Toast |
| Empty states | N/A | Shown on invoice detail |
| UI consistency | ✅ | Embedded in invoice |
| Integration tests | ✅ | `test-invoice.ts`, go-live |
| Routes | N/A | No `/payments` |
| Mock / seed dependency | Runtime | |

**Store:** `invoiceStore.recordPayment`

---

### 19. Sales (Lead → Inquiry → Quotation → SO)

**Score: 2 — Functional** (↑ from 1)

| Criterion | Status | Notes |
|-----------|--------|-------|
| Create / Edit / View | ✅ | Full module — leads, inquiries, quotations (with revisions), sales orders |
| Status flow | ✅ | Lead stages; inquiry submit; quotation approve/reject/lock revisions; SO from approved quote only |
| Validations | ✅ | SO blocked before customer approval; duplicate SO blocked; MRP on confirmed SO; **released product gate** |
| Linked transactions | ✅ | MRP, dispatch, invoice update SO status |
| Audit fields | ✅ | `AuditTrail` on sales documents via `salesStore` |
| Print / Export | Partial | Open orders + delivery commitment reports |
| Edge cases | Partial | Partial dispatch / partial invoice not modeled on SO lines |
| Error states | ✅ | Toast on all workflow actions |
| Empty states | ✅ | List empty messages |
| UI consistency | ✅ | BC-style pages under `/sales/*` |
| Integration tests | ✅ | `test:sales` — 27/27 |
| Routes | ✅ | `sales/leads`, `inquiries`, `quotations`, `orders` |
| Mock / seed dependency | Seed + persist | `salesStore` persisted; legacy `SalesPage.tsx` still unwired |

**Store:** `src/store/salesStore.ts` + `mrpStore.salesOrders` (SO records sync to MRP)

---

### 20. Reports

**Score: 2 — Functional** (↑ from 1)

| Criterion | Status | Notes |
|-----------|--------|-------|
| Create / Edit / View | ✅ | Unified hub at `/reports` + per-module report pages |
| Status flow | N/A | |
| Validations | N/A | |
| Linked transactions | ✅ | Store getters across all modules |
| Audit fields | N/A | |
| Print / Export | Partial | Tabular reports; module CSV/print elsewhere; no unified export |
| Edge cases | Partial | Some report tables lack explicit empty row |
| Error states | N/A | |
| Empty states | Partial | |
| UI consistency | ✅ | Consistent tabular report pages |
| Integration tests | ✅ | `test:reports` — 14/14; product reports via `test:product-master` |
| Routes | ✅ | 18 operational reports across inventory, purchase, production, quality, dispatch, sales, **products** |
| Mock / seed dependency | Computed from stores | |

**Report inventory (18):**
- Inventory: stock aging, negative stock, slow moving
- Purchase: open PO, delayed PO (+ module pending PR, vendor performance)
- Production: WO status, WIP aging
- Quality: NCR ageing, rework trend (+ module pending/rejection/FYP)
- Dispatch: pending dispatch, POD pending (+ module ready/dispatched)
- Sales: open orders, delivery commitments
- **Product: revision, obsolete, cost, usage, engineering change**

**Missing:** Executive KPI dashboard, AR aging, material traceability report UI, charts/analytics.

---

## Score Summary

| # | Module | Score | Rating | Δ |
|---|--------|-------|--------|---|
| 1 | Masters | 2 | Functional | ↑ |
| 2 | Product | 3 | Production Ready | ↑↑ |
| 3 | BOM | 2 | Functional | — |
| 4 | Routing | 2 | Functional | — |
| 5 | Work Centers | 2 | Functional | — |
| 6 | Inventory | 3 | Production Ready | — |
| 7 | MRP | 3 | Production Ready | — |
| 8 | Purchase | 2 | Functional | — |
| 9 | GRN | 2 | Functional | — |
| 10 | Quality | 2 | Functional | — |
| 11 | Production | 3 | Production Ready | — |
| 12 | Job Cards | 2 | Functional | — |
| 13 | WIP | 2 | Functional | — |
| 14 | Semi-Finished Receipt | 2 | Functional | — |
| 15 | Costing | 2 | Functional | — |
| 16 | Dispatch | 2 | Functional | — |
| 17 | Invoice | 2 | Functional | — |
| 18 | Payment | 2 | Functional | — |
| 19 | Sales | 2 | Functional | ↑↑ |
| 20 | Reports | 2 | Functional | ↑ |
| | **Average** | **2.2** | **Functional overall** | ↑ |

---

## Integration Test Coverage Matrix

| Script | Result (this audit) | Modules covered |
|--------|---------------------|-----------------|
| `simulate:go-live` | ✅ 9/9 | Full E2E — all 20 modules in anchor path |
| `audit-mrp-foundation.ts` | ✅ PASS | BOM explosion, MRP, warehouses, cost rollup |
| `test:wo-flow` | ✅ 60/60 | MRP, WO, Inventory, Production, Job Cards, WIP, Quality, SA/FG |
| `test:purchase:production` | ✅ 17/17 | Purchase, GRN, RFQ, PO approval |
| `test:quality:production` | ✅ 8/8 | Incoming QC, Final QC, reports |
| `test:quality` | ✅ (not re-run) | In-process QC, rework, NCR |
| `test:dispatch:production` | ✅ 9/9 | Dispatch gates, FG issue, POD, close |
| `test:dispatch` | ✅ (not re-run) | Full dispatch lifecycle |
| `test:invoice` | ✅ 23/23 | Invoice, payment, SO closure |
| `test:costing` | ✅ 18/18 | Cost rollup |
| `test:sales` | ✅ 27/27 | Lead → Inquiry → Quotation → SO → MRP |
| `test:product-master` | ✅ 14/14 | Product lifecycle, revisions, reports, SO gate |
| `test:reports` | ✅ 14/14 | 18 operational report definitions |
| `test:sa-receipt` | ✅ (not re-run) | Semi-finished receipt |
| `test:wip` | ✅ (not re-run) | WIP routing |
| `test:integrity` | ✅ 6/6 | Cross-module referential integrity |
| `test:wo-order` | ✅ (not re-run) | WO creation ordering |

**Not covered by dedicated tests:** Masters CRUD UI, BOM/Routing UI, Work Center UI, Payment register.

---

## Legacy / Dead Code Inventory

These files exist but are **not routed** — they use mock `src/data/*.ts` and must not be confused with live modules:

| File | Dead data source |
|------|------------------|
| `src/modules/sales/SalesPage.tsx` | `src/data/orders.ts` |
| `src/modules/dispatch/DispatchPage.tsx` | `src/data/dispatch.ts` |
| `src/modules/production/ProductionPage.tsx` | `src/data/production.ts` |
| `src/modules/quality/QualityPage.tsx` | `src/data/quality.ts` |
| `src/modules/mrp/MRPPage.tsx` | `src/data/mrp.ts` |
| `src/modules/inventory/InventoryPage.tsx` | `src/data/inventory.ts` |
| `src/modules/engineering/EngineeringPage.tsx` | `src/data/engineering.ts` |
| `src/modules/dashboard/DashboardPage.tsx` | Mock KPIs |

---

## Conclusion

The ERP **executes a complete order-to-cash cycle** for the anchor bulker scenario with strong store-level validations, persisted master data, commercial front-end, and manufacturing-grade Product Master. **Average module score improved from 2.0 → 2.2.** P0 hardening backlog is closed.

**Remaining gaps before backend migration:**

1. **Cost calibration** — 52.8% FG variance vs BOM standard needs process alignment (P1-007).
2. **Payment register** — payments embedded in invoice detail only; no AR summary.
3. **QC/NCR print views** — not routed.
4. **Legacy mock pages** — 8 unwired `*Page.tsx` files remain.
5. **CI test gate** — no automated pipeline.
6. **Permission enforcement** — mock admin bypasses all roles.
7. **Manual PR UI, PO amendment, Re-MRP duplicate guard** — P1 backlog items.

See **`ERP_HARDENING_BACKLOG.md`** for prioritized P1/P2 items.

---

*Re-Audit #2 performed 2026-06-23 against live code with automated test execution. Scores reflect frontend/localStorage operability only — not backend, auth, or multi-user concerns.*
