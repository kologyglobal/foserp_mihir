# HRMS Phase 3 — Permission Matrix

| Permission | Purpose |
|------------|---------|
| `hrms.leave.view` | List/view requests, types, approved-days source |
| `hrms.leave.apply` | Preview, draft, submit, cancel own/apply path |
| `hrms.leave.approve` | Approve / reject (manager path + scope) |
| `hrms.leave.manage` | Policies; HR override approve when manager unavailable |
| `hrms.leave.balance.view` | View balances |
| `hrms.leave.balance.manage` | Initialize / adjust balances (audited) |
| `hrms.leave.type.manage` | Create / update leave types |

## Roles (seed defaults)

| Role | Leave keys |
|------|------------|
| HR Manager | all leave keys above |
| HR Executive | all leave keys above |

## Scope

LE / Branch via `loadHrScope` + `assertHrAccess` (same as Phase 1–2). Manager approve also requires reporting-manager User match unless `hrms.leave.manage`.
