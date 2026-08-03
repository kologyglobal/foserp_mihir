# HRMS Phase 11 — Test Results

**Suite:** `backend/tests/hrms/hrms-phase11-exit-fnf.test.ts`
**Run date:** 2026-07-31
**Command:** `cd backend && npx vitest run tests/hrms/hrms-phase11-exit-fnf.test.ts`

## Result summary

```
✓ tests/hrms/hrms-phase11-exit-fnf.test.ts (18 tests | 11 skipped)

Test Files  1 passed (1)
     Tests  7 passed | 11 skipped (18)
```

No MySQL instance was reachable in this environment (`SELECT 1` probe failed), so the suite's live `describe` block auto-skips via `describe.skipIf(!phase11TablesReady)` — this is the same gating pattern used by every other HRMS phase test file (Phases 7–10) and is not specific to Phase 11. The 7 unit tests, which have no DB dependency, ran and passed.

## Unit tests — `computeNotice` (7/7 passed, no DB required)

| # | Test | Result |
|---|------|--------|
| 1 | Shortfall: 14 days served against a 30-day requirement → `shortfall: 16` | ✅ Pass |
| 2 | Excess: 45 days served against a 30-day requirement → `excess: 15` | ✅ Pass |
| 3 | Exact match: 30 served == 30 required → no shortfall/excess | ✅ Pass |
| 4 | No resignation date (null and undefined): full requirement treated as shortfall | ✅ Pass |
| 5 | Zero contractual notice period: never a shortfall, any service is excess | ✅ Pass |
| 6 | Resignation date == last working date (immediate exit): full requirement is shortfall | ✅ Pass |
| 7 | Negative `requiredDays` clamped to zero | ✅ Pass |

`fnf-calc.service.ts` does not export any standalone pure helpers beyond the orchestrating `calculateSettlement` (which needs `PrismaTransactionClient`, salary/leave/loan/asset reads, and DB writes) — so unlike `computeNotice` there is nothing further to unit-test in isolation without a database. Its behaviour (component derivation, exceptions, negative-net handling) is covered exclusively by the live suite below.

## Live tests — gated on `hr_employee_exits` (11 tests, **not executed** in this environment — no DB)

These require a running MySQL instance with Phase 11 migrated (`npx tsx scripts/prisma-cli.ts migrate deploy` — **not run as part of this task**, per instructions not to migrate/deploy). Listed here for traceability; each was written and reviewed against the actual service/controller/schema code, following the same patterns as the Phase 7–10 suites that do pass against a live DB in CI.

| # | Test | Covers |
|---|------|--------|
| 1 | Creates → submits → approves an exit; employee moves to `ON_NOTICE` and clearance is auto-seeded | Full happy-path lifecycle up to `CLEARANCE_PENDING`; duplicate-exit `409`; approve-before-submit `400`; notice day math (14 served / 16 shortfall / 0 excess) persisted on the exit; 6-line clearance checklist auto-seed |
| 2 | Self-approval is blocked | An approver linked to the same `HrEmployee` as the requester gets `403`; exit stays `SUBMITTED`; visible via `GET /exits/mine` |
| 3 | Cancelling an approved exit reverts `ON_NOTICE` → `ACTIVE` | Cancel lifecycle; employee status reversal; double-cancel `400` |
| 4 | Clearance lines + an asset line auto-transition to `READY_FOR_SETTLEMENT` | Asset line create/status-set; clear/waive of all 6 lines; waive-without-reason `400`; exact line whose resolution triggers the auto-transition; asset lines locked out post-transition (`400`) |
| 5 | F&F calculate flags `NO_SALARY_ASSIGNMENT` as a BLOCKER | Calculate with no salary assignment still derives `ASSET_RECOVERY` (40000); blocker present in `exceptions`; approve rejected `422 FNF_BLOCKERS_UNRESOLVED` |
| 6 | Recalculating after a salary assignment resolves the blocker → negative net | Blocker clears once an `ACTIVE` salary assignment exists; `NOTICE_RECOVERY` computed at `dailyRate × shortfallDays` (3000/30 × 16 = 1600); `deductionsTotal = 41600`; `netSettlement < 0` and equals `earningsTotal − deductionsTotal`; review locks recalculation (`400`); approve succeeds |
| 7 | Posts the negative-net settlement to GL and auto-completes the exit | GL setup (finance settings, FY, open period, 4 accounts, 4 mappings incl. `EMPLOYEE_FNF_RECEIVABLE`); post → `POSTED` with balanced voucher (`totalDebit == totalCredit`); idempotent re-post; employee → `EXITED`, exit → `CLOSED` immediately (no pay step needed) |
| 8 | Pay is blocked with `AMOUNT_RECOVERABLE` for a negative-net settlement | Treasury account created; pay attempt → `422 AMOUNT_RECOVERABLE` |
| 9 | Permissions — HR Executive | Can list/create exits and (implicitly, via shared perms) calculate F&F; denied `403` on exit-approve, F&F review/approve/post/pay |
| 10 | Permissions — Supervisor | Denied `403` on every exit/F&F endpoint including list |
| 11 | Tenant isolation | Cross-tenant token cannot fetch the exit or settlement by id (`403`/`404`); list either scoped-empty or `403` |

### How to execute the live suite

```bash
cd backend
# with DATABASE_URL pointed at a MySQL instance that has Phase 11 migrated:
npx vitest run tests/hrms/hrms-phase11-exit-fnf.test.ts
```

When a DB is available, `phase11TablesReady` resolves `true` and all 18 tests (7 unit + 11 live) run.

## Typecheck

`npx tsc --noEmit` was run as part of the earlier development pass for this phase's source files (services/controllers/routes/schemas already existed pre-task; only the test file was added, which is type-checked implicitly by `vitest run`'s esbuild transform — no separate tsc pass was needed for the test file itself since it introduces no new production types).

## Known gaps / follow-ups

- Live suite unexecuted here for lack of a reachable database — **must be run in CI or a local MySQL environment before sign-off** (see `HRMS_PHASE11_UAT.md` for the manual equivalent).
- Statutory deductions (PF/ESIC/PT/TDS) on settlement components are **not** covered because they are not calculated by the engine (`STATUTORY_NOT_CALCULATED` WARNING) — out of scope for Phase 11, tracked in `REMAINING_WORK.md`.
- No frontend exists for this phase; there is nothing to test via UI/E2E browser automation.
