# CRM Lead Form Refinement Report

## Final Verdict

**Lead Stage Dropdown Added and CRM Lead Flow Updated**

---

## Fields Changed

| Area | Change |
|------|--------|
| Lead Stage | New required dropdown: New, Contacted, Requirement Collected, Qualified, Not Qualified, Converted to Opportunity, Closed |
| Lead Status | Active / Inactive (unchanged) |
| Lifecycle Status | Open, Qualified, Converted, Closed — now derived from Lead Stage |
| Not Qualified Reason | Conditional required field when stage = Not Qualified |
| Closed Date / Reason | Required when stage = Closed |
| Lead Owner, Priority, Created Date | Retained from prior refinement |
| Source / Industry | Read-only from Company Master (not editable on lead form) |

---

## Company Master Linkage

- Searchable **Company / Prospect** dropdown with master suggestions
- **Add New Company** quick-create drawer saves to Company Master and auto-selects
- Duplicate company warning on similar names
- Read-only company source, industry, territory, type after selection

---

## Add New Company Drawer

- Opens via `Add New Company` from lead form
- Preserves lead form state while drawer is open
- Auto-selects newly created company on save

---

## Lead Owner Dropdown

- Searchable list of active CRM users
- Defaults to current logged-in user
- Shows name, role, department

---

## Priority Field

- Required: Low, Medium, High, Critical (default Medium)
- Status chips in list, detail, and dashboard

---

## Created Date Logic

- Defaults to today on new leads
- Editable on form
- Shown in list and detail

---

## Active / Inactive Logic

- Toggle on lead form
- Inactive requires Inactive Reason
- Inactive leads excluded from active pipeline KPIs when combined with stage rules

---

## Lead Stage Behavior

| Stage | Behavior |
|-------|----------|
| New | Active, lifecycle Open |
| Contacted | Follow-up recommended |
| Requirement Collected | Product / Requirement required |
| Qualified | Create Opportunity next action |
| Not Qualified | Not Qualified Reason required |
| Converted to Opportunity | Locked from edit; lifecycle Converted |
| Closed | Closed Date + Reason required; excluded from active KPI |

---

## Closed Date Logic

- Auto-fills to current date when Lead Stage set to Closed
- Required for closed stage
- Shown in list and detail

---

## Save Button Visibility

- Sticky footer: Save Lead, Save & Create Opportunity, Save & New, Cancel
- Navy primary `#003B73` via `ErpButton variant="primary"`

---

## Lead List Updates

Columns: Lead No, Company / Prospect, Contact, Mobile, Lead Owner, Priority, **Lead Stage** (chip), Lead Status, Lifecycle, Created Date, Closed Date, Next Follow-up, Actions

Stage chip colors: Blue (New), Cyan (Contacted), Indigo (Requirement Collected), Green (Qualified), Amber (Not Qualified), Dark Green (Converted), Gray (Closed)

---

## Lead Detail Updates

- Header shows Lead Stage, Priority, Owner, Status, Lifecycle
- Command bar: Edit, Qualify, Convert to Opportunity, Close Lead, Add Follow-up, Activity
- Stage history timeline from CRM activities
- Open Company Master when linked

---

## Dashboard Impact

New metrics: New Leads, Contacted, Qualified, Not Qualified, Converted, Closed, Active Leads, High/Critical priority

**Lead Stage Funnel** chart: New → Contacted → Requirement Collected → Qualified → Converted to Opportunity

---

## Report Impact

- Lead Register (includes Lead Stage)
- Lead Stage Report
- Lead Conversion Report
- Lead Owner Report
- Closed Lead Report
- Active/Inactive Lead Report

---

## Final Verdict

**Lead Stage Dropdown Added and CRM Lead Flow Updated** · **Lead Navigation and Save Button Standardized**

---

## Navigation and Save Button Standardization

- Shared `useLeadRoutes()` and `crmLeadNavigation` breadcrumbs across list, form, detail
- Form titles/subtitles per CRM standard; sticky save bar with `pb-28` content padding
- Save primary `#001B3A`; post-save next-action panel (View Lead, Create Opportunity, Add Another, Back to List)
- Route-aware navigation for `/crm/leads` and `/sales/leads` aliases

---

## Tests

Run: `npm run test:crm-lead-form-refinement` (63 checks)

Covers: form load, company search, lead owner, priority, created date, active/inactive, closed logic, save button, list/detail, dashboard metrics, **lead stage dropdown**, stage validation, stage chips, stage timeline, conversion auto-stage, CI/UAT/eeta-100/crm-freeze wiring.

---

## Remaining Gaps

- Lead list URL `?stage=` filter from dashboard funnel not yet wired to auto-apply on page load
- Full dedicated Lead Stage filter bar on reports UI (data layer supports stage grouping)
- Opportunity auto-link `opportunityId` on lead when created from lead (manual navigation today)
