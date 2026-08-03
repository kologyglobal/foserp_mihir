# HRMS Phase 4 — Permission Matrix

| Permission | Purpose |
|------------|---------|
| `hrms.leave.view` | Requests, types list, approved-days |
| `hrms.leave.apply` | Preview, draft, submit, cancel |
| `hrms.leave.approve` | Approve / reject (manager + scope) |
| `hrms.leave.manage` | Policies; HR override approve |
| `hrms.leave.balance.view` | Balances |
| `hrms.leave.balance.manage` | Upsert / adjust / accrue |
| `hrms.leave.type.manage` | Leave types |
| `hrms.attendance.view` | Days + exceptions |
| `hrms.attendance.manage` | Record punches (UAT / controlled) |

HR Manager / HR Executive seed roles include the above leave + attendance keys.
