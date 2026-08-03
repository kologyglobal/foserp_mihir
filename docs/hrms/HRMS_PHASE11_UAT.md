# HRMS Phase 11 — Exit & Full/Final Settlement — UAT Script

> Exercise via SPA (`/hrms/exits`, `/hrms/fnf`) or authenticated HTTP client against `/api/v1/t/:tenantSlug/hrms/exits` and `/hrms/fnf`. Two logins recommended: **HR Manager** (all exit/fnf perms) and **HR Executive** (create/clearance/calculate only) for negative-permission scenarios.

## Pre-requisites

1. An `ACTIVE` employee with `noticePeriodDays` set (e.g. 30) and **no** open exit.
2. For the F&F GL scenarios: `FinanceSettings.financeActivated = true` for the legal entity, an `OPEN` `AccountingPeriod` covering the last working date, and `DefaultAccountMapping` rows for every component you expect to hit — at minimum `SALARY_BASIC_EXPENSE` and whichever of `LEAVE_ENCASHMENT_EXPENSE` / `NOTICE_PAY_EXPENSE` / `NOTICE_RECOVERY_INCOME` / `ASSET_RECOVERY_INCOME` / `EMPLOYEE_LOAN_RECEIVABLE` / `SALARY_ADVANCE_RECEIVABLE` apply, plus **`EMPLOYEE_FNF_PAYABLE`** (positive net) or **`EMPLOYEE_FNF_RECEIVABLE`** (negative net).
3. For a **payable** (net > 0) scenario, also an `ACTIVE` `TreasuryAccount` on the legal entity.

## Scenario A — Happy path resignation with a positive net settlement

| # | Step | Endpoint | Expect |
|---|------|----------|--------|
| 1 | Create the exit | `POST /hrms/exits` `{ employeeId, exitType: "RESIGNATION", resignationDate, requestedLastWorkingDate, reason }` | `201`, status `DRAFT`, code `EXIT-…` |
| 2 | Submit | `POST /hrms/exits/:id/submit` | `200`, status `SUBMITTED` |
| 3 | Approve (as the reporting manager or an `hrms.exit.approve` holder — **not** the requester if they are the same login) | `POST /hrms/exits/:id/approve` `{ approvedLastWorkingDate? }` | `200`, status `CLEARANCE_PENDING`, `noticeServedDays`/`noticeShortfallDays`/`noticeExcessDays` populated, employee flips to `ON_NOTICE` |
| 4 | Inspect the auto-seeded checklist | `GET /hrms/exits/:id/clearance` | 6 lines, one per department (`IT`, `ADMIN`, `STORES`, `FINANCE`, `HR`, `DEPARTMENT`), all `PENDING` |
| 5 | Record any company assets to recover (optional) | `POST /hrms/exits/:id/assets` `{ description, assetCategory?, recoveryAmount? }` | `201`, `PENDING` |
| 6 | Clear or waive every clearance line | `POST /hrms/exits/:id/clearance/:lineId/clear` (or `/waive` with `{ reason }`) | Each call `200`; **the last one** flips `exitStatus` to `READY_FOR_SETTLEMENT` once all lines are resolved and no asset line is still `PENDING` |
| 7 | Calculate F&F | `POST /hrms/fnf/:exitId/calculate` | `200`, status `CALCULATED`, `components[]`/`earningsTotal`/`deductionsTotal`/`netSettlement`/`exceptions[]` populated |
| 8 | Confirm no BLOCKER exceptions | inspect `exceptions[].severity` in step 7's response | none are `BLOCKER` (if `NO_SALARY_ASSIGNMENT` appears, assign an active salary structure to the employee and recalculate) |
| 9 | Review | `POST /hrms/fnf/:exitId/review` | `200`, status `REVIEWED` (recalculate is now blocked — `400` if retried) |
| 10 | Approve | `POST /hrms/fnf/:exitId/approve` | `200`, status `APPROVED` |
| 11 | Post to GL | `POST /hrms/fnf/:exitId/post` | `200`, status `POSTED`, `accountingVoucherId` set; re-posting is idempotent (same voucher id, `200`) |
| 12 | Pay (only reachable here because net > 0) | `POST /hrms/fnf/:exitId/pay` `{ treasuryAccountId, method, paymentDate }` | `200`, status `PAID` |
| 13 | Confirm exit closes | `GET /hrms/exits/:id` and `GET /hrms/employees/:employeeId` | exit `CLOSED`, employee `EXITED` |

