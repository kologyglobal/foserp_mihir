# UAT Data Validation Report

**Date:** 2026-06-24  
**Validation Script:** `npm run test:uat-data-validation`  
**Result:** ✓ **31/31 passed**

## Record Counts

| Entity | Count | Target | Status |
|--------|------:|--------|--------|
| Customers | 15 | ≥15 | ✓ |
| Vendors | 15 | ≥15 | ✓ |
| Items | 51 | ≥50 | ✓ |
| Products | 10 | ≥10 | ✓ |
| Released BOMs | 5 | ≥5 | ✓ |
| Released Routings | 5 | ≥5 | ✓ |
| Sales Orders | 18 | ≥15 | ✓ |
| Purchase Orders | 20 | ≥15 | ✓ |
| GRNs | 20 | ≥15 | ✓ |
| Work Orders | 40 | ≥15 | ✓ |
| Job Cards | 320 | ≥30 | ✓ |
| Job Work Orders | 8 | ≥8 (stretch 10) | ✓ |
| QC Inspections | 245 | ≥15 | ✓ |
| Dispatches | 8 | ≥8 (stretch 15) | ✓ |
| Invoices | 8 | ≥8 (stretch 15) | ✓ |
| Payments | 8 | ≥8 (stretch 10) | ✓ |
| ECR Records | 10 | ≥10 | ✓ |
| ECO Records | 10 | ≥10 | ✓ |
| QR Records | 108 | ≥25 | ✓ |
| Serial Records | 62 | ≥25 | ✓ |
| Documents | 36 | ≥30 | ✓ |

## Integrity Rules

| Rule | Status |
|------|--------|
| No orphan SO | ✓ |
| No orphan WO | ✓ |
| No PO without vendor | ✓ |
| No GRN without PO | ✓ |
| No invoice without dispatch | ✓ |
| No payment without invoice | ✓ |
| No QR without linked entity | ✓ |
| No serial without item | ✓ |
| No ECO without affected entity | ✓ |

## Notes

Stretch targets for dispatches/invoices/payments (15/15/10) are at 8/8/8 due to full FG chain requirements. Documented as **DEF-003/004** (Medium) — does not block UAT execution.
