# HRMS Phase 7 — UAT

Prerequisites: migrations through `20260731010000_hrms_phase7_payroll` + Phase 6 salary tables, `npm run db:sync-permissions`, HR Manager role with payroll + salary perms, API mode (`VITE_USE_API=true`).

## A. Salary setup (Phase 6 prerequisite)

Create components BASIC, HRA, SPECIAL, OT (`OT_LINKED`), PF (`STATUTORY`).  
Structure **WORKER-GRADE-A** Version 1 effective `2026-01-01`: Basic ₹15,000; HRA 40% Basic; Special ₹4,000; OT linked with ₹200/hr on line; PF statutory marker. Activate. Assign to **Rajesh Patel** (join date early 2024).

## B. Attendance & OT seed

For July 2026: mark several weekdays **Present**; at least one **Absent** (LOP).  
Create/approve OT record with `approvedMinutes` (e.g. 120 min on a present day).

## C. Payroll period

HR → Payroll Runs → Create period **Jul 2026** for default legal entity.  
Expect OPEN status. Duplicate same LE + month → conflict.

## D. Payroll run

Create run for the period (optional branch filter). Expect DRAFT + auto code `PR-202607-001`.

## E. Calculate

Run **Calculate**. Expect CALCULATED; employee count ≥ 1; Rajesh row shows payable days > 0, gross > 0; component breakdown includes BASIC, HRA, OT; statutory lines show pending note; warnings for bank/statutory acceptable.

## F. Review & finalize

**Review** → REVIEWED. **Finalize** → FINALIZED; employee result FINALIZED; period CLOSED when no other open runs.  
Retry Calculate on finalized run → blocked.

## G. Permissions

Supervisor (employee + OT approve only): payroll APIs return 403.

## H. Tenant isolation

Second tenant token cannot fetch another tenant's period/run (403/404).

## Sign-off

| Case | Result | Tester | Date |
|------|--------|--------|------|
| A–H | | | |
