# ERP UAT Defect Log

**Date:** 2026-06-24

| Defect ID | Module | Screen | Test Case ID | Role | Description | Expected | Actual | Severity | Priority | Assigned To | Status | Retest | Screenshot | Resolution |
|-----------|--------|--------|--------------|------|-------------|----------|--------|----------|----------|-------------|--------|--------|------------|--------------|
| DEF-001 | Reports | Reports Hub | UAT-0143 | Engineering Head | Report export PDF manual screenshot pending | Export downloads file | Automated data OK; screenshot deferred | Low | P3 | QA | Open | — | — | Manual QA pass |
| DEF-002 | Reports | Reports Hub | UAT-0144 | Admin | Report export PDF manual screenshot pending | Export downloads file | Automated data OK; screenshot deferred | Low | P3 | QA | Open | — | — | Manual QA pass |
| DEF-003 | Demo Data | — | — | Admin | Dispatch count below stretch target 15 | ≥15 dispatches | 8 full FG chains | Medium | P3 | Dev | Open | — | — | Accept for UAT; extend seed post-migration |
| DEF-004 | Demo Data | — | — | Admin | Invoice/payment count below stretch 15/10 | ≥15 invoices | 8 invoices | Medium | P3 | Dev | Open | — | — | Tied to dispatch chains |
| DEF-005 | Demo Data | — | — | Admin | JWO count 8 vs stretch 10 | ≥10 subcontract WOs | 8 WOs | Medium | P3 | Dev | Open | — | — | Accept with 8+ threshold |
| DEF-006 | UX | Shop Floor Queue | UAT-0122 | Shop Floor Operator | Shop Floor score at minimum 90 | ≥90 UX score | Score 90 | Low | P4 | UX | Closed | Pass | — | Meets threshold |
| DEF-007 | UX | ECO / ECR | UAT-0144 | Engineering Head | ECO workspace score at minimum 90 | ≥90 UX score | Score 90 | Low | P4 | UX | Closed | Pass | — | Meets threshold |
| DEF-008 | Quick-Create | Sales Order | — | Sales User | Dedicated sales_user role not in matrix | Separate sales user role | Uses sales_manager permissions | Low | P4 | Product | Deferred | — | — | Map in RBAC backlog |

**Open Critical:** 0 | **Open High:** 0 | **Open Medium:** 3 | **Open Low:** 2
