# Production — API Plan (Proposal Only)

> Phase 1–2B **implemented**. Canonical docs: `docs/manufacturing/PRODUCTION_PHASE2B_README.md`.  
> Mount: `backend/src/modules/manufacturing/` under `/api/v1/t/:tenantSlug/manufacturing/…`

Phase 2B routes: `/assignments`, `/my-work`, `/daily-production`, `/issues` (plus Phase 2A WO/today/control-room).

---

## 1. Conventions

| Concern | Pattern |
|---------|---------|
| Auth | `authenticate` → `attachRequestContext` → `resolveTenant` → `requireTenantAccess` |
| Permission | `requirePermission('manufacturing.*')` |
| Body/query/params | Zod via `validateBody` / `validateQuery` / `validateParams` |
| IDs | UUID |
| Quantities | Decimal strings in JSON |
| Idempotency | Header `Idempotency-Key` on mutations that post/update qty |
| Errors | `ValidationError`, `NotFoundError`, `ConflictError`, `InvalidStateError` |
| Pagination | `sendPaginated` |

---

## 2. Capability groups

### 2.1 Manufacturing Profiles

| Method | Route | Permission | Notes |
|--------|-------|------------|-------|
| GET | `/manufacturing/profiles` | `manufacturing.bom.view` or `manufacturing.view` | Filter by item/type |
| POST | `/manufacturing/profiles` | `manufacturing.bom.manage` | Draft |
| GET/PATCH | `/manufacturing/profiles/:id` | view / manage | |
| POST | `/manufacturing/profiles/:id/activate` | manage | Explicit lifecycle |

**Transaction:** Single write. **Idempotency:** Optional.  
**Errors:** Duplicate code; finished item blocked.

### 2.2 BOM

| Method | Route | Permission |
|--------|-------|------------|
| GET/POST | `/manufacturing/boms` | bom.view / bom.manage |
| GET/PATCH | `/manufacturing/boms/:id` | |
| POST | `/manufacturing/boms/:id/versions` | manage |
| POST | `/manufacturing/boms/:id/activate` | `manufacturing.bom.activate` |
| GET | `/manufacturing/boms/:id/where-used` | view |

**Cross-module:** MasterItem, MasterUom, Warehouse.  
**Errors:** Circular BOM; inactive component; UOM mismatch.

### 2.3 Routing

| Method | Route | Permission |
|--------|-------|------------|
| CRUD | `/manufacturing/routings` | `manufacturing.routes.*` |
| | `/manufacturing/routings/:id/operations` | |
| | `/manufacturing/routings/:id/dependencies` | |
| POST | `/activate` | `manufacturing.routes.activate` |

**Errors:** Circular dependency; missing work centre; QC flag without plan ref (warning or hard by settings).

### 2.4 Work Centres / Machines

| Method | Route | Permission |
|--------|-------|------------|
| CRUD | `/manufacturing/work-centres` | settings or dedicated WC perms (map to `manufacturing.settings.manage` until split) |
| CRUD | `/manufacturing/machines` | same (Phase 1 optional) |

### 2.5 Production Orders (Work Orders)

| Method | Route | Permission | TX / Idempotency |
|--------|-------|------------|------------------|
| GET | `/manufacturing/work-orders` | `manufacturing.work_orders.view` | |
| POST | `/manufacturing/work-orders` | create | Optional key |
| GET/PATCH | `/manufacturing/work-orders/:id` | view / edit (draft only) | |
| POST | `/…/release` | release | **TX** snapshot; key |
| POST | `/…/start` | start | |
| POST | `/…/hold` | hold | |
| POST | `/…/resume` | start | |
| POST | `/…/complete` | `manufacturing.production.complete` | **TX**; key |
| POST | `/…/close` | close | **TX** |
| POST | `/…/cancel` | cancel | |
| POST | `/manufacturing/demands/from-sales-order` | create | **TX**; key — convert SO qty |

**Request (create):** sourceType, finishedItemId, qty, dates, salesOrderId?, salesOrderLineId?, warehouseId, notes.  
**Response:** WO DTO + materials preview + operations snapshot (if released).

**Errors:** SO not confirmed; over-conversion; no active BOM/routing; InvalidState.

**Service owner:** `production-order.service.ts`  
**Cross-module:** CRM SO read; Inventory availability (when exists); Quality blockers.

