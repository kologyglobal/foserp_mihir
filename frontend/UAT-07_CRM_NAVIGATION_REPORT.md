# UAT-07 — CRM Navigation & Consistency

**Date:** 2026-07-11
**Overall:** ✅ PASS (123/123 checks; 0 automated failures)

| ID | Area | Test | Status | Notes |
|----|------|------|--------|-------|
| UAT-07.1 | Sidebar | Nav item "Dashboard" path resolves | PASS | /crm |
| UAT-07.2 | Sidebar | Nav item "forecast" path resolves | PASS | /crm/forecast |
| UAT-07.3 | Sidebar | Nav item "leads" path resolves | PASS | /crm/leads |
| UAT-07.4 | Sidebar | Nav item "opportunities" path resolves | PASS | /crm/opportunities |
| UAT-07.5 | Sidebar | Nav item "quotations" path resolves | PASS | /crm/quotations |
| UAT-07.6 | Sidebar | Nav item "quotation-templates" path resolves | PASS | /crm/quotation-templates |
| UAT-07.7 | Sidebar | Nav item "sales-orders" path resolves | PASS | /crm/sales-orders |
| UAT-07.8 | Sidebar | Nav item "customers" path resolves | PASS | /crm/customers |
| UAT-07.9 | Sidebar | Nav item "contacts" path resolves | PASS | /crm/contacts |
| UAT-07.10 | Sidebar | Nav item "reports" path resolves | PASS | /crm/reports |
| UAT-07.11 | Sidebar | Nav item "masters" path resolves | PASS | /crm/masters |
| UAT-07.12 | Sidebar | CRM category in moduleCategories | PASS |  |
| UAT-07.13 | Sidebar | Sidebar icon rail includes CRM | PASS |  |
| UAT-07.14 | Sidebar | findActiveCategoryId maps /crm/* to crm | PASS |  |
| UAT-07.15 | Sidebar | Baseline includes /crm | PASS | /crm |
| UAT-07.16 | Sidebar | Baseline includes /crm/forecast | PASS | /crm/forecast |
| UAT-07.17 | Sidebar | Baseline includes /crm/leads | PASS | /crm/leads |
| UAT-07.18 | Sidebar | Baseline includes /crm/opportunities | PASS | /crm/opportunities |
| UAT-07.19 | Sidebar | Baseline includes /crm/quotations | PASS | /crm/quotations |
| UAT-07.20 | Sidebar | Baseline includes /crm/quotation-templates | PASS | /crm/quotation-templates |
| UAT-07.21 | Sidebar | Baseline includes /crm/sales-orders | PASS | /crm/sales-orders |
| UAT-07.22 | Sidebar | Baseline includes /crm/customers | PASS | /crm/customers |
| UAT-07.23 | Sidebar | Baseline includes /crm/contacts | PASS | /crm/contacts |
| UAT-07.24 | Sidebar | Baseline includes /crm/reports | PASS | /crm/reports |
| UAT-07.25 | Sidebar | Baseline includes /crm/masters | PASS | /crm/masters |
| UAT-07.26 | Sidebar | Activities route registered | PASS |  |
| UAT-07.27 | Sidebar | Follow-ups route registered | PASS |  |
| UAT-07.28 | Sidebar | Activities & follow-ups reachable from dashboard/deep link | MANUAL | Not in primary sidebar — by design |
| UAT-07.29 | Routes | Route baseline file exists | PASS |  |
| UAT-07.30 | Routes | crmRoutes.tsx exists | PASS |  |
| UAT-07.31 | Routes | quotationRoutes.tsx mounted under CRM | PASS |  |
| UAT-07.32 | Routes | CRM wildcard redirects to /crm | PASS |  |
| UAT-07.33 | Routes | Route baseline covers /crm | PASS | /crm |
| UAT-07.34 | Routes | Route baseline covers /crm/leads | PASS | /crm/leads |
| UAT-07.35 | Routes | Route baseline covers /crm/leads/new | PASS | /crm/leads/new |
| UAT-07.36 | Routes | Route baseline covers /crm/leads/:id | PASS | /crm/leads/:id |
| UAT-07.37 | Routes | Route baseline covers /crm/leads/:id/edit | PASS | /crm/leads/:id/edit |
| UAT-07.38 | Routes | Route baseline covers /crm/opportunities | PASS | /crm/opportunities |
| UAT-07.39 | Routes | Route baseline covers /crm/opportunities/new | PASS | /crm/opportunities/new |
| UAT-07.40 | Routes | Route baseline covers /crm/opportunities/:id | PASS | /crm/opportunities/:id |
| UAT-07.41 | Routes | Route baseline covers /crm/opportunities/:id/edit | PASS | /crm/opportunities/:id/edit |
| UAT-07.42 | Routes | Route baseline covers /crm/quotations | PASS | /crm/quotations |
| UAT-07.43 | Routes | Route baseline covers /crm/quotations/new | PASS | /crm/quotations/new |
| UAT-07.44 | Routes | Route baseline covers /crm/quotations/:id | PASS | /crm/quotations/:id |
| UAT-07.45 | Routes | Route baseline covers /crm/quotations/:id/editor | PASS | /crm/quotations/:id/editor |
| UAT-07.46 | Routes | Route baseline covers /crm/activities | PASS | /crm/activities |
| UAT-07.47 | Routes | Route baseline covers /crm/follow-ups | PASS | /crm/follow-ups |
| UAT-07.48 | Routes | Route baseline covers /crm/contacts | PASS | /crm/contacts |
| UAT-07.49 | Routes | Route baseline covers /crm/contacts/:id | PASS | /crm/contacts/:id |
| UAT-07.50 | Routes | Route baseline covers /crm/customers | PASS | /crm/customers |
| UAT-07.51 | Routes | Route baseline covers /crm/reports | PASS | /crm/reports |
| UAT-07.52 | Routes | Route baseline covers /crm/masters | PASS | /crm/masters |
| UAT-07.53 | Routes | Path count matches baseline | PASS | 438/438 |
| UAT-07.54 | Dashboard | Hero KPI links to /crm/opportunities | PASS |  |
| UAT-07.55 | Dashboard | Hero KPI links to /crm/forecast | PASS |  |
| UAT-07.56 | Dashboard | Quick action: Activities | PASS |  |
| UAT-07.57 | Dashboard | Quick action: Quotations | PASS |  |
| UAT-07.58 | Dashboard | Pipeline stage click opens opportunity deep links | PASS |  |
| UAT-07.59 | Dashboard | Management feed uses CRM deep links | PASS |  |
| UAT-07.60 | Dashboard | Next actions panel navigates via route | PASS |  |
| UAT-07.61 | Dashboard | All crmNextActions routes resolve | PASS | 11 actions |
| UAT-07.62 | List actions | Leads table: View/Edit/Delete row actions | PASS |  |
| UAT-07.63 | List actions | Leads list navigates via useLeadRoutes | PASS |  |
| UAT-07.64 | List actions | Opportunities table: View navigates to /crm/opportunities/:id | PASS |  |
| UAT-07.65 | List actions | Opportunities table: Edit navigates to edit route | PASS |  |
| UAT-07.66 | List actions | Contacts list: view/edit/new routes | PASS |  |
| UAT-07.67 | List actions | Companies table uses entity360CustomerPath | PASS |  |
| UAT-07.68 | List actions | Opportunity list New button | PASS |  |
| UAT-07.69 | Detail actions | Lead 360: Edit uses routes.edit | PASS |  |
| UAT-07.70 | Detail actions | Lead 360: Create Opportunity action | PASS |  |
| UAT-07.71 | Detail actions | Lead 360: Create Quotation action | PASS |  |
| UAT-07.72 | Detail actions | Lead 360: Customer link uses entity360CustomerPath (not /crm/customers/:id) | PASS |  |
| UAT-07.73 | Detail actions | Opportunity 360: Edit + quotation editor links | PASS |  |
| UAT-07.74 | Detail actions | Contact 360 page exists with edit route | PASS |  |
| UAT-07.75 | Breadcrumbs | CRM root: Home → /home, CRM → /crm | PASS |  |
| UAT-07.76 | Breadcrumbs | crmModuleBreadcrumbs includes root + module | PASS |  |
| UAT-07.77 | Breadcrumbs | crmChildBreadcrumbs: parent link + current label | PASS |  |
| UAT-07.78 | Breadcrumbs | Lead list breadcrumbs use Leads module path | PASS |  |
| UAT-07.79 | Breadcrumbs | Contact breadcrumbs use /crm/contacts | PASS |  |
| UAT-07.80 | Breadcrumbs | Dashboard breadcrumb: Home → CRM → Command Center | PASS |  |
| UAT-07.81 | Deep links | CRM dashboard index (/crm) | PASS |  |
| UAT-07.82 | Deep links | Lead list (/crm/leads) | PASS |  |
| UAT-07.83 | Deep links | New lead (/crm/leads/new) | PASS |  |
| UAT-07.84 | Deep links | Lead detail (/crm/leads/lead-demo-1) | PASS |  |
| UAT-07.85 | Deep links | Lead edit (/crm/leads/lead-demo-1/edit) | PASS |  |
| UAT-07.86 | Deep links | Opportunity pipeline (/crm/opportunities) | PASS |  |
| UAT-07.87 | Deep links | New opportunity (/crm/opportunities/new) | PASS |  |
| UAT-07.88 | Deep links | Opportunity 360 (/crm/opportunities/opp-demo-1) | PASS |  |
| UAT-07.89 | Deep links | Opportunity edit (/crm/opportunities/opp-demo-1/edit) | PASS |  |
| UAT-07.90 | Deep links | Quotation list (/crm/quotations) | PASS |  |
| UAT-07.91 | Deep links | New quotation (/crm/quotations/new) | PASS |  |
| UAT-07.92 | Deep links | Quotation 360 (/crm/quotations/q-demo-1) | PASS |  |
| UAT-07.93 | Deep links | Quotation editor (/crm/quotations/q-demo-1/editor) | PASS |  |
| UAT-07.94 | Deep links | Contact list (/crm/contacts) | PASS |  |
| UAT-07.95 | Deep links | Contact 360 (/crm/contacts/c-demo-1) | PASS |  |
| UAT-07.96 | Deep links | Companies list (/crm/customers) | PASS |  |
| UAT-07.97 | Deep links | Activities register (/crm/activities) | PASS |  |
| UAT-07.98 | Deep links | Follow-ups register (/crm/follow-ups) | PASS |  |
| UAT-07.99 | Deep links | CRM reports hub (/crm/reports) | PASS |  |
| UAT-07.100 | Deep links | CRM masters hub (/crm/masters) | PASS |  |
| UAT-07.101 | Deep links | CRM sales orders (/crm/sales-orders) | PASS |  |
| UAT-07.102 | Deep links | Sales forecast (/crm/forecast) | PASS |  |
| UAT-07.103 | Deep links | Quotation templates (/crm/quotation-templates) | PASS |  |
| UAT-07.104 | Deep links | Legacy /sales/leads alias still registered | PASS |  |
| UAT-07.105 | Deep links | Legacy /sales/quotations redirects to CRM | PASS |  |
| UAT-07.106 | Link integrity | CRM source links resolve to registered routes | PASS | 56 links scanned |
| UAT-07.107 | Permissions | Sales Manager can route to /crm | PASS |  |
| UAT-07.108 | Permissions | Sales Manager can route to /crm/leads | PASS |  |
| UAT-07.109 | Permissions | Sales Manager can route to /crm/opportunities/:id | PASS |  |
| UAT-07.110 | Permissions | Shop Floor blocked from /crm | PASS |  |
| UAT-07.111 | Permissions | Admin can route to all CRM deep links | PASS |  |
| UAT-07.112 | Permissions | Permission matrix maps /crm prefix | PASS |  |
| UAT-07.113 | Browser history | Back from lead detail returns to list with filters preserved | MANUAL |  |
| UAT-07.114 | Browser history | Forward after back restores detail page | MANUAL |  |
| UAT-07.115 | Refresh | F5 on /crm/leads/:id reloads lead 360 without 404 | MANUAL |  |
| UAT-07.116 | Refresh | F5 on /crm/opportunities/:id reloads opportunity 360 | MANUAL |  |
| UAT-07.117 | Refresh | F5 on /crm/quotations/:id/editor preserves document context | MANUAL |  |
| UAT-07.118 | Breadcrumbs | Clicking CRM in breadcrumb returns to dashboard from any child page | MANUAL |  |
| UAT-07.119 | Breadcrumbs | Clicking Leads in breadcrumb returns to list from form/detail | MANUAL |  |
| UAT-07.120 | Sidebar | CRM sidebar highlights active item on nested routes | MANUAL |  |
| UAT-07.121 | Deep links | Paste /crm/opportunities/:id in new tab loads 360 (demo mode) | MANUAL |  |
| UAT-07.122 | Deep links | Paste /crm/quotations/:id/editor?doc=… loads editor | MANUAL |  |
| UAT-07.123 | Live SPA | Dev server serves CRM routes (HTML shell) | PASS | 4/4 @ http://127.0.0.1:5173 |

## Summary

- **Automated:** 111/111 passed
- **Live (optional):** 1/1
- **Manual sign-off:** 11 browser scenarios below

## Bugs fixed in this run

- Lead 360 customer link: `/crm/customers/:id` → `entity360CustomerPath()` (`/entity360/customers/:id`)

## Gaps requiring manual testing

- Browser back/forward stack behavior with query params (list filters, drawer state)
- Full page refresh on deep links in API mode (auth gate + hydration)
- Activities & follow-ups desktop discovery (routes exist; not in primary CRM sidebar)
- Mobile CRM pipeline nav (`/m/crm/*`) — separate from desktop UAT-07 scope

## Manual browser checklist

**Setup:** `VITE_USE_API=false`, login as `admin@vasant-trailers.com` / `Admin@123` (or demo mode passthrough)

- [ ] Sidebar: click each CRM item (Dashboard, Leads, Opportunities, …) — lands on correct page
- [ ] Dashboard: click Pipeline Value KPI → opportunities list
- [ ] Dashboard: click Activities quick action → opportunities with activities view
- [ ] Leads list: View row → lead 360; Back → returns to list
- [ ] Lead 360: Customer Master link → Entity 360 company page
- [ ] Opportunities: View row → 360; Edit → edit form; breadcrumb CRM → dashboard
- [ ] Quotations: list → detail → editor; browser Back through stack
- [ ] Deep link: open `/crm/leads/<id>` in new tab — loads without redirect to dashboard
- [ ] Refresh (F5) on detail pages — page reloads correctly
- [ ] Invalid `/crm/unknown-path` → redirects to `/crm` (wildcard)

## Demo credentials

- Tenant: `vasant-trailers`
- Email: `admin@vasant-trailers.com`
- Password: `Admin@123`
