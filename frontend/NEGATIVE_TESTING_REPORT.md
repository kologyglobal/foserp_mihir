# Negative Testing Report

**Date:** 2026-06-25  
**Result:** **24/24 fail-safe behaviors confirmed**

| # | Negative Case | Expected | Status |
|---|---------------|----------|--------|
| 1 | SO without customer | Validation blocks save | ✓ Pass |
| 2 | SO without product | Validation blocks save | ✓ Pass |
| 3 | Direct SO without permission | RBAC blocks | ✓ Pass |
| 4 | WO without released BOM | Creation blocked | ✓ Pass |
| 5 | WO without released routing | Creation blocked | ✓ Pass |
| 6 | Issue material > stock | Issue blocked | ✓ Pass |
| 7 | GRN over PO tolerance | Receipt blocked/warned | ✓ Pass |
| 8 | QC pass without mandatory parameter | Submission blocked | ✓ Pass |
| 9 | QC pass without required photo | Submission blocked | ✓ Pass |
| 10 | Critical QC failure without NCR | NCR required | ✓ Pass |
| 11 | Dispatch without final QC | Candidate excluded | ✓ Pass |
| 12 | Dispatch without trailer serial | Dispatch blocked | ✓ Pass |
| 13 | Dispatch without QR scan | Gate pass requires scan | ✓ Pass |
| 14 | Dispatch without documents | Checklist blocks | ✓ Pass |
| 15 | Invoice without dispatch | Creation blocked | ✓ Pass |
| 16 | Payment without invoice | Receipt blocked | ✓ Pass |
| 17 | Edit released BOM without ECO | Edit blocked | ✓ Pass |
| 18 | Release ECO without approval | Release blocked | ✓ Pass |
| 19 | Duplicate chassis number | Registration blocked | ✓ Pass |
| 20 | Duplicate trailer serial | Registration blocked | ✓ Pass |
| 21 | Unauthorized approval | RBAC blocks | ✓ Pass |
| 22 | Restricted route access | Route guard redirect | ✓ Pass |
| 23 | Delete approved document | Action blocked | ✓ Pass |
| 24 | Use obsolete document | DMS usability fails | ✓ Pass |
