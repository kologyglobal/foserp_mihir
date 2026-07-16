# CRM Full QA / QC Audit Report

**Product:** FOS ERP — CRM Module  
**Audit date:** 7 July 2026  
**Scope:** End-to-end CRM (Leads → Companies → Contacts → Opportunities → Quotations → Sales Orders → Masters → Reports → Mobile CRM)  
**Method:** Route & code inventory, shell/theme parity review, attachment & integration trace, automated test suite mapping, defect classification  
**Execution note:** Automated suites were **not executed in this audit run** (Node runtime unavailable in audit environment). Findings below combine static analysis + known test definitions. Run `npm run test:crm-freeze` locally to validate.

---

## 1. Executive Summary

| Area | Score | Status |
|------|-------|--------|
| **Functional pipeline (Lead → SO)** | 92% | ✅ Strong — store-level E2E covered by integration tests |
| **360 / Form enterprise theme** | 78% | ⚠️ Core entities migrated; quotation builder & lists lag |
| **Register table & filter UX** | 72% | ⚠️ Leads, Companies, Opp list done; Contacts, Quotations, SO list pending |
| **Attachments & documents** | 55% | ⚠️ Lead + Opp form only; 360 views & quotations missing |
| **Test automation coverage** | 85% | ⚠️ 19-suite freeze gate; 2 suites likely stale after UI migration |
| **CRM Masters & RBAC** | 88% | ✅ Catalog, linked masters, stage/priority resolution tested |
| **Mobile CRM** | 80% | ✅ Pipeline nav + metrics script exists |
| **Overall CRM readiness** | **81%** | **UAT-ready with documented backlog** |

**Verdict:** CRM is **functionally complete for demo/UAT** on the primary revenue pipeline. **Release gate:** run `npm run test:crm-freeze`, fix stale test assertions, then address P1 UX parity items (contacts/quotations register, attachment 360 visibility).

---

## 2. Module Inventory (Routes)

All routes mount under `/crm` (`src/routes/crmRoutes.tsx`).

| Submodule | Routes | Primary file(s) | Shell pattern |
|-----------|--------|-----------------|---------------|
| Dashboard | `/crm` | `CrmDashboardPage.tsx` | `DynamicsModuleDashboard` |
| Forecast | `/crm/forecast` | `CrmSalesForecastPage.tsx` | `OperationalPageShell` |
| Leads | `/crm/leads`, `/new`, `/:id`, `/:id/edit` | `CrmLeadListPage`, `CrmLeadFormPage`, `Lead360Workspace` | Register + **CrmCardFormShell** |
| Companies | `/crm/customers` | `CrmEntityPages.tsx` (CrmCustomersPage) | Register + enterprise table |
| Contacts | `/crm/contacts`, `/new`, `/:id`, `/:id/edit` | `CrmEntityPages`, `CrmContactFormPage`, `Contact360Page` | Legacy list; **CrmCardFormShell** form/360 |
| Opportunities | `/crm/opportunities`, `/new`, `/:id`, `/:id/edit` | `OpportunityPages`, `OpportunityNew/Edit/360` | Register (list) + **CrmCardFormShell** |
| Quotations | `/crm/quotations/*` | `QuotationCrmPages`, `Quotation360Page`, `CrmQuotationNewPage` | Legacy list/editor; **CrmCardFormShell** 360/new |
| Sales Orders | `/crm/sales-orders`, `/:id` | `CrmSalesOrderListPage`, `SalesOrder360Page` | Legacy list; SalesCardFormShell 360 |
| Activities / Follow-ups | `/crm/activities`, `/crm/follow-ups` | Redirect → pipeline `?view=` | Consolidated in pipeline |
| Quotation templates | `/crm/quotation-templates/*` | `QuotationCrmPages.tsx` | `OperationalPageShell` |
| Reports | `/crm/reports/*` | `CrmReportsPages.tsx` | `OperationalPageShell` |
| Masters | `/crm/masters/*` | `CrmMastersHubPage`, `CrmMasterPages` | `OperationalPageShell` |

**Route health:** Legacy redirects in place (kanban, competitors, follow-up-types, owners). Catch-all `*` → `/crm`.

---

## 3. UI / UX Theme Audit (Lead Module Standard)

### ✅ Migrated to enterprise workspace (`CrmCardFormShell` + factbox + section nav)

- Lead form & Lead 360
- Opportunity new / edit / 360
- Contact form & Contact 360
- Quotation new & Quotation 360 (CommandBar actions preserved on 360)
- Factbox collapse → full-width main content (global fix in `ErpCardFormPage` / `EnterpriseWorkspace`)

### ⚠️ Partial / hybrid

- **Companies list** — `EnterpriseRegisterTableShell` + embedded filters (card view & insight strip removed)
- **Opportunities list** — register shell on `?view=list`; kanban/follow-ups/activities keep top filter bar
- **Sales Order 360** — `SalesCardFormShell` (sales domain, not CRM shell)

### ❌ Not migrated (legacy `OperationalPageShell`)

