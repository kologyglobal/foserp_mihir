# HRMS Phase 6 — Salary Components + Structures

> Verified against code **2026-07-30**. Builds on Phases 1–5. **Does not** implement Payroll calculation.

## Goal

```text
Salary Components → Structure → Version → Lines → Employee Assignment
→ getEffectiveSalaryStructure (for Payroll Phase 7)
```

## Models

| Model | Purpose |
|-------|---------|
| `HrSalaryComponent` | Earning / deduction / employer contribution definitions |
| `HrSalaryStructure` | Grade/band header (optional LE + worker category) |
| `HrSalaryStructureVersion` | DRAFT / ACTIVE / SUPERSEDED; active is read-only |
| `HrSalaryStructureLine` | FIXED / PERCENTAGE / OT_LINKED / ATTENDANCE_LINKED / STATUTORY |
| `HrEmployeeSalaryAssignment` | Employee ↔ version; revision closes prior row |

Migration: `20260730280000_hrms_phase6_salary_structure`

## Formula rule

Structured only:

- `FIXED` + `fixedAmount`
- `PERCENTAGE` + `percentage` + `percentageOfComponentId` (must be another line on the same version, earlier in sequence)

No JavaScript or free-text formulas. OT / LOP / statutory amounts are **markers only** until Payroll / statutory phases.

## Effective resolution

Canonical service:

`getEffectiveSalaryStructure(tenantId, employeeId, date)`  
→ `backend/src/modules/hrms/salary/effective-salary.service.ts`

Resolves ACTIVE or CLOSED assignments covering the date (history preserved after revision). Frontend must not invent version logic.

## Preview

`POST /hrms/salary/preview` — configuration estimate (FIXED + PERCENTAGE). Not a payroll run.

## APIs

Base: `/api/v1/t/:tenantSlug/hrms/salary`

| Area | Paths |
|------|--------|
| Components | `GET/POST /components`, `GET/PATCH /components/:id` |
| Structures | `GET/POST /structures`, `GET/PATCH /structures/:id` |
| Versions | `POST /structures/:id/versions`, `GET/PATCH /versions/:id`, `POST /versions/:id/activate` |
| Assignments | `GET/POST /assignments`, `POST /assignments/:id/revise` |
| Effective | `GET /employees/:employeeId/effective?date=` |
| Preview | `POST /preview` |

## UI

| Route | Purpose |
|-------|---------|
| `/hrms/payroll/setup/components` | Component register |
| `/hrms/payroll/setup/structures` | Structure register |
| `/hrms/payroll/setup/structures/:id` | Version + lines; Save Draft / Activate |
| `/hrms/employees` | Employee list + Salary section (assignment permission) |

## Permissions

| Key | HR Manager | HR Executive | Supervisor |
|-----|------------|--------------|------------|
| `hrms.salary.component.view` | ✅ | ✅ | ❌ |
| `hrms.salary.component.manage` | ✅ | ❌ | ❌ |
| `hrms.salary.structure.view` | ✅ | ✅ | ❌ |
| `hrms.salary.structure.manage` | ✅ | ❌ | ❌ |
| `hrms.salary.assignment.view` | ✅ | ✅ | ❌ |
| `hrms.salary.assignment.manage` | ✅ | ❌ | ❌ |

See also `HRMS_PHASE6_PERMISSION_MATRIX.md`.

## Non-goals (stop here)

Payroll run, payslip, PF/ESIC/PT/TDS calculation, payroll accounting, loans/advances.
