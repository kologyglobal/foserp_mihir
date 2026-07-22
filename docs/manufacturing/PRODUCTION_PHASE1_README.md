# Manufacturing Phase 1 — Setup Foundation

**Status:** Backend implemented and tested. Frontend setup screens (API-mode) shipped. **Production Orders and execution are explicitly out of scope for Phase 1** — this phase only covers manufacturing *setup/master data*: work centres, machines, BOMs, routings, and manufacturing profiles.

## Scope

Phase 1 delivers the foundational manufacturing configuration entities needed before any production execution work can begin:

- **Work Centres** — physical/logical production locations (capacity, cost rate, department).
- **Machines** — equipment belonging to a work centre, with an operational status lifecycle.
- **BOMs (Bill of Materials)** — versioned, multilevel (parent/child) component structures per finished item.
- **Routings** — versioned sequences of stage groups → operations → operation dependencies, describing *how* an item is produced.
- **Manufacturing Profiles** — per-item production configuration (production type, execution mode, default BOM/routing version, warehouses, tracking methods) with a readiness gate.

Explicitly **not** included: Production Orders, work order execution, material issue/consumption, WIP tracking, quality inspections, costing/variance — all deferred to a later phase.

## Data model

New Prisma models (all tenant-scoped, soft-deleted, UUID ids): `ManufacturingWorkCentre`, `ManufacturingMachine`, `ManufacturingBom`, `ManufacturingBomVersion`, `ManufacturingBomLine`, `ManufacturingRouting`, `ManufacturingRoutingVersion`, `ManufacturingStageGroup`, `ManufacturingRoutingOperation`, `ManufacturingOperationDependency`, `ManufacturingProfile`.

Migration: `backend/prisma/migrations/20260720140000_manufacturing_phase1_foundation/migration.sql`.

## API surface

Base path: `/api/v1/t/{tenantSlug}/manufacturing` (also available at `/api/v1/tenants/{tenantId}/manufacturing`).

| Resource | Endpoints |
|---|---|
| Work centres | `GET/POST /work-centres`, `GET/PATCH/DELETE /work-centres/:id`, `POST /work-centres/:id/activate`\|`deactivate` |
| Machines | `GET/POST /machines`, `GET/PATCH/DELETE /machines/:id`, `POST /machines/:id/activate`\|`deactivate`\|`status` |
| BOMs | `GET/POST /boms`, `GET /boms/:bomId`, `GET/POST /boms/:bomId/versions` |
| BOM versions | `GET/PATCH /bom-versions/:versionId`, `GET /bom-versions/:versionId/tree`, `POST /bom-versions/:versionId/lines`\|`validate`\|`activate`\|`revise`, `GET /bom-versions/:versionId/compare?from=&to=` |
| BOM lines | `PATCH/DELETE /bom-lines/:lineId` |
| Routings | `GET/POST /routings`, `GET/POST /routings/:routingId/versions` |
| Routing versions | `GET/PATCH /routing-versions/:versionId`, `POST /routing-versions/:versionId/stage-groups`\|`operations`\|`dependencies`\|`validate`\|`activate`\|`revise`, `GET /routing-versions/:versionId/compare?from=&to=` |
| Stage groups | `PATCH/DELETE /stages/:stageGroupId` |
| Operations | `PATCH/DELETE /operations/:operationId` |
| Dependencies | `DELETE /dependencies/:dependencyId` |
| Profiles | `GET/POST /profiles`, `GET/PATCH/DELETE /profiles/:id`, `POST /profiles/:id/activate`\|`deactivate`, `GET /profiles/:id/readiness` |

## Business rules

- **Draft-only edits.** Versions, lines, stage groups, operations, and dependencies can only be created/edited/deleted while their parent version is `DRAFT`. `ACTIVE` versions are immutable.
- **Activation.** Validates the version (line/operation counts, sequence uniqueness, dangling parent/stage refs, cycle scan), sets it `ACTIVE`, and transactionally supersedes any prior `ACTIVE` version for the same BOM/routing.
- **BOM cycle detection.** `parentLineId` chains are checked for cycles both on write (`assertNoTreeCycle`) and during validation (defense-in-depth scan).
- **Routing dependency cycle detection.** DFS cycle check on `predecessorOperationId → successorOperationId` edges; self-dependencies are rejected.
- **Machine/work-centre consistency.** An operation's `defaultMachineId` must belong to the same work centre as `workCentreId` when both are set.
- **Profile/BOM-routing consistency.** A profile's `defaultBomVersionId` must belong to a BOM with the same `productItemId`; `defaultRoutingVersionId`'s routing must match too (when the routing specifies a product).
- **Revision.** Cloning an existing version (any status) creates a new `DRAFT` version with an incremented version number, remapping all child line/stage/operation/dependency ids.
- **Comparison.** `GET .../compare?from=&to=` diffs two versions into added/removed/changed sets plus human-readable `summaries` (e.g. “quantity changed from 2 NOS to 3 NOS”).
- **Readiness gate.** `GET /profiles/:id/readiness` returns `{ ready, checks, missing[] }` — flags missing/inactive default BOM or routing version, missing production/WIP/finished-goods warehouses (WIP warehouse required only for `STOCKED_SEMI_FINISHED`/`BOTH` tracking).

