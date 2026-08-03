# HRMS Phase 8 — UAT

Prerequisites: migrations through `20260731030000_hrms_phase8_statutory` (+ Phase 6 salary + Phase 7 payroll), `npm run db:sync-permissions`, HR Manager role with statutory + payroll + salary perms, API mode (`VITE_USE_API=true`).

## A. Statutory hub & PF rule

HR → Payroll → **Statutory** (`/hrms/payroll/statutory`). Open **PF**.  
Create rule `PF-DEFAULT`, effective `2026-01-01`, employee/employer rate 12%, wage ceiling ₹15,000.  
Set wage basis to **BASIC** only. **Activate**. Expect ACTIVE; editing name on ACTIVE rule → blocked.

## B. ESIC rule

Create `ESIC-DEFAULT`, rates 0.75% / 3.25%, eligibility ceiling ₹21,000. Activate without wage-basis lines (defaults to gross).

## C. Professional Tax rule + slabs

Create `PT-MH`, type PT, `stateCode=MH`, effective `2026-01-01`.  
Try activate **before** slabs → 400.  
Add slabs: 0–7500 → ₹0; 7501–10000 → ₹175; 10001+ → ₹200. Activate → ACTIVE.

## D. Employee statutory profile

On employee **Sunita Rao** (or test worker): UAN, ESIC number, PAN on file.  
PATCH applicability without `overrideReason` → 400.  
Set `tdsManualMonthly=500` with `overrideReason` → saved.

## E. Effective rule resolution

`GET /hrms/statutory/resolve?type=PF&employeeId=…&date=2026-08-31`  
Expect `PF-DEFAULT`, `stateCode` from branch (e.g. `MH`).

## F. Payroll calculate with statutory lines

Ensure salary structure has BASIC + HRA (no STATUTORY structure lines required).  
Create payroll period **Aug 2026**, run, **Calculate**.  
Employee detail components expect approximately:

| Code | Expected (illustrative) |
|------|-------------------------|
| `PF_EMPLOYEE` / `PF_EMPLOYER` | 12% of BASIC capped at ceiling (e.g. ₹1,800 on ₹15,000 BASIC) |
| `ESIC_EMPLOYEE` / `ESIC_EMPLOYER` | % of gross |
| `PT` | Slab match on gross (e.g. ₹200) |
| `TDS` | Manual override amount (e.g. ₹500) |

Warnings for missing LWF rule acceptable. Evidence JSON on result notes under `statutory`.

## G. Compliance registers

With `hrms.statutory.reports`, `GET /hrms/statutory/registers/pf?payrollPeriodId=…` includes employee.  
`GET …/registers/pf/export.csv` returns CSV with `employeeCode` header.

## H. ESIC override + recalculate

Set `esicApplicable=false` with override reason. Recalculate run.  
ESIC lines absent; PF lines remain.

## I. Permissions

**HR Executive** (`hrms.statutory.view` + `reports` only): list rules ✅; create rule / patch profile → 403.  
**Supervisor** (no statutory perms): statutory hub shows permission denied.

## J. Tenant isolation

Second tenant token cannot fetch first tenant's rules, profile, or registers (403/404).

## Sign-off

| Case | Result | Tester | Date |
|------|--------|--------|------|
| A–J | | | |
