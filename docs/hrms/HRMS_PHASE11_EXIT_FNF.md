# HRMS Phase 11 — Exit, Offboarding & Full & Final Settlement

> Verified against code **2026-07-31**. Builds on Phase 6 (salary), Phase 7 (payroll), Phase 8 (statutory — referenced, not recalculated), Phase 9 (payslip/accounting), Phase 10 (loans/advances). **Does not** implement recruitment/ATS, performance management, LMS/engagement, an employee self-service exit-request UI, or a statutory-accurate F&F recompute (PF/ESIC/PT/TDS on settlement components are flagged for manual review, not calculated).

## Goal

```text
DRAFT exit request (resignation/termination/retirement/contract end/absconding/other)
  → Submit → Approve (locks last working date, reconciles notice period, employee → ON_NOTICE, seeds clearance checklist)
  → Clearance checklist (IT/Admin/Stores/Finance/HR/Department, or tenant template) — clear or waive each line
  → Asset lines (non-returned/damaged equipment) — recovery amount tracked per line
  → All clearance + asset lines resolved → exit auto-transitions to READY_FOR_SETTLEMENT
  → Calculate Full & Final Settlement (pending salary, leave encashment, notice pay/recovery, loan/advance outstanding, asset recovery)
  → Review → Approve (blocked while any BLOCKER exception is unresolved) → Post (GL) → Pay (only when net > 0)
  → Employee → EXITED, exit → CLOSED (auto-completed on post when net ≤ 0, or on payment when net > 0)
  → Cancel is available up to READY_FOR_SETTLEMENT (reverts ON_NOTICE → ACTIVE) as long as the settlement hasn't been reviewed/approved
```

No separate ledger — Phase 11 reuses the shared accounting `post()` engine, `DefaultAccountMapping` (`EMPLOYEE_FNF_PAYABLE`, `EMPLOYEE_FNF_RECEIVABLE`, `LEAVE_ENCASHMENT_EXPENSE`, `NOTICE_PAY_EXPENSE`, `NOTICE_RECOVERY_INCOME`, `ASSET_RECOVERY_INCOME`, plus existing salary/loan mapping keys), Treasury accounts, and `CodeSeries` (`EMPLOYEE_EXIT` → `EXIT-######`, `FULL_FINAL_SETTLEMENT` → `FNF-######`).

## Models

| Model | Purpose |
|-------|---------|
| `HrExitClearanceTemplate` | Tenant/legal-entity-configurable clearance checklist template (code/name/sequence); LE-specific rows win over tenant-wide on a code clash. Falls back to a hardcoded IT/Admin/Stores/Finance/HR/Department checklist when no active templates exist. |
| `HrEmployeeExit` | One exit record: `exitType`, resignation/requested/approved last-working dates, notice period reconciliation (`noticePeriodDays`/`noticeServedDays`/`noticeShortfallDays`/`noticeExcessDays`), `noticeSettlementMode` (`recover`/`pay`/`none`), `status` (DRAFT→SUBMITTED→APPROVED→CLEARANCE_PENDING→READY_FOR_SETTLEMENT→SETTLED→CLOSED, or CANCELLED) |
| `HrExitClearanceItem` / `HrExitClearanceLine` | Snapshot of the checklist seeded onto an exit at approval time; each line is PENDING → CLEARED or WAIVED (with a reason) |
| `HrExitAssetLine` | Company asset issued to the employee: description/category, `status` (PENDING/RETURNED/NOT_RETURNED/DAMAGED/WAIVED), `recoveryAmount` |
| `HrFullFinalSettlement` | One settlement per exit (1:1): `status` (DRAFT→CALCULATED→REVIEWED→APPROVED→POSTED→PAID→CLOSED), earnings/deductions/net totals, `exceptionsJson` (WARNING/BLOCKER list from the last calculate), posting + payment metadata |
| `HrFnfComponent` | One line per settlement: `kind` (EARNING/DEDUCTION), code/name/amount, `calculationBasis` (human-readable), `mappingKeyHint` (resolved to a `DefaultAccountMapping` at post time) |

Migration: `20260731060000_hrms_phase11_exit_fnf` — also adds `HrEmployee.noticePeriodDays`/`exitDate`/`lastWorkingDate` and `HrLeaveType.fnfSettlementAction`/`maxEncashDays`.