## Phase 2 scaffolding note

Prisma already contains Production Order–related models and some backend folders under `work-orders/` / `demands/` exist for forward work. **They are not mounted on the Phase 1 manufacturing router and must not be treated as shipped.** Phase 2 starts only with explicit approval.

## Permissions

New permission keys added to `backend/src/constants/permissions.ts`:

```
manufacturing.setup.view
manufacturing.profile.view / manufacturing.profile.manage
manufacturing.work_centre.view / manufacturing.work_centre.manage
manufacturing.machine.view / manufacturing.machine.manage
```

Reused existing: `manufacturing.bom.view/create/edit/activate/deactivate`, `manufacturing.routes.view/create/edit/activate`.

Roles: `Production Manager` (unchanged, gets the full `production.*`/`manufacturing.*` set), plus two new roles:

- **Production Supervisor** — view-only across manufacturing setup (work centres, machines, BOMs, routings, profiles, work orders).
- **Production Engineer** — create/edit/activate on BOMs, routings, profiles, work centres, and machines (no execution permissions).

## Testing

`backend/tests/manufacturing-phase1.test.ts` (12 tests, all passing against a live MySQL dev database):

- Work centre CRUD + activate/deactivate + duplicate-code rejection.
- Machine creation under a work centre + status transitions + deactivate.
- Multilevel BOM build → tree fetch → validate → activate → immutability on the active version.
- Circular BOM line parent rejection.
- BOM revision (clone to new DRAFT) + version comparison.
- Routing stage groups + operations + dependencies → validate → activate.
- Circular routing operation dependency rejection.
- Manufacturing profile creation + readiness gate (missing → satisfied).
- 403 without the required permission; tenant isolation on BOM reads (404 across tenants).

Run: `npx vitest run tests/manufacturing-phase1.test.ts`.

## Seed fixtures

`backend/scripts/seed-manufacturing-fixtures.ts` seeds 5 idempotent reference configurations (Fabricated Bracket, Industrial Pump, Electrical Panel, Machined Component, Trailer) — each with a work centre, machine, finished item + component + raw material, an active-ready DRAFT BOM version (2-level), a DRAFT routing version (1 stage, 1 operation), and a manufacturing profile — for an existing tenant:

```bash
npx tsx scripts/seed-manufacturing-fixtures.ts <tenantSlug>
# or
TENANT_SLUG=<tenantSlug> npx tsx scripts/seed-manufacturing-fixtures.ts
```

Records are looked up/created by unique `code` within the tenant, so re-running is safe.

## Frontend (API mode)

Setup screens live under `frontend/src/modules/manufacturing/setup/` and only render live data when `VITE_USE_API=true` (they show an API-mode banner otherwise — no mock setup data is invented). The pre-existing demo BOM/Routing pages (`/manufacturing/bom`, `/manufacturing/routes`) are untouched and remain available in demo mode.

| Route | Page |
|---|---|
| `/manufacturing/setup` | `SetupHubPage` — hub cards linking to each setup area, notes Production Orders are Phase 2 |
| `/manufacturing/work-centres` | `WorkCentresSetupPage` — list, search, create/edit drawer, activate/deactivate |
| `/manufacturing/machines` | `MachinesSetupPage` — list, filter by work centre, create/edit drawer, status change, activate/deactivate |
| `/manufacturing/profiles` | `ProfilesSetupPage` — list, create drawer, readiness checklist, activate/deactivate |
| `/manufacturing/setup/boms` | `BomsSetupPage` — list, create (BOM + first DRAFT version) |
| `/manufacturing/setup/boms/:bomId` and `/manufacturing/setup/bom-versions/:versionId` | `BomVersionEditorPage` — version switcher, component tree, add/remove draft components, validate, activate, revise, human-readable compare |
| `/manufacturing/setup/routings` | `RoutingsSetupPage` — list, create (routing + first DRAFT version) |
| `/manufacturing/setup/routings/:routingId` and `/manufacturing/setup/routing-versions/:versionId` | `RoutingVersionEditorPage` — version switcher, stage/operation cards, add/remove draft stage/operation/dependency (cycle errors), validate, activate, revise, human-readable compare |

Supporting frontend files: `frontend/src/types/manufacturingSetup.ts` (DTO types), `frontend/src/services/api/manufacturingApi.ts` (API client functions), `frontend/src/utils/permissions/manufacturing.ts` (`useManufacturingSetupPermissions` hook), `frontend/src/modules/manufacturing/setup/ManufacturingSetupShell.tsx` (shared shell + sub-nav), `frontend/src/modules/manufacturing/setup/useSetupLookups.ts` (master data lookups for selects).

Smoke test: `npm run test:manufacturing-setup` (`frontend/scripts/test-manufacturing-setup-smoke.ts`) verifies file existence, route registration, and navigation wiring.