### 2.6 Production execution / Daily Production

| Method | Route | Permission | TX / Idempotency |
|--------|-------|------------|------------------|
| POST | `/work-orders/:id/updates` | `manufacturing.work_orders.start` or operator.execute | **TX**; **required** Idempotency-Key |
| GET | `/work-orders/:id/updates` | view | |
| GET | `/manufacturing/today` | view | Supervisor board |
| GET | `/manufacturing/operator/my-work` | operator.execute | |

**Request:** operationId/stageId, goodQty, reworkQty, rejectQty, scrapQty, notes, downtimeMinutes?  
**Errors:** Negative WIP; qty exceeds open balance; QC hold; stale version.

### 2.7 Materials

| Method | Route | Permission | Dependency |
|--------|-------|------------|------------|
| GET | `/work-orders/:id/materials` | materials.view | |
| POST | `/…/materials/reserve` | materials.reserve | Inventory |
| POST | `/…/materials/issue` | materials.issue | Inventory **TX** |
| POST | `/…/materials/return` | materials.return | Inventory **TX** |
| POST | `/…/materials/shortage-requisition` | materials.create_requirement | Purchase PR |

Until Inventory/Purchase backends exist: return `501` / feature-not-ready **or** Phase-gate these routes to Phase 3.

### 2.8 WIP

| Method | Route | Permission |
|--------|-------|------------|
| POST | `/work-orders/:id/wip-movements` | wip.move |
| POST | `/work-orders/:id/transfer-to/:targetId` | materials.transfer |

Physical post via Inventory when available.

### 2.9 Runtime changes / Issues

| Method | Route | Permission |
|--------|-------|------------|
| POST | `/…/runtime-changes` | runtime_change.request |
| POST | `/…/runtime-changes/:id/approve` | runtime_change.approve |
| POST | `/…/issues` | work_orders.hold or edit |
| POST | `/…/split` | split |

### 2.10 Quality links

| Method | Route | Permission |
|--------|-------|------------|
| POST | `/…/quality-requests` | quality.view |
| GET | `/…/quality-blockers` | quality.view |

Creates Quality inspection via interface; does not embed QC engine.

### 2.11 Subcontracting

| Method | Route | Permission |
|--------|-------|------------|
| CRUD lifecycle | `/manufacturing/job-work` | `manufacturing.job_work.*` |

Links Vendor; optional Purchase docs later.

### 2.12 Dashboard / Reports

| Method | Route | Permission |
|--------|-------|------------|
| GET | `/manufacturing/control-room` | dashboard.view |
| GET | `/manufacturing/reports/:reportId` | reports.view |
| GET | `/manufacturing/reports/:reportId/export` | reports.export |

### 2.13 Settings

| Method | Route | Permission |
|--------|-------|------------|
| GET/PUT | `/manufacturing/settings` | settings.view / manage |

Flags: quickMode, autoConsumption, advancedMode, requireQcBeforeFg, etc.

---

## 3. Cross-module call map

```text
manufacturing → crm/sales-orders (read, convert remaining)
manufacturing → masters/items|uom|warehouses (read)
manufacturing → inventory (reserve/issue/return/FG)     [Phase 3+]
manufacturing → purchase/requisitions (create)          [Phase 3+]
manufacturing → quality/inspections (create/read)       [Phase 4+]
manufacturing → accounting events (write only)          [flagged]
```

---

## 4. Error catalogue (common)

| Code / class | When |
|--------------|------|
| `VALIDATION_ERROR` | Zod / business field |
| `NOT_FOUND` | WO/BOM missing for tenant |
| `CONFLICT` | Duplicate idempotency payload mismatch; unique code |
| `INVALID_STATE` | Wrong lifecycle transition |
| `TENANT_MISMATCH` | Cross-tenant FK |
| `FORBIDDEN` | Permission |
| `QC_HOLD` | Blocked by quality |
| `INSUFFICIENT_STOCK` | Inventory |
| `OVER_CONVERSION` | SO remaining |

---

## 5. Permission mapping note

Existing catalog already has rich `manufacturing.*` and legacy `production.*` (`permissions.ts` ~401–430). Phase 1 should **enforce existing keys** and add only missing ones (see `PRODUCTION_PERMISSION_MATRIX.md`) rather than renaming wholesale.
