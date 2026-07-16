# UAT-02 — Lead Lifecycle

**Date:** 2026-07-11
**Overall:** ✅ PASS (84/84)

| ID | Area | Test | Status | Notes |
|----|------|------|--------|-------|
| UAT-02.1 | Create lead | CRM routes: list, new, edit, view | PASS |  |
| UAT-02.2 | Create lead | Lead form page exports CrmLeadFormPage | PASS |  |
| UAT-02.3 | Create lead | Store createLead assigns lead number | PASS |  |
| UAT-02.4 | Create lead | Demo store creates lead successfully | PASS | lead-a9d67f74 |
| UAT-02.5 | Create lead | API bridge maps create payload | PASS |  |
| UAT-02.6 | Required-field validation | Form requires Company / Prospect | PASS |  |
| UAT-02.7 | Required-field validation | Form requires Lead Owner | PASS |  |
| UAT-02.8 | Required-field validation | Not Qualified reason required | PASS |  |
| UAT-02.9 | Required-field validation | Closed stage requires date + reason | PASS |  |
| UAT-02.10 | Required-field validation | Backend create schema requires prospectName | PASS |  |
| UAT-02.11 | Required-field validation | Product required for requirement_collected stage | PASS |  |
| UAT-02.12 | Required-field validation | Empty prospect still creates in store (UI blocks) | PASS | UI validation is form-layer |
| UAT-02.13 | Edit/view/list/search/filter | List page uses filterLeadRows | PASS |  |
| UAT-02.14 | Edit/view/list/search/filter | List supports search, owner, stage filters | PASS |  |
| UAT-02.15 | Edit/view/list/search/filter | Grid has View/Edit/Delete actions | PASS |  |
| UAT-02.16 | Edit/view/list/search/filter | Edit route wired in list | PASS |  |
| UAT-02.17 | Edit/view/list/search/filter | Lead 360 view workspace | PASS |  |
| UAT-02.18 | Edit/view/list/search/filter | Search filter matches lead number | PASS |  |
| UAT-02.19 | Edit/view/list/search/filter | Owner filter works | PASS |  |
| UAT-02.20 | Edit/view/list/search/filter | Stage filter works | PASS |  |
| UAT-02.21 | Edit/view/list/search/filter | Lead update succeeds | PASS |  |
| UAT-02.22 | Edit/view/list/search/filter | Default sort by last modified | PASS |  |
| UAT-02.23 | Lead Stage consistency | Create form shows leadStageLabel | PASS |  |
| UAT-02.24 | Lead Stage consistency | List uses StageBadge for stage column | PASS |  |
| UAT-02.25 | Lead Stage consistency | View 360 uses leadStageLabel + chip | PASS |  |
| UAT-02.26 | Lead Stage consistency | Dashboard lead stage funnel chart | PASS |  |
| UAT-02.27 | Lead Stage consistency | Reports use leadStageLabel | PASS |  |
| UAT-02.28 | Lead Stage consistency | Backend LEAD_STAGES align with frontend | PASS |  |
| UAT-02.29 | Lead Stage consistency | Stage report has 7 buckets | PASS |  |
| UAT-02.30 | Lead Stage consistency | Dashboard metrics include leadsByStage | PASS |  |
| UAT-02.31 | Lead Stage consistency | leadStageLabel human-readable | PASS |  |
| UAT-02.32 | Stage progression | LEAD_STAGE_FLOW defines transitions | PASS |  |
| UAT-02.33 | Stage progression | advanceLeadStage enforces flow | PASS |  |
| UAT-02.34 | Stage progression | Backend qualify/disqualify routes exist | PASS |  |
| UAT-02.35 | Stage progression | Workflow blocks direct stage PATCH | PASS |  |
| UAT-02.36 | Stage progression | new → contacted allowed | PASS |  |
| UAT-02.37 | Stage progression | contacted → converted blocked | PASS |  |
| UAT-02.38 | Stage progression | Qualified sets lifecycle qualified | PASS |  |
| UAT-02.39 | Stage progression | deriveLifecycleFromStage maps stages | PASS |  |
| UAT-02.40 | Duplicate handling | Duplicate action navigates with duplicateFrom | PASS |  |
| UAT-02.41 | Duplicate handling | Form reads duplicateFrom search param | PASS |  |
| UAT-02.42 | Duplicate handling | Duplicate prefill resets stage to new | PASS |  |
| UAT-02.43 | Duplicate handling | Duplicate lead gets new id and stage new | PASS |  |
| UAT-02.44 | Duplicate handling | Duplicate is independent record | PASS |  |
| UAT-02.45 | Lead ownership | Form has Lead Owner field | PASS |  |
| UAT-02.46 | Lead ownership | Owner defaults to session user on new | PASS |  |
| UAT-02.47 | Lead ownership | assignLead store action exists | PASS |  |
| UAT-02.48 | Lead ownership | API assign endpoint bridged | PASS |  |
| UAT-02.49 | Lead ownership | Reassign lead owner in demo | PASS |  |
| UAT-02.50 | Lead ownership | Owner id updated on lead | PASS |  |
| UAT-02.51 | Delete/archive | archiveLead soft-deletes in store | PASS |  |
| UAT-02.52 | Delete/archive | API delete bridged as archive | PASS |  |
| UAT-02.53 | Delete/archive | Delete modal confirmation | PASS |  |
| UAT-02.54 | Delete/archive | Converted leads blocked from delete | PASS |  |
| UAT-02.55 | Delete/archive | Fresh lead can be deleted | PASS |  |
| UAT-02.56 | Delete/archive | archiveLead succeeds | PASS |  |
| UAT-02.57 | Delete/archive | Archived flag set | PASS |  |
| UAT-02.58 | Delete/archive | Qualified lead still deletable (no links) | PASS |  |
| UAT-02.59 | Lead → Opportunity | Convert action on lead form | PASS |  |
| UAT-02.60 | Lead → Opportunity | Convert navigates with leadId | PASS |  |
| UAT-02.61 | Lead → Opportunity | Opportunity new reads leadId param | PASS |  |
| UAT-02.62 | Lead → Opportunity | createOpportunity links lead in demo | PASS |  |
| UAT-02.63 | Lead → Opportunity | API mode uses convertLeadApi | PASS |  |
| UAT-02.64 | Lead → Opportunity | Backend convert sets converted stage | PASS |  |
| UAT-02.65 | Lead → Opportunity | Demo conversion creates opportunity | PASS | opp-4b1cdbc3 |
| UAT-02.66 | Lead → Opportunity | Lead stage becomes converted_to_opportunity | PASS |  |
| UAT-02.67 | Lead → Opportunity | Lead lifecycle becomes converted | PASS |  |
| UAT-02.68 | Lead → Opportunity | Lead stores opportunityId | PASS |  |
| UAT-02.69 | No duplicate opportunity | Backend rejects repeat convert | PASS |  |
| UAT-02.70 | No duplicate opportunity | Demo store guards converted lead | PASS |  |
| UAT-02.71 | No duplicate opportunity | linkLeadToOpportunity blocks second link | PASS |  |
| UAT-02.72 | No duplicate opportunity | Converted lead locked from edit | PASS |  |
| UAT-02.73 | No duplicate opportunity | Second conversion rejected in demo | PASS | Lead is already converted to an opportunity |
| UAT-02.74 | No duplicate opportunity | Only one opportunity linked to lead | PASS |  |
| UAT-02.75 | No duplicate opportunity | Converted lead edit blocked | PASS |  |
| UAT-02.76 | No duplicate opportunity | isLeadStageLocked on converted | PASS |  |
| UAT-02.77 | Lead Stage consistency | Lead register report includes UAT lead | PASS |  |
| UAT-02.78 | Create lead | Live API creates lead | PASS | Lead created |
| UAT-02.79 | Edit/view/list/search/filter | Live API get lead by id | PASS |  |
| UAT-02.80 | Edit/view/list/search/filter | Live API list leads | PASS | HTTP 200 |
| UAT-02.81 | Stage progression | Live qualify lead | PASS | HTTP 200 |
| UAT-02.82 | Lead → Opportunity | Live convert lead to opportunity | PASS |  |
| UAT-02.83 | No duplicate opportunity | Live repeat convert rejected | PASS | HTTP 422 |
| UAT-02.84 | Delete/archive | Live soft-delete lead after convert | PASS | HTTP 200 |

