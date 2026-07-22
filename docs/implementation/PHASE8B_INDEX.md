# Phase 8B — Index

**Started:** 2026-07-21  
**Input decision (8A):** READY WITH CONDITIONS  
**Output decision (8B→8C):** **READY WITH CONDITIONS for internal UAT** — see [`PHASE8B_PHASE8C_READINESS.md`](PHASE8B_PHASE8C_READINESS.md)

Phase 8B prepares a **controlled pilot / internal UAT** tenant. It does **not** execute production cutover.

---

## Deliverables

| Doc | Purpose |
|-----|---------|
| [`PHASE8B_REMEDIATION_REGISTER.md`](PHASE8B_REMEDIATION_REGISTER.md) | P0/P1 burn-down + ACCEPTED_OUTSIDE_PILOT |
| [`PHASE8B_PILOT_SCOPE.md`](PHASE8B_PILOT_SCOPE.md) | Frozen scope, routes, exclusions, roles |
| [`PHASE8B_FEATURE_FLAG_PLAN.md`](PHASE8B_FEATURE_FLAG_PLAN.md) | Pilot flag states |
| [`PHASE8B_MANUAL_CONTROLS.md`](PHASE8B_MANUAL_CONTROLS.md) | Controls for each accepted limitation |
| [`PHASE8B_SOP_INDEX.md`](PHASE8B_SOP_INDEX.md) + [`sops/`](sops/) | Operator/supervisor SOPs + prohibited actions |
| [`PHASE8B_UAT_PACK.md`](PHASE8B_UAT_PACK.md) | UAT cases (N/A for excluded flows) |
| [`PHASE8B_CUTOVER_DRAFT.md`](PHASE8B_CUTOVER_DRAFT.md) | Prepare-only cutover (no go-live date) |
| [`PHASE8B_TECHNICAL_READINESS.md`](PHASE8B_TECHNICAL_READINESS.md) | Host/ops checklist |
| [`PHASE8B_DATA_TEMPLATES_README.md`](PHASE8B_DATA_TEMPLATES_README.md) + [`templates/`](templates/) | CSV stubs |
| [`PHASE8B_READINESS_CHECKLIST.md`](PHASE8B_READINESS_CHECKLIST.md) | Implementation checklist |
| [`PHASE8B_PHASE8C_READINESS.md`](PHASE8B_PHASE8C_READINESS.md) | Gate into formal UAT |

Upstream audit: [`docs/audit/PHASE8A_INDEX.md`](../audit/PHASE8A_INDEX.md)

---

## Wave 0 engineering (this session)

| Item | Status |
|------|--------|
| Prisma validate (`prisma-cli validate`) | **exit 0** — 8B-R-001 CLOSED |
| `finance.tax.view` / `extract` in catalog + FE | CLOSED |
| Manufacturing Accounting API-mode gate (no seed KPIs) | CLOSED |
| Nav demote MRP / Budgeting / scan | Done |
| Backend typecheck | **3** FA disposal errors remain |
| Frontend typecheck | **~26** remain (dispatch/quality/store/WO) |
| Migration drift | Still OPEN — document on pilot DB |

---

## What Phase 8C needs next

1. Confirm migrate status on **UAT DB** (no force-reset).  
2. Finish typecheck or waive FA/dispatch with explicit CI exemptions.  
3. Seed pilot tenant from templates + opening stock dry-run.  
4. Execute UAT pack on frozen SOP routes.  
5. Client sign-off only after internal UAT PASS + technical readiness UNKNOWN rows filled.
