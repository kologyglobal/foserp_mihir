# HRMS Phase 7 — Permission Matrix

| Permission | Description | HR Manager | HR Executive | Supervisor / Operator |
|------------|-------------|------------|--------------|------------------------|
| `hrms.payroll.view` | List periods/runs, employee results, exceptions | ✅ | ✅ | ❌ |
| `hrms.payroll.create` | Create period/run; cancel DRAFT/CALCULATED run | ✅ | ❌ | ❌ |
| `hrms.payroll.calculate` | Execute / recalculate open run | ✅ | ❌ | ❌ |
| `hrms.payroll.review` | Move CALCULATED → REVIEWED | ✅ | ❌ | ❌ |
| `hrms.payroll.finalize` | Finalize run; close period when last open run done | ✅ | ❌ | ❌ |

**Setup dependencies (Phase 6 + master data):**

| Permission | Needed for |
|------------|------------|
| `hrms.salary.component.view/manage` | Component register |
| `hrms.salary.structure.view/manage` | Structure + activate |
| `hrms.salary.assignment.view/manage` | Employee salary assignment |
| `hrms.employee.view/create/edit` | Employee master |
| `hrms.designation.view/manage` | Designation |
| `hrms.shift.view/manage` | Default shift / weekly off |
| `hrms.attendance.view/manage` | Attendance days (or prisma seed in tests) |
| `hrms.overtime.view/approve` | OT approval (Phase 5) |
| `finance.legal_entity.view` | Period LE scope |
| `finance.branch.view` | Optional branch-scoped run |
| `organisation.view` | Module access baseline |

Payroll permissions are **separate** from salary view — granting salary alone does not expose payroll runs.

After deploy: `npm run db:sync-permissions` so catalog keys exist on roles.
