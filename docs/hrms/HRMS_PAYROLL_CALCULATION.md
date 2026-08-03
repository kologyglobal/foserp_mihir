# HRMS Payroll Calculation Reference

> Phase 7 engine — **2026-07-31**. For statutory amounts see non-goals in `HRMS_PHASE7_PAYROLL.md`.

## Paid days

Source: `computePaidDaysBreakdown(tenantId, employeeId, periodStart, periodEnd)`

Resolution order **per calendar date** within the employee eligibility window:

1. **Holiday** (tenant/branch holiday table via `getHoliday`) → payable 1
2. **Weekly off** (effective shift via `getEffectiveShift`) → payable 1
3. **Attendance day** (`HrAttendanceDay`):
   - `PRESENT` / `ON_DUTY` → present 1, payable 1
   - `ABSENT` → LOP 1
   - `LEAVE` → paid/unpaid from leave type `paid` flag
   - `HALF_DAY` → 0.5 paid leave or LOP + optional 0.5 present if punch
   - Missing row → LOP 1 (`MISSING_ATTENDANCE` warning)

**Eligibility window** clamps period to join date and (for EXITED/INACTIVE) last working day from employment history.

**Basis days** = full calendar days in period (typically month length).  
**Payable days** = sum of daily payable fractions (present + paid leave + weekly off + holiday).

Warnings (non-blocking unless escalated at finalize): missing attendance bulk, unknown leave type.

## Component calculation types

Applied per **salary assignment segment** (see mid-month below). Sequence order matters for PERCENTAGE bases.

| Type | Behaviour |
|------|-----------|
| **FIXED** | `fixedAmount × (segmentPayableDays / basisDays)`; optional monthly cap |
| **PERCENTAGE** | `%` of an earlier line's **resolved segment amount** on same version |
| **ATTENDANCE_LINKED** | Earning: prorate like FIXED. Component code `LOP`: deduction `lopDays × (base / basisDays)` on **final segment only** |
| **OT_LINKED** | `(approvedOtMinutes / 60) × hourlyRate` where hourly rate = line `fixedAmount`; final segment only; BLOCKER if OT minutes > 0 but no rate |
| **STATUTORY** | Placeholder — amount 0, `STATUTORY_DATA_MISSING` WARNING (engine deferred) |

**Gross** = sum of EARNING component amounts (all segments merged by component id).  
**Deduction** = sum of DEDUCTION lines. **Net** = gross − deduction.

## Overtime

- Sums **APPROVED** `HrOvertimeRecord.approvedMinutes` in period.
- PENDING OT excluded from pay; WARNING on calculate, BLOCKER on finalize if still pending for included employees.

## Mid-month salary revision

When multiple `HrEmployeeSalaryAssignment` rows overlap the period:

1. Split period into segments by assignment effective dates (clamped to eligibility window).
2. Each segment: resolve FIXED/PERCENTAGE/ATTENDANCE_LINKED earnings using **segment payable days** (sum of daily payable in segment range).
3. OT_LINKED, LOP, STATUTORY: resolved on **final segment only** (avoid double count).
4. Merge component amounts across segments.

`calculationNotesJson` on employee result records multi-segment runs.

## Effective salary

Uses Phase 6 `getEffectiveSalaryStructure` indirectly via assignment + version lines at calculation time. No separate preview endpoint in Phase 7 — use run calculate on DRAFT run.

## Exceptions

| Code | Severity | When |
|------|----------|------|
| `MISSING_SALARY_STRUCTURE` | BLOCKER | No assignment/version |
| `STATUTORY_DATA_MISSING` | WARNING | STATUTORY line present |
| `OT_RATE_NOT_CONFIGURED` | BLOCKER | OT minutes but no rate on line |
| `PENDING_OT_APPROVAL` | WARNING (calc) / BLOCKER (finalize) | Unapproved OT in period |
| `MISSING_BANK_DETAILS` | WARNING | No primary bank on employee |
| `UNRESOLVED_ATTENDANCE_EXCEPTION` | BLOCKER | Open attendance exceptions |
| `NO_ELIGIBLE_EMPLOYEES` | WARNING | Run-level empty cohort |

## Pragmatic test note

Full-month attendance seeding is not required for engine validation — partial days still produce prorated FIXED/PERCENTAGE and valid `CALCULATED` status when salary assignment exists.
