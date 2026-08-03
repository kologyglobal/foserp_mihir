# HRMS Phase 9 — UAT

Prerequisites: migrations through `20260731040000_hrms_phase9_payslip_accounting_payment` (+ Phase 6/7/8), `npm run db:sync-permissions`, HR Manager role with payslip + accounting + salary_payment + payroll + salary perms, a Legal Entity with `DefaultAccountMapping` configured for at least `SALARY_BASIC_EXPENSE`/`SALARY_PAYABLE` (and PF/ESIC/PT/TDS/LWF keys if statutory is active), an active Treasury (bank) account, API mode (`VITE_USE_API=true`).

## A. Golden path — generate payslips

Finalize a payroll run (Phase 7). Open the run → **Generate Payslips**.  
Expect `generatedCount` = number of FINALIZED employee results; re-clicking **Generate Payslips** reports `generatedCount: 0` (idempotent, no duplicates).  
Open a payslip: header (employee, department, designation, branch, masked bank account), attendance strip, earnings/deductions/employer-contribution tables, net pay panel.

## B. Payslip snapshot immutability

Note the net pay on a generated payslip. Go back to Salary Structure and change the employee's assignment (e.g. new `monthlyGross`) — **do not** recalculate/regenerate this run.  
Reopen the same payslip → net pay and all line amounts are **unchanged** (frozen at generation time, not re-derived from current salary masters).

## C. Payslip self-service + HTML

As the employee's linked user, `GET /hrms/payroll/payslips/mine` returns only their own payslips.  
`GET /hrms/payroll/payslips/:id/html` renders a printable payslip page (no login-gated PDF in Phase 9 — browser Print-to-PDF works).

## D. Payroll accounting — missing mapping blocks posting

On a legal entity with **no** `DefaultAccountMapping` rows, open the run's **Accounting** tab → **Post to Accounting**.  
Expect a 422 with `code: MISSING_PAYROLL_ACCOUNT_MAPPING` and a `missingKeys` list naming every unconfigured key (e.g. `SALARY_BASIC_EXPENSE`, `SALARY_PAYABLE`). No voucher is created.

## E. Payroll accounting — successful post + idempotency

Configure the missing mappings from step D. Retry **Post to Accounting** → succeeds; run shows `accountingStatus = POSTED` with a voucher number.  
Click **Post to Accounting** again → returns the same voucher (idempotent — no duplicate journal).

## F. Salary payment batch — blocked before accounting is posted

On a FINALIZED run whose accounting is still `NOT_POSTED`, try **Create Payment Batch** → 422 `PAYROLL_ACCOUNTING_NOT_POSTED`.

## G. Salary payment batch — bank validation

After the run's accounting is `POSTED`, with an employee missing a primary bank account (or missing account number / IFSC): **Create Payment Batch** → 422 `INVALID_EMPLOYEE_BANK_DETAILS` listing the employee(s); no batch created.  
Add/complete the employee's primary bank details. Retry → batch created in `DRAFT` with that employee included.

## H. Duplicate payment prevention

With the batch from step G still open (not cancelled), try **Create Payment Batch** again for the same run → 400 ("already have a payment in progress") — the same payslip cannot be added to a second live batch.

## I. Batch lifecycle

`Ready` re-validates bank details/totals → `READY`. Approving before `READY`, or confirming before `APPROVED`, are both blocked (422). `Approve` → `APPROVED`. Export bank CSV (Employee Code, Name, Account Number, IFSC, Amount, Reference) at any point from `DRAFT` onward.

## J. Confirm payment

On the `APPROVED` batch, **Confirm** — optionally mark some lines as failed with a reason.  
Successful lines → payslip `paymentStatus = PAID`; failed lines → `FAILED` (eligible for a later retry batch). Run's overall `paymentStatus` updates to `PAID`/`PARTIALLY_PAID`/`IN_PROGRESS` accordingly. A settlement voucher posts (Dr Salary Payable, Cr Bank).

## K. Cancel

Cancel a `DRAFT`/`READY`/`APPROVED` batch → `CANCELLED`; its `PENDING`/`READY` lines release (their payslips become eligible for a new batch). Cancelling an already `PAID` batch is blocked (422).

## L. Permissions

**HR Executive** (`hrms.payslip.view/generate`, `hrms.payroll.accounting.view`, `hrms.salary_payment.view/create` — no `accounting.post`, `salary_payment.approve/confirm/export`): can generate/view payslips and view accounting status, create/ready a payment batch, but **cannot** post accounting, approve, confirm, or export CSV (403).  
**Supervisor** (no Phase 9 perms): every payslip/accounting/payment-batch endpoint → 403.

## M. Tenant isolation

Second tenant's token cannot fetch the first tenant's payslips, accounting status, or payment batches (403/404).

## Sign-off

| Case | Result | Tester | Date |
|------|--------|--------|------|
| A–M | | | |