New `DefaultAccountMappingKey` values: `EMPLOYEE_FNF_PAYABLE`, `EMPLOYEE_FNF_RECEIVABLE`, `LEAVE_ENCASHMENT_EXPENSE`, `NOTICE_PAY_EXPENSE`, `NOTICE_RECOVERY_INCOME`, `ASSET_RECOVERY_INCOME`.

## Workflow

1. **Create (DRAFT)** — `employeeId` defaults to the caller's own linked `HrEmployee` when omitted. Requires `exitType`, `requestedLastWorkingDate`; the employee must be ACTIVE/DRAFT and have no other exit already in progress (DRAFT/SUBMITTED/APPROVED/CLEARANCE_PENDING/READY_FOR_SETTLEMENT/SETTLED → `409 CONFLICT`). `noticePeriodDays` defaults to the employee's own `noticePeriodDays`.
2. **Submit** — DRAFT → SUBMITTED.
3. **Approve** — SUBMITTED → CLEARANCE_PENDING, in one transaction: locks `approvedLastWorkingDate` (defaults to the requested date), reconciles the notice period via `computeNotice` (see `HRMS_FNF_CALCULATION.md`), moves the employee to `ON_NOTICE` (records `HrEmployeeEmploymentHistory`), and seeds the clearance checklist (idempotent — no-op if lines already exist). Approver must be the employee's reporting manager **or** hold `hrms.exit.approve` — **self-approval is always blocked**, even for an `hrms.exit.approve` holder.
4. **Clearance** — each seeded line: `POST .../clearance/:lineId/clear` (optional remarks) or `.../waive` (reason required). `POST .../clearance/seed` reseeds an exit whose checklist wasn't auto-seeded (no-op if lines already exist).
5. **Asset lines** — add/edit/remove while the exit is DRAFT…CLEARANCE_PENDING (blocked once READY_FOR_SETTLEMENT or beyond); `POST .../assets/:assetLineId/status` sets RETURNED/NOT_RETURNED/DAMAGED/WAIVED with an optional recovery amount.
6. **Auto-readiness** — every clear/waive/asset-status call re-checks: all clearance lines CLEARED/WAIVED **and** no asset line PENDING → CLEARANCE_PENDING auto-transitions to READY_FOR_SETTLEMENT (no manual "mark ready" action).
7. **Calculate F&F** — `POST /hrms/fnf/:exitId/calculate` (see `HRMS_FNF_CALCULATION.md` for the full component-by-component breakdown). Creates the settlement on first call (CALCULATED); recalculating replaces all component lines. **Blocked** once the settlement is REVIEWED/APPROVED+ (`400`).
8. **Review** — CALCULATED → REVIEWED (no blocker check — a checkpoint before the approve gate).
9. **Approve** — CALCULATED/REVIEWED → APPROVED. **Blocked with `422 FNF_BLOCKERS_UNRESOLVED`** while any exception has `severity: 'BLOCKER'` (e.g. no salary assignment found). Same self-approval block and `hrms.fnf.approve` requirement as exit approval; immutable after (no further recalculation).
10. **Post** — APPROVED → POSTED. Builds one balanced JOURNAL voucher: each EARNING component debits its `mappingKeyHint`, each DEDUCTION credits its `mappingKeyHint`, and the net balances against `EMPLOYEE_FNF_PAYABLE` (net > 0, credit) or `EMPLOYEE_FNF_RECEIVABLE` (net < 0, debit). Idempotent via `FNF_POST:{id}:V1`. **When net ≤ 0, the exit auto-completes right here** (nothing is payable to the employee) — see step 12.
11. **Pay** — POSTED → PAID, **only when net > 0** (a PAYMENT voucher Dr `EMPLOYEE_FNF_PAYABLE` / Cr the treasury bank GL account). Attempting to pay a net ≤ 0 settlement returns **`422 AMOUNT_RECOVERABLE`** — the balance is owed *by* the employee, not to them, and is not collected through this endpoint. Idempotent via `FNF_PAY:{id}:V1`.
12. **Complete exit** (`completeExit`, internal — triggered by post when net ≤ 0, or by pay when net > 0) — employee → `EXITED` (`exitDate`/`lastWorkingDate` = settlement LWD, employment-history entry), linked user deactivated (best-effort, non-fatal if it fails), exit → SETTLED then CLOSED.
13. **Cancel** — any status except SETTLED/CLOSED/CANCELLED, and blocked once the settlement has been reviewed/approved (`400`). Reverts the employee `ON_NOTICE` → `ACTIVE` when applicable; soft-deletes a DRAFT/CALCULATED settlement if one exists. Cancelling an APPROVED+ exit requires `hrms.exit.approve` or ownership.

