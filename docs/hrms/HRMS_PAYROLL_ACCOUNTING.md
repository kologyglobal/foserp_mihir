# HRMS Payroll Accounting

> Canonical implementation: `backend/src/modules/hrms/payroll/payroll-accounting.service.ts`. Verified **2026-07-31**.

## Overview

```text
FINALIZED run components
  → buildPayrollAccrualBuckets()         (pure function — Dr/Cr GL key buckets)
  → resolve DefaultAccountMapping        (per non-zero bucket, for the run's legal entity)
  → post()                               (shared accounting posting engine — one JOURNAL voucher)
  → HrPayrollRun.accountingStatus = POSTED
```

No new ledger — payroll accrual posts through the same `post()` engine used by AR/AP/inventory/manufacturing, so period-close, idempotency, and GL reporting are shared infrastructure.

## `buildPayrollAccrualBuckets`

Pure function, no DB access — exported for direct unit testing. Input: FINALIZED `HrPayrollEmployeeResult` rows (with their `HrPayrollComponentResult` components). Output: `Map<DefaultAccountMappingKey, { debit, credit }>`.

Per employee, per non-zero component:

| Component | Type | Bucket(s) |
|-----------|------|-----------|
| `BASIC` | EARNING | Dr `SALARY_BASIC_EXPENSE` |
| `HRA` | EARNING | Dr `SALARY_HRA_EXPENSE` |
| `calculationType = OT_LINKED` or code `OT` | EARNING | Dr `SALARY_OT_EXPENSE` |
| any other earning | EARNING | Dr `SALARY_ALLOWANCE_EXPENSE` |
| `PF_EMPLOYER` | EMPLOYER_CONTRIBUTION | Dr `PF_EMPLOYER_EXPENSE` / Cr `PF_EMPLOYER_PAYABLE` |
| `ESIC_EMPLOYER` | EMPLOYER_CONTRIBUTION | Dr `ESIC_EMPLOYER_EXPENSE` / Cr `ESIC_EMPLOYER_PAYABLE` |
| `LWF_EMPLOYER` | EMPLOYER_CONTRIBUTION | Dr `LWF_EMPLOYER_EXPENSE` / Cr `LWF_EMPLOYER_PAYABLE` |
| `PF_EMPLOYEE` | DEDUCTION | Cr `PF_EMPLOYEE_PAYABLE` |
| `ESIC_EMPLOYEE` | DEDUCTION | Cr `ESIC_EMPLOYEE_PAYABLE` |
| `PT` | DEDUCTION | Cr `PT_PAYABLE` |
| `TDS` | DEDUCTION | Cr `TDS_SALARY_PAYABLE` |
| `LWF_EMPLOYEE` | DEDUCTION | Cr `LWF_PAYABLE` |
| — (per employee) | `netAmount` | Cr `SALARY_PAYABLE` |

**Unrecognised component codes** for `DEDUCTION` or `EMPLOYER_CONTRIBUTION` types throw `UnprocessableEntityError('MISSING_PAYROLL_ACCOUNT_MAPPING')` immediately — the bucket builder itself refuses to silently drop an amount. (Unrecognised `EARNING` codes fall through to `SALARY_ALLOWANCE_EXPENSE`, so new allowance components never block posting.)

Zero-amount components are skipped entirely (no empty buckets). Buckets are cumulative across all employees in the run, so `sum(debit) === sum(credit)` always holds when every component maps to a recognised bucket pair.

## `postPayrollAccounting`

**Signature:** `postPayrollAccounting(tenantId, runId, scope, audit?)`

1. Load run, `assertHrAccess` (legal entity / branch scope).
2. Run must be `FINALIZED` → else `PAYROLL_NOT_FINALIZED` (422).
3. If `accountingStatus = POSTED` and a `postingEventId` exists → **idempotent return** of the existing result (no re-post). If `POSTED` without an event id (inconsistent state) → `PAYROLL_ALREADY_POSTED` (422).
4. Load FINALIZED employee results + components; empty set → `PAYROLL_NOT_FINALIZED` (422).
5. `buildPayrollAccrualBuckets(results)`.
6. For every bucket with a non-zero debit or credit, look up `DefaultAccountMapping` for `(legalEntityId, mappingKey)`. Any missing key → `MISSING_PAYROLL_ACCOUNT_MAPPING` (422) with `missingKeys: string[]` in the response body.
7. Build `PostingRequestLine[]` (one per non-zero bucket, `accountMappingKey` resolved by the posting engine) and confirm `totalDebit === totalCredit` → else `PAYROLL_ENTRY_UNBALANCED` (422). This should be unreachable given step 5's guarantee, but is a defence-in-depth check.
8. `post()` with `eventKey: PAYROLL_ACCRUAL_POST:{runId}:V1`, `eventType: PAYROLL_ACCRUAL_POSTED`, `voucherType: JOURNAL`, posting date = period end date.
9. On `PostingError`:
   - `ACCOUNTING_PERIOD_CLOSED` → `NO_OPEN_ACCOUNTING_PERIOD` (422)
   - `UNBALANCED` / `UNBALANCED_BASE` → `PAYROLL_ENTRY_UNBALANCED` (422)
   - other → run marked `accountingStatus = FAILED` with `accountingError`, error rethrown
10. On success: run updated `accountingStatus = POSTED`, `accountingVoucherId`, `postingEventId`, `accountingPostedAt`, `accountingPostedByUserId`; audit log `PAYROLL_POSTED`.

## Error codes

| Code | HTTP | Meaning |
|------|------|---------|
| `PAYROLL_NOT_FINALIZED` | 422 | Run is not FINALIZED, or has no FINALIZED employee results |
| `MISSING_PAYROLL_ACCOUNT_MAPPING` | 422 | One or more GL mapping keys unconfigured for the legal entity — `missingKeys[]` lists them |
| `PAYROLL_ENTRY_UNBALANCED` | 422 | Dr ≠ Cr (should not occur if mappings are complete and components are well-formed) |
| `NO_OPEN_ACCOUNTING_PERIOD` | 422 | No open accounting period covers the payroll period end date |
| `PAYROLL_ALREADY_POSTED` | 422 | Run shows `POSTED` but has no linked posting event (inconsistent state) |

## Setup checklist (finance team, per legal entity)

Configure `DefaultAccountMapping` rows for every mapping key your salary structure and statutory rules can produce — at minimum `SALARY_BASIC_EXPENSE` and `SALARY_PAYABLE`; add `SALARY_HRA_EXPENSE` / `SALARY_ALLOWANCE_EXPENSE` / `SALARY_OT_EXPENSE` / PF / ESIC / PT / TDS / LWF keys as applicable. Posting fails fast (422, no partial voucher) with the exact missing keys until this is done — safer than silently dropping statutory liabilities.

## Read endpoint

`GET /hrms/payroll/runs/:runId/accounting` returns `{ runId, accountingStatus, accountingVoucherId, voucherNumber, postingEventId, accountingPostedAt, accountingPostedByUserId, accountingError }` — safe to poll from the run detail UI without re-attempting the post.