## Scenario B — Negative net settlement (recoverable from the employee)

Repeat steps 1–9 above with enough asset-recovery/loan-outstanding/notice-recovery amount to push `netSettlement` below zero (e.g. a high-value unreturned asset and a large notice shortfall against a small salary).

| # | Step | Endpoint | Expect |
|---|------|----------|--------|
| 10 | Approve | `POST /hrms/fnf/:exitId/approve` | `200`, status `APPROVED` |
| 11 | Post to GL (needs `EMPLOYEE_FNF_RECEIVABLE` mapped instead of `EMPLOYEE_FNF_PAYABLE`) | `POST /hrms/fnf/:exitId/post` | `200`, status `POSTED`; **exit auto-completes immediately** — no pay step follows |
| 12 | Confirm auto-completion | `GET /hrms/exits/:id`, `GET /hrms/employees/:employeeId` | exit already `CLOSED`, employee already `EXITED` |
| 13 | Attempt to pay anyway | `POST /hrms/fnf/:exitId/pay` `{ treasuryAccountId, method, paymentDate }` | `422`, `code: "AMOUNT_RECOVERABLE"` |

## Scenario C — Guardrails

| # | Check | Endpoint | Expect |
|---|-------|----------|--------|
| 1 | Duplicate open exit for the same employee | `POST /hrms/exits` while another is DRAFT…READY_FOR_SETTLEMENT | `409` |
| 2 | Approve before submit | `POST /hrms/exits/:id/approve` on a `DRAFT` exit | `400` |
| 3 | Self-approval | Approve an exit whose `employeeId` is linked (`HrEmployee.userId`) to the caller | `403` |
| 4 | Cancel an approved exit | `POST /hrms/exits/:id/cancel` `{ reason }` | `200`, status `CANCELLED`, employee reverts `ON_NOTICE` → `ACTIVE`; cancelling again → `400` |
| 5 | Add an asset line after `READY_FOR_SETTLEMENT` | `POST /hrms/exits/:id/assets` | `400` |
| 6 | Waive a clearance line without a reason | `POST /hrms/exits/:id/clearance/:lineId/waive` `{}` | `400` (Zod requires `reason`) |
| 7 | Recalculate F&F after `REVIEWED`/`APPROVED` | `POST /hrms/fnf/:exitId/calculate` | `400` |
| 8 | Approve F&F with unresolved blockers | `POST /hrms/fnf/:exitId/approve` while `NO_SALARY_ASSIGNMENT` (or any other BLOCKER) is outstanding | `422`, `code: "FNF_BLOCKERS_UNRESOLVED"` |
| 9 | Post without required account mapping | `POST /hrms/fnf/:exitId/post` with a mapping key missing | `422`, `code: "MISSING_FNF_ACCOUNT_MAPPING"` |

## Scenario D — Permissions & tenant isolation

| # | Check | As | Expect |
|---|-------|-----|--------|
| 1 | List/create exits, clear clearance lines, calculate F&F | HR Executive (`hrms.exit.view/create/clearance`, `hrms.fnf.view/calculate`) | All `200`/`201` |
| 2 | Approve exit / review / approve / post / pay F&F | HR Executive | All `403` |
| 3 | Anything under `/hrms/exits` or `/hrms/fnf` | Supervisor (no `hrms.exit.*`/`hrms.fnf.*`) | `403` |
| 4 | `GET /hrms/exits/mine` | Any logged-in user with a linked `HrEmployee` record | `200`, only their own exit(s) — no HR permission required |
| 5 | Fetch another tenant's exit/settlement by id | A valid token from a different tenant | `403`/`404` (never the real record) |

## Sign-off checklist

- [ ] Scenario A completed end-to-end (positive net, paid, exit closed)
- [ ] Scenario B completed end-to-end (negative net, auto-completed, pay blocked)
- [ ] All Scenario C guardrails confirmed
- [ ] All Scenario D permission/tenant checks confirmed
- [ ] GL voucher balances (`totalDebit == totalCredit`) verified for both A and B in the accounting module
- [ ] No unexpected `WARNING` exceptions surfaced that should have been BLOCKERs (spot-check `OT_NOT_INCLUDED` / `STATUTORY_NOT_CALCULATED` are understood by finance/HR as manual follow-ups, not bugs)
