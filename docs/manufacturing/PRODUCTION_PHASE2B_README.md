# Manufacturing Phase 2B — Daily Production, My Work, Assignments & Issues

**Status:** Full stack (API + DB + UI + permissions + tenant isolation + tests) — 2026-07-20.

**Depends on:** Phase 1 masters + Phase 2A Work Orders / Stage Ledger / Progress Service.

## Product goal

Make daily production recording easy for supervisors and operators using **one** Production transaction path:

Supervisor assigns work → Operator sees My Work → Start / Pause / Report Problem / Complete  
**or** Supervisor opens Daily Production Update → multi-order shift submit

Both paths post through the Phase 2A **Production Progress Service** (`recordProgress` / `correctProgress`) and Stage Ledger. There are not two disconnected production systems.

## Scope included

- Daily Production batch (draft → atomic submit → immutable)
- Daily Production lines with idempotency
- Operator / machine assignment + reassignment history
- Operator My Work (mobile/tablet-first)
- Task start / pause / resume / complete (Good / Rework / Reject / Scrap)
- Quick issue reporting (informational — no PR / Maintenance WO / QC created)
- Basic downtime start/end (task-scoped; overlapping open downtime prevented)
- Supervisor issue queue
- Today / Control Room / Work Order detail enhancements
- Permissions, tests, documentation

## Explicitly out of scope

- Inventory availability, reservation, issue, return, physical WIP, FG receipt
- Purchase Requisition / RFQ / PO
- Quality inspection / NCR
- Rework Production Order, maintenance Work Order, subcontracting
- Finite scheduling, labour/machine costing, WIP valuation, GL, OEE

Issue types such as MATERIAL_SHORTAGE / MACHINE_BREAKDOWN / QUALITY_HOLD are **informational** in Phase 2B. Optional future reference IDs may be stored; no cross-module transactions are created.

## Operating modes

Reuses Manufacturing Profile execution mode:

| Mode | Behaviour |
|------|-----------|
| **SIMPLE** | Stage-level assign/update; operation/machine optional; supervisor bulk Daily Update; no mandatory job cards |
| **DETAILED** | Operation + operator + machine; start/pause/resume/complete with actual times; progress rolls into Stage totals |

## Soft references (temporary)

| Field | Reason |
|-------|--------|
| `shiftCode` / `shiftLabel` | No HR Shift master — migrate to `shiftId` FK later |
| `employeeId` / `reportedByEmployeeId` | No Employee master — operator identity is `userId` (User) |

## Data model

Migration: `backend/prisma/migrations/20260720160000_manufacturing_phase2b_daily_ops/migration.sql`

| Model | Purpose |
|-------|---------|
| `ProductionAssignment` | Operator/machine assign to Stage (optional Operation); status lifecycle; history via cancel + reassign chain |
| `DailyProductionBatch` | Supervisor draft/submitted shift batch |
| `DailyProductionLine` | Line quantities; `idempotencyKey`; `resultingLedgerTransactionId` |
| `ProductionIssue` | Shopfloor issues with acknowledge/resolve |
| `ProductionDowntime` | Basic downtime intervals (`TASK` / `MACHINE` / `WORK_ORDER` scope) |

Stage/Operation denormalised: `assignedUserId`, `assignedMachineId`, `activeAssignmentCount`, `openIssueCount`, `pausedAt`, `totalDowntimeMinutes`.

Code series: `DAILY_PRODUCTION_BATCH` → `DP-`, `PRODUCTION_ISSUE` → `PI-`.

No separate `ProductionTaskEvent` model — events use extended `ProductionActivityType`.

## Central services

| Service | Responsibility |
|---------|----------------|
| Phase 2A `recordProgress` / `correctProgress` | Quantity validation, Stage Ledger, WO/stage totals, readiness, health |
| `ProductionAssignmentService` | Assign/reassign/cancel/lifecycle; machine status coordination |
| `DailyProductionService` | Draft batch; atomic submit (optional `tx` on progress); correction |
| `ProductionIssueService` | Issue lifecycle; blocking impact; activity |
| Downtime helpers | Start/end; no overlapping open downtime per assignment |

## API surface

Base: `/api/v1/t/{tenantSlug}/manufacturing`

| Area | Endpoints |
|------|-----------|
| Assignments | `POST/GET /assignments`, lifecycle `/:id/{accept,start,pause,resume,complete,reassign,cancel}`, `GET /:id/history`, `GET /work-orders/:id/assignments` |
| My Work | `GET /my-work` (own assignments; `?userId=` only with `assignment.view`) |
| Daily Production | `GET/POST /daily-production`, `PATCH /:id`, lines CRUD, `validate`, `submit`, line `correct` |
| Issues | `GET/POST /issues`, `/:id/{acknowledge,in-progress,resolve,cancel}` |

Swagger tags: Production Assignments, Daily Production, Production Issues, My Work.

## Permissions

```
manufacturing.daily_production.view|create|submit|correct
manufacturing.assignment.view|manage|reassign
manufacturing.operator.my_work|start|pause|complete
manufacturing.issue.view|report|acknowledge|resolve
manufacturing.downtime.view|manage
```

Roles: **Production Manager** (full manufacturing set); **Production Supervisor** (daily + assign + issues + downtime); **Production Operator** (My Work + start/pause/complete + report issue); **Production Engineer** (view assignments/issues/daily).

## Frontend routes

| Route | Audience |
|-------|----------|
| `/manufacturing/daily-update` | Supervisor |
| `/manufacturing/my-work` | Operator (mobile-first) |
| `/manufacturing/issues` | Supervisor queue |
| Existing Today / Control Room / Work Order detail | Enhanced |

Operator strings use `t('key')` via `frontend/src/modules/manufacturing/i18n/operatorStrings.ts` (English map; Hindi/Gujarati-ready keys).

## Issue / downtime rules

- Local blocking issue → may pause assignment; Stage can show issue indicator / BLOCKED; Work Order health may become BLOCKED
- Does **not** automatically set Work Order `ON_HOLD` for every issue
- Downtime is primarily **task** scoped; machine/WO scopes available; OEE not calculated

## Correction

Submitted daily lines and completed task quantities are immutable. Authorised correction uses progress correction (reversal + new ledger entry); original retained; batch may become `PARTIALLY_REVERSED`.

## Testing

| Suite | Result |
|-------|--------|
| `tests/manufacturing-phase2b.test.ts` | 8/8 |
| Phase 1 + 2A regression | 12 + 11 = 23 |
| `npm run test:manufacturing-phase2b` (FE smoke) | See package script |

## Guides

- [OPERATOR_UX_GUIDE.md](./OPERATOR_UX_GUIDE.md)
- [DAILY_PRODUCTION_WORKFLOW.md](./DAILY_PRODUCTION_WORKFLOW.md)

## Next phase

**PHASE 3 — Inventory, Store and Purchase Integration** (do not start until approved): material requirements, availability, reservation, issue/return, shortages → PR, WIP/SFG/FG receipts.
