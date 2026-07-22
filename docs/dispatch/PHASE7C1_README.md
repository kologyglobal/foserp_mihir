# Dispatch Phase 7C1 — Requirement, readiness & workbench

> Status: **shipped** — migration `20260721193000_dispatch_phase7c1_requirements` deployed; live suites pass (7C1 3/3, 7C0 5/5 regression).  
> Scope lock: **no** reservation redesign, pick list, packing, Delivery Challan, confirm/posting redesign, reverse after confirm, invoice/COGS, POD/e-Way, barcode/WMS.

## Why 7C1

Phase 7C0 landed SO fulfilment projection + DRAFT→CONFIRMED `FG_DISPATCH`. 7C1 adds an operational **Dispatch Requirement** projection, readiness evaluation, and a workbench that creates **DRAFT** outbound dispatches — without making Basic Confirm the primary workbench action.

## Compatibility (7C0)

| Rule | Behaviour |
|------|-----------|
| Confirm/post | Unchanged `postFgDispatchIssueMovement`; permission `dispatch.post` **or** `dispatch.basic_confirm` |
| Planning source | `BASIC_7C0` (legacy create) vs `WORKBENCH_7C1` (from-requirements) |
| Remaining qty | Still derived from **CONFIRMED** lines only — drafts do not reduce remaining |
| Quality on confirm | Still **not** gated on Basic Confirm (readiness surfaces blockers separately) |

See `PHASE7C0_COMPATIBILITY_AUDIT.md`.

## What shipped

| Piece | Detail |
|-------|--------|
| Schema | `DispatchRequirement` + planning fields on `OutboundDispatch` / lines |
| Sync | Rebuild requirements from confirmed SO lines + fulfilment position |
| Readiness | Priority statuses (hold / recon / fulfilled / draft / QC / production / stock / ready) |
| Availability | FG free qty via `resolveManufacturedProductItem` + warehouse quality-hold mapping |
| Draft create | `POST /dispatch/orders/from-requirements` — customer/ship-to compatibility, fingerprint conflict |
| Workbench FE | `/dispatch` + `/dispatch/workbench` in API mode |
| SO 360 | API fulfilment panel (no demo `dispatchStore` leakage) |
| Reports | `dispatch-readiness` joins FG readiness |
| Exceptions | Overdue / blocked / reconciliation requirement categories |
| Traceability | `DISPATCH_REQUIREMENT` search + lineage |

## API

Base: `/api/v1/t/:tenantSlug`

### Workbench / requirements

- `GET /dispatch/workbench/summary` — `dispatch.requirement.view`
- `GET /dispatch/requirements` — filters + tabs (`ready`, `waiting_*`, `overdue`, `blocked`, `all`)
- `POST /dispatch/requirements/synchronise` — `dispatch.requirement.synchronise`
- `GET /dispatch/requirements/:id` (+ `/readiness`, `/fulfilment`)
- `POST /dispatch/requirements/:id/hold` / `release-hold`
- `POST /dispatch/requirements/readiness-preview`
- `POST /dispatch/orders/from-requirements` — `dispatch.order.create` → DRAFT only

### CRM sales order

- `GET /crm/sales-orders/:id/fulfilment` — unchanged 7C0 projection
- `GET /crm/sales-orders/:id/fulfilment-summary` — readiness-enriched lines
- `GET /crm/sales-orders/:id/dispatch-requirements`
- `GET /crm/sales-orders/:id/dispatch-history`

### Outbound (7C0)

Unchanged paths under `/dispatch/outbound/*`. Confirm still posts stock.

## Code series

`DISPATCH_REQUIREMENT` → `DRQ-######`

## Permissions (additive)

`dispatch.requirement.*`, `dispatch.readiness.view`, `dispatch.fulfilment.view`, `dispatch.exceptions.view`, `dispatch.order.*`, `dispatch.basic_confirm`, `dispatch.legacy_7c0_use`

## Explicit non-goals (7C2+)

- Hard reservation / pick / pack / Delivery Challan
- Confirm/posting redesign with QC gate as primary path
- Reverse after confirm
- Invoice / e-Way / POD
- Lot/serial allocation
- Balance-level quality-hold buckets (uses warehouse mapping only)

## Tests

```bash
cd backend
npx tsx scripts/prisma-cli.ts migrate deploy
npx vitest run tests/dispatch-phase7c0.test.ts tests/dispatch-phase7c1.test.ts

cd ../frontend
npm run test:dispatch-phase7c0
npm run test:dispatch-phase7c1
```

Live suites **skip** when MySQL is down (`skipIf(!dbAvailable)`).

## Phase 7C2 readiness (assessment)

**READY WITH CONDITIONS**

| Condition | Note |
|-----------|------|
| Quality hold stock | Warehouse-role mapping only; `QualityReleaseService` still unwired |
| No lot/serial | Pick/pack design must decide allocation model |
| Confirm remains legacy | Do not promote Basic Confirm until QC/tracking/reverse hardened |

## Related

- `PHASE7C0_COMPATIBILITY_AUDIT.md`
- `DISPATCH_PHASE7C0_README.md`
- Inventory 3A / Manufacturing 7A FG receipts / Quality 4A–4B