## Manual sign-off checklist

- [ ] Create lead at `/crm/leads/new` — save, verify new lead number
- [ ] Required fields: blank prospect/owner show inline errors before save
- [ ] Edit lead — stage change logs activity; converted lead is read-only
- [ ] List: search by prospect, filter by owner/stage, sort by last modified
- [ ] View 360 — stage chip matches form and list
- [ ] Dashboard — Lead stage funnel counts match list filters
- [ ] Reports → Lead Stage — labels match list chips
- [ ] Stage progression: New → Contacted → Requirement → Qualified
- [ ] Duplicate lead — opens new form with "(Copy)" prospect, stage reset to New
- [ ] Reassign owner — list and 360 show new owner
- [ ] Archive/delete — confirmation modal; converted lead blocked
- [ ] Qualified lead + company → Convert to Opportunity — one opp only
- [ ] Repeat convert shows error (API mode)

## Demo credentials

- Tenant: `vasant-trailers`
- Email: `admin@vasant-trailers.com`
- Password: `Admin@123`

## Gaps / notes

- Automated tests use demo store (`VITE_USE_API=false`); live API checks run when backend is on `:5000`.
- UI-only validation (empty prospect) is enforced in the form — not re-validated in Zustand createLead.
- Full browser E2E (Playwright) not covered — use manual checklist above.
