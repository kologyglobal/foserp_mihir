# HRMS Phase 7 — Payroll Run & Calculation Engine

> Verified against code **2026-07-31**. Builds on Phases 1–6. **Does not** implement statutory engine, payslip PDF, or payroll GL posting.

## Goal

```text
Payroll Period → Run → Calculate (paid days + salary lines + OT)
→ Review → Finalize → Period CLOSED
```

## Models

| Model | Purpose |
|-------|---------|
| `HrPayrollPeriod` | Calendar month per legal entity (OPEN / PROCESSING / CLOSED) |
| `HrPayrollRun` | Calculation batch (DRAFT → CALCULATED → REVIEWED → FINALIZED) |
| `HrPayrollEmployeeResult` | Per-employee totals, paid-days snapshot, status |
| `HrPayrollComponentResult` | Resolved line amounts (BASIC, HRA, OT, …) |
| `HrPayrollException` | BLOCKER / WARNING flags (missing bank, statutory pending, pending OT, …) |

Migration: `20260731010000_hrms_phase7_payroll`

## Workflow

1. **Create period** — one row per `(tenant, legalEntity, year, month)`; duplicate blocked.
2. **Create run** — links to period; optional branch filter; auto code `PR-YYYYMM-###`.
3. **Calculate** — selects eligible employees (join/exit clamp, no duplicate finalized result for same period); computes paid days + prorated salary + OT; writes results/exceptions; run → `CALCULATED`; period → `PROCESSING` if was `OPEN`.
4. **Review** — run → `REVIEWED` (no amount change).
5. **Finalize** — blocks on ERROR results, unresolved BLOCKERs, pending OT for included employees; employee results → `FINALIZED`; run → `FINALIZED`; period → `CLOSED` when no other open runs remain.
6. **Recalculate** — allowed on DRAFT/CALCULATED/REVIEWED; **blocked** on FINALIZED/CANCELLED.

Canonical calculation: `backend/src/modules/hrms/payroll/payroll-calc.service.ts`  
Paid days: `backend/src/modules/hrms/payroll/paid-days.service.ts`

## APIs

Base: `/api/v1/t/:tenantSlug/hrms/payroll`

| Area | Paths |
|------|--------|
| Periods | `GET/POST /periods`, `GET /periods/:periodId`, `POST /periods/:periodId/close` |
| Runs | `GET/POST /runs`, `GET /runs/:runId` |
| Lifecycle | `POST /runs/:runId/calculate`, `/review`, `/finalize`, `/cancel` |
| Results | `GET /runs/:runId/employees`, `GET /runs/:runId/employees/:employeeResultId` |
| Exceptions | `GET /runs/:runId/exceptions` |

## UI

| Route | Purpose |
|-------|---------|
| `/hrms/payroll/runs` | Period picker + run register; create period/run |
| `/hrms/payroll/runs/:id` | Run detail — Calculate / Review / Finalize; employee grid; exceptions |
| `/hrms/payroll/setup/components` | Salary components (Phase 6) |
| `/hrms/payroll/setup/structures` | Salary structures (Phase 6) |

## Permissions

| Key | HR Manager | HR Executive | Supervisor |
|-----|------------|--------------|------------|
| `hrms.payroll.view` | ✅ | ✅ | ❌ |
| `hrms.payroll.create` | ✅ | ❌ | ❌ |
| `hrms.payroll.calculate` | ✅ | ❌ | ❌ |
| `hrms.payroll.review` | ✅ | ❌ | ❌ |
| `hrms.payroll.finalize` | ✅ | ❌ | ❌ |

Salary + employee setup permissions from Phase 6 still required for end-to-end setup.

See `HRMS_PHASE7_PERMISSION_MATRIX.md`.

## Non-goals (Phase 7)

- Statutory PF / ESIC / PT / TDS calculation engine
- Payslip PDF / email / employee self-service download
- Payroll accounting / GL journal posting
- Loans / advances / reimbursements
- Multi-currency payroll
- Retro payroll / off-cycle runs beyond cancel + recalculate on open runs

## Tests

`backend/tests/hrms/hrms-phase7-payroll.test.ts` — unit paid-days helper + live period/run/calculate/review/finalize flow.