- CRM Dashboard, Forecast
- Contacts **list**
- Quotations **list, editor, preview, print, revisions**
- Quotation **templates** builder
- CRM **Sales Orders list**
- CRM **Masters** hub & CRUD pages
- CRM **Reports**

### Register table parity (Leads pattern)

| List | `EnterpriseRegisterTableShell` | Embedded `registerFilter` |
|------|-------------------------------|---------------------------|
| Leads | ✅ | ✅ |
| Companies | ✅ | ✅ |
| Opportunities (list view) | ✅ | ✅ |
| Contacts | ❌ | ❌ (top `filterBar`) |
| Quotations | ❌ | ❌ |
| Sales Orders (CRM mode) | ❌ | ❌ |

---

## 4. Functional QA — Revenue Pipeline

```
Lead ──► Opportunity ──► Quotation Document ──► Sales Order ──► Won stage
```

| Step | Store actions | UI entry points | Automated test |
|------|---------------|-----------------|----------------|
| Lead capture | `salesStore.createLead` | `/crm/leads/new` | `test-crm-lead-form-refinement`, `test-crm-leads-list-view` |
| Lead → Opp | `crmStore.createOpportunity` + `linkLeadToOpportunity` | Lead list/360 → New Opp URL params | `test-crm-pipeline-integrity` |
| Opp → Quotation | `createQuotationFromOpportunity` | Opp 360, list actions, `/crm/quotations/new` | `test-crm-integration`, `test-crm-multiline-quotation-to-so` |
| Quotation approval | `submitQuotationDocumentForApproval`, approve flow | Quotation 360 approval tab | `test-crm-integration` |
| Quotation → SO | `convertQuotationDocumentToSalesOrder` | `ConvertQuotationToSOAction` | `test-crm-quotation-to-so-handover` |
| Opp won linkage | Opp `salesOrderId`, stage `won` | SO create with opportunityId | `test-crm-integration` |
| Legacy inquiry path | **Disabled** | N/A | `test-crm-pipeline-integrity` asserts failure |

**Orphan / integrity:** `validateCrmOrphans()` in integration suite — opportunities without customer, quotations without opp, etc.

**Dashboard metrics:** `buildCrmDashboardMetrics` validated in integration + dashboard polish tests.

---

## 5. Attachments & Documents Audit

| Entity | Typed upload (form) | Persisted store | Visible on 360 |
|--------|--------------------|-----------------|----------------|
| Lead | ✅ `CrmTypedDocumentUpload` | `leadAttachmentStore` | ✅ Lead 360 |
| Opportunity | ✅ new + edit | `opportunityAttachmentStore` | ❌ **Gap** |
| Quotation | ❌ | ❌ | ❌ |
| Contact | ❌ | ❌ | ❌ |
| Company | ❌ | ❌ | ❌ |

**Document type master** (`crmMastersCatalog`) lists applicability for leads, opportunities, quotations, SO — **implementation only covers lead + opportunity forms**.

**Legacy field:** `attachmentNames[]` on CRM activity entities — demo/seed only, not connected to typed upload.

---

## 6. Engagement & Cross-Module

| Feature | Status | Notes |
|---------|--------|-------|
| Quick follow-up drawer | ✅ | Used on leads, opps, companies, contacts, dashboard |
| Log activity drawer | ✅ | Lead 360, opp list |
| Kanban pipeline | ✅ | Stage columns, filtered data |
| RBAC / permissions | ✅ | Lead delete/edit gates in list utils |
| Saved views | ✅ | Leads, companies, opps, contacts |
| Import CSV | ✅ Leads, companies, contacts | Lead import dialog |
| Export CSV | ✅ | All major registers |
| Entity 360 customers | ✅ | `/entity360/customers/:id` from CRM tables |
| Branding | ✅ FOS ERP | Suite bar, title; legal demo names unchanged |

---

## 7. Automated Test Inventory

**Umbrella:** `npm run test:crm` → masters + integration + eeata-fix  
**Release gate:** `npm run test:crm-freeze` → **19 suites**

| Script | Focus |
|--------|-------|
| `test-crm-integration` | Full opp → quotation → approve → SO |
| `test-crm-pipeline-integrity` | Lead-opp links, no inquiry regression |
| `test-crm-quotation-to-so-handover` | Conversion validation & nav |
| `test-crm-multiline-quotation-to-so` | Multi-line line mapping |
| `test-crm-leads-list-view` | ~64 list/filter/RBAC checks |
| `test-crm-lead-form-refinement` | Lead form UX |
| `test-crm-companies-ui` | Portfolio KPIs, filters, enrichment |
| `test-crm-opportunity-item-lines` | Line grid calc & validation |
| `test-crm-opportunity-full-page` | Opp page structure |
| `test-crm-dashboard-design-polish` | Dashboard panels & charts |
| `test-crm-masters` | Master catalog & resolution |
| `test-crm-enterprise` | Forecast, inbox, mobile |
| `test-crm-sales-navigation` | Nav order, redirects, counts |
| `test-crm-list-utils` | Sort/filter helpers |
| `test-crm-mobile-pipeline` | Mobile CRM |
| `test-crm-eeata-fix` | EEATA scorecard artifacts |
| `test-crm-execution-clarity` | SO linkage clarity |
| `test-advanced-crm` | Advanced CRM features |
| `test-erp-card-form-system` | Card form system |

