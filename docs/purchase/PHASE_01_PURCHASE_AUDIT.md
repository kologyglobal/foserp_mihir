# Phase 01 — Purchase Module Audit

**Date:** 2026-07-20  
**Scope:** Complete existing Purchase module (frontend + backend + DB + RBAC + tests + inventory touchpoints)  
**Mode:** Read-only audit — **no code was changed** in this phase  
**Classification legend:**

| Tag | Meaning |
|-----|---------|
| **Complete** | UI + API + DB + permissions + tenant isolation + tests (production-ready) |
| **Partially complete** | Real pieces exist but gaps remain (often FE polished, BE missing) |
| **Frontend demo only** | Rich SPA / in-memory or Zustand mock; not API-backed |
| **Missing** | Not implemented |
| **Must not be changed** | Do not alter in early purchase-backend phases without explicit decision (shared masters, CRM, finance, deferred AP) |

**Project policy (verified):** Purchase transactional backend is **Deferred by design** (`docs/PROJECT_STATUS.md`, `docs/REMAINING_WORK.md` P3-2). Demo FE alone ≠ complete.

**Business rule under audit (target product rule):**

```text
Purchase Requisition → Submit → Approval → RFQ decision

If RFQ Required = Yes (rfqRequired: true):
  → RFQ + Vendor Quotation flow
  → Do NOT create Purchase Planning Sheet rows

If RFQ Required = No (rfqRequired: false / Skip RFQ = Yes):
  → After final approval, create one Planning Sheet row per valid PR line
  → Planning rows may be grouped by vendor to create Purchase Orders
```

Demo code in `frontend/src/services/purchase/purchaseService.ts` already implements this split via `syncPlanningSheetFromPr` (skips when `pr.rfqRequired`).

---

## 1. Existing folder structure

### Frontend

| Path | Role |
|------|------|
| `frontend/src/routes/purchaseRoutes.tsx` | Route tree under `/purchase` |
| `frontend/src/modules/purchase/` | Pages (PR, PPS, RFQ, VQ, PO, GRN, QI, Invoice, Return, Approvals, Setup, Reports, Dashboard) |
| `frontend/src/modules/purchase/masters/` | Purchase masters hub + CRUD pages |
| `frontend/src/components/purchase/` | Shared tables, shells, line grids, drawers, FactBox, workflow strip |
| `frontend/src/components/purchase/masters/` | Master context panel |
| `frontend/src/services/purchase/` | Domain mock service (`purchaseService.ts`, reports, `index.ts`) |
| `frontend/src/data/purchase/` | Seeds: domain, setup, masters, commercial terms |
| `frontend/src/types/purchaseDomain.ts` | Canonical domain types (PR, PPS, RFQ, PO, GRN, …) |
| `frontend/src/types/purchase.ts` | Older operational types (still used by `purchaseStore`) |
| `frontend/src/store/purchaseStore.ts` | Legacy Zustand purchase docs (MRP/tests/some pages) |
| `frontend/src/store/purchaseMasterStore.ts` | Persistable purchase-native masters (freight, buyers, BIN codes, …) |
| `frontend/src/utils/permissions/purchase.ts` | FE permission catalog + route soft-guards |
| `frontend/src/utils/purchaseRequisitionValidation.ts` | PR form validation |
| `frontend/src/utils/purchaseStatusLabels.ts` | Status / next-step labels |
| `frontend/src/config/purchaseWorkflow.ts` | Workflow step config |
| `frontend/src/config/purchaseMastersCatalog.ts` | Purchase master catalog |
| `frontend/src/config/navigation.ts` | Purchase nav items |

### Docs (pre-existing)

| Path | Role |
|------|------|
| `docs/purchase-workflow-map.md` | Canonical 20-step UX map |
| `docs/PURCHASE_UI_CONSISTENCY.md` | UI consistency rules |
| `docs/PURCHASE_LIST_PAGE_STANDARD.md` | List/register standard |
| `docs/UI_VIEW_PAGE_STANDARD.md` | View-page standard (referenced by purchase) |
| `backend/docs/api-requirement-matrix.md` | Notes PR line `locationId` / `binCode` when purchase APIs start |

### Backend

