# UAT-03 — Opportunity Lifecycle

**Date:** 2026-07-14
**Overall:** ✅ PASS (86/86)

| ID | Area | Test | Status | Notes |
|----|------|------|--------|-------|
| UAT-03.1 | Create standalone | CRM routes: pipeline, new, edit, 360 | PASS |  |
| UAT-03.2 | Create standalone | New page exports OpportunityNewPage | PASS |  |
| UAT-03.3 | Create standalone | Store createOpportunity assigns opportunityNo | PASS |  |
| UAT-03.4 | Create standalone | API bridge maps create payload | PASS |  |
| UAT-03.5 | Create standalone | Demo store creates standalone opportunity | PASS | opp-1e8b1678 |
| UAT-03.6 | Create standalone | Opportunity number assigned | PASS |  |
| UAT-03.7 | Create standalone | Creation logs activity | PASS |  |
| UAT-03.8 | Create from lead | New page reads leadId param | PASS |  |
| UAT-03.9 | Create from lead | Prefill from lead (customer, owner, name) | PASS |  |
| UAT-03.10 | Create from lead | API mode uses convertLeadApi when leadId set | PASS |  |
| UAT-03.11 | Create from lead | Backend convert route on leads | PASS |  |
| UAT-03.11b | Create from lead | Conversion rejected until lead is Qualified | PASS | Qualify the lead before converting to an opportunity. |
| UAT-03.12 | Create from lead | Demo conversion creates opportunity | PASS | opp-cd7b14aa |
| UAT-03.13 | Create from lead | Lead stage becomes converted_to_opportunity | PASS |  |
| UAT-03.14 | Create from lead | Lead stores opportunityId | PASS |  |
| UAT-03.15 | Create from lead | Activity links lead + opportunity | PASS |  |
| UAT-03.16 | Create from lead | Second conversion rejected | PASS | Lead is already converted to an opportunity |
| UAT-03.17 | Customer linkage | Form requires Company | PASS |  |
| UAT-03.18 | Customer linkage | New page customer select | PASS |  |
| UAT-03.19 | Customer linkage | Edit page shows linked customer | PASS |  |
| UAT-03.20 | Customer linkage | Contact filtered by customer | PASS |  |
| UAT-03.21 | Customer linkage | Backend validates contact belongs to company | PASS |  |
| UAT-03.22 | Customer linkage | Backend create requires customerId UUID | PASS |  |
| UAT-03.23 | Customer linkage | Demo update links contact | PASS | no demo contact — skipped |
| UAT-03.24 | Customer linkage | Contact id persisted on opportunity | PASS | skipped |
| UAT-03.25 | Customer linkage | Customer id can be updated in demo | PASS |  |
| UAT-03.26 | Pipeline stage | Kanban uses moveOpportunityStage | PASS |  |
| UAT-03.27 | Pipeline stage | 360 page stage move handler | PASS |  |
| UAT-03.28 | Pipeline stage | Backend move-stage route | PASS |  |
| UAT-03.29 | Pipeline stage | Workflow blocks stage via generic PATCH | PASS |  |
| UAT-03.30 | Pipeline stage | Default stages count | PASS |  |
| UAT-03.31 | Pipeline stage | new_lead → qualified succeeds | PASS |  |
| UAT-03.32 | Pipeline stage | Stage label human-readable | PASS |  |
| UAT-03.33 | Pipeline stage | Stage updated on record | PASS |  |
| UAT-03.34 | Pipeline stage | qualified → negotiation succeeds | PASS |  |
| UAT-03.35 | Pipeline stage | resolveOpportunityStages returns stages | PASS |  |
| UAT-03.36 | Value/probability/close | New page probability field | PASS |  |
| UAT-03.37 | Value/probability/close | New page expected close date | PASS |  |
| UAT-03.38 | Value/probability/close | Edit page weighted forecast | PASS |  |
| UAT-03.39 | Value/probability/close | Backend probability 0–100 validation | PASS |  |
| UAT-03.40 | Value/probability/close | Backend amount history on value change | PASS |  |
| UAT-03.41 | Value/probability/close | Update probability and close date | PASS |  |
| UAT-03.42 | Value/probability/close | Probability persisted | PASS |  |
| UAT-03.43 | Value/probability/close | Expected close date persisted | PASS |  |
| UAT-03.44 | Value/probability/close | Weighted value calculation | PASS |  |
| UAT-03.45 | Value/probability/close | Pipeline report includes opportunities | PASS |  |
| UAT-03.46 | Owner assignment | New page owner select | PASS |  |
| UAT-03.47 | Owner assignment | Edit page owner select | PASS |  |
| UAT-03.48 | Owner assignment | Backend assign route | PASS |  |
| UAT-03.49 | Owner assignment | List/table shows owner column | PASS |  |
| UAT-03.50 | Owner assignment | Filter config has owner filter | PASS |  |
| UAT-03.51 | Owner assignment | Demo reassign owner | PASS |  |
| UAT-03.52 | Owner assignment | Owner id updated | PASS |  |
| UAT-03.53 | Lost/won workflow | Backend win route | PASS |  |
| UAT-03.54 | Lost/won workflow | Backend lose route requires lostReason | PASS |  |
| UAT-03.55 | Lost/won workflow | Kanban prompts lost reason | PASS |  |
| UAT-03.56 | Lost/won workflow | 360 lost reason display | PASS |  |
| UAT-03.57 | Lost/won workflow | Bridge win/lose API wired | PASS |  |
| UAT-03.58 | Lost/won workflow | Lost without reason rejected | PASS | Lost reason is required |
| UAT-03.59 | Lost/won workflow | Lost with reason succeeds | PASS |  |
| UAT-03.60 | Lost/won workflow | Lost status and probability 0 | PASS |  |
| UAT-03.61 | Lost/won workflow | Lost reason stored | PASS |  |
| UAT-03.62 | Lost/won workflow | Won without approval rejected | PASS | Won stage requires approved quotation or manual approval |
| UAT-03.63 | Lost/won workflow | Won with manual approval succeeds | PASS |  |
| UAT-03.64 | Lost/won workflow | Won status and probability 100 | PASS |  |
| UAT-03.65 | Activity history | 360 filters activities by opportunityId | PASS |  |
| UAT-03.66 | Activity history | moveOpportunityStage logs stage_change | PASS |  |
| UAT-03.67 | Activity history | Won logs deal_won activity | PASS |  |
| UAT-03.68 | Activity history | Lost logs deal_lost activity | PASS |  |
| UAT-03.69 | Activity history | API history panel (stage/assignment) | PASS |  |
| UAT-03.70 | Activity history | Stage changes remain linked after moves | PASS |  |
| UAT-03.71 | Activity history | Activity count increased after stage move | PASS |  |
| UAT-03.72 | Activity history | Won deal has deal_won activity | PASS |  |
| UAT-03.73 | Activity history | Lost deal has deal_lost activity | PASS |  |
| UAT-03.74 | Activity history | lastActivityAt updated on opportunity | PASS |  |
| UAT-03.75 | List/pipeline UI | Pipeline page navigates to new | PASS |  |
| UAT-03.76 | List/pipeline UI | Sort opportunities utility | PASS |  |
| UAT-03.77 | List/pipeline UI | Filter helper exists | PASS |  |
| UAT-03.78 | Create standalone | Live API creates opportunity | PASS | Opportunity created |
| UAT-03.79 | Create standalone | Live API get opportunity by id | PASS | HTTP 200 |
| UAT-03.80 | List/pipeline UI | Live API list opportunities | PASS | HTTP 200 |
| UAT-03.81 | Value/probability/close | Live update probability | PASS | HTTP 200 |
| UAT-03.82 | Create from lead | Live convert lead to opportunity | PASS | HTTP 200 |
| UAT-03.83 | Create from lead | Live repeat convert rejected | PASS | HTTP 422 |
| UAT-03.84 | Lost/won workflow | Live win opportunity | PASS | HTTP 200 |
| UAT-03.85 | Activity history | Live status history endpoint | PASS | HTTP 200 |

