# HRMS Phase 6 — UAT

Prerequisites: migrate `20260730280000_hrms_phase6_salary_structure`, `npm run db:sync-permissions`, HR Manager role, API mode.

## A. Components

Create: BASIC, HRA, SPECIAL, OT (`OT_LINKED`), PF (`STATUTORY`), ESIC (`STATUTORY`).

Expect: register shows Code / Name / Type / Calculation / Status. Duplicate BASIC → conflict.

## B. Structure WORKER-GRADE-A

Create structure. Draft Version 1 effective `2026-08-01`:

| Component | Rule |
|-----------|------|
| Basic | Fixed ₹15,000 |
| HRA | 40% of Basic |
| Special | Fixed ₹4,000 |
| OT | OT Linked |
| PF | Statutory |
| ESIC | Statutory |

Save Draft.

## C. Activate Version 1

Activate. Expect ACTIVE + read-only (edit blocked). Preview earnings ≈ ₹25,000.

## D. Assign Rajesh

Employee → Assign Salary Structure → Version 1 → effective `2026-08-01`. Preview monthly gross. Save.

Supervisor without salary perms must not see Salary section / APIs (403).

## E. Version 2

New draft from `2027-01-01` (copy lines). Activate. Version 1 → SUPERSEDED. History retained.

## F. Revision

Revise assignment effective `2027-01-01` → Version 2. Prior assignment CLOSED with `effectiveTo` day before. History shows both.

## G. Permissions

Supervisor (employee + OT approve only): cannot open components/structures/assignments APIs.

## Sign-off

| Case | Result | Tester | Date |
|------|--------|--------|------|
| A–G | | | |