| Path | Role vs Purchase |
|------|------------------|
| `backend/src/modules/vendors/` | Vendor master API (shared) — **not** transactional purchase |
| `backend/src/modules/masters/` | Items, UOM, warehouses, locations, etc. |
| `backend/src/modules/items/` | Item APIs |
| `backend/src/constants/permissions.ts` | `purchase.*` permission **catalog reserved** for future API |
| **No** `backend/src/modules/purchase/` | **Missing** |

### Classification

| Area | Status |
|------|--------|
| Frontend folder structure | **Frontend demo only** (mature SPA layout) |
| Backend purchase module folder | **Missing** |

---

## 2. Existing frontend routes

Mounted at `/purchase` via `purchaseRouteTree` in `frontend/src/routes/purchaseRoutes.tsx`.

| Route | Page | Feature class |
|-------|------|---------------|
| `/purchase` | Dashboard + process map | Frontend demo only |
| `/purchase/approvals` | Approval inbox | Frontend demo only |
| `/purchase/setup` | Purchase setup (series, matrix, skip RFQ default, …) | Frontend demo only |
| `/purchase/requisitions` | PR list | Frontend demo only |
| `/purchase/requisitions/new` | PR editor (create) | Frontend demo only |
| `/purchase/requisitions/:id/edit` | PR editor | Frontend demo only |
| `/purchase/requisitions/:id` | PR 360 / detail | Frontend demo only |
| `/purchase/planning-sheet` | Purchase Planning Sheet | Frontend demo only |
| `/purchase/rfqs` … `/new` … `/:id` … `/edit` | RFQ | Frontend demo only |
| `/purchase/vendor-quotations` … | Vendor quotations | Frontend demo only |
| `/purchase/comparison` … `/:rfqId` | Quote comparison | Frontend demo only |
| `/purchase/orders` … `/new` … `/:id` … `/edit` `/revise` `/amend` `/print` | Purchase orders | Frontend demo only |
| `/purchase/grn` … | GRN | Frontend demo only |
| `/purchase/quality-inspections` … | QI (purchase-side list/detail) | Frontend demo only |
| `/purchase/invoices` … | Purchase invoices | Frontend demo only |
| `/purchase/returns` … | Purchase returns | Frontend demo only |
| `/purchase/vendor-performance` | Vendor performance | Frontend demo only |
| `/purchase/reports` … `/:reportId` | Reports hub/runner | Frontend demo only |
| `/purchase/masters` … | Hub + linked + native masters | Frontend demo only (linked masters may hit global/CRM APIs in API mode) |
| `/purchase/manual-pr` | Legacy manual PR | Frontend demo only / legacy |
| `/purchase/grns` → redirect to `/purchase/grn` | Alias | — |

**Nav** (`navigation.ts`): Approvals, PR, Planning Sheet, RFQ, Comparison, Orders, GRN, Return, Invoice, Vendor Quotation, Vendor Performance, Reports, Masters, Setup.

---

## 3. Existing backend APIs

### Purchase transactional APIs

| Resource | Routes / controllers / services / validators | Status |
|----------|-----------------------------------------------|--------|
| PR / Planning / RFQ / VQ / PO / GRN / Invoice / Return | None under `/api/v1/t/:tenantSlug/purchase/…` | **Missing** |

There is **no** purchase router registration in `backend/src/modules/`.

### Related APIs that Purchase UI may consume later / already for masters

| Module | Status | Notes |
|--------|--------|-------|
| Auth / tenants / users / roles | Complete (platform) | **Must not be changed** for purchase work except granting `purchase.*` |
| Master vendors | Partially complete / Complete for master CRUD | `MasterVendor` + vendors module |
| Master items / UOM / warehouses / locations | Partially complete | Shared masters |
| CRM payment/delivery terms | Complete (CRM masters) | Linked from purchase hub |
| Inventory movements / stock ledger API | Deferred / demo FE | GRN→stock is demo |
| Finance AP / payables | Deferred / scaffolding | Invoice payment matching deferred |

### Classification

| Feature | Status |
|---------|--------|
| Purchase REST API surface | **Missing** |
| Vendor/Item masters usable by future PO | **Partially complete** (masters exist; PO does not) |

---

## 4. Existing Prisma models

### Purchase transactional models

| Model | Status |
|-------|--------|
| `PurchaseRequisition` / lines | **Missing** |
| `PurchasePlanningSheet` / rows | **Missing** |
| `RequestForQuotation` / invites / lines | **Missing** |
| `VendorQuotation` / lines | **Missing** |
| `PurchaseOrder` / lines / revisions | **Missing** |
| `GoodsReceipt` / GRN lines | **Missing** |
| `PurchaseInvoice` / match | **Missing** |
| `PurchaseReturn` | **Missing** |
| Purchase approval request tables | **Missing** (finance has its own approval models — do not conflate) |