Canonical services:
- `backend/src/modules/hrms/exit/exit.service.ts` — exit lifecycle (create/update-draft/submit/approve/cancel)
- `backend/src/modules/hrms/exit/exit-clearance.service.ts` — clearance template seeding, clear/waive, asset lines, `recomputeReadiness`
- `backend/src/modules/hrms/exit/notice.util.ts` — `computeNotice` (pure function — see `HRMS_FNF_CALCULATION.md`)
- `backend/src/modules/hrms/exit/fnf-calc.service.ts` — `calculateSettlement` (component derivation + exceptions)
- `backend/src/modules/hrms/exit/fnf.service.ts` — settlement lifecycle (review/approve/post/pay), `completeExit`

## Frontend

- `/hrms/exits`, `/hrms/exits/new`, `/hrms/exits/:id` — register + CRM-style detail (Overview / Notice / Clearance / Assets / Settlement / Timeline)
- `/hrms/fnf`, `/hrms/fnf/:id` — settlement register + earnings/deductions/net, negative recoverable banner, Calculate/Review/Approve/Post/Pay, print snapshot

## APIs

Base: `/api/v1/t/:tenantSlug/hrms/exits` and `/api/v1/t/:tenantSlug/hrms/fnf`

| Area | Paths |
|------|-------|
| Exit list/create | `GET /exits`, `POST /exits`, `GET /exits/mine` |
| Exit detail/edit | `GET /exits/:exitId`, `PATCH /exits/:exitId` (DRAFT only) |
| Exit lifecycle | `POST /exits/:exitId/submit`, `POST /exits/:exitId/approve`, `POST /exits/:exitId/cancel` |
| Clearance | `GET /exits/:exitId/clearance`, `POST /exits/:exitId/clearance/seed`, `POST /exits/:exitId/clearance/:lineId/clear`, `POST /exits/:exitId/clearance/:lineId/waive` |
| Asset lines | `GET /exits/:exitId/assets`, `POST /exits/:exitId/assets`, `PATCH /exits/:exitId/assets/:assetLineId`, `DELETE /exits/:exitId/assets/:assetLineId`, `POST /exits/:exitId/assets/:assetLineId/status` |
| F&F list/detail | `GET /fnf`, `GET /fnf/:exitId` |
| F&F lifecycle | `POST /fnf/:exitId/calculate`, `POST /fnf/:exitId/review`, `POST /fnf/:exitId/approve`, `POST /fnf/:exitId/post`, `POST /fnf/:exitId/pay` |

Swagger stubs generated via `npm run swagger:generate` (auto-documented; enrich in `swagger.ts` if needed).

## Permissions

See `HRMS_PHASE11_PERMISSION_MATRIX.md`.

`GET /hrms/exits/mine` requires **no** HR permission — scoped to the caller's own linked `HrEmployee` via `req.context.userId`.

## Non-goals (Phase 11)

- Recruitment / ATS, performance management, LMS/engagement — explicitly out of scope for this session
- Employee self-service exit-request submission UI (backend `GET /hrms/exits/mine` exists; no FE)
- Statutory-accurate recompute of PF/ESIC/PT/TDS on settlement components (flagged `STATUTORY_NOT_CALCULATED` for manual review)
- Automatic inclusion of unpaid approved overtime in the settlement (flagged `OT_NOT_INCLUDED` for manual addition)
- Portal filing (EPFO/ESIC/TRACES), Form 16/24Q
- Any frontend for exit/offboarding/F&F

## Tests

`backend/tests/hrms/hrms-phase11-exit-fnf.test.ts` — see `HRMS_PHASE11_TEST_RESULTS.md`.
