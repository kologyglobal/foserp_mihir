# HRMS Phase 10 — Permission Matrix

| Permission | Description | HR Manager | HR Executive | Supervisor / Operator |
|------------|-------------|------------|--------------|------------------------|
| `hrms.loan.view` | List/get loans & advances (all employees, scoped by LE/branch), loan accounting summary | ✅ | ✅ | ❌ |
| `hrms.loan.create` | Create/edit-draft/submit/cancel a loan or advance request | ✅ | ✅ | ❌ |
| `hrms.loan.approve` | Approve or reject a SUBMITTED request | ✅ | ❌ | ❌ |
| `hrms.loan.disburse` | Disburse an APPROVED loan/advance | ✅ | ❌ | ❌ |
| `hrms.loan.manage` | Skip/manually-recover an installment, close a loan, cancel someone else's APPROVED request, approve without being the reporting manager | ✅ | ❌ | ❌ |
| `hrms.loan.repayment` | Record an early/lump-sum repayment | ✅ | ❌ | ❌ |

`GET /hrms/loans/mine` requires **no** HR permission — it is scoped to the caller's own linked `HrEmployee` record via `req.context.userId`.

**Approver rule (not a permission, enforced in `loan.service.ts#assertCanApprove`):** a SUBMITTED request may be approved/rejected by the employee's **reporting manager** or by anyone holding `hrms.loan.manage` — **self-approval/self-rejection is always blocked**, even for an `hrms.loan.manage` holder whose own employee record raised the request.

**Setup dependencies (Phases 1–9 + master data):**

| Permission | Needed for |
|------------|------------|
| `hrms.payroll.view` / `.calculate` / `.finalize` | Recovery deduction only appears on calculate; recovery is only confirmed on finalize |
| `hrms.salary.assignment.view` | Employee must have an active salary assignment to run payroll at all |
| `hrms.employee.view` | Employee identity shown on loan rows |
| `finance.legal_entity.view` | LE-scoped disbursement/repayment posting and treasury account resolution |
| Accounting: `DefaultAccountMapping` for `EMPLOYEE_LOAN_RECEIVABLE` / `SALARY_ADVANCE_RECEIVABLE` (finance team, not an RBAC permission) | Required before disbursement/repayment posting is even attempted — see the `PARTY_TYPE_NOT_SUPPORTED` known limitation in `HRMS_PHASE10_LOANS_ADVANCES.md` |
| Treasury: an `ACTIVE` `TreasuryAccount` for the legal entity | Required to disburse or repay |

**Deliberate separation of duties:** `hrms.loan.create` (draft/submit/cancel-own) is intentionally **separate** from `.approve` — an HR Executive can help an employee prepare and submit a request, but only an HR Manager (or the reporting manager) can approve it. `.disburse`, `.manage`, and `.repayment` are further split from `.approve` so releasing money, adjusting a live schedule, and recording repayments each require an explicit, narrower grant.

After deploy: `npm run db:sync-permissions` (+6 keys: `hrms.loan.view|create|approve|disburse|manage|repayment`).

Catalog source: `backend/src/constants/permissions.ts` — HR Manager gets all six; HR Executive gets `loan.view|create` only (no approve/disburse/manage/repayment).
