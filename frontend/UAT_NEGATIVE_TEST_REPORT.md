# UAT Negative Test Report

**Date:** 2026-06-24  
**Result:** **24/24 fail-safe behaviors confirmed**

| # | Negative Case | Expected | Status |
|---|---------------|----------|--------|
| 1 | Create SO without customer | Validation error; save blocked | ✓ Pass |
| 2 | Create SO without product | Validation error; save blocked | ✓ Pass |
| 3 | Create WO without released BOM | WO creation blocked | ✓ Pass |
| 4 | Create WO without released routing | WO creation blocked | ✓ Pass |
| 5 | Release WO without material readiness | Release blocked with reason | ✓ Pass |
| 6 | Issue material > available stock | Issue blocked | ✓ Pass |
| 7 | GRN > PO tolerance | GRN blocked / warning | ✓ Pass |
| 8 | Pass QC without mandatory parameters | QC submission blocked | ✓ Pass |
| 9 | Pass QC without required photo | QC blocked when photo required | ✓ Pass |
| 10 | Dispatch without final QC | Dispatch candidate excluded | ✓ Pass |
| 11 | Dispatch without FG stock | No dispatch candidate | ✓ Pass |
| 12 | Dispatch without trailer serial | Dispatch blocked | ✓ Pass |
| 13 | Dispatch without QR scan | Gate pass requires scan | ✓ Pass |
| 14 | Invoice without dispatch | Invoice creation blocked | ✓ Pass |
| 15 | Cancel invoice without approval | Permission / approval blocked | ✓ Pass |
| 16 | Close SO without payment (policy) | Closure rules enforced | ✓ Pass |
| 17 | Edit released BOM without ECO | Edit blocked | ✓ Pass |
| 18 | Release ECO without approval | Release blocked | ✓ Pass |
| 19 | Approve PO without permission | RBAC blocks purchase_user | ✓ Pass |
| 20 | Access restricted page without permission | Route guard redirect | ✓ Pass |
| 21 | Duplicate chassis number | Serial registration blocked | ✓ Pass |
| 22 | Duplicate trailer serial | Serial registration blocked | ✓ Pass |
| 23 | Obsolete document in transaction | DMS usability check fails | ✓ Pass |
| 24 | Close NCR without evidence | NCR closure blocked | ✓ Pass |

All negative cases validated via automated integrity, RBAC, QC engine, dispatch rules, and DMS tests.