### Shared models relevant to Purchase

| Model | Table map | Class |
|-------|-----------|-------|
| `MasterVendor` | `master_vendors` | Complete (master) — **Must not be changed** casually |
| `MasterItem` | `master_items` | Complete (master) |
| `MasterItemCategory` | — | Complete (master) |
| Location / warehouse masters (as implemented) | master_* | Complete / partial |
| `AuditLog` | `audit_logs` | Complete platform — unused by purchase docs today |
| `CodeSeries` | `code_series` | Exists; **no** purchase entity enums for PR/PO/RFQ/GRN |
| Finance `AccountType` includes `PURCHASE` / `PURCHASE_RETURN` | CoA | Finance only — **Must not be changed** for procurement docs |

---

## 5. Existing MySQL tables

Derived from Prisma `@@map` / absence of purchase models:

| Table | Status for Purchase |
|-------|---------------------|
| `master_vendors`, `master_items`, … | Exist — shared masters |
| `audit_logs` | Exist — platform; no purchase entity writes |
| `code_series` | Exist — no PR/PO/RFQ/GRN series types |
| `purchase_requisitions`, `purchase_requisition_lines` | **Missing** |
| `purchase_planning_sheet_rows` (or equivalent) | **Missing** |
| `rfqs`, `vendor_quotations`, `purchase_orders`, `grns`, … | **Missing** |

No MySQL migration exists for transactional purchase documents.

---

## 6. Frontend-only demo logic

### Dual runtime stores (important risk)

| Layer | Used by | Notes |
|-------|---------|-------|
| `services/purchase/purchaseService.ts` | Modern editors: PR editor, Planning Sheet, RFQ/VQ/PO/GRN/Invoice/Return domain pages, approvals, setup | In-memory seed + artificial latency; planning sync; domain approvals history |
| `store/purchaseStore.ts` | Legacy pages (`PurchaseFormPages`, parts of `PurchaseExtendedPages`), **MRP → PR**, `test:purchase-module`, `test:purchase-production-ready` | Separate document graph; **not the same state** as `purchaseService` |

**Classification:** Dual demo stacks = **Partially complete** architecture risk; migration to one domain service (then API) is required before backend.

### Domain service behaviours (demo)

| Behaviour | Implementation | Class |
|-----------|----------------|-------|
| PR CRUD, submit, approve, reject, cancel | `purchaseService` | Frontend demo only |
| `rfqRequired` / Skip RFQ | Header flag; setup default `skipRfq` | Frontend demo only |
| Sync PPS on approve when `!rfqRequired` | `syncPlanningSheetFromPr` | Frontend demo only — **matches target business rule** |
| One PPS row per PR line; idempotent by `(prId, lineId)` | Same | Frontend demo only |
| RFQ convert from approved PR (`rfqRequired`) | `convertPurchaseRequisitionToRfq` | Frontend demo only |
| Direct PO from PR / planning | `convertPurchaseRequisitionToPo`, `createPurchaseOrdersFromPlanningSelection` | Frontend demo only |
| Group PPS by vendor → one PO | Planning create-PO | Frontend demo only |
| RFQ → quotes → comparison → PO | Domain + some legacy store paths | Frontend demo only |
| PO release / send / revise | Domain editors | Frontend demo only |
| GRN + QC flags | Domain + quality demo hooks | Frontend demo only |
| Purchase invoice / return | Domain editors | Frontend demo only |
| Approval matrix by amount | Setup + in-memory approvals | Frontend demo only |
| Number series | Setup seed (`PR`, `PO`, …) | Frontend demo only |
| BIN Code master | `purchaseMasterStore` kind `bin-codes` | Frontend demo only |
| Unsaved-changes guard | Shared hook | Complete for FE UX |

### Forms / tables / drawers / modals (sample)

| UI | Class |
|----|-------|
| `PurchaseRequisitionEditorPage` + `PurchaseRequisitionLinesTable` | Frontend demo only |
| `PurchasePlanningSheetPage` + Create PO modal | Frontend demo only |
| `PurchaseApprovalReviewDrawer` | Frontend demo only |
| `PurchaseLineDetailsDrawer` | Frontend demo only |
| `PurchaseOrderOriginPicker` / series dialogs | Frontend demo only |
| Register filter drawers (`CrmFilterDrawer`) on lists | Frontend demo only |
| Print pages (PO, Invoice, Return) | Frontend demo only |

