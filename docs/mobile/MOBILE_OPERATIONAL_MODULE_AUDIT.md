# Mobile Operational Module Audit

> **Phase 1 complete** — shared navigation + permission foundation (2026-08-05).  
> **Purchase approvals live** (list / detail / act) on native Expo. Quality / Store / Gate writes still deferred.  
> Permission source of truth: `backend/src/constants/permissions.ts` + `requirePermission` / `requireAnyPermission` on routes.

## Phase 1 scope (done)

| Area | Status |
|------|--------|
| Auth profile | `GET /auth/me` → permissions, roles (roles **not** used for ACL) |
| Modules | `GET /t/:slug/modules` → enabled flags |
| Permission helpers | `mobile/src/auth/permissions.ts` (`can` / `canAny` / `canAll`) |
| Module helpers | `mobile/src/auth/modules.ts` (`isModuleEnabled`) |
| Navigation catalogue | `mobile/src/auth/navigationCatalog.ts` + `canAccessNavigationEntry` |
| Shared tabs | **Home · Work · Approvals · More** (not fixed module tabs) |
| Home / More | Catalog-filtered tiles only |
| Work / Approvals | CRM + **live purchase approval rows** (independent fetch) |
| Purchase approvals | `mobile/app/(app)/purchase/approvals/*` live API |
| Other ops child routes | May still be **Coming soon** stubs |
| Unit tests | `verify-navigation-catalog` + `verify-purchase-approvals` in `npm run test:unit` |

## Summary by module

| Module | Native Phase 1 | Existing Web reference | APIs available | Key permissions | Later phase |
|--------|----------------|------------------------|----------------|-----------------|-------------|
| **CRM** | Full screens under `mobile/app/(app)/crm/*` | `/m/crm/*` | CRM REST suite | `crm.*` | Keep; do not break |
| **Purchase** | Hub + **approvals live**; PO/GRN routes may still stub | `/m/approvals`, `/m/grn/*` | `/purchase/approvals`, PR/PO approve\|reject, GRN tolerance | `purchase.pr.*`, `purchase.po.*`, `purchase.grn.*` | Full GRN receive UI later |
| **Quality** | Hub + QC queue + inspection detail (photos + decide) | `/m/qc/*` | `/quality/kiosk/*`, `/quality/inspections/*` | `quality.view`, `quality.submit`, `manufacturing.quality.inspect` | Production-ready photo upload + PASS gate |
| **Store** | Hub + **material issue live** (return/stock still stubs) | `/m/material-issue` etc. | WO materials + `/inventory/*` | `manufacturing.materials.*`, `inventory.*` | Return / stock next |
| **Gate** | Hub + Coming soon in/out/vehicles | `/m/gate/*` | `/gate/*` | `gate.vehicle.*`, `gate.approval.*` | Phase 5 (or earlier if priority) |

## Module catalog keys (`TenantModuleFlag` / `module-catalog.ts`)

`masters`, `crm`, `purchase`, `inventory`, `manufacturing`, `quality`, `maintenance`, `dispatch`, `accounting`, `logistics`, `gate`, `reports`, `knowledge`, `hrms`

**Hard `requireModule` on backend:** `purchase`, `manufacturing`, `maintenance`, `hrms`, `knowledge` (and others as wired).  
**Often RBAC-only (no module middleware):** `quality`, `gate`, inventory subsets.

Native UI still **fail-closed on permissions** and hides when module flag is disabled.

## Permission codes used by mobile ops catalogue (exact)

### Purchase
- Hub: `purchase.view` \| `purchase.pr.view` \| `purchase.po.view` \| `purchase.pr.approve` \| `purchase.po.approve` \| `purchase.grn.view` \| `purchase.grn.create`
- Approvals list: `purchase.pr.approve` \| `purchase.po.approve` \| `purchase.pr.view` \| `purchase.po.view`
- Approve act: `purchase.pr.approve` / `purchase.po.approve` / GRN `purchase.grn.post` \| `purchase.po.approve`
- Reject act: PR route `purchase.pr.reject`; PO `purchase.po.approve`; GRN same as approve-tolerance
- PO list: `purchase.po.view`
- GRN: `purchase.grn.view` \| `purchase.grn.create` \| `purchase.grn.post`

### Quality
- Hub: `quality.view` \| `quality.incoming.view` \| `purchase.qi.view` \| `manufacturing.quality.view` \| `manufacturing.quality.inspect`
- Queue: same view family
- Decide (later): `quality.submit` \| `manufacturing.quality.inspect`

### Store / inventory + materials
- Hub: `manufacturing.materials.view` \| `.issue` \| `.return` \| `inventory.stock.view` \| `inventory.view` \| `inventory.stock_count.view` \| `manufacturing.store_workbench.view`
- Issue: `manufacturing.materials.issue` (+ module `manufacturing`)
- Return: `manufacturing.materials.return`
- Stock: `inventory.stock.view` \| `inventory.view`
- Count: `inventory.stock_count.view` \| `.create` \| `.count`
- Transfer: `inventory.transfers.view` \| `.create`

### Gate
- Hub: `gate.dashboard.view` \| `gate.register.view` \| `gate.vehicle.view` \| `gate.material_inward.view` \| `gate.material_outward.view` \| `gate.approval.view`
- Gate-in: `gate.vehicle.entry` \| `gate.vehicle.create` \| `gate.material_inward.create`
- Gate-out: `gate.vehicle.exit` \| `gate.material_outward.release`
- Approvals: `gate.approval.view` \| `gate.approval.action`

### CRM (unchanged)
- Leads/opps/quotes/SO/follow-ups/search/business card as in catalogue (`crm.*`, collection uses `finance.ar.view`)

## API path patterns (tenant form) — planned for later phases

```text
GET  /api/v1/t/:slug/purchase/approvals?tab=pending_mine
POST /api/v1/t/:slug/purchase/requisitions/:id/approve|reject
POST /api/v1/t/:slug/purchase/orders/:id/approve|reject
GET|POST /api/v1/t/:slug/purchase/grns…
GET  /api/v1/t/:slug/quality/kiosk/queue
POST /api/v1/t/:slug/quality/kiosk/inspections/:id/decide
POST …/materials/issue   (body.idempotencyKey required)
GET  /api/v1/t/:slug/inventory/balances
GET  /api/v1/t/:slug/gate/vehicles
POST …/gate/approvals/:id/approve|reject
```

## Native architecture (Phase 1)

```text
Login → session restore
  → GET /auth/me (+ permissions)
  → GET /t/:slug/modules
  → navigationCatalog.canAccessNavigationEntry(module ∧ anyOf/allOf)
  → Home / Work / Approvals / More shells
CRM stack remains under /(app)/crm/*
Ops modules: /(app)/purchase|quality|store|gate hubs + Coming soon children
```

## Web reference only

Do **not** port `frontend/src/modules/mobile/*` components or demo Zustand stores into Expo.
