# HRMS Phase 10 — Employee Loans & Salary Advances

> Verified against code **2026-07-31**. Builds on Phase 7 (payroll run/calculation) and Phase 9 (payslip/accounting). **Does not** implement interest-bearing loan products, full & final settlement (F&F) offset of outstanding balances, EPFO/ESIC/TRACES portal filing, or an employee self-service portal beyond `GET /hrms/loans/mine`.

## Goal

```text
DRAFT loan/advance request
  → Submit → Approve (sets installment plan + recovery start month) → Reject/Cancel
  → Disburse (Dr employee-loan/advance receivable · Cr treasury bank) → generates recovery schedule
  → Each payroll period: due installment auto-deducted as a LOAN_RECOVERY / ADVANCE_RECOVERY component
  → Payroll finalize confirms the recovery, reduces the loan's outstanding balance
  → Skip / partial-recover an installment, or record an early lump-sum repayment
  → Close once outstanding = 0 and no installments remain PENDING
```

No separate ledger — Phase 10 reuses the shared accounting `post()` engine, `DefaultAccountMapping` (`EMPLOYEE_LOAN_RECEIVABLE`, `SALARY_ADVANCE_RECEIVABLE`), Treasury accounts, and `CodeSeries` (`EMPLOYEE_LOAN` → `LN-######`, `SALARY_ADVANCE` → `ADV-######`).

## Models

| Model | Purpose |
|-------|---------|
| `HrEmployeeLoan` | One loan or salary advance request: `type` (LOAN/SALARY_ADVANCE), `status` (DRAFT/SUBMITTED/APPROVED/REJECTED/DISBURSED/RECOVERING/CLOSED/CANCELLED), requested/approved/disbursed/recovered/outstanding amounts, installment plan, disbursement + closure metadata |
| `HrLoanRecoverySchedule` | One row per installment: `year`/`month`, `dueAmount`, `status` (PENDING/RECOVERED/PARTIAL/SKIPPED), links back to the `HrPayrollRun`/`HrPayrollEmployeeResult` that recovered it |
| `HrLoanRepayment` | One row per lump-sum/early repayment: amount, method, treasury account, accounting voucher reference |

Migration: `20260731050000_hrms_phase10_loans_advances`

New `DefaultAccountMappingKey` values: `EMPLOYEE_LOAN_RECEIVABLE`, `SALARY_ADVANCE_RECEIVABLE`.

## Workflow

1. **Create (DRAFT)** — `employeeId` defaults to the caller's own linked `HrEmployee` when omitted (self-service request). Requires `type`, `requestDate`, `requestedAmount`.
2. **Submit** — DRAFT → SUBMITTED; requires `requestedAmount > 0`.
3. **Approve** — SUBMITTED → APPROVED. Sets `approvedAmount` (≤ requested), `installmentAmount` and/or `installmentCount`, and `recoveryStartYear`/`recoveryStartMonth`. Approver must be the employee's reporting manager **or** hold `hrms.loan.manage` — **self-approval is always blocked**, even for an `hrms.loan.manage` holder.
4. **Reject** — SUBMITTED → REJECTED with a reason. Same approver rule as approve (self-rejection blocked too).
5. **Cancel** — DRAFT/SUBMITTED/APPROVED only; APPROVED cancellation requires `hrms.loan.manage` or ownership. Cannot cancel once disbursed.
6. **Disburse** — APPROVED → DISBURSED (or RECOVERING if a schedule generates immediately). Posts one `PAYMENT` voucher (Dr receivable mapping key with `partyNameSnapshot` only — no `partyType: EMPLOYEE`, which the GL engine does not support yet; Cr treasury GL account), then generates the recovery schedule. Idempotent per loan via deterministic `eventKey`.
7. **Payroll integration** — during payroll calculation (`payroll-calc.service.ts`), `getDueRecoveriesForEmployee` finds this period's PENDING schedule row(s) for the employee and `buildPayrollRecoveryComponents` (`loan-recovery.service.ts`) appends a `LOAN_RECOVERY`/`ADVANCE_RECOVERY` DEDUCTION component **after** statutory (never affects statutory bases), **capped to the remaining net pay** — a capped/zeroed recovery raises a `LOAN_RECOVERY_CAPPED` WARNING exception rather than blocking payroll. On `finalizeRun`, `confirmRecoveriesForRun` marks the matched schedule row RECOVERED/PARTIAL and reduces the loan's `recoveredAmount`/`outstandingAmount` — this is the **only** point a schedule row is confirmed (never on calculate/recalculate).
8. **Skip an installment** — a PENDING row → SKIPPED with a reason (e.g. employee on unpaid leave); does not touch the loan balance.
9. **Manual partial/full recovery** — records a manual recovery against one PENDING installment (capped to the due amount); closes the loan if it zeroes the outstanding balance with no PENDING rows left.
10. **Early/lump-sum repayment** — posts Dr treasury bank / Cr the receivable (same party snapshot pattern), reduces `outstandingAmount`, and cancels/shrinks future PENDING installments from the most-future end (`reduceFutureSchedules`) so the remaining schedule total stays in sync with the new outstanding balance.
11. **Close** — DISBURSED/RECOVERING → CLOSED once `outstandingAmount = 0` and no PENDING installments remain.

