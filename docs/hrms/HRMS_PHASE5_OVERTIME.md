# HRMS Phase 5 — Overtime Management

> Verified against code **2026-07-30**. Builds on Leave + Attendance. **Does not** implement Payroll.

## Goal

```text
Punch → Attendance (worked time) → OT Candidate → Supervisor Approve → Payroll input (later)
```

## Models

| Model | Purpose |
|-------|---------|
| `HrOvertimePolicy` | LE / optional Branch / worker category OT rules |
| `HrOvertimeRecord` | Detected / eligible / approved minutes + status |
| `HrAttendanceDay` extensions | `shiftId`, `firstInAt`, `lastOutAt`, `workedMinutes`, `isFinalized` |

Migration: `20260730270000_hrms_phase5_overtime`

## Detected vs Eligible vs Approved

| Field | Meaning |
|-------|---------|
| `detectedMinutes` | Worked − shift span (from attendance interpretation) |
| `eligibleMinutes` | After policy min / rounding / daily / monthly / WO / holiday / leave gates |
| `approvedMinutes` | Supervisor decision — **payroll consumes this only** |

## Generation

After punch / finalize / leave sync: `regenerateOtCandidate`.

- Unique per employee/date  
- PENDING updated on attendance change  
- APPROVED never silently overwritten → flag `ATTENDANCE_CHANGED_AFTER_OT_APPROVAL`

## APIs

`/hrms/overtime` — list, manual create, approve/reject/cancel, bulk, monthly summary, policies, regenerate  
`POST /hrms/attendance/days/finalize` — finalize day + OT regen

## UI

`/hrms/overtime` — Pending / My Team / Approved / Rejected / Exceptions / All + approve drawer + bulk actions

## Permissions

`hrms.overtime.view|create|approve|manage|override_limit`

## Non-goals

Salary components, payroll, PF/ESIC/PT/TDS, loans.
