# HRMS Full & Final (F&F) Settlement Calculation Reference

> Phase 11 engine — **2026-07-31**. Companion to `HRMS_PAYROLL_CALCULATION.md` (Phase 7) — F&F does **not** re-run the payroll engine; it estimates the exit-month pending salary and applies exit-specific components on top.

## Notice period reconciliation — `computeNotice`

`backend/src/modules/hrms/exit/notice.util.ts` — pure function, called once at exit **approval** time (not recalculated at F&F calculate).

```ts
computeNotice(requiredDays: number, resignationDate: Date | string | null | undefined, lastWorkingDate: Date | string): { served, shortfall, excess }
```

| Input | Output |
|-------|--------|
| `resignationDate` present | `served` = calendar days between resignation and (approved) last working date, floored at 0 |
| `resignationDate` absent (e.g. employer-initiated `TERMINATION`) | `served = 0` — there is no "serving" window to measure, so the **full contractual requirement is treated as shortfall**; the employer decides recover/pay/none via `noticeSettlementMode` |
| `served ≥ required` | `shortfall = 0`, `excess = served − required` |
| `served < required` | `shortfall = required − served`, `excess = 0` |
| `requiredDays < 0` (defensive) | clamped to `0` before comparison |

Results (`noticeServedDays`/`noticeShortfallDays`/`noticeExcessDays`) are persisted on `HrEmployeeExit` at approval and read (not recomputed) by the F&F calculator.

## Settlement components — `calculateSettlement`

`backend/src/modules/hrms/exit/fnf-calc.service.ts`. Runs once per calculate/recalculate call, always **replaces** all `HrFnfComponent` rows for the settlement (never appends). Requires `exit.approvedLastWorkingDate` to be set (i.e. the exit must be at least APPROVED) and the exit not CANCELLED.

| # | Component | Kind | Condition | Formula | Mapping key |
|---|-----------|------|-----------|---------|-------------|
| 1 | `PENDING_SALARY` | EARNING | Effective salary assignment found for the LWD | `monthlyGross × payableDays / basisDays` (uses `computePaidDaysBreakdown` for the exit-month-to-date window when available, else a simple calendar-day fraction) | `SALARY_BASIC_EXPENSE` |
| 2 | `LEAVE_ENCASHMENT_{code}` | EARNING | Leave type has `fnfSettlementAction = ENCASH` and the employee has a positive year balance | `min(available, maxEncashDays ?? available) × (monthlyGross / 30)` | `LEAVE_ENCASHMENT_EXPENSE` |
| 3 | *(none — exception only)* | — | Always | `OT_NOT_INCLUDED` WARNING — approved unpaid overtime is **not** auto-included; add manually if applicable | — |
| 4 | `NOTICE_RECOVERY` | DEDUCTION | `noticeShortfallDays > 0`, mode = `recover`, salary available | `(monthlyGross / 30) × noticeShortfallDays` | `NOTICE_RECOVERY_INCOME` |
| 4′ | `NOTICE_PAY` | EARNING | `noticeShortfallDays > 0`, mode = `pay`, salary available | `(monthlyGross / 30) × noticeShortfallDays` | `NOTICE_PAY_EXPENSE` |
| 5 | `LOAN_RECOVERY` / `ADVANCE_RECOVERY` | DEDUCTION | One line per `HrEmployeeLoan` still DISBURSED/RECOVERING with `outstandingAmount > 0` | Full outstanding balance — **snapshot only, the loan record is never mutated by F&F** | `EMPLOYEE_LOAN_RECEIVABLE` / `SALARY_ADVANCE_RECEIVABLE` |
| 6 | `ASSET_RECOVERY` | DEDUCTION | Any `HrExitAssetLine` with `recoveryAmount > 0` (any status) | Sum of all such asset-line recovery amounts | `ASSET_RECOVERY_INCOME` |
| 7 | *(none — exception only)* | — | Always | `STATUTORY_NOT_CALCULATED` WARNING — PF/ESIC/PT/TDS on settlement components are **not** auto-calculated; review manually before approval | — |

`earningsTotal` = sum of EARNING amounts. `deductionsTotal` = sum of DEDUCTION amounts. `netSettlement = earningsTotal − deductionsTotal` (can be **negative** — see below).

## Exceptions (WARNING vs BLOCKER)

Persisted as `exceptionsJson` on the settlement; returned as `exceptions: [{ code, severity, message }]`.

| Severity | Behaviour |
|----------|-----------|
| `WARNING` | Informational only — never blocks review/approve/post/pay. Examples: `PENDING_SALARY_ESTIMATED`, `LEAVE_ENCASHMENT_SKIPPED`, `OT_NOT_INCLUDED`, `NOTICE_SETTLEMENT_SKIPPED`, `STATUTORY_NOT_CALCULATED` |
| `BLOCKER` | **Blocks F&F approve** (`422 FNF_BLOCKERS_UNRESOLVED`, lists every unresolved blocker code) until resolved and recalculated. Currently only `NO_SALARY_ASSIGNMENT` (no effective salary assignment found for the LWD — pending salary and notice pay/recovery cannot be estimated without a daily rate) |

Review is **not** gated on blockers (a deliberate checkpoint before the harder approve gate); recalculation is only permitted while the settlement is DRAFT/CALCULATED (blocked once REVIEWED/APPROVED+).

## Negative net settlement policy

`netSettlement` can be negative — e.g. asset non-return recovery, loan outstanding, or notice recovery exceeding the pending salary/leave encashment earned. This is a **normal, supported outcome**, not an error:

- **Post** (`POST /fnf/:exitId/post`) posts the balanced GL entry regardless of sign — Dr `EMPLOYEE_FNF_RECEIVABLE` for `|net|` when `net < 0` (instead of crediting `EMPLOYEE_FNF_PAYABLE`). **The exit auto-completes immediately after posting when `net ≤ 0`** — there is nothing further to disburse, so the employee moves straight to `EXITED` and the exit to `CLOSED` without waiting for a payment step.
- **Pay** (`POST /fnf/:exitId/pay`) is **only valid for `net > 0`**. Attempting to pay a `net ≤ 0` settlement returns **`422 AMOUNT_RECOVERABLE`** ("This settlement has no amount payable to the employee — the balance is recoverable from them instead"). Recovering that balance from the employee (e.g. via a separate manual journal, adjustment, or deduction from another source) is **out of scope for Phase 11** — the F&F module tracks and posts the receivable but does not chase collection.

Covered by both the unit tests (`computeNotice` shortfall/excess/no-resignation-date cases) and a live test that drives a real negative-net settlement (asset recovery dominating a small salary) through calculate → review → approve → post → blocked pay, per `HRMS_PHASE11_TEST_RESULTS.md`.
