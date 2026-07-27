# Phase B Audit — Purchase → GRN → Incoming QC → Inventory

**Date:** 2026-07-27
**Method:** Code-first audit (`backend/prisma/schema.prisma`, `backend/src/modules/{purchase,inventory,quality,accounting}`, `frontend/src/{modules,services,routes}`, `backend/tests`). `docs/PROJECT_STATUS.md` / `docs/REMAINING_WORK.md` were read but **not trusted** where they conflict with code (see Finding F0 below).
**Scope:** Audit only. No code was changed as part of this task.

---

## 0. Headline finding — docs are stale, the backend is real

`docs/PROJECT_STATUS.md` (last verified 2026-07-21) and `docs/REMAINING_WORK.md` classify **"Purchase backends beyond RFQ award→draft PO (full PO lifecycle, GRN); inventory / production / quality"** as **"Deferred by design"** / demo-only. The always-applied workspace rule `fos-erp-project.mdc` (§16) repeats this.

**Code shows otherwise for the Purchase→GRN→QC→Inventory slice specifically.** All of the following are real, transactional, tenant-scoped, permissioned, and tested:

- Full `PurchaseOrder` → `GoodsReceipt` (GRN) → `PurchaseQualityInspection` (incoming QC) → `InventoryStockMovement`/`InventoryStockBalance` chain, with GL-event hooks into Accounting.
- `PurchaseReturn` sourced from GRN or QC rejection, posting an inventory `ISSUE`.
- `PurchaseInvoice` → Vendor Invoice (AP) handoff with PO/GRN source links and 2-way/3-way tolerance matching.
- Frontend is **dual-mode** (`VITE_USE_API=true`) with live pages for GRN, QI, Purchase Return, and Inventory balances/ledger/receipts — not demo Zustand.

**Recommendation:** Treat `PROJECT_STATUS.md` / `REMAINING_WORK.md` / the `fos-erp-project.mdc` §16 "deferred by design" line as **out of date for Purchase/GRN/QC/Inventory-receipt** and update them once this audit is accepted (tracked as a Do-Not-Duplicate follow-up, not part of this audit). Production, Maintenance, and most of Finance-beyond-AP-handoff remain genuinely deferred/demo — this audit does not change that.

This does **not** mean Phase B is done — see the capability matrix and gaps below. It means B1–B10 should be scoped as **hardening/closing gaps in a real system**, not **building from zero**.

---

## 1. Executive summary — what's real vs. gap for Phase B DoD

### Real (VERIFIED in code, with tests)

| Capability | Evidence |
|---|---|
| PO lifecycle incl. receivable states (`SENT_TO_VENDOR`, `PARTIALLY_RECEIVED`, `FULLY_RECEIVED`) | `purchase-order.workflow.ts`, `goods-receipt-lifecycle.test.ts` |
| GRN create/update/submit/cancel/reverse/post-inventory with ordered/received/accepted/rejected/open qty fields per line | `goods-receipt.service.ts`, `schema.prisma` `GoodsReceiptLine` |
| Over-receipt tolerance % + duplicate-challan policy (BLOCK/WARN/ALLOW) enforced from Purchase Setup, not client input | `goods-receipt.service.ts::assertDuplicateChallanPolicy`, `buildLineCreates` |
| QC-gated vs non-QC GRN inward: QC-required lines post to `QC_HOLD` stock status; non-QC lines post straight to `UNRESTRICTED` and auto-advance to `INVENTORY_POSTED` | `goods-receipt.service.ts::submitGoodsReceipt` |
| Incoming QC (`PurchaseQualityInspection`) creation from a `QC_PENDING`/`SUBMITTED` GRN, accept/reject/partial/deviation outcomes, QC_HOLD→UNRESTRICTED/REJECTED status transfer | `quality-inspection.service.ts` |
| Single inventory posting authority (`InventoryPostingService` / `postStockMovement` / `transferStockStatus`) — GRN and QI both call it, never touch `InventoryStockBalance` directly | `stock-posting.service.ts`, `purchase-inventory-posting.ts` |
| Idempotent posting + compensating reversal (ISSUE) for GRN cancel/reverse and QC-hold cancel | `purchase-inventory-posting.ts` (`grn-in:`, `grn-rev:`, `grn-qc-cancel:` idempotency keys) |
| PO line qty rollup (`receivedQuantity`/`acceptedQuantity`/`rejectedQuantity`) + PO status derivation (`deriveReceiptStatus`) on every GRN submit/reverse | `goods-receipt.service.ts::applyPoReceiptDeltas` |
| Purchase Return sourced from GRN or QC rejection, posts inventory `ISSUE` | `purchase-return.service.ts`, `purchase-inventory-posting.ts::postPurchaseReturnStockIssue` |
| Purchase Invoice → Vendor Invoice (AP) draft handoff with PO+GRN `sourceLinks`, 2-/3-way qty/rate/amount tolerance matching | `purchase-invoice.service.ts`, `purchase-invoice-ap-handoff.service.ts` |
| Best-effort, flag-gated GL posting for every inventory movement type incl. `GRN_INWARD`/`GRN_REVERSAL`/`PURCHASE_RETURN` (never blocks quantity posting) | `inventory-accounting-event.service.ts` |
| Batch/lot/serial capture on GRN lines, propagated into `InventoryBatch`/`InventorySerial`/`InventoryLot` | `purchase-inventory-posting.ts`, `stock-posting.service.ts::resolveTrackingInTx` |
| RBAC: `purchase.grn.*`, `purchase.quality.*`, `purchase.return.*` permissions wired on every route | `permissions.ts`, `goods-receipt.routes.ts` |
| Frontend dual-mode: GRN/QI/Return pages call `@/services/purchase` (`purchaseApiFacade.ts`), real API when `VITE_USE_API=true` | `GrnDetailPage.tsx`, `purchaseApiFacade.ts` |
| Frontend Inventory dual-mode: stock balances/ledger/receipts/issues/returns/reservations under `/inventory/*` read the same `InventoryStockMovement`/`InventoryStockBalance` tables GRN writes to | `inventoryRoutes.tsx`, `ApiReceiptsPages.tsx` |
| Tests: GRN lifecycle (15 cases), QI lifecycle (4), Purchase Return lifecycle (4), inventory stock-status/QC-hold tracking, inventory accounting event derivation (unit) | `backend/tests/*` (listed §9) |

