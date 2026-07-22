# Phase 8A — Index & Executive Summary

**Audit date:** 2026-07-21  
**Nature:** Evidence / go-live readiness — **not** a feature build phase.  
**Pilot decision:** **READY WITH CONDITIONS** — see [`PHASE8A_PILOT_READINESS.md`](PHASE8A_PILOT_READINESS.md).

---

## Deliverables

| # | Document | Purpose |
|---|----------|---------|
| 1 | [`PHASE8A_REPOSITORY_MAP.md`](PHASE8A_REPOSITORY_MAP.md) | Runtime layout, entry points, dual-mode, legacy routes |
| 2 | [`PHASE8A_BASELINE_RESULTS.md`](PHASE8A_BASELINE_RESULTS.md) | Prisma / typecheck / build exit codes + classifications |
| 3 | [`PHASE8A_DATABASE_MIGRATION_AUDIT.md`](PHASE8A_DATABASE_MIGRATION_AUDIT.md) | Migrations, schema risks, `tenantId` / Decimal spot-checks |
| 4 | [`PHASE8A_MOCK_DEMO_AUDIT.md`](PHASE8A_MOCK_DEMO_AUDIT.md) | Demo vs API leakage (**16 P1** candidates) |
| 5 | [`PHASE8A_FEATURE_FLAG_MATRIX.md`](PHASE8A_FEATURE_FLAG_MATRIX.md) | `VITE_USE_API`, mfg accounting, MULTI_CURRENCY, FE-only flags |
| 6 | [`PHASE8A_FRONTEND_ROUTE_MATRIX.md`](PHASE8A_FRONTEND_ROUTE_MATRIX.md) | Mfg / Quality / Dispatch / Accounting routes |
| 7 | [`PHASE8A_PERMISSION_MATRIX_VERIFIED.md`](PHASE8A_PERMISSION_MATRIX_VERIFIED.md) | BE catalog vs FE hooks; FE-only namespaces |
| 8 | [`PHASE8A_VERIFIED_CAPABILITY_MATRIX.md`](PHASE8A_VERIFIED_CAPABILITY_MATRIX.md) | Capability classifications (evidence-oriented) |
| 9 | [`PHASE8A_DEFECT_REGISTER.md`](PHASE8A_DEFECT_REGISTER.md) | P0 / P1 register |
| 10 | [`PHASE8A_PILOT_READINESS.md`](PHASE8A_PILOT_READINESS.md) | Controlled-pilot decision + SOP boundaries |
| 11 | [`PHASE8A_PHASE8B_RECOMMENDATION.md`](PHASE8A_PHASE8B_RECOMMENDATION.md) | Remediation sequence |

---

## What was *not* fully executed in this pass

Per scope honesty (environment / time), these remain **recommended follow-on evidence** before expanding pilot scope:

- Full live E2E scenarios 1–8 on a dedicated audit tenant (SO → FG → dispatch → GL)
- Automated ledger reconciliation scripts under `scripts/audit/` (not created this pass)
- Live cross-tenant negative tests beyond existing finance/CRM test files
- Performance baseline with large synthetic datasets
- Production backup/restore proof for the host environment
- Concurrency / atomicity chaos tests

Absence of those runs is reflected in **READY WITH CONDITIONS**, not **READY**.

---

## Classification snapshot (high level)

| Area | Typical status |
|------|----------------|
| Finance setup, journals, Money In/Out, Bank core | VERIFIED_SHIPPED (narrow routes) |
| Period Close P1, GST extract P1, Bank connector 5D1 | PARTIAL / scaffold |
| Manufacturing masters + WO + shopfloor ops | VERIFIED_SHIPPED (API routes) |
| Materials issue | VERIFIED_SHIPPED conditional on stock |
| Quality queue / inspections | VERIFIED_SHIPPED conditional |
| Quality NCR / incoming / reports | DEMO_ONLY / BLOCKED_BY_DEPENDENCY |
| Dispatch pick/pack/challan | DEMO_ONLY / NOT_FOUND beyond confirm |
| Classic MRP | DEMO_ONLY |
| Manufacturing Accounting UI | MOCK_DATA_DEPENDENT; BE flag-gated off |
| Budgeting / Fixed Assets UI | DEMO_ONLY or unfinished |
| Inventory SPA | Demo-leaning; WO materials use inventory APIs |

---

## Baseline gate (exit codes)

See [`PHASE8A_BASELINE_RESULTS.md`](PHASE8A_BASELINE_RESULTS.md). Summary: Prisma generate **0**; validate / migrate status / BE+FE typecheck / FE build **non-zero** — classified as pre-existing or environment, not audit-introduced.
