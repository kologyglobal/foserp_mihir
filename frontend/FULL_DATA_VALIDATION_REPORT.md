# Full Data Validation Report

**Date:** 2026-06-25  
**Script:** `test:demo-data-saturation` + in-process validation

| Entity | Count | Target | Status |
|--------|------:|-------:|--------|
| Customers | 30 | 30 | ✓ |
| Contacts | 60 | 60 | ✓ |
| Vendors | 30 | 30 | ✓ |
| Items | 120 | 120 | ✓ |
| Products | 30 | 25 | ✓ |
| BOMs | 32 | 25 | ✓ |
| Routings | 31 | 25 | ✓ |
| Leads | 50 | 50 | ✓ |
| Opportunities | 40 | 40 | ✓ |
| Activities | 114 | 100 | ✓ |
| Follow-ups | 51 | 80 | ✗ |
| Quotations | 50 | 30 | ✓ |
| Sales Orders | 33 | 30 | ✓ |
| Purchase Orders | 37 | 30 | ✓ |
| GRNs | 37 | 30 | ✓ |
| Work Orders | 146 | 30 | ✓ |
| Job Cards | 840 | 80 | ✓ |
| Job Work Orders | 62 | 25 | ✓ |
| QC Inspections | 638 | 40 | ✓ |
| NCRs | 0 | 25 | ✗ |
| Reworks | 1 | 25 | ✗ |
| Dispatches | 30 | 30 | ✓ |
| Invoices | 30 | 30 | ✓ |
| Payments | 25 | 25 | ✓ |
| ECR/ECO | 50 | 50 | ✓ |
| QR Records | 203 | 80 | ✓ |
| Serial Records | 80 | 80 | ✓ |
| Documents | 100 | 100 | ✓ |

## Orphan Checks

| Rule | Status |
|------|--------|
| No orphan customer contacts | ✓ |
| No orphan opportunities | ✓ |
| No orphan quotations (CRM) | ✓ |
| No orphan SO | ✓ |
| No orphan WO | ✓ |
| No orphan PO | ✓ |
| No orphan GRN | ✓ |
| No orphan invoice | ✓ |
| No orphan QR | ✓ |
| No orphan serial | ✓ |
| No orphan documents | ✓ |

**Overall:** ✓ PASS
