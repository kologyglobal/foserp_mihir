# Production — Permission Matrix

> Implemented through Phase 2B. Catalog in `backend/src/constants/permissions.ts`. Backend `requirePermission` enforced on manufacturing routes.

## Phase 2B keys (shipped)

`manufacturing.daily_production.view|create|submit|correct`  
`manufacturing.assignment.view|manage|reassign`  
`manufacturing.operator.my_work|start|pause|complete`  
`manufacturing.issue.view|report|acknowledge|resolve`  
`manufacturing.downtime.view|manage`

Roles: Production Manager (full set), Supervisor (daily + assign + issues), Operator (My Work + report), Engineer (view).

---

## 1. Existing catalog (evidence)

Already seeded (~401–430):

- Legacy: `production.view|create|edit|submit|approve|release|post|cancel|close|print|export|override`
- Manufacturing: `manufacturing.view`, `dashboard.view`, `bom.*`, `production_plan.*`, `work_orders.*`, `materials.*`, `production.complete*`, `quality.*`, `scrap.*`, `rework.*`, `cost.*`, `job_work.*`, `reports.*`, `settings.*`, `routes.*`

FE soft-gate: `frontend/src/utils/permissions/manufacturing.ts` (accepts `production.view` as alias for `manufacturing.view`).

**Gap:** No HTTP handlers enforce these for manufacturing resources yet.

---

## 2. Proposed permission set

Prefer **mapping onto existing `manufacturing.*` keys**. Add only where missing.

| Proposed (Phase 0 intent) | Map to existing / new |
|---------------------------|------------------------|
| production.view | `manufacturing.view` (+ alias `production.view`) |
| production.create | `manufacturing.work_orders.create` |
| production.edit_draft | `manufacturing.work_orders.edit` |
| production.release | `manufacturing.work_orders` + add `manufacturing.work_orders.release` if absent |
| production.start | `manufacturing.work_orders.start` |
| production.update | `manufacturing.work_orders.start` or new `manufacturing.operator.execute` |
| production.hold | `manufacturing.work_orders.hold` |
| production.complete | `manufacturing.production.complete` |
| production.close | `manufacturing.work_orders.close` |
| production.cancel | `manufacturing.work_orders.cancel` |
| production.assign | **New** `manufacturing.work_orders.assign` |
| production.operator.execute | **New** `manufacturing.operator.execute` |
| production.material.view | `manufacturing.materials.view` |
| production.material.issue | `manufacturing.materials.issue` |
| production.material.return | `manufacturing.materials.return` |
| production.material.transfer | **New** `manufacturing.materials.transfer` |
| production.wip.move | **New** `manufacturing.wip.move` |
| production.runtime_change.request | **New** `manufacturing.runtime_change.request` |
| production.runtime_change.approve | **New** `manufacturing.runtime_change.approve` |
| production.split | **New** `manufacturing.work_orders.split` |
| production.bom.view / manage | `manufacturing.bom.view` / create+edit+activate |
| production.routing.view / manage | `manufacturing.routes.*` |
| production.quality.view | `manufacturing.quality.view` |
| production.reports.view | `manufacturing.reports.view` |

---

## 3. Role mapping

| Permission area | Production Manager | Supervisor | Operator | Store | Quality | Purchase | Maintenance | Admin |
|-----------------|--------------------|------------|----------|-------|---------|----------|-------------|-------|
| view / reports / dashboard | ✓ | ✓ | limited my-work | materials view | quality view | shortage view | issue view | ✓ |
| BOM / routing manage | ✓ | read | — | — | — | — | — | ✓ |
| create / edit draft / release | ✓ | create+edit | — | — | — | — | — | ✓ |
| start / hold / resume / daily update | ✓ | ✓ | execute only | — | — | — | — | ✓ |
| complete / close / cancel / split | ✓ | complete+hold | complete own | — | — | — | — | ✓ |
| assign | ✓ | ✓ | — | — | — | — | — | ✓ |
| materials reserve/issue/return | ✓ | request | — | ✓ issue/return | — | — | — | ✓ |
| WIP move | ✓ | ✓ | — | ✓ assist | — | — | — | ✓ |
| runtime request | ✓ | ✓ | — | — | — | — | — | ✓ |
| runtime approve | ✓ | — | — | — | — | — | — | ✓ |
| quality inspect | view | view | — | — | ✓ | — | — | ✓ |
| job work | ✓ | view+receive | — | — | — | vendor link | — | ✓ |
| settings | ✓ | — | — | — | — | — | — | ✓ |

Seed roles: extend `ROLE_PERMISSIONS` in `permissions.ts` + `prisma/seed.ts` (Production Manager / Supervisor / Operator as system or tenant roles).

---

## 4. Frontend visibility

| UI | Gate |
|----|------|
| Nav Manufacturing | `manufacturing.view` |
| Create WO | `work_orders.create` |
| Release / Close | matching lifecycle perms |
| Operator My Work | `operator.execute` |
| Issue materials button | `materials.issue` (Store or Supervisor) |
| Approve runtime change | `runtime_change.approve` |
| Settings | `settings.manage` |

Hide disabled actions; do not only grey out without permission check.

---

## 5. Backend enforcement

Every manufacturing route: `requirePermission(...)`.  
Tenant isolation via `tenantId` from middleware — never from body.  
Operator endpoints must also assert assignment (user = assignee) unless supervisor override permission.

---

## 6. Dual alias policy

Keep accepting **`production.*`** as aliases for view-level checks during transition (FE already does for view). New code and docs prefer **`manufacturing.*`**.
