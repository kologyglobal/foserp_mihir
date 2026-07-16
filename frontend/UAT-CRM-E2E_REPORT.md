# UAT-CRM-E2E — Live API Journey

**Date:** 2026-07-11
**Overall:** ✅ PASS (14/14)

## Journey

Lead → Opportunity → Follow-up → Quotation → Approval → Sales Order conversion

| ID | Step | Test | Status | Notes |
|----|------|------|--------|-------|
| E2E-00 | Auth | Single login succeeds | PASS | Login successful |
| E2E-01 | Company | Create company with billing address | PASS | Company created |
| E2E-02 | Contact | Create contact | PASS | Contact created |
| E2E-03 | Lead | Create lead | PASS | Lead created |
| E2E-04 | Lead | Convert lead to opportunity | PASS | Lead converted |
| E2E-05 | Follow-up | Create follow-up | PASS | Follow-up created |
| E2E-06 | Quotation | Create quotation with document | PASS | Quotation created |
| E2E-07 | Quotation | Submit for approval | PASS | HTTP 200 |
| E2E-08 | Quotation | Approve quotation document | PASS | approved |
| E2E-09 | Sales Order | Convert approved quotation to sales order | PASS | Sales order created from quotation |
| E2E-10 | Sales Order | Duplicate conversion blocked | PASS | HTTP 422 |
| E2E-11 | Persistence | Quotation retains salesOrderId after refresh | PASS | SO-000003 |
| E2E-12 | Persistence | Sales order persists after re-GET | PASS | SO-000003 |
| E2E-13 | Opportunity | Opportunity marked won after conversion | PASS | won |

## Environment

- API: `http://127.0.0.1:5000/api/v1`
- Tenant: `vasant-trailers`
- Auth: single login per run (rate-limit safe)
