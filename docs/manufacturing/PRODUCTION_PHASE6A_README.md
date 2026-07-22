# Manufacturing Phase 6A — Production Planning Workbench

**Status:** Shipped (2026-07-20)  
**Depends on:** Demands / WO factory (2A), materials readiness Inventory 3A, BOM profiles  
**Prerequisite acceptance:** Phase 5C depth limits (split / no cascade / no mfg GL) — see `PRODUCTION_PHASE5C_README.md`

## What this is

A **plan + FG netting + draft WO generation** workbench — **not** classic MRP II, CRP, finite scheduling, costing, or manufacturing GL.

## Principle

1. Plans batch finished-good demand into a header (`PP-`) with lines.
2. **Netting** uses Inventory free qty + open WO remaining qty; single-level BOM component shortage preview (BUY/MAKE visibility only).
3. **Generate work orders** creates `ProductionDemand` (`PRODUCTION_PLAN`) + draft `ProductionOrder` via existing factory.
4. Physical stock / reservation / issue remain on WO materials (3C) after release — planning does not post stock.

## API

Base: `/api/v1/t/:tenantSlug/manufacturing/plans`

| Method | Path | Permission |
|--------|------|------------|
| GET | `/` | `production_plan.view` |
| POST | `/` | `production_plan.create` |
| GET/PATCH | `/:id` | view / edit (draft) |
| POST | `/:id/release` | `production_plan.release` |
| POST | `/:id/preview-netting` | `production_plan.view` |
| POST | `/:id/generate-work-orders` | `production_plan.create_work_order` |
| POST | `/:id/close` | `production_plan.close` |
| POST | `/:id/cancel` | `production_plan.edit` |

Lifecycle: `DRAFT` → `PLANNED` → `WORK_ORDERS_CREATED` → `CLOSED` (or `CANCELLED` before WOs).

## Frontend

- Existing `/manufacturing/production-plan` (+ new / detail) dual-mode via `manufacturingService` + API mapper.
- Demo seed unchanged when `VITE_USE_API=false`.

## Tests

```bash
cd backend && npx tsx scripts/prisma-cli.ts migrate deploy && npx prisma generate
npx vitest run tests/manufacturing-phase6a.test.ts
cd ../frontend && npm run test:manufacturing-phase6a
```

## Deferred (explicit)

| Out of scope | Notes |
|--------------|--------|
| Regenerating MRP / pegging trees / time buckets | DB design deferred |
| Finite scheduling / CRP / capacity calendars | — |
| Multi-level recursive MAKE explosion | Single-level BOM preview only |
| Costing / WIP valuation / manufacturing GL | Phase 6B+ + feature flag |
| Plan-level shortage → PR auto-create | Use WO materials → PR after release |
| Unifying legacy `/mrp/*` demo SPA | Documented separate |
| WO merge / cascade reverse / split feature | Accepted 5C limits |
