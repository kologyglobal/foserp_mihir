# HRMS Phase 4 — Leave Management (+ Attendance Sync)

> Verified against code **2026-07-30**. Builds on Phase 1 Employee + Phase 2 Shift/Holiday/Roster.  
> **Note:** A full Attendance Phase 3 product surface was not present in-repo; Phase 4 adds a **minimal attendance read model** (day / punch / exception) so approved leave can sync. Full biometric device APIs, OT, and payroll remain out of scope.

## Goal

```text
Employee → Apply Leave → Manager Approval → Leave Balance
         → Attendance day status LEAVE / HALF_DAY
         → Punch retained + exception when conflict
```

## Domain

| Model | Purpose |
|-------|---------|
| `HrLeaveType` / `HrLeavePolicy` / `HrLeaveBalance` / `HrLeaveRequest` | Leave (from prior leave migration) |
| `HrAttendanceDay` | Daily attendance read model |
| `HrAttendancePunch` | Immutable punch evidence |
| `HrAttendanceException` | Punch-on-leave conflicts |

Migrations:
- `20260730250000_hrms_phase3_leave` (leave tables)
- `20260730260000_hrms_phase4_leave_attendance_sync` (`approvedByEmployeeId` + attendance tables)

## Approve / Cancel sync

| Event | Balance | Attendance |
|-------|---------|------------|
| Submit | `pending += days` | — |
| Approve | pending → used | Upsert day `LEAVE` or `HALF_DAY`; if punch exists → exception, punch kept |
| Reject | pending released | — |
| Cancel APPROVED | used restored | Clear leave day / recalc to PRESENT if punch |

## APIs

- Leave: `/hrms/leave/*` (types, policies, balances, adjust, accrue, preview, requests, approved-days)
- Attendance (minimal): `/hrms/attendance/days`, `/exceptions`, `POST /punches`

## UI

`/hrms/leave`, `/requests`, `/balances`, `/types`, `/apply`

## Permissions

`hrms.leave.*` + `hrms.attendance.view|manage`  
See [`HRMS_PHASE4_PERMISSION_MATRIX.md`](./HRMS_PHASE4_PERMISSION_MATRIX.md).

## Non-goals

OT approval, salary structures, payroll, PF/ESIC/PT/TDS, loans, full biometric device connectors.