### Gaps (PARTIAL / MISSING against Phase B DoD)

| Gap | Detail |
|---|---|
| **No incoming-QC ↔ NCR linkage** | `QualityNcr.inspectionId` only FKs `ManufacturingQualityInspection` (production). A GRN QC rejection has **no path to open an NCR** against the vendor. `QualityNcr.supplierId` field exists but nothing populates it from Purchase. |
| **No GRN/QI-level integration test asserting `InventoryStockMovement`/`InventoryStockBalance` rows** | `goods-receipt-lifecycle.test.ts` and `purchase-qi-lifecycle.test.ts` assert **PO line/status** deltas only — none assert the created `InventoryStockMovement` (QC_HOLD then release/reject) or resulting `InventoryStockBalance` numerically. Posting code is exercised but not asserted end-to-end. |
| **No dedicated end-to-end "GRN → QI → Return/Invoice → GL" integration test** | Each leg (GRN, QI, Return, Invoice, inventory accounting) has isolated unit/lifecycle tests; no single test walks the full chain and checks final stock + GL state. |
| **GL posting is best-effort/silent on failure** | `recordInventoryAccountingEvent` swallows posting failures into `status: 'FAILED'` — correct for "never block quantity posting," but there is **no alerting/reconciliation report** surfaced in Purchase or Inventory UI to catch `FAILED`/`SKIPPED_*` GRN accounting events. `InventoryAccountingEventsPage` exists but is a generic list, not a GRN-scoped reconciliation view. |
| **Permission naming inconsistent with master-instruction vocabulary** | Master instruction expects `quality.incoming.*` / `inventory.purchase_receipt.*`. Actual code uses `purchase.quality.view/inspect` (incoming QC) and `purchase.grn.view/create/post` (receipt+post). A parallel, currently-unused `inventory.quality.*` and a distinct `inventory.receipts.*` (generic inward, not GRN) also exist — see §8 for full mapping and duplication risk. |
| **`PurchaseInvoiceStatus` includes `MATCHED`/`PARTIALLY_MATCHED`/`MISMATCH`** enum values that the service layer does not appear to set (`submitPurchaseInvoice` only sets `MATCHED` or leaves failures as `OVERRIDDEN`-style remarks) | Needs confirmation — enum/service drift risk for invoice matching UI. |
| **No formal GRNI (GR/IR) clearing account model** | Purchase Invoice → Vendor Invoice handoff carries PO/GRN `sourceLinks` for traceability, but there is no explicit "GR/IR clearing" ledger account concept distinct from the inventory GL event (`INV_GRN_INWARD`) and the eventual AP voucher — reconciliation between "goods received not invoiced" and "invoiced not received" is not modeled as a report. |
| **Warehouse/location master coverage not audited for QC-hold/rejected default locations completeness** | `PurchasePlantSettings` has `defaultQualityHoldLocationId`/`defaultRejectedLocationId`, and `completeQualityInspection` requires them **only if** `allowRejectedStockInQuarantine` is on — but stock status (`QC_HOLD`/`REJECTED`) is tracked at item/warehouse granularity, not location granularity, in `InventoryStockBalance`. The location fields appear to be **planning metadata only**, not enforced/consumed by the actual stock-status posting path. Needs confirmation before assuming location-level quarantine works. |
| **Purchase Setup `inspectionRequiredCategories`** used to auto-select GRN lines for QC (`linesFromGrn`) is category-code driven off `MasterItem.category.code` — no visible UI audit of whether Purchase Setup UI actually lets users manage this list end-to-end (not deep-audited here; flagged for B-phase verification). |

**Net: Phase B core plumbing (GRN receipt → QC hold → accept/reject → inventory posting → return/invoice) is implemented, wired, and partially tested. The main real gaps are (1) NCR linkage for incoming QC, (2) end-to-end inventory-state test coverage, and (3) reconciliation/observability surfaces for GL posting and GRNI.**

---

## 2. Stock ownership diagram — who posts what today

```
                         ┌─────────────────────────────┐
                         │   InventoryPostingService    │
                         │  (stock-posting.service.ts)  │
                         │  postStockMovement()         │
                         │  transferStockStatus()       │
                         └───────────────┬───────────────┘
                                         │  (sole writer of
                                         │   InventoryStockMovement,
                                         │   InventoryStockBalance,
                                         │   InventoryBatchBalance,
                                         │   InventorySerial*, InventoryLot*)
        ┌────────────────────────────────┼─────────────────────────────────┐
        │                                │                                 │
┌───────▼────────┐            ┌──────────▼──────────┐            ┌─────────▼─────────┐
│ Purchase / GRN  │            │ Purchase / Quality   │            │ Purchase / Returns │
│ goods-receipt.  │            │ Inspection            │            │ purchase-return.   │
│ service.ts      │            │ quality-inspection.  │            │ service.ts          │
│                 │            │ service.ts            │            │                     │
│ submit (QC req) │──INWARD───▶│ completeQualityInsp-  │            │ postPurchaseReturn  │
│  → QC_HOLD      │  QC_HOLD   │ ection()              │            │ StockIssue()        │
│                 │            │  → transferStatus     │──ISSUE────▶│  (UNRESTRICTED)     │
│ submit (no QC)  │──INWARD───▶│    QC_HOLD→UNRESTRICTED           │                     │
│  → UNRESTRICTED │            │    QC_HOLD→REJECTED   │            └─────────────────────┘
│                 │            │  (QUALITY_RELEASE /   │
│ postInventory() │──INWARD───▶│   QUALITY_REJECT)     │
│  (idempotent)   │            │                       │
│                 │            └───────────────────────┘
│ cancel/reverse  │──ISSUE────▶ (compensating, allowNegativeStock)
│  (compensating) │
└─────────────────┘

                 ┌───────────────────────────────────────┐
                 │  inventory-accounting-event.service.ts  │
                 │  tryRecordInventoryAccountingEvents     │
                 │  ForMovements() — best-effort, flag-    │
                 │  gated GL posting via posting.service   │
                 │  (INV_GRN_INWARD / INV_GRN_REVERSAL /   │
                 │   INV_PURCHASE_RETURN events)           │
                 └──────────────────────────────────────────┘
                       called AFTER every GRN/QI/Return
                       inventory-posting transaction commits;
                       never inside the same DB transaction,
                       never blocks it on failure.

Frontend reads (never writes) the same tables via:
  /inventory/stock, /inventory/movements (ledger), /inventory/movements/receipts
  (comment in ApiReceiptsPages.tsx: "PO goods receipts live under Purchase GRN" —
   confirms no duplicate receipt-posting surface).
```