---

## 7. Missing backend functionality

All of the following are **Missing** for production API mode:

1. Tenant-scoped CRUD for PR / PPS / RFQ / VQ / PO / GRN / Invoice / Return  
2. Explicit lifecycle endpoints (submit, approve, reject, convert-to-RFQ, sync-planning, create-POs-from-planning, release PO, post GRN, …) — not generic PATCH for workflow  
3. Server-side Zod validators mirroring FE rules  
4. Atomic document number allocation (tenant + series)  
5. Approval engine for purchase docs (or reuse pattern from finance approvals — **new** purchase-specific wiring)  
6. Planning sheet persistence + idempotent sync on PR approve  
7. Convert / link integrity (PR ↔ RFQ ↔ PO ↔ GRN)  
8. Permission enforcement on every route  
9. Writing to `audit_logs` for purchase mutations  
10. Soft delete / concurrency (`updatedAt` / version)  
11. Attachments storage for purchase entities  

---

## 8. Missing database models

Recommended future entities (names illustrative — design in later phase):

| Entity | Purpose |
|--------|---------|
| `PurchaseRequisition` + `PurchaseRequisitionLine` | Demand header/lines; `rfqRequired`; `lineNo` + UUID `id` |
| `PurchasePlanningSheetRow` | One row per PR line when direct-PO; FK to `purchaseRequisitionLineId` |
| `PurchaseRfq` + lines + vendor invites | RFQ path |
| `VendorQuotation` + lines | Quotes |
| `QuotationComparison` / award (optional) | Compare result |
| `PurchaseOrder` + lines + amendments | PO |
| `GoodsReceiptNote` + lines | GRN |
| `PurchaseQualityInspection` (or link Quality module) | QI |
| `PurchaseInvoice` + match lines | AP side may share finance later |
| `PurchaseReturn` + lines | Returns |
| `PurchaseApprovalRequest` + steps | Or polymorphic approval |
| `PurchaseSetup` / number series / matrix | Tenant config |

Indexes of note for later: `(tenantId, purchaseRequisitionId, lineNo)`, unique `(tenantId, purchaseRequisitionLineId)` on planning.

---

## 9. Missing validations

| Validation | FE today | Backend |
|------------|----------|---------|
| PR header required fields / urgent purpose | Partial (`purchaseRequisitionValidation`) | **Missing** |
| PR lines qty/item/type | Partial | **Missing** |
| `rfqRequired` immutable after submit/approve | Soft / unclear | **Missing** |
| PPS: no rows if `rfqRequired` | Enforced in sync | **Missing** server |
| PPS: vendor + rate + qty before Create PO | Demo checks | **Missing** |
| RFQ vendor count / send rules | Demo | **Missing** |
| PO over-receipt / GRN tolerance | Setup + demo | **Missing** API |
| Line `locationId` per line (API matrix requirement) | FE lines have location fields; consistency varies | **Missing** |
| Tenant isolation on all queries | N/A (no API) | **Missing** |

---

## 10. UI/UX inconsistencies

| Issue | Severity | Class |
|-------|----------|-------|
| Dual stores (`purchaseStore` vs `purchaseService`) → different docs in tests vs UI | High | Partially complete |
| Legacy routes/pages still in tree (`manual-pr`, some `PurchaseFormPages` / `PurchaseExtendedPages`) | Medium | Frontend demo only / legacy |
| Workflow map still describes RFQ-first journey; Planning Sheet is newer alternate path | Medium | Partially complete docs |
| `/purchase/planning-sheet` not in `PURCHASE_ROUTE_VIEW_PERMISSIONS` / nav permission map (falls through to `purchase.view`) | Medium | RBAC gap (FE) |
| Some lists gold-path (`/purchase/orders`); others still catching up to list standard | Low–medium | Partially complete |
| Quality inspection split between `/purchase/quality-inspections` and `/quality/*` | Medium | Partially complete |
| Invoice/AP steps marked Planned in workflow map but editors exist in demo | Medium | Frontend demo only vs deferred AP |
| Item picker / smart-select historically caused portal flicker (mitigations in FE) | Low | Ongoing FE polish |

