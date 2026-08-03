# HRMS Phase 9 — Test Results

## Commands

```bash
cd backend
npx tsx scripts/prisma-cli.ts migrate deploy   # includes 20260731040000_hrms_phase9_payslip_accounting_payment (+ Phase 6/7/8)
npm run db:sync-permissions
npm run typecheck
npx vitest run tests/hrms/hrms-phase9-payslip-accounting-payment.test.ts
# Optional regression:
npx vitest run tests/hrms/hrms-phase8-statutory.test.ts
npx vitest run tests/hrms/hrms-phase7-payroll.test.ts
cd ../frontend && npm run typecheck && npm run build
```

## Coverage

| Area | Covered |
|------|---------|
| `buildPayrollAccrualBuckets` balanced Dr=Cr (earnings + employer contribution pairs + employee deductions + net payable) | Unit |
| `buildPayrollAccrualBuckets` aggregation across multiple employees, zero-amount components skipped | Unit |
| `buildPayrollAccrualBuckets` throws `MISSING_PAYROLL_ACCOUNT_MAPPING` for unrecognised deduction component | Unit |
| `buildPayrollAccrualBuckets` throws `MISSING_PAYROLL_ACCOUNT_MAPPING` for unrecognised employer-contribution component | Unit |
| Payslip generation blocked before FINALIZE (422) | Live |
| Payslip generation idempotent (2nd call → `generatedCount: 0`) | Live |
| Payslip snapshot immutable after direct mutation of the underlying calculation result | Live |
| Payslip detail, HTML render, list filters | Live |
| Permission 403 — payslip view/generate without perms | Live |
| Payroll accounting post → `MISSING_PAYROLL_ACCOUNT_MAPPING` (with `missingKeys[]`) when mappings absent | Live |
| Permission 403 — accounting view/post without perms | Live |
| Payment batch creation blocked until accounting `POSTED` (`PAYROLL_ACCOUNTING_NOT_POSTED`) | Live |
| Payment batch bank validation (`INVALID_EMPLOYEE_BANK_DETAILS`) | Live |
| Payment batch duplicate-payment prevention (400 on re-create for the same run) | Live |
| Payment batch lifecycle guards (approve-before-ready, confirm-before-approved → 422) | Live |
| Payment batch Ready → Approve → CSV export → Cancel | Live |
| Permission 403 — salary_payment view/create/approve/confirm/export without perms | Live |
| Tenant isolation — payslip, accounting, payment batch | Live |

Test file: `backend/tests/hrms/hrms-phase9-payslip-accounting-payment.test.ts`

Live suite auto-skips when `hr_payslips` table is absent (`describe.skipIf(!phase9TablesReady)`).

Live GL posting itself (a fully-mapped legal entity + open accounting period, producing a real voucher) is **not** exercised end-to-end in this suite by design — the missing-mapping guard is unit+live tested (the most valuable failure mode to lock down), and the shared `post()` engine already has dedicated coverage elsewhere (AR/AP/FX/period-close suites). The payment-batch tests fake a `POSTED` accrual via a direct DB update to isolate batch/bank-validation logic from full CoA/financial-year setup.

## Results (2026-07-31 session)

| Suite | Result | Notes |
|-------|--------|-------|
| Unit (accrual buckets) | **5/5 PASS** | Includes LOP netting; no DB dependency |
| Live Phase 9 | **PENDING** | `20260731040000_hrms_phase9_payslip_accounting_payment` not yet deployed — live suite **9 skipped** |
| Backend `tsc --noEmit` | **PASS** | 2026-07-31 session |
| Frontend `tsc -b` | **PASS** | 2026-07-31 session |

Environments without the Phase 9 migration deployed will report **9 skipped** live tests — run `migrate deploy` (see Commands) then re-run before claiming live PASS.

## Verdict

**READY WITH CONDITIONS** — code + unit vitest green; migration deploy + `db:sync-permissions` + live vitest PASS + BE/FE typecheck + UAT A–M still required before production sign-off.