**Key invariant confirmed in code:** Purchase/GRN, Purchase/QC, and Purchase/Returns **never** write to `InventoryStockBalance`/`InventoryStockMovement` directly — they always go through `postStockMovement` / `transferStockStatus` in `backend/src/modules/inventory/shared/stock-posting.service.ts`. This is the correct single-writer pattern and should be preserved by any Phase B work.

---

## 3. Capability matrix

| Capability | Status | Notes |
|---|---|---|
| PO receivable-state gating for GRN creation | ✅ VERIFIED | `PO_RECEIVABLE_STATUSES = [SENT_TO_VENDOR, PARTIALLY_RECEIVED]` |
| GRN header (challan/vehicle/gate/transporter/LR capture) | ✅ VERIFIED | Enforced via Purchase Setup toggles |
| GRN line qty fields (ordered/previouslyReceived/open/challan/received/damaged/short/excess/acceptedForQc/accepted/rejected) | ✅ VERIFIED | `GoodsReceiptLine` model, `buildLineCreates` |
| Over-receipt tolerance (Setup-authoritative, ignores client flag) | ✅ VERIFIED | `settings.allowOverReceipt` / `overReceiptTolerancePct` |
| Duplicate vendor-challan policy | ✅ VERIFIED (BLOCK/WARN both currently block — WARN soft-UX not built) | `assertDuplicateChallanPolicy` |
| GRN lifecycle: DRAFT→SUBMITTED/QC_PENDING→(PARTIALLY/FULLY)_ACCEPTED→INVENTORY_POSTED, CANCELLED, REVERSED, CLOSED | ✅ VERIFIED | `GoodsReceiptStatus` enum + `goods-receipt.workflow.ts` |
| GRN inventory posting (QC_HOLD when inspection required, else UNRESTRICTED) | ✅ VERIFIED | `postGrnStockInward` |
| GRN reversal (compensating ISSUE, restores PO qty) | ✅ VERIFIED | `reverseGrnStockInward`, `reverseGoodsReceipt` |
| GRN cancel before inventory post (QC_HOLD compensation only) | ✅ VERIFIED | `reverseGrnQcHold`, `cancelGoodsReceipt` |
| Incoming QC creation from GRN | ✅ VERIFIED | `createQualityInspection` (auto-populates lines from `qcRequired` GRN lines or category rules) |
| Incoming QC accept/reject/partial/deviation | ✅ VERIFIED | `completeQualityInspection` |
| QC deviation approval gate (role-based, Setup-driven) | ✅ VERIFIED (gate exists) | ⚠️ PARTIAL — no dedicated approval action/endpoint found beyond status transition to `DEVIATION_PENDING`; unclear who/how approves out of deviation (not deep-audited) |
| QC → inventory status transfer (QC_HOLD→UNRESTRICTED / QC_HOLD→REJECTED) | ✅ VERIFIED | Uses `InventoryPostingService.transferStatus`, referenceType `QUALITY_RELEASE`/`QUALITY_REJECT` |
| QC → NCR linkage for incoming/vendor rejections | ❌ MISSING | `QualityNcr.inspectionId` only links `ManufacturingQualityInspection` |
| Purchase Return from GRN / from QC rejection / from reason | ✅ VERIFIED (service level) | `purchase-return.service.ts::resolveReturnRefs` cross-validates GRN↔QI consistency |
| Purchase Return inventory posting (ISSUE) | ✅ VERIFIED | `postPurchaseReturnStockIssue` |
| Purchase Invoice ← PO / ← GRN, 2-/3-way match tolerance (qty/rate/amount) | ✅ VERIFIED | `purchase-invoice.service.ts` tolerance checks |
| Purchase Invoice → Vendor Invoice (AP) draft handoff w/ source links | ✅ VERIFIED | `purchase-invoice-ap-handoff.service.ts` |
| GRNI / GR-IR clearing reconciliation report | ❌ MISSING | No dedicated report; only source-link metadata on Vendor Invoice |
| Inventory posting single-writer pattern (no direct balance writes from Purchase) | ✅ VERIFIED | See §2 |
| Inventory accounting GL event hooks (flag-gated, best-effort) | ✅ VERIFIED | `INV_GRN_INWARD`, `INV_GRN_REVERSAL`, `INV_PURCHASE_RETURN` |
| Batch / Lot / Serial capture on GRN → Inventory | ✅ VERIFIED | `InventoryBatch`, `InventorySerial`, `InventoryLot`, `InventoryLotMovement` |
| Item QC flags (`qcRequired`, `qualityTestGroupCode`) driving GRN default | ✅ VERIFIED | `MasterItem.qcRequired` |
| Item batch/serial tracking flags enforced at posting time | ✅ VERIFIED | `stock-posting.service.ts::validateItemAndWarehouse` / `resolveTrackingInTx` |
| Warehouse-level QC-hold / rejected default **locations** actually enforced at stock-status granularity | ⚠️ PARTIAL / UNCONFIRMED | `InventoryStockBalance` tracks qty by (item, warehouse) + status columns, not by location; `PurchasePlantSettings` location defaults look like metadata only |
| RBAC: `purchase.grn.*` / `purchase.quality.*` / `purchase.return.*` | ✅ VERIFIED | All GRN/QI/Return routes gated |
| RBAC naming matches master-instruction (`quality.incoming.*`, `inventory.purchase_receipt.*`) | ❌ MISMATCH (naming only, not a functional gap) | See §8 |
| Frontend GRN/QI/Return dual-mode (demo vs API) | ✅ VERIFIED | `purchaseApiFacade.ts` |
| Frontend Inventory dual-mode (balances/ledger/receipts) | ✅ VERIFIED | `inventoryRoutes.tsx`, `ApiReceiptsPages.tsx` |
| `/quality/incoming` dedicated FE surface | ⚠️ PARTIAL | Generic Quality workspace exposes `/quality/workspace/incoming` and `/quality/incoming/queue` (backend `workspace.controller.ts`) — this reads production+incoming summary data; **Purchase's own QC pages** (`QualityInspectionListPage`/`DetailPage`/`CreatePage`) are the actual incoming-QC CRUD surface, under `/purchase/...`, not `/quality/incoming` |
| Tests: GRN lifecycle | ✅ 15 cases | `goods-receipt-lifecycle.test.ts` |
| Tests: QI lifecycle | ⚠️ 4 cases (thin) | `purchase-qi-lifecycle.test.ts` — no partial/deviation/reject coverage |
| Tests: Purchase Return lifecycle | ⚠️ 4 cases (thin) | `purchase-return-lifecycle.test.ts` — no from-QI-rejection coverage |
| Tests: Inventory stock-status/QC-hold | ✅ VERIFIED (unit-ish) | `inventory-stock-status-tracking.test.ts` |
| Tests: Inventory accounting event derivation | ✅ VERIFIED (unit) | `inventory-accounting-events.test.ts` — builder logic only, not integration |
| Tests: End-to-end GRN→QC→Inventory balance assertions | ❌ MISSING | No test reads `InventoryStockBalance`/`InventoryStockMovement` after a GRN/QI flow |

