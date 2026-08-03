# HRMS Phase 10 — UAT

Prerequisites: migrations through `20260731050000_hrms_phase10_loans_advances` (+ Phase 6/7/8/9), `npm run db:sync-permissions`, HR Manager role with `hrms.loan.*` + payroll + salary perms, at least one employee with an active salary assignment, a Legal Entity with `DefaultAccountMapping` for `EMPLOYEE_LOAN_RECEIVABLE`/`SALARY_ADVANCE_RECEIVABLE` and an active Treasury (bank) account (see **D** below for the current disbursement limitation), API mode (`VITE_USE_API=true`).

## A. Golden path — create, submit, approve

Create a LOAN request for an employee (₹30,000, reason "Medical emergency") → `DRAFT`.  
**Submit** → `SUBMITTED`. **Approve** with `installmentAmount: 5000`, `recoveryStartYear/Month` set to the next payroll period → `APPROVED`, `approvedAmount`/`installmentAmount` reflected.

## B. Self-approval is always blocked

Log in as the employee's own linked user (or an HR Manager whose `HrEmployee` record is the requester). Attempt to **Approve** or **Reject** their own SUBMITTED request → 403, even if the user holds `hrms.loan.manage`.

## C. Approver rules

A SUBMITTED request can be approved/rejected by the employee's **reporting manager** (if one is assigned) or anyone holding `hrms.loan.manage`. An employee with no reporting manager assigned and no `hrms.loan.manage` grant on the approver → 403 ("No reporting manager assigned; HR Manager must approve").

## D. Disbursement — known GL posting limitation

**Disburse** the APPROVED loan from step A with a valid treasury account → expect a **422 with `code: PARTY_TYPE_NOT_SUPPORTED`**, even with a fully configured chart of accounts, open accounting period, and default mappings. This is a known limitation of the shared GL posting engine (it does not yet support the `EMPLOYEE` party type) — not a defect in the loan workflow. See `HRMS_PHASE10_LOANS_ADVANCES.md` → "Known limitation" for detail. Do not sign off Phase 10 as blocking on this — it is documented and tracked as follow-up work.

## E. Recovery schedule shape

Once a loan is disbursed (via a future posting-engine fix, or seeded directly for test purposes), open the loan detail → the recovery schedule shows one row per month starting at `recoveryStartYear`/`Month`, each `dueAmount` equal to the installment amount except the **last row**, which absorbs any rounding remainder so the schedule sums exactly to the disbursed amount.

## F. Payroll recovery deduction

Run payroll for the period matching a PENDING installment's `year`/`month`. **Calculate** the run → the employee's result includes a `LOAN_RECOVERY` (or `ADVANCE_RECOVERY`) DEDUCTION component equal to the due installment amount (unless net pay is insufficient — see **G**). **Review → Finalize** the run → the matching schedule row moves to `RECOVERED` (or `PARTIAL` if under-recovered), and the loan's `outstandingAmount` drops by exactly the recovered amount.

## G. Recovery capping when net pay is insufficient

For an employee whose net pay before recovery is less than the due installment, calculate the run → the recovery component amount is capped to the remaining net pay (never pushes net pay negative), and a `LOAN_RECOVERY_CAPPED` WARNING exception appears on the run (does not block calculation or finalize). If net pay is zero, the recovery is skipped entirely for that period (still a WARNING, not a BLOCKER).

## H. Skip an installment

On a loan with a PENDING installment, **Skip** it with a reason (e.g. "Employee on unpaid leave") → schedule row moves to `SKIPPED`; the loan balance is untouched. Attempting to skip an already-SKIPPED/RECOVERED row → 400.

## I. Manual partial recovery

On a PENDING installment, record a manual partial recovery for less than the due amount → row moves to `PARTIAL`, loan `recoveredAmount`/`outstandingAmount` update accordingly. Attempting an amount greater than the due installment → 400 ("use early repayment for full payoff amounts").

## J. Early repayment validation + limitation

Attempt an early repayment **greater than** the loan's outstanding balance → 400. Attempt one **without** a `treasuryAccountId` → 400 ("treasuryAccountId is required to post this repayment to accounting"). With a valid amount and treasury account → 422 `PARTY_TYPE_NOT_SUPPORTED` (same limitation as **D** — the repayment line also tags `partyType: EMPLOYEE`).

## K. Reject and re-approval guard

Reject a SUBMITTED request with a reason → `REJECTED`, reason recorded. Attempting to **approve** an already-REJECTED (or DRAFT) request → 400 ("Only submitted loans/advances can be…").

## L. Cancel

Cancel a DRAFT or SUBMITTED request (any authorized user) → `CANCELLED`. Cancel an APPROVED request as a non-owner without `hrms.loan.manage` → 403; as the owner or an `hrms.loan.manage` holder → `CANCELLED`. Attempting to cancel a DISBURSED/RECOVERING loan → 400.

## M. Self-service — "my loans"

As an employee's linked user, `GET /hrms/loans/mine` returns only their own loans/advances — no HR permission required.

## N. Permissions

**HR Executive** (`hrms.loan.view`, `hrms.loan.create` — no approve/disburse/manage/repayment): can create/view/submit/cancel-own requests, but **cannot** approve, reject, disburse, skip, manually recover, close, or record a repayment (403).  
**Supervisor** (no loan perms): every `/hrms/loans*` endpoint → 403.

## O. Tenant isolation

Second tenant's token cannot fetch the first tenant's loan detail or see it in a list response (403/404, or absent from list results).

## Sign-off

| Case | Result | Tester | Date |
|------|--------|--------|------|
| A–O | | | |
