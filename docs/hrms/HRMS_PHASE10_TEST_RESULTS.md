# HRMS Phase 10 — Test Results

## Commands

```bash
cd backend
npx tsx scripts/prisma-cli.ts migrate deploy   # includes 20260731050000_hrms_phase10_loans_advances (+ Phase 6–9)
npm run db:sync-permissions
npm run typecheck
npx vitest run tests/hrms/hrms-phase10-loans-advances.test.ts
# Optional regression:
npx vitest run tests/hrms/hrms-phase9-payslip-accounting-payment.test.ts
npx vitest run tests/hrms/hrms-phase7-payroll.test.ts
cd ../frontend && npm run typecheck && npm run build
```

## Coverage

| Area | Covered |
|------|---------|
| Schedule sums / remainder absorption | Unit |
| Recovery capping to net pay (`LOAN_RECOVERY_CAPPED`) | Unit |
| Accrual buckets credit loan/advance receivables | Unit |
| Create → Submit → Approve | Live |
| Disburse + GL voucher + 6×5000 schedule | Live |
| Payroll calc LOAN_RECOVERY + finalize outstanding 30k→25k | Live |
| Skip installment / early repayment GL | Live |
| Reject / self-approval block / permissions / tenant isolation | Live |

Test file: `backend/tests/hrms/hrms-phase10-loans-advances.test.ts`

Live suite auto-skips when `hr_employee_loans` is absent.

## Results (2026-07-31 session)

| Suite | Result | Notes |
|-------|--------|-------|
| Unit | **5/5 PASS** | No DB |
| Live | **PENDING** | Migration not deployed — **9–10 skipped** |
| Backend typecheck | **PASS** | |

## Verdict

**READY WITH CONDITIONS** — migrate + sync-permissions + live vitest + UAT before production. Stop before interest products, F&F, portal filing, performance management.
