# ERP Backend Migration Plan

**Document type:** Architecture & migration roadmap  
**Current stack:** React 19 + Vite + Zustand + browser `localStorage`  
**Target stack:** React → REST API → NestJS → PostgreSQL → Prisma ORM  
**Scope:** Vasant Trailer ERP (`trailer-erp`)  
**Status:** Planning only — **do not implement until approved**  
**Reference:** Existing [`DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md) (PostgreSQL DDL v2.1) · [`ERP_GO_LIVE_READINESS.md`](./ERP_GO_LIVE_READINESS.md)

---

## 1. Executive Summary

The frontend ERP today runs as a **single-user, client-side application**. All transactional state lives in **11 Zustand persist slices** (`localStorage`). Business logic is embedded in **stores** and **pure TypeScript engines** (`mrpEngine`, `workOrderEngine`, `costEngine`, `qualityEngine`, `gstEngine`).

Migration goal: move **source of truth** to PostgreSQL while keeping the React UI. Stores become **thin API clients**; engines move to **NestJS services** with **database transactions** and **audit trails**.

```text
┌─────────────────────────────────────────────────────────────┐
│  React SPA (existing modules, routes, components)           │
│  Zustand → API hooks (React Query / TanStack Query)         │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS / JSON REST
┌───────────────────────────▼─────────────────────────────────┐
│  NestJS API (modules mirror domain stores)                    │
│  Guards · DTOs · Validation · Transactions · Event bus        │
│  Engines: mrp · workOrder · cost · quality · gst · inventory  │
└───────────────────────────┬─────────────────────────────────┘
                            │ Prisma Client
┌───────────────────────────▼─────────────────────────────────┐
│  PostgreSQL 16                                                │
│  md.* masters · tx.* documents · inv.* ledger · sys.*       │
└─────────────────────────────────────────────────────────────┘
```

**Anchor scenario for parity testing:** ABC Cement · SO-0001 · 2× 45 M3 Bulker — must pass existing `npm run simulate:go-live` against the API.

---

## 2. Current State Inventory

### 2.1 Persistence Model

| Persist key | Store | Primary entities stored |
|-------------|-------|-------------------------|
| `vasant-erp-inventory-v1` | `inventoryStore` | `stockMovements[]`, `reservations[]` |
| `vasant-erp-mrp-v1` | `mrpStore` | `salesOrders[]`, `runs[]` (embedded material/WO lines) |
| `vasant-erp-purchase-v1` | `purchaseStore` | `requisitions[]`, `rfqs[]`, `purchaseOrders[]`, `grns[]` |
| `vasant-erp-workorders-v1` | `workOrderStore` | WOs, material lines, ops, job cards, SA/FG receipts, subcontract |
| `vasant-erp-bom-v1` | `bomStore` | `bomHeaders[]`, `bomLines[]` |
| `vasant-erp-routing-v1` | `routingStore` | `routingHeaders[]`, `routingOperations[]` |
| `vasant-erp-workcenters-v1` | `workCenterStore` | `workCenters[]`, warehouse mappings |
| `vasant-erp-quality-v1` | `qualityStore` | `inspections[]`, `reworks[]`, `ncrs[]` |
| `vasant-erp-costing-v1` | `costingStore` | `overheadPct` only (sheets computed on read) |
| `vasant-erp-dispatch-v1` | `dispatchStore` | `dispatches[]` (checklist, photos, POD embedded) |
| `vasant-erp-invoice-v1` | `invoiceStore` | `invoices[]` (lines, payments embedded) |

### 2.2 Non-Persisted Stores

| Store | Role | Migration note |
|-------|------|----------------|
| `masterStore` | UOM, items, customers, vendors, warehouses, products, vendor maps | **Seed-only in memory today** — must become first DB migration target |
| `uiStore` | Sidebar collapse | Stays client-side |
| `useERPStore` | Legacy UI shell | Deprecate |

### 2.3 Business Logic Engines (server-side candidates)

| Engine | File | Used by |
|--------|------|---------|
| MRP explosion & shortage | `utils/mrpEngine.ts` | `mrpStore`, MRP UI |
| WO creation order & materials | `utils/workOrderEngine.ts` | `workOrderStore` |
| WIP routing stages | `utils/wipRouting.ts` | `inventoryStore`, WO flow |
| Cost rollup | `utils/costEngine.ts` | `costingStore` |
| QC gates & blockers | `utils/qualityEngine.ts` | `qualityStore`, `workOrderStore` |
| GST computation | `utils/gstEngine.ts` | `invoiceStore` |
| On-hand from ledger | `utils/inventory.ts` | `inventoryStore` |
| BOM tree & cost | `utils/bom.ts` | `bomStore`, MRP |
| Integrity validation | `utils/integrityCheck.ts` | Bootstrap, tests |

### 2.4 Cross-Store Coupling (migration risk)

Stores call each other synchronously via `useXStore.getState()` — **no transactions**, **no rollback**. Examples:

- `confirmDispatch` → `inventoryStore.postDispatchIssue` + `mrpStore` SO status
- `postInvoice` → `mrpStore` SO status
- `postFgReceipt` → `inventoryStore` + `costingStore` (implicit via reads)
- `completeJobCard` → `qualityStore.createPendingInspection`
- `runMrpForOrder` → reads BOM, inventory, master; may create PR

**Backend requirement:** NestJS **application services** with `@Transactional()` (Prisma interactive transactions) per command.

### 2.5 Legacy / Unwired Code

| Path | Status |
|------|--------|
| `types/erp.ts`, `data/orders.ts`, `SalesPage.tsx` | Legacy mock — **do not migrate** |
| `DATABASE_SCHEMA.md` | Uses `production_orders` naming; live code uses `work_orders` with SA/FG/subcontract types — **schema must align to TS domain** |

---

## 3. Existing Stores → Target NestJS Modules

| # | Zustand store | NestJS module | Priority |
|---|---------------|---------------|----------|
| 1 | `masterStore` | `MastersModule` | P0 |
| 2 | `inventoryStore` | `InventoryModule` | P0 |
| 3 | `bomStore` | `BomModule` | P0 |
| 4 | `routingStore` | `RoutingModule` | P0 |
| 5 | `workCenterStore` | `WorkCentersModule` | P0 |
| 6 | `mrpStore` | `MrpModule` + `SalesModule` | P1 |
| 7 | `purchaseStore` | `PurchaseModule` | P1 |
| 8 | `workOrderStore` | `WorkOrdersModule` | P1 |
| 9 | `qualityStore` | `QualityModule` | P2 |
| 10 | `costingStore` | `CostingModule` | P2 |
| 11 | `dispatchStore` | `DispatchModule` | P2 |
| 12 | `invoiceStore` | `InvoiceModule` | P2 |
| — | — | `AuthModule`, `SystemModule` (numbering, audit) | P0 |

---

## 4. Existing Entities (TypeScript → Database)

### 4.1 Master Data (`types/master.ts`)

| Entity | Table | Notes |
|--------|-------|-------|
| `Uom` | `md.uom_master` | Exists in DDL |
| `ItemCategory` | `md.item_categories` | Tree via `parent_id` |
| `Item` | `md.items` | + `sub_assembly_rule` enum (in TS, extend DDL) |
| `Customer` | `md.customers` | |
| `Vendor` | `md.vendors` | |
| `ItemVendorMap` | `md.item_vendor_map` | Preferred vendor, lead time, rate |
| `Warehouse` | `md.warehouses` | |
| `Product` | `md.products` | Links to `fg_item_id` |

### 4.2 Engineering (`types/bom.ts`, `routing.ts`, `workcenter.ts`)

| Entity | Table | Notes |
|--------|-------|-------|
| `BomHeader` | `md.bom_headers` | Revision workflow |
| `BomLine` | `md.bom_lines` | `parent_line_id` tree |
| `RoutingHeader` | `md.routing_headers` | **New table** — DDL has flat `product_routings`; align to header/operation model |
| `RoutingOperation` | `md.routing_operations` | Includes `qc_checklist` JSONB |
| `WorkCenter` | `md.work_centers` | |
| `WorkCenterWarehouseMapping` | `md.work_center_warehouse_map` | |

### 4.3 Sales & MRP (`types/mrp.ts`)

| Entity | Table | Notes |
|--------|-------|-------|
| `SalesOrder` | `tx.sales_orders` | Extend status enum to match TS: `open, confirmed, in_production, ready_dispatch, dispatched, invoiced, closed` |
| `MrpRun` | `tx.mrp_runs` | Header only |
| `MrpMaterialLine` | `tx.mrp_material_lines` | **Denormalize** from embedded JSON |
| `MrpWoRequirement` | `tx.mrp_wo_requirements` | |
| `MrpException` | `tx.mrp_exceptions` | |
| `MrpPeggingLink` | `tx.mrp_pegging_links` | Optional materialized view |

### 4.4 Purchase (`types/purchase.ts`)

| Entity | Table |
|--------|-------|
| `PurchaseRequisition` | `tx.purchase_requisitions` |
| `PurchaseRequisitionLine` | `tx.pr_lines` |
| `RequestForQuotation` | `tx.rfqs` |
| `RfqLine`, `RfqVendorQuote` | `tx.rfq_lines`, `tx.rfq_quotes` |
| `PurchaseOrder` | `tx.purchase_orders` |
| `PurchaseOrderLine` | `tx.po_lines` |
| `GrnHeader` | `tx.grn_headers` |
| `GrnLine` | `tx.grn_lines` |

### 4.5 Inventory (`types/inventory.ts`)

| Entity | Table | Notes |
|--------|-------|-------|
| `StockMovement` | `inv.stock_movements` | **Source of truth**; add `work_order_id`, `dispatch_id`, `source_wo_id` FKs |
| `StockReservation` | `inv.stock_reservations` | `demand_type` SO/WO; FK to demand UUID |
| `StockBalanceSnapshot` | `inv.stock_balances` | Derived cache (trigger or job) |

### 4.6 Production (`types/workorder.ts`)

| Entity | Table | Notes |
|--------|-------|-------|
| `WorkOrder` | `tx.work_orders` | **Replace** DDL `production_orders`; types: `finished_goods`, `manufactured_sub_assembly`, `subcontract` |
| `WorkOrderMaterialLine` | `tx.wo_material_lines` | |
| `WorkOrderProductionOperation` | `tx.wo_operations` | Snapshot from routing on release |
| `JobCard` | `tx.job_cards` | |
| `SubcontractShipment` | `tx.subcontract_shipments` | |
| `SaReceipt` | `tx.sa_receipts` | |
| `FgReceipt` | `tx.fg_receipts` | |
| `WorkOrderActivity` | `tx.wo_activities` | Audit log |

### 4.7 Quality (`types/quality.ts`)

| Entity | Table |
|--------|-------|
| `QcInspection` | `tx.qc_inspections` |
| `ReworkOrder` | `tx.rework_orders` |
| `NonConformanceReport` | `tx.ncrs` |

### 4.8 Costing (`types/costing.ts`)

| Entity | Table | Notes |
|--------|-------|-------|
| `CostSheet` | — | **Computed** — optional `tx.cost_sheet_snapshots` for posted WOs |
| Settings | `sys.costing_settings` | `overhead_pct` |

### 4.9 Dispatch (`types/dispatch.ts`)

| Entity | Table | Notes |
|--------|-------|-------|
| `DispatchPlan` | `tx.dispatch_plans` | Extend DDL `dispatch_orders` |
| `DispatchLine` | `tx.dispatch_lines` | `trailer_no`, `chassis_no`, `work_order_id` |
| `DispatchChecklistItem` | `tx.dispatch_checklist_items` | |
| `DispatchPhoto` | `tx.dispatch_photos` | Store URL to S3, not base64 |
| `CustomerAcknowledgement` | `tx.dispatch_pod` | 1:1 with dispatch |

### 4.10 Invoice (`types/invoice.ts`)

| Entity | Table |
|--------|-------|
| `SalesInvoice` | `tx.sales_invoices` |
| `InvoiceLine` | `tx.invoice_lines` |
| `PaymentRecord` | `tx.payment_records` |
| GST breakdown | Columns on invoice or `tx.invoice_tax_lines` |

### 4.11 System (new)

| Entity | Table |
|--------|-------|
| `User` | `sys.users` |
| `Role`, `Permission` | `sys.roles`, `sys.role_permissions` |
| `AuditLog` | `sys.audit_log` |
| `DocumentSequence` | `sys.document_sequences` | DC-, WO-, INV-, MRP-, etc. |

**Estimated table count:** ~52 core tables + 4 views + indexes.

---

## 5. API Endpoints Required

REST conventions: `GET` list/detail · `POST` create · `PATCH` update · domain **commands** as `POST /resource/:id/action`.

### 5.1 Auth & System

```text
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
GET    /api/v1/auth/me
GET    /api/v1/system/health
GET    /api/v1/system/sequences/:docType/next   (internal / admin)
```

### 5.2 Masters

```text
GET/POST/PATCH     /api/v1/masters/uom
GET/POST/PATCH     /api/v1/masters/item-categories
GET/POST/PATCH     /api/v1/masters/items
GET/POST/PATCH     /api/v1/masters/customers
GET/POST/PATCH     /api/v1/masters/vendors
GET/POST/PATCH     /api/v1/masters/warehouses
GET/POST/PATCH     /api/v1/masters/products
GET                /api/v1/masters/items/:id/vendor-maps
```

### 5.3 BOM & Routing

```text
GET/POST/PATCH     /api/v1/bom
GET                /api/v1/bom/:id/tree
POST               /api/v1/bom/:id/submit | /approve | /release
GET/POST/PATCH     /api/v1/routing
POST               /api/v1/routing/:id/submit | /approve | /release
GET/POST/PATCH     /api/v1/work-centers
```

### 5.4 Sales & MRP

```text
GET/POST/PATCH     /api/v1/sales-orders
POST               /api/v1/sales-orders/:id/confirm | /cancel
GET                /api/v1/mrp/dashboard
POST               /api/v1/mrp/runs                    (run MRP)
GET                /api/v1/mrp/runs/:id
POST               /api/v1/mrp/runs/:id/reserve
GET                /api/v1/mrp/runs/:id/pegging
```

### 5.5 Purchase

```text
GET/POST           /api/v1/purchase/requisitions
POST               /api/v1/purchase/requisitions/:id/submit | /approve
POST               /api/v1/purchase/requisitions/:id/create-po
GET/POST           /api/v1/purchase/orders
GET/POST           /api/v1/purchase/rfqs
POST               /api/v1/purchase/grns                 (post GRN → inventory)
GET                /api/v1/purchase/grns
```

### 5.6 Inventory

```text
GET                /api/v1/inventory/stock-positions
GET                /api/v1/inventory/ledger
GET                /api/v1/inventory/reservations
POST               /api/v1/inventory/opening-stock
POST               /api/v1/inventory/inward
POST               /api/v1/inventory/issue
POST               /api/v1/inventory/adjustment
POST               /api/v1/inventory/reservations
PATCH              /api/v1/inventory/reservations/:id/cancel
```

### 5.7 Work Orders (largest surface)

```text
GET/POST           /api/v1/work-orders
GET                /api/v1/work-orders/:id
GET                /api/v1/work-orders/:id/materials
GET                /api/v1/work-orders/:id/operations
GET                /api/v1/work-orders/:id/job-cards
GET                /api/v1/work-orders/:id/activities
POST               /api/v1/work-orders/from-mrp/:runId
POST               /api/v1/work-orders/:id/plan
POST               /api/v1/work-orders/:id/release
POST               /api/v1/work-orders/:id/reserve-materials
POST               /api/v1/work-orders/:id/issue-materials
POST               /api/v1/work-orders/:id/start-production
POST               /api/v1/work-orders/:id/complete
POST               /api/v1/work-orders/:id/sa-receipt
POST               /api/v1/work-orders/:id/fg-receipt
POST               /api/v1/work-orders/:id/subcontract/send
POST               /api/v1/work-orders/:id/subcontract/receive
POST               /api/v1/job-cards/:id/start
POST               /api/v1/job-cards/:id/complete
```

### 5.8 Quality

```text
GET                /api/v1/quality/inspections
GET                /api/v1/quality/inspections/queue
POST               /api/v1/quality/inspections/:id/decide
GET/POST           /api/v1/quality/reworks
POST               /api/v1/quality/reworks/:id/start | /complete
GET/PATCH          /api/v1/quality/ncrs
POST               /api/v1/quality/ncrs/:id/close
```

### 5.9 Costing

```text
GET                /api/v1/costing/dashboard
GET                /api/v1/costing/work-orders/:id/sheet
GET                /api/v1/costing/variance-report
GET                /api/v1/costing/profitability
PATCH              /api/v1/costing/settings/overhead
```

### 5.10 Dispatch

```text
GET                /api/v1/dispatch/candidates
GET/POST           /api/v1/dispatch/plans
PATCH              /api/v1/dispatch/plans/:id/logistics
PATCH              /api/v1/dispatch/plans/:id/lines/:lineId/identity
POST               /api/v1/dispatch/plans/:id/checklist/:itemId
POST               /api/v1/dispatch/plans/:id/photos        (multipart → S3)
POST               /api/v1/dispatch/plans/:id/start-loading
POST               /api/v1/dispatch/plans/:id/confirm
POST               /api/v1/dispatch/plans/:id/in-transit
POST               /api/v1/dispatch/plans/:id/pod
POST               /api/v1/dispatch/plans/:id/cancel
```

### 5.11 Invoice

```text
GET                /api/v1/invoices/candidates
GET/POST           /api/v1/invoices
GET                /api/v1/invoices/:id
POST               /api/v1/invoices/from-dispatch/:dispatchId
POST               /api/v1/invoices/:id/post
POST               /api/v1/invoices/:id/payments
POST               /api/v1/invoices/:id/cancel
GET                /api/v1/invoices/receivables
GET                /api/v1/invoices/:id/tax-invoice.pdf    (Phase 2)
```

**Total estimated endpoints:** ~120 REST routes + ~35 command actions.

---

## 6. Database Tables Required (Prisma Schema Outline)

Organize Prisma `schema.prisma` with `@@schema("md")` etc. or single schema with prefixes.

### 6.1 Schema `md` — Master (14 tables)

`uom_master`, `item_categories`, `items`, `customers`, `vendors`, `item_vendor_map`, `warehouses`, `products`, `bom_headers`, `bom_lines`, `routing_headers`, `routing_operations`, `work_centers`, `work_center_warehouse_map`

### 6.2 Schema `tx` — Transactions (28 tables)

`sales_orders`, `mrp_runs`, `mrp_material_lines`, `mrp_wo_requirements`, `mrp_exceptions`, `purchase_requisitions`, `pr_lines`, `rfqs`, `rfq_lines`, `rfq_quotes`, `purchase_orders`, `po_lines`, `grn_headers`, `grn_lines`, `work_orders`, `wo_material_lines`, `wo_operations`, `job_cards`, `subcontract_shipments`, `sa_receipts`, `fg_receipts`, `wo_activities`, `qc_inspections`, `rework_orders`, `ncrs`, `dispatch_plans`, `dispatch_lines`, `dispatch_checklist_items`, `dispatch_photos`, `dispatch_pod`, `sales_invoices`, `invoice_lines`, `payment_records`

### 6.3 Schema `inv` — Inventory (3 tables)

`stock_movements`, `stock_reservations`, `stock_balances`

### 6.4 Schema `sys` — Platform (5 tables)

`users`, `roles`, `role_permissions`, `audit_log`, `document_sequences`, `costing_settings`

### 6.5 Key DB Rules (preserve from frontend)

1. **Stock:** `inv.stock_movements` is source of truth; balances derived.
2. **BOM/Routing:** MRP and WO release only consume `status = released`.
3. **QC gate:** Next operation blocked until inspection `pass` (or rework closed).
4. **FG WO:** Blocked until manufactured SA receipts posted.
5. **Dispatch:** Blocked until FG in yard; checklist + photos + LR required.
6. **Invoice:** Only from dispatched/delivered; posting updates SO to `invoiced`.
7. **Numbering:** Atomic sequences per document type (no client-side `nextNo`).

### 6.6 Prisma vs Existing DDL Deltas

| Area | `DATABASE_SCHEMA.md` | Live TypeScript | Action |
|------|---------------------|-----------------|--------|
| Production | `production_orders` | `WorkOrder` + SA/FG/subcontract | **Rename & extend** |
| Routing | Flat `product_routings` | Header + operations + QC checklist | **Restructure** |
| MRP lines | `mrp_plan_lines` | Embedded in `MrpRun` JSON | **Normalize to child tables** |
| Sales status | 11-value enum | 7-value TS enum | **Unify** |
| Dispatch | Basic header | Full plan + lines + POD | **Extend** |
| Invoice | Not in DDL | Full GST invoice | **Add tables** |
| Photos | — | base64 in localStorage | **S3 + URL column** |

---

## 7. Migration Sequence

Execute in order. Each phase ends with **API integration tests** ported from existing `scripts/test-*.ts`.

### Phase 0 — Platform Foundation (Weeks 1–3)

- [ ] NestJS monorepo (`apps/api`, keep `apps/web` or existing Vite root)
- [ ] PostgreSQL + Prisma init; CI migrate
- [ ] Auth (JWT + refresh); RBAC skeleton (`admin`, `planner`, `store`, `production`, `qc`, `dispatch`, `finance`)
- [ ] `sys.document_sequences` — replace all `nextXxxNo()` helpers
- [ ] Global exception filter, validation pipe, OpenAPI/Swagger
- [ ] Audit log middleware on all `POST/PATCH` commands

**Exit:** Health check, login, seed script loads masters from existing `data/masters/seed.ts`.

### Phase 1 — Master Data API (Weeks 3–5)

- [ ] CRUD for all `masterStore` entities
- [ ] React: replace master reads with API; keep optimistic UI optional
- [ ] Migrate `masterStore` seed → PostgreSQL seed (`prisma db seed`)

**Exit:** All master pages work against API; no master data in memory-only store.

### Phase 2 — Engineering Data (Weeks 5–7)

- [ ] BOM + Routing + Work Centers API with approval workflow
- [ ] Port `bom.ts` tree logic to service
- [ ] React: `bomStore`, `routingStore`, `workCenterStore` → API hooks

**Exit:** BOM release gate still blocks MRP (via API validation).

### Phase 3 — Inventory Ledger (Weeks 7–9)

- [ ] `stock_movements`, `stock_reservations` API
- [ ] Port `postInward`, `postIssue`, `postAdjustment`, reservation logic
- [ ] DB trigger or service to maintain `stock_balances`
- [ ] React: inventory dashboard, ledger, reservations against API

**Exit:** `test:integrity` equivalent against API; ledger = on-hand.

### Phase 4 — Sales Order + MRP (Weeks 9–12)

- [ ] Minimal SO CRUD + confirm (unblocks factory — currently seed-only)
- [ ] MRP run API — port `mrpEngine.ts`
- [ ] Normalize MRP run output to child tables
- [ ] SO reservation API

**Exit:** `runMrpForOrder(SO-0001)` via API matches current material lines.

### Phase 5 — Purchase (Weeks 12–14)

- [ ] PR → PO → GRN API with transactional inventory posting
- [ ] Port `createPrFromMrpRun`, `postGrn`
- [ ] GRN list route in React (existing gap)

**Exit:** MRP → PR → PO → GRN path via API.

### Phase 6 — Work Orders & Production (Weeks 14–20) ⚠️ Critical path

- [ ] Full WO lifecycle API — port `workOrderEngine.ts`, `wipRouting.ts`
- [ ] Material issue/reserve integrated with inventory transactions
- [ ] Job card start/complete; operation generation on release
- [ ] SA receipt, FG receipt, subcontract send/receive
- [ ] React: largest cutover — `workOrderStore` → API

**Exit:** `test:wo-flow` (60 checks) passes against API.

### Phase 7 — Quality (Weeks 20–22)

- [ ] QC inspection, rework, NCR API — port `qualityEngine.ts`
- [ ] Wire job card complete → auto-create inspection

**Exit:** `test:quality` passes against API.

### Phase 8 — Costing (Week 22–23)

- [ ] Cost sheet as computed read model (optional snapshot table on WO complete)
- [ ] Port `costEngine.ts`; overhead setting in DB

**Exit:** `test:costing` passes; FG roll-up matches.

### Phase 9 — Dispatch & Invoice (Weeks 23–25)

- [ ] Dispatch API + file storage for photos
- [ ] Invoice + GST + payments API — port `gstEngine.ts`
- [ ] SO status sync in single transaction

**Exit:** `test:dispatch`, `test:invoice` pass against API.

### Phase 10 — Frontend Cutover & Decommission localStorage (Weeks 25–28)

- [ ] Remove Zustand `persist` middleware slice-by-slice
- [ ] Introduce TanStack Query for cache + invalidation
- [ ] Feature flag: `VITE_API_URL` vs offline mode (temporary)
- [ ] Export/import tool: one-time localStorage → API migration for pilot users

**Exit:** Fresh browser with no localStorage runs full `simulate:go-live` against API.

### Phase 11 — Hardening & Factory Pilot (Weeks 28–32)

- [ ] Load testing on inventory posting
- [ ] Backup/restore procedures
- [ ] Parallel run: desk pilot vs localStorage (2 weeks)
- [ ] Commercial front (Lead/Inquiry/Quote) — **separate phase**, not blocking manufacturing

---

## 8. Data Migration Strategy

### 8.1 Seed Migration (one-time)

Existing seed files → Prisma seed:

| Source | Target |
|--------|--------|
| `data/masters/seed.ts` | All `md.*` tables |
| `data/bom/seed.ts` | BOM headers/lines |
| `data/routing/seed.ts` | Routing headers/operations |
| `data/inventory/seed.ts` | Opening stock movements |
| `data/mrp/seed.ts` | SO-0001 + optional runs |

### 8.2 User Data Migration (localStorage export)

Script: `scripts/export-localstorage.ts` → JSON bundle per persist key → API bulk import endpoints (admin-only):

```text
POST /api/v1/migration/import/inventory
POST /api/v1/migration/import/work-orders
... (one per slice, idempotent by business key)
```

**Order:** masters (skip if seeded) → inventory → purchase → work orders → quality → dispatch → invoice → mrp runs.

### 8.3 ID Strategy

- **Option A (recommended):** New UUIDs in DB; maintain `legacy_id` column during migration.
- **Option B:** Preserve client UUIDs from localStorage where present.

---

## 9. Risks

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| R1 | **No atomic transactions today** — partial failures corrupt state | Critical | Prisma `$transaction` per command; idempotency keys on POST |
| R2 | **Cross-store orchestration** spread across 10+ files | High | Map each store action → single application service method |
| R3 | **Schema drift** — DDL doc ≠ TypeScript domain | High | Generate Prisma from TS types review; single source in Prisma |
| R4 | **WO complexity** — largest store (~960 lines) | High | Phase 6 dedicated; port tests first (TDD) |
| R5 | **MRP embedded JSON** — hard to query/report | Medium | Normalize to child tables in Phase 4 |
| R6 | **Base64 photos in dispatch** | Medium | S3/MinIO before Phase 9; never store blobs in PG |
| R7 | **masterStore not persisted** — users may have edited masters only in session | Medium | Phase 1 first; warn on cutover |
| R8 | **Dual SO models** (`erp.ts` vs `mrp.ts`) | Medium | Delete legacy; API uses `mrp.ts` shape only |
| R9 | **Numbering collisions** multi-user | High | DB sequences with row lock |
| R10 | **Performance** — on-hand computed from full ledger scan | Medium | `stock_balances` cache + indexes; paginate ledger |
| R11 | **Offline / shop-floor latency** | Medium | Optimistic UI + queue (Phase 11); not in scope initially |
| R12 | **Team capacity** — serial phases on critical path | High | 2 backend + 1 frontend minimum for 7-month plan |

---

## 10. Estimated Effort

Assumes **2 backend developers + 1 frontend developer**, reusing existing UI components.

| Phase | Duration | Person-weeks | Cumulative |
|-------|----------|--------------|------------|
| 0 Platform | 3 weeks | 6 BE | 6 |
| 1 Masters | 2 weeks | 4 BE + 2 FE | 12 |
| 2 Engineering | 2 weeks | 4 BE + 2 FE | 18 |
| 3 Inventory | 2 weeks | 4 BE + 2 FE | 24 |
| 4 Sales + MRP | 3 weeks | 6 BE + 2 FE | 32 |
| 5 Purchase | 2 weeks | 4 BE + 1 FE | 37 |
| 6 Work Orders | 6 weeks | 12 BE + 4 FE | 53 |
| 7 Quality | 2 weeks | 4 BE + 1 FE | 58 |
| 8 Costing | 1 week | 2 BE | 60 |
| 9 Dispatch + Invoice | 2 weeks | 4 BE + 2 FE | 66 |
| 10 Cutover | 3 weeks | 3 BE + 6 FE | 75 |
| 11 Hardening | 4 weeks | 4 BE + 2 FE + 2 QA | 83 |

**Total: ~32 calendar weeks (~8 months)** · **~83 person-weeks**

### Accelerated track (3 BE + 2 FE + 1 QA)

Parallelize Phase 6 subdomains (WO header, materials, job cards): **~22–24 weeks (~6 months)**.

### Minimal viable backend (manufacturing only, no dispatch/invoice)

Phases 0–6 + partial 4: **~18–20 weeks** — matches desk pilot in readiness report.

---

## 11. Frontend API Layer Pattern

Replace persist stores incrementally:

```text
Before:  Component → useWorkOrderStore → localStorage
After:   Component → useWorkOrders() hook → fetch /api/v1/work-orders
                      ↳ TanStack Query cache
                      ↳ Optimistic updates on mutations
```

Shared package (optional): `@vasant-erp/types` — move `src/types/*` shared between web and API DTOs.

NestJS DTOs: `class-validator` mirrors Zod schemas already in master forms.

---

## 12. Testing Strategy

| Layer | Approach |
|-------|----------|
| Engines | Port existing `scripts/test-*.ts` to hit `localhost:3000/api` |
| API | Jest + Supertest per module |
| E2E | Playwright against React + real API |
| Parity | `simulate:go-live` becomes API integration test |
| Migration | Snapshot compare: localStorage export vs API export |

Existing test scripts to port (priority order):

1. `test:integrity` → inventory
2. `test:wo-flow` → work orders
3. `test:quality` → QC
4. `test:costing` → costing
5. `test:dispatch` → dispatch
6. `test:invoice` → invoice
7. `simulate:go-live` → full E2E

---

## 13. Recommended Repository Layout

```text
frontend/
├── apps/
│   ├── web/                 # Existing Vite React (move src here)
│   └── api/                 # NestJS
│       ├── src/
│       │   ├── modules/
│       │   │   ├── masters/
│       │   │   ├── inventory/
│       │   │   ├── mrp/
│       │   │   ├── purchase/
│       │   │   ├── work-orders/
│       │   │   ├── quality/
│       │   │   ├── costing/
│       │   │   ├── dispatch/
│       │   │   └── invoice/
│       │   ├── common/      # guards, filters, prisma
│       │   └── engines/     # ported from src/utils
│       └── prisma/
│           ├── schema.prisma
│           └── migrations/
├── packages/
│   └── types/               # Shared TS interfaces
└── scripts/
    ├── simulate-go-live-api.ts
    └── migrate-localstorage.ts
```

---

## 14. Decision Log (pre-implementation)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| ORM | Prisma | Team target; good NestJS integration |
| API style | REST v1 | Matches store action model; GraphQL optional later |
| File storage | S3-compatible | Dispatch photos, POD, invoice PDF |
| Auth | JWT + refresh | Standard for SPA |
| Multi-tenancy | Single plant first | Pune plant; extend later |
| Event sourcing | No | Document + ledger model sufficient |
| Real-time | Polling / SSE later | Job card updates not live today |

---

## 15. Success Criteria

Migration is complete when:

1. **Zero** transactional data in `localStorage` for production users.
2. `npm run simulate:go-live -- --api` passes 9/9 verifications against PostgreSQL.
3. All 7 existing test scripts pass against API.
4. ABC Cement SO-0001 lifecycle executable by factory roles (store keeper, planner, production, QC, dispatch, finance) via authenticated UI.
5. Audit log captures who posted every GRN, issue, FG receipt, dispatch, and invoice.

---

## 16. Out of Scope (this migration)

- Lead / Inquiry / Quotation commercial pipeline
- Mobile shop-floor app
- Multi-plant / inter-warehouse transfer rules
- SAP / Tally integration
- Advanced analytics warehouse

These remain frontend-only or future phases per [`ERP_GO_LIVE_READINESS.md`](./ERP_GO_LIVE_READINESS.md).

---

*Planning document only. No backend code has been implemented. Approve phase order and team allocation before Phase 0 kickoff.*