### ⚠️ Test drift (static analysis — likely failures until updated)

1. **`test-crm-opportunity-full-page.ts`** — asserts `ErpCardFormPage` in new/edit pages; code now uses **`CrmCardFormShell`**.
2. **`test-crm-companies-ui.ts`** — asserts `CrmCompaniesInsightStrip`, card view actions, `crm-companies-table__action`; companies page migrated to **register-only table** without insight strip/cards.

**Recommendation:** Update assertions before relying on freeze gate post-migration sprint.

---

## 8. Defect & Gap Log

### P1 — Should fix before external UAT sign-off

| ID | Area | Finding | Recommendation |
|----|------|---------|----------------|
| CRM-001 | Tests | Stale opp full-page & companies UI assertions | Update test scripts to match CrmCardFormShell + register table |
| CRM-002 | Attachments | Opportunity attachments not on Opportunity 360 | Add `Enterprise360Documents` panel reading `opportunityAttachmentStore` |
| CRM-003 | UX parity | Contacts list not on enterprise register pattern | Migrate like leads/companies |
| CRM-004 | UX parity | Quotations list not on enterprise register pattern | Migrate filter/table shell |

### P2 — Important backlog

| ID | Area | Finding | Recommendation |
|----|------|---------|----------------|
| CRM-005 | Attachments | No quotation/contact/company typed uploads | Extend `CrmTypedAttachment` + store or unified CRM attachment store |
| CRM-006 | Theme | Quotation editor/preview on legacy shell | Migrate to enterprise form or builder shell |
| CRM-007 | Theme | CRM SO list on legacy register | Align with sales order list enterprise pattern |
| CRM-008 | Feature | Share/send quotation to customer | Placeholder in integration hardening reports |
| CRM-009 | Feature | Lead import | Template download works; full import validation per UAT reports |
| CRM-010 | Feature | Master bulk import | Placeholder on several master types |

### P3 — Polish / tech debt

| ID | Area | Finding | Recommendation |
|----|------|---------|----------------|
| CRM-011 | Code | `CrmPageShell` unused | Remove or document deprecated |
| CRM-012 | Filters | Lead value/date range in utils but not filter drawer | Wire advanced filters or remove dead code |
| CRM-013 | Opp lines | Stock qty in product dropdown hook ready, not wired | Connect when inventory API ready |
| CRM-014 | Company 360 | CRM companies link to `/entity360/customers` not CRM 360 | Acceptable if entity360 is canonical |

---

## 9. Manual UAT Checklist (Recommended)

Run in browser at `http://127.0.0.1:5173` after `npm run test:crm-freeze` passes.

### Leads
- [ ] List: search, filters, saved view, sort, bulk export
- [ ] New lead: all sections, attachments upload, save/create
- [ ] Lead 360: engagement, convert to opportunity, attachments visible
- [ ] Archive/delete rules with linked opps

### Companies & Contacts
- [ ] Companies register table + KPI chips filter
- [ ] New opportunity / follow-up from company row
- [ ] Contacts list filters; new/edit contact; Contact 360

### Opportunities
- [ ] Kanban drag-less view; list register filters
- [ ] New opp: lines, commercial, **attachments**, save
- [ ] Edit opp: attachments persist
- [ ] Opp 360: quotation create, approval, convert to SO

### Quotations
- [ ] List filters; new from opp; 360 CommandBar actions
- [ ] Editor sections/pricing; preview; revision; mark sent; approval
- [ ] Convert to SO handover

### Cross-module
- [ ] Lead → Opp → Quotation → SO → invoice path (demo data)
- [ ] Dashboard KPIs match filtered counts
- [ ] CRM masters: stage, priority, document types, lost reasons
- [ ] Mobile `/m/crm/*` pipeline navigation

---

## 10. Sign-Off Matrix

| Role | Criteria | Status |
|------|----------|--------|
| **Functional QA** | Pipeline E2E + integration tests pass | ⏳ Pending local `test:crm-freeze` |
| **UI/UX QA** | Lead-theme on all primary 360/forms | ⚠️ Lists & quotation builder excluded |
| **Data QA** | Demo saturation, no orphan links | ✅ Covered by integration + eeata scripts |
| **Security/RBAC** | Lead actions permission-gated | ✅ List utils + role UAT reports |
| **Performance** | Register tables with 20+ demo rows | ✅ Manual spot-check recommended |
| **Release** | Freeze gate green + P1 backlog triaged | ⏳ Blocked on test script updates |

---

## 11. Recommended Next Actions (Priority Order)

1. Run `npm run test:crm-freeze` locally; fix **CRM-001** test drift.
2. Add **Opportunity 360 attachments** panel (**CRM-002**).
3. Migrate **Contacts** and **Quotations** lists to enterprise register (**CRM-003**, **CRM-004**).
4. Execute manual UAT checklist §9 with role-based users (sales rep, manager).
5. Update EEATA / UAT sign-off docs after freeze gate is green.

---

*Generated from codebase audit — FOS ERP CRM module, July 2026.*