---

## 4. Detailed capability sections (master instruction B0 format)

### 4.1 Purchase Order → GRN receipt

- **Current model:** `PurchaseOrder` / `PurchaseOrderLine` (`backend/prisma/schema.prisma:5311`, `:5374`) carry `quantity`, `receivedQuantity`, `acceptedQuantity`, `rejectedQuantity`, `returnedQuantity`, `invoicedQuantity` per line. `GoodsReceipt` / `GoodsReceiptLine` (`:5429`, `:5487`) carry the full ordered/previouslyReceived/open/challan/received/damaged/short/excess/acceptedForQc/accepted/rejected quantity set plus batch/lot/heat/serial/mfg/expiry and bin/location.
- **Current API:** `backend/src/modules/purchase/grn/*` — `GET/POST /purchase/:tenantSlug/grns`, `GET /:id`, `PATCH /:id`, `POST /:id/submit`, `/:id/cancel`, `/:id/reverse`, `/:id/post-inventory`, plus `GET /purchase/:tenantSlug/orders/:id/receivable-lines`.
- **Current UI:** `frontend/src/modules/purchase/{GrnListPage,GrnDetailPage,GrnEditorPage,GrnDomainPages,GrnPages}.tsx`, dual-mode via `services/purchase/goodsReceiptApi.ts` + `purchaseApiFacade.ts`.
- **Posting owner:** `goods-receipt.service.ts` calls `purchase-inventory-posting.ts` → `InventoryPostingService` (`stock-posting.service.ts`). GRN service never writes `InventoryStockBalance` directly.
- **Lifecycle:** `DRAFT → SUBMITTED | QC_PENDING → (PARTIALLY_ACCEPTED | FULLY_ACCEPTED) → INVENTORY_POSTED`, plus `CANCELLED`, `REVERSED`, `CLOSED`. Non-QC lines auto-chain `submit → postInventoryGoodsReceipt` in the same call (`submitGoodsReceipt` tail call).
- **Gap:** No test asserts the resulting `InventoryStockMovement`/`InventoryStockBalance` values; `CLOSED` status has no service transition found (enum value present, no code path sets it — confirm before building on it).
- **Required change (Phase B candidate):** Add integration tests asserting inventory movement/balance after GRN submit+post; confirm/implement `CLOSED` transition if needed by B-phase UX.
- **Risk:** Low — core path is solid; risk is regressions going untested at the inventory-state level.
- **Tests:** `goods-receipt-lifecycle.test.ts` (15 cases: create, over-receipt block/allow, tolerance, policy fields, cancelled-PO block, partial/full receive → PO status, reverse, edit-lock, permission denial, tenant isolation, audit log, MySQL persistence).

### 4.2 Incoming Quality Inspection (QC)

- **Current model:** `PurchaseQualityInspection` / `PurchaseQualityInspectionLine` (`schema.prisma:5860`) — **distinct from** `ManufacturingQualityInspection` (`:12214`, production QC) and `QualityInspectionPlan*` (generic Quality module inspection plans). `QualityInspectionStatus` enum: `DRAFT, PENDING, IN_PROGRESS, ACCEPTED, PARTIALLY_ACCEPTED, REJECTED, DEVIATION_PENDING, CLOSED, CANCELLED`.
- **Current API:** `backend/src/modules/purchase/quality-inspections/*` under `/purchase/:tenantSlug/quality-inspections`.
- **Current UI:** `frontend/src/modules/purchase/{QualityInspectionListPage,QualityInspectionDetailPage,QualityInspectionCreatePage}.tsx`.
- **Posting owner:** `quality-inspection.service.ts::completeQualityInspection` — updates GRN line accepted/rejected qty, sets GRN → `INVENTORY_POSTED`, then (best-effort, outside the main transaction, wrapped in try/catch that only logs) calls `postGrnStockInward` (QC_HOLD inward if not already posted) and `InventoryPostingService.transferStatus` (`QC_HOLD→UNRESTRICTED` / `QC_HOLD→REJECTED`).
- **Lifecycle:** `DRAFT → IN_PROGRESS → (ACCEPTED | PARTIALLY_ACCEPTED | REJECTED | DEVIATION_PENDING) → CLOSED`; `CANCELLED` from editable states.
- **Gap:** Deviation approval flow stops at `DEVIATION_PENDING` — no found endpoint to formally approve/deny a deviation and resume `completeQualityInspection`; QC→NCR linkage missing (see §1); inventory posting failure is silently logged (`logger.warn`) with **no compensating status** on the QI/GRN — i.e., a GL/inventory posting failure after QC completion could leave GRN marked `INVENTORY_POSTED` without a corresponding movement. This needs verification/hardening.
- **Required change:** (a) confirm/build deviation-approval action; (b) decide and implement failure-handling contract when post-QC inventory posting throws (retry queue? surfaced error state on GRN?); (c) NCR auto-creation option on reject.
- **Risk:** Medium — the try/catch-and-log pattern around `postGrnStockInward`/`transferStatus` in `completeQualityInspection` (lines ~302–383) means a QC "complete" can succeed while its stock movement silently fails, with only a log line as evidence.
- **Tests:** `purchase-qi-lifecycle.test.ts` (4 cases: create from QC_PENDING GRN, complete with ACCEPT, permission denial, tenant isolation). No REJECT/PARTIALLY_ACCEPTED/DEVIATION_PENDING test coverage found.

