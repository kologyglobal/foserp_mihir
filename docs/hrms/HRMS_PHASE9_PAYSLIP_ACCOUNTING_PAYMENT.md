# HRMS Phase 9 — Payslip, Payroll Accounting & Salary Payment

> Verified against code **2026-07-31**. Builds on Phase 7 (payroll run/calculation) and Phase 8 (statutory). **Does not** implement EPFO/ESIC/TRACES portal filing, Form 16/24Q, full & final settlement, loans, or live bank payment gateway APIs. Payslip PDF is client-side from server HTML.

## Goal

```text
FINALIZED payroll run
  → Generate payslips (immutable snapshot per employee)
  → Post payroll accrual to GL (Dr salary/employer expense, Cr salary/statutory payable)
  → Create salary payment batch (bank-validated) → Ready → Approve → Confirm (Dr payable, Cr bank)
  → Bank CSV export
```

No separate HR ledger — Phase 9 reuses the shared accounting `post()` engine, `DefaultAccountMapping`, Treasury accounts, and `CodeSeries` (`PAYSLIP`, `SALARY_PAYMENT_BATCH`).

## Models

| Model | Purpose |
|-------|---------|
| `HrPayslip` | Immutable per-employee payslip: `snapshotJson` frozen at generation time, `status` (GENERATED/VOID), `paymentStatus` (UNPAID/PARTIAL/PAID/FAILED) |
| `HrPayrollRun` (extended) | `accountingStatus` (NOT_POSTED/POSTED/FAILED), `accountingVoucherId`, `postingEventId`, `payslipGeneratedAt`, `paymentStatus` (NOT_STARTED/IN_PROGRESS/PARTIALLY_PAID/PAID) |
| `HrSalaryPaymentBatch` | One bank payment run: `status` (DRAFT/READY/APPROVED/PAID/CANCELLED), `treasuryAccountId`, totals |
| `HrSalaryPaymentLine` | Per-employee line: snapshotted bank details (masked + full), `paymentStatus` (PENDING/READY/PAID/FAILED/SKIPPED) |

Migration: `20260731040000_hrms_phase9_payslip_accounting_payment`

New `DefaultAccountMappingKey` values: `SALARY_BASIC_EXPENSE`, `SALARY_HRA_EXPENSE`, `SALARY_ALLOWANCE_EXPENSE`, `SALARY_OT_EXPENSE`, `SALARY_PAYABLE`, `PF_EMPLOYEE_PAYABLE`, `PF_EMPLOYER_PAYABLE`, `PF_EMPLOYER_EXPENSE`, `ESIC_EMPLOYEE_PAYABLE`, `ESIC_EMPLOYER_PAYABLE`, `ESIC_EMPLOYER_EXPENSE`, `PT_PAYABLE`, `TDS_SALARY_PAYABLE`, `LWF_PAYABLE`, `LWF_EMPLOYER_PAYABLE`, `LWF_EMPLOYER_EXPENSE`.

## Workflow

1. **Generate payslips** — only for a FINALIZED run; snapshots each FINALIZED employee result (header, attendance, earnings, deductions, employer contributions, totals) into `snapshotJson`. Idempotent — re-running skips employee results that already have a payslip.
2. **Post payroll accounting** — builds balanced Dr/Cr GL buckets from the run's frozen components, checks every non-zero bucket has a `DefaultAccountMapping` for the run's legal entity, then posts one JOURNAL voucher. Idempotent per run via a deterministic `eventKey`.
3. **Create payment batch** — requires the run to be FINALIZED **and** `accountingStatus = POSTED`. Selects UNPAID/FAILED payslips, validates each employee's primary bank details, snapshots them onto the batch line.
4. **Ready → Approve → Confirm** — Ready re-validates bank details/totals; Approve is a pure state gate; Confirm marks lines PAID/FAILED, posts a settlement voucher for the paid total (Dr `SALARY_PAYABLE`, Cr the treasury GL account), and syncs payslip + run payment status.
5. **Bank CSV export** — Employee Code, Name, Account Number, IFSC, Amount, Reference.
6. **Cancel** — allowed until PAID; PENDING/READY lines move to SKIPPED.

Canonical services:
- `backend/src/modules/hrms/payroll/payslip.service.ts`
- `backend/src/modules/hrms/payroll/payroll-accounting.service.ts` (see `HRMS_PAYROLL_ACCOUNTING.md`)
- `backend/src/modules/hrms/payroll/salary-payment.service.ts` (see `HRMS_SALARY_PAYMENT.md`)

## APIs

Base: `/api/v1/t/:tenantSlug/hrms/payroll`

| Area | Paths |
|------|-------|
| Payslips | `POST /runs/:runId/payslips/generate`, `GET /payslips`, `GET /payslips/mine`, `GET /payslips/:payslipId`, `GET /payslips/:payslipId/html` |
| Accounting | `GET /runs/:runId/accounting`, `POST /runs/:runId/accounting/post` |
| Payment batches | `GET/POST /payment-batches`, `GET /payment-batches/:batchId`, `POST /payment-batches/:batchId/ready\|approve\|confirm\|cancel`, `GET /payment-batches/:batchId/export` |

## Permissions

| Key | HR Manager | HR Executive | Supervisor |
|-----|------------|--------------|------------|
| `hrms.payslip.view` | ✅ | ✅ | ❌ |
| `hrms.payslip.generate` | ✅ | ✅ | ❌ |
| `hrms.payroll.accounting.view` | ✅ | ✅ | ❌ |
| `hrms.payroll.accounting.post` | ✅ | ❌ | ❌ |
| `hrms.salary_payment.view` | ✅ | ✅ | ❌ |
| `hrms.salary_payment.create` | ✅ | ✅ | ❌ |
| `hrms.salary_payment.approve` | ✅ | ❌ | ❌ |
| `hrms.salary_payment.confirm` | ✅ | ❌ | ❌ |
| `hrms.salary_payment.export` | ✅ | ❌ | ❌ |

See `HRMS_PHASE9_PERMISSION_MATRIX.md`.

## Non-goals (Phase 9)

- EPFO / ESIC / TRACES portal filing, challans
- Form 16 / Form 24Q / annual TDS return engine
- Full & final settlement, loans/advances, reimbursements
- Multi-currency payroll payment
- Live bank payment gateway/API integration (CSV export + manual confirm only)

## Frontend

- `/hrms/payroll/payslips` — register + preview/PDF
- `/hrms/payroll/runs/:id` — Calculation / Payslips / Accounting / Payments tabs
- `/hrms/payroll/my-payslips` — employee self-service

## Tests

`backend/tests/hrms/hrms-phase9-payslip-accounting-payment.test.ts` — unit tests for `buildPayrollAccrualBuckets` (balance, aggregation, missing-mapping errors) + live tests for payslip generation/immutability/idempotency, `MISSING_PAYROLL_ACCOUNT_MAPPING` on post, payment-batch bank validation/duplicate-prevention/lifecycle, permissions, and tenant isolation.
