# HRMS Phase 11 — Permission Matrix

| Permission | Description | HR Manager | HR Executive | Supervisor / Operator |
|------------|-------------|------------|--------------|------------------------|
| `hrms.exit.view` | List/get exits (all employees, scoped by LE/branch) | ✅ | ✅ | ❌ |
| `hrms.exit.create` | Create/edit-draft/submit an exit request | ✅ | ✅ | ❌ |
| `hrms.exit.approve` | Approve a SUBMITTED exit; cancel an APPROVED+ exit on behalf of someone else | ✅ | ❌ | ❌ |
| `hrms.exit.clearance` | Seed/clear/waive clearance lines; add/edit/remove/status asset lines | ✅ | ✅ | ❌ |
| `hrms.fnf.view` | List/get full & final settlements | ✅ | ✅ | ❌ |
| `hrms.fnf.calculate` | Calculate/recalculate the F&F settlement | ✅ | ✅ | ❌ |
| `hrms.fnf.approve` | Review **and** approve the settlement (both actions gated on the same key) | ✅ | ❌ | ❌ |
| `hrms.fnf.post` | Post the approved settlement to the GL | ✅ | ❌ | ❌ |
| `hrms.fnf.pay` | Record payment of a POSTED settlement (net > 0 only) | ✅ | ❌ | ❌ |

`GET /hrms/exits/mine` requires **no** HR permission — it is scoped to the caller's own linked `HrEmployee` record via `req.context.userId`.

**Approver rule (not a permission, enforced in `exit.service.ts#assertCanApprove` / `fnf.service.ts#approveSettlement`):** an exit or its settlement may be approved by the employee's **reporting manager** or anyone holding `hrms.exit.approve` / `hrms.fnf.approve` — **self-approval is always blocked**, even for a permission holder whose own employee record raised the request.

**Deliberate separation of duties:** `hrms.exit.create`/`hrms.exit.clearance` (raise/progress an exit, run the clearance checklist) and `hrms.fnf.calculate` (compute a draft settlement for review) are intentionally **separate** from the approval/post/pay keys — an HR Executive can prepare everything up to a reviewable settlement, but only an HR Manager (or the reporting manager, for exit approval specifically) can approve the exit, approve/post/pay the settlement, or reverse it.

**Setup dependencies (Phases 6–10 + master data):**

| Permission | Needed for |
|------------|------------|
| `hrms.employee.view` | Employee identity shown on exit/settlement rows |
| `hrms.salary.assignment.view` | An effective salary assignment avoids the `NO_SALARY_ASSIGNMENT` BLOCKER on calculate |
| `finance.legal_entity.view` | LE-scoped posting and treasury account resolution |
| Accounting: `DefaultAccountMapping` for `EMPLOYEE_FNF_PAYABLE` / `EMPLOYEE_FNF_RECEIVABLE` and any component mapping key actually used (`SALARY_BASIC_EXPENSE`, `LEAVE_ENCASHMENT_EXPENSE`, `NOTICE_PAY_EXPENSE`, `NOTICE_RECOVERY_INCOME`, `ASSET_RECOVERY_INCOME`, `EMPLOYEE_LOAN_RECEIVABLE`, `SALARY_ADVANCE_RECEIVABLE`) (finance team, not an RBAC permission) | Required before post is even attempted — missing mapping → `422 MISSING_FNF_ACCOUNT_MAPPING` |
| Treasury: an `ACTIVE` `TreasuryAccount` for the legal entity | Required to pay (net > 0 settlements only) |

After deploy: `npm run db:sync-permissions` (+9 keys: `hrms.exit.view|create|approve|clearance`, `hrms.fnf.view|calculate|approve|post|pay`).

Catalog source: `backend/src/constants/permissions.ts` — HR Manager gets all nine; HR Executive gets `exit.view|create|clearance` + `fnf.view|calculate` only (no exit approve, no fnf approve/post/pay).