### 4.3 Inventory posting / balances

- **Current model:** `InventoryStockBalance` (item+warehouse, `onHandQty/reservedQty/qcHoldQty/blockedQty/rejectedQty/avgRate/stockValue`), `InventoryStockMovement` (signed qty, `movementType` OPENING/INWARD/ISSUE/ADJUSTMENT, `referenceType` incl. `GRN`, `QUALITY_RELEASE`, `QUALITY_HOLD`, `QUALITY_REJECT`, `stockStatus`/`fromStockStatus`), `InventoryBatchBalance`, `InventorySerial`/`InventorySerialMovement`, `InventoryLot`/`InventoryLotMovement`, `InventoryStockReservation`.
- **Current API:** `backend/src/modules/inventory/{balances,movements,ledger,reservations}/*`.
- **Current UI:** `/inventory/stock`, `/inventory/movements` (ledger), `/inventory/movements/receipts|issues|returns`, `/inventory/reservations` — all dual-mode, API pages read the same tables GRN/QI write.
- **Posting owner:** `backend/src/modules/inventory/shared/stock-posting.service.ts` exclusively (`postStockMovement`, `transferStockStatus`) — confirmed as sole writer; Purchase/GRN/QI/Return only call into it.
- **Lifecycle:** Movement is append-only + balance upsert in the same transaction; idempotency via `idempotencyKey` unique constraint; negative-stock guard (`allowNegativeStock` override used only for compensating reversals).
- **Gap:** None found in the core posting engine itself — this is the strongest-audited part of the stack. Only gap is **test coverage from the Purchase side** (§4.1/4.2) confirming Purchase actually reaches expected balances end-to-end.
- **Required change:** None to the engine. Add Purchase-side integration assertions (see §5 sequencing).
- **Risk:** Low.
- **Tests:** `inventory-stock-status-tracking.test.ts` (QC hold isolation, status transfer, batch position snapshots), `inventory-phase3a.test.ts`, `inventory-moving-average.test.ts`, `inventory-masters.test.ts`, `inventory-document-workflows.test.ts`.

### 4.4 Quality module (generic) vs Purchase incoming QC

