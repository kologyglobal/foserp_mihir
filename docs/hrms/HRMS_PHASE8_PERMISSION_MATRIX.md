# HRMS Phase 8 — Permission Matrix

| Permission | Description | HR Manager | HR Executive | Supervisor / Operator |
|------------|-------------|------------|--------------|------------------------|
| `hrms.statutory.view` | List/get rules; employee statutory profile read; `/resolve` | ✅ | ✅ | ❌ |
| `hrms.statutory.manage` | Create/edit DRAFT rules; wage basis; PT slabs; activate; profile PATCH (with override fields when reason supplied) | ✅ | ❌ | ❌ |
| `hrms.statutory.override` | Profile PATCH for applicability / manual TDS (alternative to manage for override-only roles) | ✅ | ❌ | ❌ |
| `hrms.statutory.reports` | Statutory registers JSON + CSV export | ✅ | ✅ | ❌ |

**Setup dependencies (Phases 1–7 + master data):**

| Permission | Needed for |
|------------|------------|
| `hrms.payroll.view` | View payroll runs whose results feed registers |
| `hrms.payroll.calculate` | End-to-end statutory line generation via calculate |
| `hrms.salary.component.view/manage` | Salary components referenced in wage basis |
| `hrms.salary.structure.view/manage` | Structure assignment for payroll calc |
| `hrms.salary.assignment.view/manage` | Employee salary assignment |
| `hrms.employee.view/edit` | Employee master + statutory identifiers (UAN, PAN, ESIC) |
| `finance.legal_entity.view` | LE-scoped rules |
| `finance.branch.view` | Branch `stateCode` for PT/LWF resolution |
| `organisation.view` | Module access baseline |

Statutory permissions are **separate** from payroll view — granting payroll alone does not expose rule management.

Profile PATCH accepts either `hrms.statutory.manage` **or** `hrms.statutory.override` via `requireAnyPermission`.

After deploy: `npm run db:sync-permissions` (+4 keys: `hrms.statutory.view|manage|override|reports`).

Catalog source: `backend/src/constants/permissions.ts` — HR Manager gets all four; HR Executive gets `view` + `reports` only.