Canonical services:
- `backend/src/modules/hrms/loans/loan.service.ts` — lifecycle (create/submit/approve/reject/cancel/disburse/skip/partial-recover/repay/close)
- `backend/src/modules/hrms/loans/loan-schedule.service.ts` — `planInstallments`, `buildScheduleRows`, `generateSchedule` (last installment absorbs the rounding remainder)
- `backend/src/modules/hrms/loans/loan-recovery.service.ts` — `getDueRecoveriesForEmployee`, `buildPayrollRecoveryComponents`, `confirmRecoveriesForRun`

## Frontend

- `/hrms/loans` — register + filters
- `/hrms/loans/new`, `/hrms/loans/:id`, `/hrms/loans/:id/edit`
- `/hrms/my-loans` — employee self-service
- Payroll employee panel shows Loans & Advances recovery lines with source `LN-`/`ADV-` code

## APIs

Base: `/api/v1/t/:tenantSlug/hrms/loans`

| Area | Paths |
|------|-------|
| List/create | `GET /`, `POST /`, `GET /mine` |
| Detail/edit | `GET /:loanId`, `PATCH /:loanId` (DRAFT only) |
| Lifecycle | `POST /:loanId/submit`, `POST /:loanId/approve`, `POST /:loanId/reject`, `POST /:loanId/disburse`, `POST /:loanId/cancel`, `POST /:loanId/close` |
| Recovery schedule | `POST /:loanId/schedules/:scheduleId/skip`, `POST /:loanId/schedules/:scheduleId/partial` |
| Repayment | `POST /:loanId/repayments` |
| Accounting | `GET /:loanId/accounting` |

## Permissions

| Key | HR Manager | HR Executive | Supervisor |
|-----|------------|--------------|------------|
| `hrms.loan.view` | ✅ | ✅ | ❌ |
| `hrms.loan.create` | ✅ | ✅ | ❌ |
| `hrms.loan.approve` | ✅ | ❌ | ❌ |
| `hrms.loan.disburse` | ✅ | ❌ | ❌ |
| `hrms.loan.manage` | ✅ | ❌ | ❌ |
| `hrms.loan.repayment` | ✅ | ❌ | ❌ |

`GET /hrms/loans/mine` requires **no** HR permission — scoped to the caller's own linked `HrEmployee` via `req.context.userId`.

See `HRMS_PHASE10_PERMISSION_MATRIX.md`.

## Non-goals (Phase 10)

- Interest-bearing loan products / EMI interest calculation
- Full & final settlement (F&F) offset of outstanding loan balances
- EPFO/ESIC/TRACES portal filing
- Employee self-service loan request UI beyond the existing `GET /hrms/loans/mine` read API
- Lifting the shared posting engine's `EMPLOYEE` party-type restriction (see Known Limitation above)
- Performance/load testing of the payroll ↔ loan recovery join at scale

## Frontend

A frontend landed in parallel with this backend work: `frontend/src/modules/hrms/pages/LoanPages.tsx` (list/create/approve workflow) and `LoanDetailPage.tsx` (detail, schedule, repayment), wired through `frontend/src/services/api/hrmsApi.ts` to the real `/hrms/loans*` endpoints above, plus navigation (`config/navigation.ts`), routes (`routes/hrmsRoutes.tsx`), and permission gating (`utils/permissions/hrms.ts`). This document covers the API + DB backend; the frontend was not authored or verified as part of this backend session.

## Tests

`backend/tests/hrms/hrms-phase10-loans-advances.test.ts` — unit tests for schedule generation (even division + remainder-absorption), `buildPayrollRecoveryComponents` (capping + full-skip), and `buildPayrollAccrualBuckets` (`EMPLOYEE_LOAN_RECEIVABLE`/`SALARY_ADVANCE_RECEIVABLE` crediting) + live tests for the full create→submit→approve lifecycle, the `PARTY_TYPE_NOT_SUPPORTED` disbursement/repayment limitation, seeded schedule generation, payroll calculate/finalize recovery confirmation (outstanding 30000 → 25000), skip, reject, self-approval block, permissions, and tenant isolation.
