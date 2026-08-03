# HRMS Phase 8 — Test Results

## Commands

```bash
cd backend
npx tsx scripts/prisma-cli.ts migrate deploy   # includes 20260731030000_hrms_phase8_statutory (+ Phase 6/7)
npm run db:sync-permissions
npm run typecheck
npx vitest run tests/hrms/hrms-phase8-statutory.test.ts
# Optional regression:
npx vitest run tests/hrms/hrms-phase7-payroll.test.ts
npx vitest run tests/hrms/hrms-phase6-salary-structure.test.ts
cd ../frontend && npm run typecheck && npm run build
```

## Coverage

| Area | Covered |
|------|---------|
| `resolveWageBasis` defaults / configured lines | Unit |
| `roundStatutoryAmount` modes | Unit |
| `calculateTds` manual vs review-required | Unit |
| PF/ESIC/PT rule CRUD + activate + DRAFT guard | Live |
| PT activate blocked without slabs | Live |
| `/resolve` effective rule for employee | Live |
| Profile override reason validation | Live |
| Payroll calculate appends PF/ESIC/PT/TDS without structure STATUTORY lines | Live |
| PF register + CSV export | Live |
| ESIC applicability override + recalculate | Live |
| HR Executive manage/override 403 | Live |

Test file: `backend/tests/hrms/hrms-phase8-statutory.test.ts`

Live suite auto-skips when `hr_statutory_rules` table is absent (`describe.skipIf(!statutoryTablesReady)`).

## Results (2026-07-31 session)

| Suite | Result | Notes |
|-------|--------|-------|
| Unit (wage basis, rounding, TDS) | **3/3 PASS** | No DB dependency |
| Live Phase 8 | **6/6 PASS** | Local DB had migration applied |
| **Total** | **9/9 PASS** | `npx vitest run tests/hrms/hrms-phase8-statutory.test.ts` |

Environments without `20260731030000_hrms_phase8_statutory` deployed will report **6 skipped** live tests — run migrate deploy before claiming live PASS.

## Verdict

**READY WITH CONDITIONS** — code + local vitest green when migration applied; `db:sync-permissions` + Hostinger/stage migrate + human UAT A–J still required before production sign-off.
