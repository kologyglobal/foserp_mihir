# HRMS Phase 6 — Permission Matrix

| Permission | Description | HR Manager | HR Executive | Supervisor / Operator |
|------------|-------------|------------|--------------|------------------------|
| `hrms.salary.component.view` | List/view salary components | ✅ | ✅ | ❌ |
| `hrms.salary.component.manage` | Create/edit components | ✅ | ❌ | ❌ |
| `hrms.salary.structure.view` | List/view structures + preview | ✅ | ✅ | ❌ |
| `hrms.salary.structure.manage` | Structure/version/activate | ✅ | ❌ | ❌ |
| `hrms.salary.assignment.view` | View employee salary + effective | ✅ | ✅ | ❌ |
| `hrms.salary.assignment.manage` | Assign / revise salary | ✅ | ❌ | ❌ |

Salary access is **separate** from `hrms.employee.view`. Employee detail Salary section requires assignment view/manage.

After deploy: `npm run db:sync-permissions` (or project equivalent) so catalog keys exist on roles.