- **Current model:** Generic `backend/src/modules/quality/*` (NCR, inspection plans, parameters, certificates, kiosk) is **production/manufacturing-oriented**: `ManufacturingQualityInspection`, `QualityNcr.productionOrderId`/`inspectionId → ManufacturingQualityInspection`, `QualityInspectionPlan*`.
- **Current API:** `/quality/*` (`quality.routes.ts`) — `workspace/incoming` and `incoming/queue` endpoints exist (`workspace.controller.ts::incoming`) but summarize/aggregate; they are not the incoming-QC CRUD system.
- **Current UI:** `frontend/src/modules/quality/*` — `QualityPage`, `ApiQcQueuePage`, `ApiQcInspectionDetailPage`, `ApiNcrPages`, etc. — again production-oriented.
- **Gap:** The master instruction's framing of `/quality/incoming` as *the* incoming-GRN-QC surface does not match code: incoming/vendor QC actually lives entirely under **Purchase** (`purchase/quality-inspections`), and the `/quality` app's "incoming" endpoints are a read-side workspace queue, not the transactional home. This is a **naming/expectation mismatch to resolve explicitly before B-phase work**, not a missing feature — do not build a second incoming-QC CRUD under `/quality`.
- **Required change:** Decide (product decision, not code) whether `/quality/workspace/incoming` should surface `PurchaseQualityInspection` rows (it currently doesn't appear to — needs confirmation) or remain manufacturing-only.
- **Risk:** Medium — risk of accidentally building a duplicate incoming-QC system under `/quality` if this isn't clarified first.

### 4.5 Purchase Return

- **Current model:** `PurchaseReturn`/`PurchaseReturnLine` (`schema.prisma:6005`), links to `purchaseOrderId`, `goodsReceiptId`, `qualityInspectionId` (nullable, cross-validated for consistency).
- **Current API:** `backend/src/modules/purchase/returns/*`.
- **Current UI:** `PurchaseReturnListPage`, `PurchaseReturnDetailPage`, `PurchaseReturnEditorPage`, `PurchaseReturnPrintPage`.
- **Posting owner:** `purchase-return.service.ts` → `postPurchaseReturnStockIssue` → `InventoryPostingService`.
- **Lifecycle:** `DRAFT → SUBMITTED → APPROVED → SHIPPED → COMPLETED`, `CANCELLED`, `CLOSED`.
- **Gap:** Test coverage thin (4 cases, no from-QI-rejection path tested); debit-note-from-return and replacement-PO-from-return exist in the frontend facade (`createDebitNoteFromReturn`, `createReplacementPoFromReturn`) — backend equivalents not verified in this pass.
- **Required change:** Add QI-rejection-sourced return test; confirm backend support for debit-note/replacement-PO facade calls (verify not frontend-only stubs).
- **Risk:** Medium — unverified whether `createDebitNoteFromReturn`/`createReplacementPoFromReturn` are real API calls or demo-only; flag for B-phase confirmation.
- **Tests:** `purchase-return-lifecycle.test.ts` (draft create, submit+complete, permission denial, tenant isolation).

### 4.6 Accounting / AP readiness

- **Current model:** `PurchaseInvoice`/`PurchaseInvoiceLine` (`schema.prisma:5920`) — soft-linked (no FK) to Accounting `VendorInvoice` via `vendorInvoiceId`/`vendorInvoiceDraftRef`. `matchingStatus` free-text-ish field (not the same as `PurchaseInvoiceStatus` enum values `MATCHED`/`PARTIALLY_MATCHED`/`MISMATCH`, which appear unused by current service code — enum/usage drift, needs confirmation).
- **Current API:** `backend/src/modules/purchase/invoices/*`; AP handoff via `purchase-invoice-ap-handoff.service.ts` → `accounting/payables/vendor-invoices/vendor-invoice-draft.service.ts`.
- **Current UI:** `PurchaseInvoiceListPage`, `PurchaseInvoiceDetailPage`, `PurchaseInvoiceEditorPage`, `PurchaseInvoicePrintPage`.
- **Posting owner:** Purchase Invoice itself does **not** post GL — it creates a Vendor Invoice **draft** in Accounting/Payables (Accounting remains source of truth for AP GL, per code comment `"Accounting remains SoT"`). Inventory GL event (`INV_GRN_INWARD`) is a **separate** posting path from the AP voucher — no unified GR/IR clearing account model tying the two together was found.
- **Lifecycle:** `DRAFT → PENDING_APPROVAL → APPROVED → POSTED`, `REJECTED`, `CANCELLED`, `CLOSED`; tolerance check on `submitPurchaseInvoice` (qty/rate/amount % + absolute amount tolerance) with `OVERRIDDEN` fallback path requiring explicit override.
- **Gap:** No GR/IR (GRNI) reconciliation report; `MATCHED`/`PARTIALLY_MATCHED`/`MISMATCH` enum values vs. actual `matchingStatus` string usage should be reconciled.
- **Required change:** If Phase B DoD requires GRNI reconciliation reporting, this needs new work (report + possibly a real matching-status enum wire-up) — not just a gap-fill.
- **Risk:** Medium — financial reconciliation gap, but does not block quantity-side Phase B DoD.
- **Tests:** `purchase-invoice-lifecycle.test.ts`, `purchase-invoice-lifecycle-live.test.ts`, `finance/finance-ap-vendor-invoice-master-reuse.test.ts`.

### 4.7 Masters

- **Item:** `MasterItem.qcRequired` (bool), `qualityTestGroupCode`, `batchTracked`, `serialTracked`, `quantityPerUom`, `purchaseUomId` all exist and are consumed by GRN line building (`qcRequired` default) and stock posting (`validateItemAndWarehouse`/`resolveTrackingInTx` enforce batch/serial requirement at posting time, auto-create `InventoryBatch`/`InventorySerial` on first inward if not pre-existing).
- **Warehouse:** `MasterWarehouse`, `MasterLocation`, `MasterBin` — GRN lines resolve warehouse→storageLocation→bin with active-status checks (`assertWarehouseActive`, `resolveStorageLocation`, `resolveBin`). `PurchasePlantSettings` carries plant-level default warehouse/receiving/QC-hold/rejected/vendor-return **location** IDs, but (per §1/§3) these look like planning metadata not enforced at the stock-status-balance level (balances are item+warehouse+status, not +location). **Confirm before assuming location-level quarantine is functional.**
- **Gap:** None blocking; the location-granularity question above is the only open item.

---

## 5. Recommended B1–B10 sequencing against current gaps

This assumes the master instruction's B1–B10 breakdown roughly follows: B1 GRN model/lifecycle, B2 GRN inventory posting, B3 incoming QC, B4 QC-inventory integration, B5 purchase return, B6 AP/invoice matching, B7 NCR/vendor quality, B8 reporting/reconciliation, B9 permissions/RBAC cleanup, B10 UI polish/tests. Mapped against what exists:

| Phase | Status | What's already done | What's still needed |
|---|---|---|---|
| **B1** GRN model + lifecycle | **Done** | Full model, full lifecycle, 15 tests | Confirm/implement `CLOSED` transition if in scope |
| **B2** GRN → Inventory posting | **Done** | `postGrnStockInward`/reverse/QC-hold-cancel, idempotent | Add integration tests asserting `InventoryStockMovement`/`InventoryStockBalance` values |
| **B3** Incoming QC (create/accept/reject) | **Done** | Full CRUD + lifecycle | Add REJECT/PARTIALLY_ACCEPTED/DEVIATION_PENDING tests; confirm deviation-approval endpoint |
| **B4** QC ↔ Inventory integration (QC_HOLD → release/reject) | **Done**, hardening needed | `transferStatus` wired | Fix silent-failure contract in `completeQualityInspection` (currently log-and-swallow with no compensating GRN/QI state) |
| **B5** Purchase Return (from GRN/QC) | **Done**, thin tests | Full model + posting | More lifecycle tests incl. QI-rejection path; confirm debit-note/replacement-PO backend reality |
| **B6** AP / Invoice matching | **Mostly done** | PO/GRN handoff, tolerance check | Reconcile `PurchaseInvoiceStatus.MATCHED/PARTIALLY_MATCHED/MISMATCH` enum vs actual usage; decide GRNI reconciliation scope |
| **B7** NCR / vendor quality linkage | **Not started** | NCR model exists (production-only) | New: link `QualityNcr` (or a purchase-scoped variant) to `PurchaseQualityInspection`/`GoodsReceipt`/vendor; UI trigger from QC reject |
| **B8** Reporting / reconciliation (GRNI, accounting event health) | **Not started** | `InventoryAccountingEventsPage` generic list exists | New: GRN-scoped accounting-event reconciliation view; GRNI aging report |
| **B9** Permissions/RBAC cleanup | **Partial** | `purchase.grn.*`/`purchase.quality.*`/`purchase.return.*` all wired | Resolve naming mismatch vs. master-instruction vocabulary (decide: rename, alias, or accept current names); confirm unused `inventory.quality.*` is intentionally dormant or should be removed |
| **B10** UI polish / end-to-end tests | **Partial** | Rich dual-mode UI already shipped for GRN/QI/Return/Inventory | End-to-end (GRN→QI→Inventory→Return/Invoice→GL) integration test; `/quality` vs Purchase-QC surface clarification (§4.4) |

**Sequencing recommendation:** Do **B2/B3/B4 test-hardening first** (cheap, de-risks the "is it actually posting correctly" question before building on top), then **B7 NCR linkage** (net-new, most valuable missing capability), then **B8 reconciliation reporting**, then **B9 naming cleanup** (low risk, but touches routes/tests — do it once, deliberately), then **B10 end-to-end test + UI/product decision on `/quality` vs Purchase-QC**.

---

## 6. "Do not duplicate" — existing services/models to reuse

**Backend services (call these, never re-implement):**
- `backend/src/modules/inventory/shared/stock-posting.service.ts` — `postStockMovement`, `transferStockStatus`, exported as `InventoryPostingService`. **The only place that may write `InventoryStockMovement`/`InventoryStockBalance`/`InventoryBatchBalance`/`InventorySerial*`/`InventoryLot*`.**
- `backend/src/modules/purchase/shared/purchase-inventory-posting.ts` — `postGrnStockInward`, `reverseGrnStockInward`, `reverseGrnQcHold`, `postPurchaseReturnStockIssue`. The Purchase-side adapter over `InventoryPostingService`; extend here, don't bypass it.
- `backend/src/modules/inventory/accounting/inventory-accounting-event.service.ts` — `tryRecordInventoryAccountingEventsForMovements`. Call after any new inventory-posting flow that should have a GL shadow; it is already flag-gated and safe to call unconditionally.
- `backend/src/modules/purchase/shared/purchase-defaults.ts` — `resolveEffectivePurchaseDefaults` (Setup cascade: tenant → plant). Use for any new Setup-driven policy, don't re-read `PurchaseSettings`/`PurchasePlantSettings` directly.
- `backend/src/modules/purchase/shared/purchase-document-number.ts` — `nextPurchaseDocumentNumber`/`previewPurchaseDocumentNumber`. Use for any new Purchase document type's numbering.
- `backend/src/modules/purchase/shared/purchase-audit.ts` — `writePurchaseAudit`. Use for any new Purchase action's audit trail (separate from per-document `*StatusHistory` tables, which already exist for GRN/PO/etc. via `repo.createStatusHistory`).
- `backend/src/modules/purchase/invoices/purchase-invoice-ap-handoff.service.ts` — the PO/GRN → Vendor Invoice draft pattern; reuse `sourceLinks` shape for any new Accounting handoff.

**Backend models (extend, don't fork):**
- `GoodsReceipt` / `GoodsReceiptLine`, `PurchaseQualityInspection` / `PurchaseQualityInspectionLine`, `PurchaseReturn` / `PurchaseReturnLine`, `PurchaseInvoice` / `PurchaseInvoiceLine` — all already carry the cross-links (`goodsReceiptId`, `qualityInspectionId`, `purchaseOrderLineId`, `goodsReceiptLineId`) needed to thread a document chain. Any B7 NCR-linkage work should add a nullable FK/soft-link on `QualityNcr` (e.g. `purchaseQualityInspectionId`, `goodsReceiptId`, `vendorId`) rather than creating a parallel "PurchaseNcr" model.
- `InventoryStockBalance`, `InventoryStockMovement`, `InventoryStockReservation`, `InventoryBatch(Balance)`, `InventorySerial(Movement)`, `InventoryLot(Movement)` — complete stock-truth schema; no new inventory-balance table should be created for Purchase-specific views (build read-side projections/reports instead).
- `InventoryAccountingEvent` (implied by `inventory-accounting-event.service.ts`) — reuse for any new GRNI reconciliation report rather than adding a new ledger-shadow table.

**Frontend:**
- `frontend/src/services/purchase/purchaseApiFacade.ts` + `frontend/src/services/purchase/index.ts` — the dual-mode facade; add new GRN/QI/Return/Invoice functions here, keep the `isApiMode()` branch pattern.
- `frontend/src/services/inventory/inventoryApiFacade.ts` — same pattern for Inventory; note the explicit code comment that PO-driven receipts are **out of scope** for `/inventory/movements/receipts` (that page is for manual inward only) — any Phase B UI work for GRN-driven receipts belongs under Purchase, not Inventory.
- `PurchaseCardFormShell`, `ErpCommandBar`, `PurchaseDocumentFactBox` and the wider `.cursor/rules/purchase-ui.mdc` conventions — reuse for any new Purchase Phase B screens (e.g. an NCR-from-QC trigger UI).

---

## 7. Permissions — existing vs. master-instruction naming

| Master-instruction suggested | Actual code permission(s) | Where used | Notes |
|---|---|---|---|
| `purchase.grn.*` | `purchase.grn.view`, `purchase.grn.create`, `purchase.grn.post` | `goods-receipt.routes.ts`, `purchase.routes.ts` (receivable-lines) | Matches. `create` covers create+update+submit+cancel; `post` covers reverse+post-inventory. |
| `quality.incoming.*` | **Does not exist under this name.** Actual: `purchase.quality.view`, `purchase.quality.inspect` | `quality-inspection.routes.ts` (not shown above but implied by pattern; confirm exact file) | Incoming/vendor QC lives entirely under the `purchase.quality.*` namespace, not `quality.*` (which is the separate, production-oriented Quality module using `quality.view/create/edit/submit/approve/...`). |
| `inventory.purchase_receipt.*` | **Does not exist.** Closest are `inventory.receipts.*` (generic manual inward, unrelated to GRN) and `purchase.grn.*` (actual GRN receipt permission) | `movement.routes.ts` (`inventory.receipts.*`), `goods-receipt.routes.ts` (`purchase.grn.*`) | GRN receipt posting is gated by `purchase.grn.post`, **not** any `inventory.*` permission — this is correct given GRN is a Purchase document, but differs from the master instruction's naming assumption. |
| — | `inventory.quality.view`, `inventory.quality.inspect`, `inventory.quality.release`, `inventory.quality.accept_deviation` | Defined in `permissions.ts` (line ~535) | **Appears unused/dormant** — not found wired to any route in this audit pass. Candidate for removal or for B9 to consciously decide whether Inventory-side QC actions (as opposed to Purchase-side) should use these instead of duplicating `purchase.quality.*`. Confirm with a full route grep before deleting. |
| `purchase.return.*` | `purchase.return.view/create/edit/submit/complete/cancel/post` | `purchase-return.routes.ts` (implied) | Matches, more granular than master instruction's `*`. |

**Recommendation for B9:** Do not rename existing permissions (would require role/seed-data migration and re-grant). Instead, document the actual naming as canonical (this table) and either (a) delete the dormant `inventory.quality.*` permissions if truly unused, or (b) repurpose them intentionally for an Inventory-side QC view surface if B7/B8 work introduces one.

---

## 8. Tests — what exists and what it covers

| Test file | Covers | Gaps in this file |
|---|---|---|
| `backend/tests/goods-receipt-lifecycle.test.ts` (15 cases) | Receivable-lines list, draft create, over-receipt block/allow + tolerance, Setup policy field enforcement (challan/vehicle/gate), cancelled-PO block, partial/full receive → PO status rollup, reverse (restores PO qty), edit-lock post-submit, permission denial, tenant isolation, audit log, MySQL persistence | No assertion on `InventoryStockMovement`/`InventoryStockBalance`; no QC-required-path test (all tests appear to use `inspectionRequired: false` flow based on direct SUBMITTED assertions) |
| `backend/tests/purchase-qi-lifecycle.test.ts` (4 cases) | Create QI from QC_PENDING GRN, complete with ACCEPT outcome, permission denial, tenant isolation | No REJECT, PARTIALLY_ACCEPTED, DEVIATION_PENDING, or inventory-state assertions |
| `backend/tests/purchase-return-lifecycle.test.ts` (4 cases) | Draft create, submit+complete, permission denial, tenant isolation | No GRN-sourced or QI-rejection-sourced return test; no inventory ISSUE assertion |
| `backend/tests/purchase-invoice-lifecycle.test.ts` / `-live.test.ts` | Invoice lifecycle (not deep-audited this pass) | Not deep-audited; flagged for B6 |
| `backend/tests/purchase-order-lifecycle.test.ts` | PO lifecycle incl. approve/send-to-vendor (used as GRN test fixture dependency) | — |
| `backend/tests/purchase-module-coverage.test.ts` | Broad module smoke coverage (not deep-audited) | — |
| `backend/tests/inventory-stock-status-tracking.test.ts` | QC hold isolation from free qty, status transfer (QC_HOLD→other) without on-hand change, tenant-scoped batch position + movement snapshot creation | Not GRN-triggered — uses direct `postStockMovement`/`transferStockStatus` calls, i.e. tests the engine, not the Purchase integration |
| `backend/tests/inventory-accounting-events.test.ts` | Event-type derivation (`GRN`→`GRN_INWARD`/`GRN_REVERSAL`), posting-request builder (balanced Dr/Cr voucher shape), query schema validation | Unit-level only — no test posts a real GRN and checks the resulting `InventoryAccountingEvent` row/status |
| `backend/tests/inventory-phase3a.test.ts`, `inventory-moving-average.test.ts`, `inventory-masters.test.ts`, `inventory-document-workflows.test.ts`, `inventory-store-workbench.test.ts` | Core inventory engine (not deep-audited this pass, listed for completeness) | — |
| `backend/tests/quality-phase4a.test.ts`, `quality-phase4b.test.ts`, `quality-phase7b.test.ts` | Generic Quality module (production-oriented; not deep-audited) | Confirm none of these accidentally cover incoming/GRN QC (unlikely given model separation in §4.4) |
| `backend/tests/finance/finance-ap-vendor-invoice-master-reuse.test.ts` | Vendor Invoice master-data reuse (AP side) | Not deep-audited for PO/GRN source-link assertions specifically |

**No test file found** that: (a) drives a full GRN with `inspectionRequired: true` through submit → QC_PENDING → QI accept/reject → asserts final `InventoryStockBalance` by status column, or (b) asserts a `PurchaseReturn` sourced from a rejected QI posts the correct ISSUE movement, or (c) asserts an `InventoryAccountingEvent` row is created/posted end-to-end from a real GRN submit (only the derivation/builder units are tested).

---

## 9. Risks / dependency blockers

1. **Silent posting-failure risk in `completeQualityInspection`** (§4.2) — a QC "complete" action can succeed and change GRN/QI status while the actual inventory status-transfer silently fails (caught, logged, swallowed). Any Phase B work that assumes "QI ACCEPTED ⇒ stock is UNRESTRICTED" must first close this gap or add reconciliation tooling.
2. **Doc/rule staleness** (§0) — `PROJECT_STATUS.md`, `REMAINING_WORK.md`, and `.cursor/rules/fos-erp-project.mdc` §16 all currently tell agents/humans that this area is "deferred by design, demo-only." Anyone starting Phase B work without reading code first (contrary to this codebase's own rule §1/§6) will likely duplicate existing GRN/QI/Return/Inventory work. **This audit exists specifically to prevent that.**
3. **`/quality` vs Purchase-QC surface ambiguity** (§4.4) — building new incoming-QC UI/API under the generic `/quality` app risks duplicating `purchase/quality-inspections`. Needs an explicit product decision before B3/B7/B10 UI work starts.
4. **Location-granularity of QC-hold/rejected stock unconfirmed** (§4.7) — if Phase B DoD requires "rejected stock physically quarantined in a specific bin/location," current `InventoryStockBalance` (item+warehouse+status only, no location dimension) may not support it without a schema change. Needs explicit confirmation with a domain owner before committing to a B-phase deliverable that assumes location-level quarantine.
5. **`PurchaseInvoiceStatus` matching enum vs. actual `matchingStatus` field usage drift** (§4.6) — if B6/B8 reporting work assumes the enum values are populated, it will find they mostly aren't; needs a decision (wire up the enum, or drop it in favor of the free-text field) before building reports on top.
6. **Unverified frontend-only stubs** — `createDebitNoteFromReturn`/`createReplacementPoFromReturn` (exported from `purchaseApiFacade`) were not traced to confirmed backend endpoints in this pass; if B5 work assumes these are live, verify first.

---

*Prepared as a read-only audit per Phase B0 instructions. No source files outside this document and the changelog entry below were modified.*