**Must not be changed** without product decision: CRM quotation UX, global master CRUD patterns, finance AP screens.

---

## 11. RBAC gaps

| Item | Status |
|------|--------|
| `purchase.*` keys in FE + BE permission catalogs | Partially complete (catalog only) |
| FE soft route/nav gates | Partially complete |
| Server enforcement for purchase mutations | **Missing** |
| `purchase.planning.*` (view/edit/create-po) | **Missing** — planning uses generic `purchase.view` |
| Approvals page gated mainly on `purchase.requisition.approve` (PO approve may differ) | Partially complete |
| Role packs: Purchase Manager / Executive in BE constants | Partially complete (unused by purchase API) |
| Tests asserting API 403 for purchase | **Missing** |

---

## 12. Multi-tenant gaps

| Item | Status |
|------|--------|
| Demo purchase state | Single in-memory tenant — **Frontend demo only** |
| API routes `/api/v1/t/:tenantSlug/purchase/…` | **Missing** |
| `tenantId` on all future purchase tables | **Missing** (required by architecture) |
| Never trust `tenantId` from body | N/A until API |
| Master vendors/items already tenant-scoped | Complete for masters |

---

## 13. Audit-log gaps

| Item | Status |
|------|--------|
| Platform `AuditLog` / `audit_logs` | Complete infrastructure |
| Purchase mutations writing audit logs | **Missing** |
| Demo `approvalHistory` / `pushHistory` in `purchaseService` | Frontend demo only (not `audit_logs`) |
| Field-level change tracking on PO amend | Partial demo only |

---

## 14. Test coverage gaps

| Suite | What it covers | Gap |
|-------|----------------|-----|
| `npm run test:purchase-module` | Route string checks + **purchaseStore** MRP→PR→RFQ→PO→GRN | Does **not** exercise `purchaseService` Planning Sheet / modern PR editor |
| `npm run test:purchase-production-ready` | Same legacy store happy path | No API / DB / PPS / `rfqRequired` split |
| `test:purchase-e2e` smoke | FE smoke if present | Not live API |
| Backend purchase live tests | — | **Missing** |
| Permission / tenant isolation tests for purchase | — | **Missing** |
| CI note | Scripts run in FE CI; false confidence vs production completeness | — |

---

## 15. Files likely to be changed (future phases)

**Do not change in Phase 01** (this audit only). Likely touch list when implementation starts:

### Frontend (bridge / API hydration)

- `frontend/src/services/purchase/purchaseService.ts` → API client + keep demo path  
- `frontend/src/services/purchase/index.ts`  
- `frontend/src/store/purchaseStore.ts` (migrate or deprecate)  
- PR / Planning / RFQ / PO editors under `modules/purchase/`  
- `frontend/src/utils/permissions/purchase.ts` (add planning keys + route map)  
- Seeds / types: `purchaseDomain.ts`, `purchaseDomainSeed.ts`  
- Tests: replace store-only scripts with service + later `test:crm-live`-style purchase live suite  

### Backend (new)

- `backend/src/modules/purchase/**` (routes, controllers, services, repositories, validators)  
- `backend/prisma/schema.prisma` + migrations  
- `backend/src/constants/permissions.ts` (wire roles; add planning perms if needed)  
- `backend/docs/api-requirement-matrix.md`  
- New live tests under `backend/tests/purchase/`  

### Shared / careful

- `MasterVendor` / `MasterItem` — **Must not be changed** except additive FKs if required  
- Inventory posting from GRN — coordinate; inventory API still deferred  
- Finance AP — **Must not be changed** in early PR/PPS/PO phases  

### Docs

- `docs/purchase-workflow-map.md` (add Planning Sheet branch)  
- `docs/PROJECT_STATUS.md` / `REMAINING_WORK.md` when phases ship  
- This file + future `PHASE_02_…` design docs  

---

## 16. Recommended implementation order

Aligned with the stated business flow and project “explicit lifecycle endpoints” rule:

| Phase | Focus | Outcome |
|-------|--------|---------|
| **01** | Audit (this document) | Baseline — **done** |
| **02** | Domain design | ERD: PR + lines + PPS + approvals; `rfqRequired` rules; indexes; API matrix |
| **03** | PR backend | CRUD + submit/approve/reject + Zod + tenant + perms + audit + live tests |
| **04** | Planning Sheet backend | On approve (`!rfqRequired`): create rows; list/update; Action Message; create POs by vendor group |
| **05** | RFQ + Vendor Quotation + Comparison | Path when `rfqRequired`; no PPS rows |
| **06** | Purchase Order | Manual / from PR / from PPS / from comparison; release/send/amend |
| **07** | GRN + Quality hooks | Receipt; QC flag; demo→API inventory post when inventory phase allows |
| **08** | Invoice / Return / AP handoff | Coordinate with finance; do not invent full AP early |
| **09** | FE dual-mode | `VITE_USE_API` hydration; retire `purchaseStore` duplication; update tests |
| **10** | Hardening | Reports, setup series in DB, RBAC matrix, UAT |

**Within Phase 03–04, preserve demo FE** until API bridges exist (`VITE_USE_API=false` must keep working).

---

## Feature matrix (summary)

| Feature | Classification |
|---------|----------------|
| Purchase SPA shell, nav, dashboard | Frontend demo only |
| PR list / create / edit / detail | Frontend demo only |
| PR submit / approve (demo) | Frontend demo only |
| Skip RFQ / `rfqRequired` UI + sync rule | Frontend demo only (**rule logic present**) |
| Purchase Planning Sheet + Create PO by vendor | Frontend demo only |
| RFQ / VQ / Comparison | Frontend demo only |
| Purchase Order full UI | Frontend demo only |
| GRN / QI / Return / Invoice UI | Frontend demo only |
| Purchase Setup / Masters (native) | Frontend demo only |
| Linked Vendor/Item masters | Partially complete (API masters + demo purchase docs) |
| Inventory ← GRN / planning draft PR | Frontend demo only |
| MRP → PR (`purchaseStore`) | Frontend demo only (legacy store) |
| Purchase backend APIs | **Missing** |
| Purchase Prisma / MySQL tables | **Missing** |
| Purchase RBAC server-side | **Missing** |
| Purchase `audit_logs` | **Missing** |
| Purchase live API tests | **Missing** |
| Platform auth/tenant/masters/audit infra | Complete — **Must not be changed** lightly |
| CRM / Finance AP full | Deferred / other modules — **Must not be changed** for early purchase |

---

## Existing Purchase Order flow (as implemented in demo)

```text
Origins (domain service):
  manual
  purchase_requisition (direct convert or from planning)
  quotation_comparison / RFQ award path
  (legacy store: createPoFromRfq / createPoFromPr)

Lifecycle (demo): draft → submit → approve → release/send → (GRN) → close
```

Planning path (direct PO):

```text
PR approved + rfqRequired=false
  → PPS rows (1 per line)
  → Action Message + vendor/rate
  → createPurchaseOrdersFromPlanningSelection (group by vendor)
  → PO origin purchase_requisition; PPS status po_created
```

RFQ path:

```text
PR approved + rfqRequired=true
  → no PPS
  → convert to RFQ → vendor quotes → comparison → PO
```

---

## Existing Inventory integration (demo)

| Touchpoint | Direction | Class |
|------------|-----------|-------|
| Inventory planning `createPurchaseRequisitionDraftDemo` | Inv → `createPurchaseRequisition` (domain service) | Frontend demo only |
| GRN post / expected receipt qty on items | Purchase/legacy store ↔ inventory stores | Frontend demo only |
| Inventory returns from posted GRN | Inv reads GRN via purchase service | Frontend demo only |
| Stock check before buy (workflow step 2) | Deferred | **Missing** / deferred |
| Real inventory ledger API from GRN | Deferred | **Missing** |

---

## Audit conclusion

The Purchase module is a **large, polished frontend demo** with a domain mock service that **already encodes** the RFQ-vs-Planning split. There is **no** purchase transactional backend, **no** purchase MySQL schema, **no** server RBAC/audit for purchase documents, and tests largely cover the **legacy Zustand** path—not Planning Sheet / modern PR.

**Phase 01 complete.** Next recommended artifact: Phase 02 design (ERD + API list + validation matrix) before any implementation.

---

## Verification notes (how this audit was produced)

- Inspected `purchaseRoutes.tsx`, `navigation.ts`, `purchaseService.ts` (sync/planning/PO), permissions FE/BE, Prisma (no purchase models; `MasterVendor`, `AuditLog`), `backend/src/modules` (no purchase), workflow map, REMAINING_WORK P3-2, inventory service imports of purchase, FE test scripts.  
- Did not run migrations or modify application code.
