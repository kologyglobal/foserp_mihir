# HRMS Phase 9 — Permission Matrix

| Permission | Description | HR Manager | HR Executive | Supervisor / Operator |
|------------|-------------|------------|--------------|------------------------|
| `hrms.payslip.view` | List/get payslips (all employees), HTML render | ✅ | ✅ | ❌ |
| `hrms.payslip.generate` | Generate payslips for a FINALIZED run | ✅ | ✅ | ❌ |
| `hrms.payroll.accounting.view` | Read the run's accounting post status | ✅ | ✅ | ❌ |
| `hrms.payroll.accounting.post` | Post the payroll accrual journal to GL | ✅ | ❌ | ❌ |
| `hrms.salary_payment.view` | List/get salary payment batches | ✅ | ✅ | ❌ |
| `hrms.salary_payment.create` | Create a batch; mark Ready; cancel | ✅ | ✅ | ❌ |
| `hrms.salary_payment.approve` | Approve a READY batch | ✅ | ❌ | ❌ |
| `hrms.salary_payment.confirm` | Confirm payment results (PAID/FAILED) on an APPROVED batch | ✅ | ❌ | ❌ |
| `hrms.salary_payment.export` | Export the bank upload CSV | ✅ | ❌ | ❌ |

`GET /hrms/payroll/payslips/mine` requires **no** HR permission — it is scoped to the caller's own linked `HrEmployee` record via `req.context.userId`.

**Setup dependencies (Phases 1–8 + master data):**

| Permission | Needed for |
|------------|------------|
| `hrms.payroll.view` / `hrms.payroll.finalize` | The run must reach FINALIZED before payslips or accounting can be actioned |
| `hrms.salary.structure.view` / `hrms.salary.assignment.view` | Salary lines feeding payslip earnings/deductions |
| `hrms.employee.view` | Employee identity + bank details shown on payslips/batches |
| `finance.legal_entity.view` | LE-scoped accounting post and treasury account resolution |
| Accounting: `DefaultAccountMapping` configured (finance team, not an RBAC permission) | Posting fails with `MISSING_PAYROLL_ACCOUNT_MAPPING` otherwise |
| Treasury: an `ACTIVE` `TreasuryAccount` for the legal entity | Required to create a payment batch |

**Deliberate separation of duties:** `hrms.salary_payment.create` (draft + ready + cancel) is intentionally **separate** from `.approve` and `.confirm` — a payroll executive can prepare a batch, but releasing money (approve) and confirming the bank outcome (confirm) require the stricter HR Manager-level grants. `hrms.payroll.accounting.post` is likewise separate from `.view` so more people can see posting status than can trigger a GL entry.

After deploy: `npm run db:sync-permissions` (+9 keys: `hrms.payslip.view|generate`, `hrms.payroll.accounting.view|post`, `hrms.salary_payment.view|create|approve|confirm|export`).

Catalog source: `backend/src/constants/permissions.ts` — HR Manager gets all nine; HR Executive gets `payslip.view|generate`, `payroll.accounting.view`, `salary_payment.view|create` (no post/approve/confirm/export).
