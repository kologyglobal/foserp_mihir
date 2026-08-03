# HRMS UI/UX Redesign

**Date:** 2026-07-31  
**Scope:** Frontend-only Zoho People–inspired redesign of `/hrms/*`  
**Verdict:** **READY WITH CONDITIONS**

## Goal

Make HRMS feel like a dedicated modern HR product:

Zoho People simplicity + FOS CRM consistency + manufacturing operational clarity.

No backend business-rule changes. Existing APIs reused. Permissions remain authoritative.

## Shared components

| Component | Role |
|-----------|------|
| `HrPageHeader` | Title / subtitle / actions band |
| `HrKpiStrip` | Compact KPI strip (`EnterpriseKpiStrip`) |
| `HrStatusChip` | Human-readable status chips |
| `HrRegisterShell` | Search + filters + table + pagination |
| `HrFilterBar` | *(via register shell filter slot)* |
| `HrEmployeeCell` | Avatar + name + code |
| `HrEmployeeHeader` | *(via `HrPageHeader` + 360 header)* |
| `HrInfoSection` | 2-col definition sections |
| `HrSmartContext` | Right factbox |
| `HrApprovalDrawer` | Approve/reject drawer |
| `HrMoneySummary` | Money totals strip |
| `HrTimeline` | Vertical timeline |
| `HrEmptyState` | Empty / no-access |
| `HrExceptionPanel` | Needs Attention list |
| `HrStepIndicator` | Guided lifecycle steps |
| `HrChecklist` | Clearance-style checklist |
| `HrPayslipDocument` | Printable payslip preview |
| `hrStatusLabels` / `hrFormat` | Enum → labels, date/money/minutes |

Styles: `frontend/src/modules/hrms/hrms-ui.css` (white/light, compact, no purple/glow).

## Routes redesigned

| Route | Page |
|-------|------|
| `/hrms` | Action-oriented home |
| `/hrms/employees` | Employee register |
| `/hrms/employees/new` · `/:id/edit` | Add/Edit employee (no bank/salary on create) |
| `/hrms/employees/:id` | Employee 360 (lazy tabs) |
| `/hrms/my` | My HR self-service |
| `/hrms/attendance` | Exception-first daily register + drawer |
| `/hrms/shifts` · `/holidays` · `/roster` | Time setup / visual roster |
| `/hrms/leave*` | Leave hub / apply / requests / balances / types |
| `/hrms/overtime` | OT approval workspace |
| `/hrms/payroll/runs*` | Guided payroll process |
| `/hrms/payroll/payslips` · `my-payslips` | Payslip register + document |
| `/hrms/payroll/payments` | Salary payment batches |
| `/hrms/payroll/setup/*` · `statutory*` | Salary / statutory setup |
| `/hrms/loans*` · `my-loans` | Loans & advances |
| `/hrms/exits*` · `/fnf*` | Exit + F&F guided |
| `/hrms/setup` | HR Settings hub |

Demo mode still shows `HrmsApiRequiredPage` (API mode required).

## Navigation

HRMS nav regrouped: Overview · People · Time · Leave · Overtime · Payroll · Finance · Exit · Setup · Self-service.  
Departments links to existing Admin `/admin/departments` (no duplicate HR department model).

## APIs

**Reused** from `frontend/src/services/api/hrmsApi.ts` (list/get/create/update employees, attendance days/exceptions/punches, leave, OT, payroll, payslips, payment batches, loans, exits, F&F, roster, shifts, holidays, designations, statutory).

**Frontend API additions (client only):** employee get/create/update/history/docs/bank/statutory getters; attendance list/exceptions/punch; leave `mine` balance filter where supported.

**Backend contracts:** unchanged for business rules. No payroll/accounting logic rewritten.

## Permissions

UI continues to gate via `useHrmsPermissions` (`frontend/src/utils/permissions/hrms.ts`).  
Sensitive salary/bank/PAN/Aadhaar/statutory surfaces require sensitive / salary / payroll permissions — not bare `hrms.employee.view`.

## Responsive

- Desktop: full registers + side context  
- Tablet: compact tables  
- Mobile: My HR + drawers prioritized; dense payroll admin remains desktop-first by design  

## Evidence

- Frontend `npx tsc -b --noEmit` — **PASS** (2026-07-31)  
- Live SPA smoke / screenshots — **not run in this pass** (no attached browser UAT)

## Remaining UX gaps

1. Dedicated Leave **Approvals** nav item (approvals live inside Leave hub / requests tabs).  
2. Some transactional panels (loan disburse/repay, exit asset add, F&F pay) still use older slide-ins vs `HrApprovalDrawer`.  
3. Attendance drawer shows calculated day + exceptions; full punch evidence list depends on day payload (firstIn/lastOut always shown; per-punch list when API returns it).  
4. My HR lacks a hard “linked employee for current user” resolver — cards link to hubs.  
5. Employee 360 Attendance/OT tabs are read lists, not full workspaces.  
6. No visual screenshot pack / human UAT completed yet.  
7. Leave Calendar tab is light / optional vs full month grid.

## UAT checklist (manual)

- [ ] `/hrms` KPIs + Needs Attention + Quick Actions (API mode)  
- [ ] Employees register filters/pagination → 360 tabs (permission-gated)  
- [ ] Add Employee: no bank/statutory/salary on create  
- [ ] Attendance date nav + row drawer + import punch (manage)  
- [ ] Roster cell assign / bulk / clear  
- [ ] Leave apply preview (requested / available / after) + approve/reject  
- [ ] OT pending drawer approve with editable minutes  
- [ ] Payroll run step strip + employee breakdown + payslip document/PDF  
- [ ] Loan detail money summary + recovery schedule  
- [ ] Exit progress + clearance checklist + F&F net settlement  
- [ ] My HR quick links  
- [ ] Confirm salary/bank hidden without sensitive perms  

## Verdict

**HRMS UI/UX: READY WITH CONDITIONS**

Conditions: complete manual SPA UAT above; migrate/sync already required for Phase 1–11 backends; polish remaining transactional drawers + Approvals nav if product wants exact Zoho IA.