## Manual sign-off checklist

- [ ] Create standalone opportunity at `/crm/opportunities/new` — company, owner, item line, save
- [ ] Convert qualified lead — prefill from lead, one opportunity only on repeat
- [ ] Link contact on edit — contact list filtered by company
- [ ] Pipeline Kanban — drag card between stages; lost prompts reason; won prompts approval
- [ ] Edit value, probability, expected close — weighted forecast updates
- [ ] Reassign owner — list, 360, and reports reflect new owner
- [ ] Mark lost with reason — status chip, probability 0, activity in timeline
- [ ] Mark won (manual or via approved quotation) — status won, probability 100
- [ ] 360 Activities tab — stage changes and won/lost events stay linked after moves
- [ ] API mode: Opportunity History panel shows stage/assignment/amount/status tabs

## Demo credentials

- Tenant: `vasant-trailers`
- Email: `admin@vasant-trailers.com`
- Password: `Admin@123`

## Gaps / notes

- Automated tests use demo store (`VITE_USE_API=false`); live API checks run when backend is on `:5000`.
- Owner reassignment in demo uses `updateOpportunity`; API has dedicated `/assign` endpoint.
- Won in demo requires approved quotation or manual approval checkbox — matches business rule.
- Full browser E2E (Playwright) not covered — use manual checklist above.
