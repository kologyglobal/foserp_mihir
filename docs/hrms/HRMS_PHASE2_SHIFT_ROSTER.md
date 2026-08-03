# HRMS Phase 2 — Shift, Holiday & Roster

> Verified against code **2026-07-30**. Builds on Phase 1 Employee foundation. **Does not** implement Attendance.

## Goal

Scheduling foundation before attendance:

```text
Employee → Shift Template → Holiday Calendar → Roster / Shift Assignment
```

## Models

| Model | Purpose |
|-------|---------|
| `HrShiftTemplate` | Shift definitions incl. overnight (`22:00→06:00`) |
| `HrHolidayCalendar` | LE (+ optional Branch) calendar for a year |
| `HrHolidayCalendarDay` | Holiday rows (unique per calendar/date) |
| `HrEmployeeShiftAssignment` | Effective-dated ROSTER / TEMPORARY / DEFAULT assignments |
| `HrEmployee.defaultShiftId` | Default shift (not historical attendance authority) |
| `HrEmployee.weeklyOffDay` | Optional employee weekly-off override (0=Sun…6=Sat) |

Migration: `backend/prisma/migrations/20260730240000_hrms_phase2_shift_roster/`

## Canonical services (Attendance must reuse)

| Service | Path |
|---------|------|
| `getEffectiveShift(tenantId, employeeId, date)` | `backend/src/modules/hrms/shared/effective-shift.service.ts` |
| `getHoliday(tenantId, employeeId, date)` | `backend/src/modules/hrms/shared/holiday-resolution.service.ts` |

### Effective shift priority

1. `TEMPORARY` assignment covering the date  
2. `ROSTER` assignment covering the date  
3. `HrEmployee.defaultShiftId`

Returns shift snapshot metadata + `weeklyOffDay` / `isWeeklyOff`. Frontend must not invent this logic.

### Holiday resolution

Prefer active **branch** calendar day for the employee’s branch/year; else **legal-entity-wide** (`branchId` null).

## APIs

Base: `/api/v1/t/:tenantSlug/hrms`

| Method | Path | Permission |
|--------|------|------------|
| GET/POST | `/shifts` | `hrms.shift.view` / `.manage` |
| GET/PATCH | `/shifts/:shiftId` | view / manage |
| GET/POST | `/holidays` | `hrms.holiday.view` / `.manage` |
| GET/PATCH | `/holidays/:calendarId` | view / manage |
| POST/PATCH/DELETE | `/holidays/:calendarId/days[/:dayId]` | manage |
| GET | `/holidays/resolve?employeeId&date` | view |
| GET | `/roster/grid?from&to&…` | `hrms.roster.view` |
| GET | `/roster/effective-shift?employeeId&date` | view |
| POST | `/roster/assignments` | manage |
| POST | `/roster/assignments/bulk` | manage |
| POST | `/roster/assignments/copy` | manage |
| POST | `/roster/assignments/clear` | manage |

Employee PATCH accepts `defaultShiftId` / `weeklyOffDay` (writes employment history `DEFAULT_SHIFT`).

## UI routes

| Route | Page |
|-------|------|
| `/hrms/shifts`, `/new`, `/:id` | Shift register + form |
| `/hrms/holidays`, `/new`, `/:id` | Calendars + days |
| `/hrms/roster` | Weekly board (assign / bulk / clear cell) |
| `/hrms/setup/designations` | Phase 1 designation setup |
| `/hrms/employees` | Landing (Phase 1 register APIs live; rich FE may follow) |

API mode only (`VITE_USE_API=true`).

## Rules

- Overnight: end ≤ start ⇒ overnight span across midnight  
- Break &lt; shift duration; positive full/half day minima  
- Same-source assignment date ranges cannot overlap  
- TEMPORARY may overlay ROSTER (priority resolves)  
- LE/Branch scope enforced on write; holiday list allows LE-wide calendars for branch-scoped users  
- Soft-delete only for holiday days / assignments  

## Permissions

`hrms.shift.view|manage`, `hrms.holiday.view|manage`, `hrms.roster.view|manage`  
Granted to **HR Manager** / **HR Executive** (plus Tenant Admin via catalog).

## Explicit non-goals (stop here)

Attendance punches/calc, leave, OT approval, payroll, statutory engines.
