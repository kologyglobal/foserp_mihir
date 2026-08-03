# HRMS Salary Payment

> Canonical implementation: `backend/src/modules/hrms/payroll/salary-payment.service.ts`. Verified **2026-07-31**.

## Overview

```text
FINALIZED run, accountingStatus = POSTED
  → createBatch()      DRAFT   — select UNPAID/FAILED payslips, validate + snapshot bank details
  → markReady()        READY   — re-validate bank details + totals
  → approveBatch()     APPROVED
  → confirmPayment()   PAID    — post settlement voucher, mark lines PAID/FAILED, sync payslip + run status
  → exportCsv()                — bank upload file, any time after DRAFT
  → cancelBatch()      CANCELLED — allowed until PAID; releases PENDING/READY lines to SKIPPED
```

## `createBatch`

**Prerequisites** (checked in order, each a distinct 422 code):

1. Payroll run exists and is in the caller's HR scope.
2. `run.status === 'FINALIZED'` → else `PAYROLL_NOT_FINALIZED`.
3. `run.accountingStatus === 'POSTED'` → else `PAYROLL_ACCOUNTING_NOT_POSTED`. **A payment batch can never be created before the payroll accrual has been posted to GL** — this keeps the payable liability and the cash payment in sync.
4. `treasuryAccountId` resolves to an `ACTIVE` account belonging to the run's legal entity (400 `ValidationError` otherwise).

**Employee selection:**

- Payslips with `paymentStatus IN (UNPAID, FAILED)` and `netAmount > 0` for the run, optionally filtered to `employeeIds`.
- If `employeeIds` was supplied and any id has no eligible payslip → 400 with the missing ids.
- **Duplicate-payment guard:** any payslip already referenced by a `HrSalaryPaymentLine` with status `PENDING/READY/PAID` on a non-cancelled batch is excluded from the new batch. If that leaves zero candidates → 400 `"All selected employees already have a payment in progress for this run"`. This is what prevents double-paying an employee across two batches for the same run.
- **Bank validation:** for each remaining candidate, the employee's primary (`isPrimary: true`, not soft-deleted) `HrEmployeeBankDetail` must have both `accountNumber` and `ifsc`. Employees without a valid primary bank record are collected into `invalidEmployees[]`.
  - Default: any invalid employee → 422 `INVALID_EMPLOYEE_BANK_DETAILS` with the full `invalidEmployees[]` list (id, code, name, reason) — **nothing is created**.
  - `skipInvalidEmployees: true` → invalid employees are silently excluded from the batch instead of blocking it; the response still echoes `invalidEmployees[]` for the caller to review/report.
- If zero employees remain with valid bank details → 400.

**On success:** one `HrSalaryPaymentBatch` (status `DRAFT`) + one `HrSalaryPaymentLine` per included employee. Each line snapshots `bankName`, `accountHolderName`, `accountNumberMasked` (display), and the raw `accountNumber`/`ifsc` (used only for the CSV export — never returned unmasked by the JSON API). Batch code from `CodeSeries` (`SALARY_PAYMENT_BATCH`).

## `markReady`

Only from `DRAFT`. Re-validates that every line still has `accountNumber`/`ifsc` and that the sum of line `netPay` equals the batch `totalAmount` (defence against a payslip/employee record changing between create and ready). Lines move `PENDING → READY`; batch → `READY`.

## `approveBatch`

Only from `READY` → `APPROVED`. Pure state gate (no recomputation) — records `approvedAt`/`approvedByUserId`.

## `confirmPayment`

Only from `APPROVED`. Request body:

```jsonc
{
  "lineIds": ["..."],           // optional — explicit paid lines (default: all PENDING/READY lines not in failedLineIds)
  "failedLineIds": [{ "id": "...", "reason": "Account closed" }]
}
```

- Paid lines total → one settlement voucher (only if the total is non-zero): Dr `SALARY_PAYABLE` (via `DefaultAccountMapping`), Cr the treasury account's `glAccountId` directly. `eventKey: PAYROLL_PAYMENT_POST:{batchId}:V1`.
- Paid lines → `paymentStatus = PAID`, `paidAt`, `paymentReference` (batch reference or code); linked payslip → `paymentStatus = PAID`.
- Failed lines → `paymentStatus = FAILED`, `failureReason`; linked payslip → `paymentStatus = FAILED` (eligible for a future retry batch).
- Batch → `status = PAID` (even on partial success — "PAID" reflects the batch completing its confirmation pass, not that every line succeeded); `paidAmount`/`pendingAmount`/`failedCount` updated.
- `HrPayrollRun.paymentStatus` recomputed from all payslips on the run: `PAID` (all paid) → `PARTIALLY_PAID` (some paid) → `IN_PROGRESS` (some attempted, none paid) → `NOT_STARTED`.
- 422 if the batch is not `APPROVED`; 400 if no lines were confirmed as paid or failed.

Statutory liability accounts (PF/ESIC/PT/TDS/LWF payable) are **never** touched by salary payment — those are settled by separate statutory challan/remittance workflows outside Phase 9 scope.

## `exportCsv`

Columns: `Employee Code, Name, Account Number, IFSC, Amount, Reference`. Uses the batch's unmasked `accountNumber`/`ifsc` (this is the one place the raw account number leaves the system, as a bank-upload file) and its `reference` or `code` as the payment reference. Available from `DRAFT` onward (does not require any lifecycle state) — logs a `BANK_EXPORT_GENERATED` audit entry each time.

## `cancelBatch`

Any status except `PAID`/`CANCELLED` → `CANCELLED`; lines in `PENDING`/`READY` move to `SKIPPED` (freeing their payslips for inclusion in a future batch). Already-`PAID` lines within a cancelled batch are left untouched (a batch can be cancelled after a partial confirm to release the still-pending lines).

## Error codes

| Code | HTTP | Meaning |
|------|------|---------|
| `PAYROLL_NOT_FINALIZED` | 422 | Run is not FINALIZED |
| `PAYROLL_ACCOUNTING_NOT_POSTED` | 422 | Payroll accrual has not been posted to GL yet |
| `INVALID_EMPLOYEE_BANK_DETAILS` | 422 | One or more employees have no/invalid primary bank record (`invalidEmployees[]`) |
| `VALIDATION_ERROR` (400) | 400 | Inactive/mismatched treasury account, no eligible employees, all candidates already batched (duplicate guard), no lines confirmed |
| `INVALID_STATE` (422) | 422 | Lifecycle guard violated (ready/approve/confirm called out of order, or cancel on PAID/CANCELLED) |

## Bank data handling

- `accountNumber`/`ifsc` are stored per line (snapshot at batch-create time), independent of any later change to the employee's bank master — a batch's CSV always reflects what was validated when it was created.
- `maskAccountNumber` (from `employee.mapper.ts`) is applied for every JSON API response; only the CSV export contains the full account number.
