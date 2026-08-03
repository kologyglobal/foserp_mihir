# HRMS Phase 3 — Leave Management

> Built on Phase 1 Employee + Phase 2 Shift/Holiday/Roster. **Does not** implement Attendance or Payroll.

## Goal

```text
Employee → Apply Leave → Manager Approval → Leave Balance
         → Approved leave source for Attendance (later)
```

## Models

| Model | Purpose |
|-------|---------|
| `HrLeaveType` | CL/SL/EL/LOP… tenant-configurable |
| `HrLeavePolicy` | LE / optional Branch / worker category; holiday & weekly-off exclusion |
| `HrLeavePolicyLeaveType` | Policy ↔ type links |
| `HrLeaveBalance` | Per employee / type / year |
| `HrLeaveBalanceAdjustment` | Audited HR adjustments |
| `HrLeaveRequest` | Draft → Submit → Approve/Reject/Cancel |

Migration: `20260730250000_hrms_phase3_leave`

## Day calculation (backend only)

`calculateLeaveDays` uses:

- `getEffectiveShift` → weekly off  
- `getHoliday` → holiday  
- Policy `excludeHolidays` / `excludeWeeklyOff`  
- Half day = 0.5 on a single date  

`POST /hrms/leave/preview` returns requested days, available, balance after approval.

## Lifecycle

| Action | Balance effect |
|--------|----------------|
| Submit | `pending += days` (blocks if insufficient unless negative allowed) |
| Approve | `pending -= days`, `used += days` |
| Reject | `pending -= days` |
| Cancel APPROVED | `used -= days` |
| Cancel SUBMITTED | `pending -= days` |

Overlap: block vs other `SUBMITTED` / `APPROVED` ranges.

Approver: reporting manager’s linked User, or `hrms.leave.manage` (HR).

## Attendance hook

`GET /hrms/leave/approved-days?employeeId&from&to` — canonical approved leave for Attendance Phase. **No fake attendance rows.**

## APIs

Base: `/api/v1/t/:tenantSlug/hrms/leave`

- `/types`, `/policies`, `/balances`, `/balances/adjust`
- `/preview`, `/requests`, lifecycle actions
- `/approved-days`

## UI

`/hrms/leave`, `/requests`, `/balances`, `/types`, `/apply`

## Permissions

See [`HRMS_PHASE3_PERMISSION_MATRIX.md`](./HRMS_PHASE3_PERMISSION_MATRIX.md).

`hrms.leave.view|apply|approve|manage`  
`hrms.leave.balance.view|manage`  
`hrms.leave.type.manage`

## Non-goals

Attendance engine, OT, salary, payroll, statutory.
