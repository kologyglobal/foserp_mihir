# Document Governance — UAT checklist

Configuration-only phase. **Pass** if documents still behave exactly as before.

## Pre-conditions

- [ ] Migration `20260804200000_document_governance_date_control` applied  
- [ ] `npm run db:sync-permissions` (or CI equivalent) so `platform.document_governance.*` exist  
- [ ] `DOCUMENT_GOVERNANCE_DATE_CONTROL` unset or `false`  
- [ ] API mode UI (`VITE_USE_API=true`) for Admin page  

## Admin configuration

| # | Step | Expected |
|---|------|----------|
| A1 | Open `/admin/document-governance/date-controls` as Tenant Admin | Config-only banner; grid (possibly empty) |
| A2 | Create policy for CRM Quotation, leave default modes | Row saved; `policyEnabled` false |
| A3 | Edit future mode to BLOCK, save without enabling | Stored; documents still unrestricted |
| A4 | Activate policy | `policyEnabled` true; **CRM quotation still saves any date** (no wiring) |
| A5 | Reset to Current Behaviour | Modes back to CURRENT_BEHAVIOUR; policy disabled path |
| A6 | Create STRICT profile via API | Profile listed; not forced onto documents |
| A7 | User **without** `platform.document_governance.view` | 403 / permission denied on page & API |

## Document regression (must unchanged)

| # | Module | Check |
|---|--------|-------|
| D1 | CRM Quotation | Create / submit / approve with today, past, and future document dates as previously allowed |
| D2 | CRM Sales Order | Unchanged confirm/close |
| D3 | Purchase PO | Create/post dates as before |
| D4 | Purchase GRN | Receipt date validation unchanged |
| D5 | Purchase Invoice | Unchanged |

## Negative (flag)

| # | Step | Expected |
|---|------|----------|
| F1 | Flag OFF + enabled policy BLOCK in DB | Evaluator unit tests / future integration no-op in modules |
| F2 | Unknown module/document type on POST | Validation error (registry) |
| F3 | Duplicate active same scope | ConflictError |

## Sign-off

| Role | Result | Date |
|------|--------|------|
| Engineer | | |
| Product | | |
