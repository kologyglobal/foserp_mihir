# CRM Leads List View Update Report

**Project:** Vasant Trailer ERP  
**Date:** 2026-06-29  
**Routes:** `/sales/leads`, `/crm/leads`

## Final Verdict

**Leads List View Updated** · **Lead Navigation and Save Button Standardized**

---

## Navigation and Save Button Standardization

- CRM tab row: Dashboard, Companies, Contacts, Leads, Opportunities, Pipeline, Follow-ups, Activities, Quotations, Quotation Templates, CRM Reports
- `/sales/leads` uses CRM module tabs; Leads tab active on all lead routes
- Standard headers/breadcrumbs on list (`Leads`), new, edit, view (`Lead Details`)
- `ErpCommandBar` on list and detail pages
- Save standard: `ErpButton` primary `#001B3A`, sticky form footer, post-save next actions panel
- History drawer: record summary, timeline, Open Lead / Close actions
- Dashboard `?stage=` / `?priority=` seeds list filters

---

## Columns Updated

The lead register grid (`CrmLeadsTable` + `ErpDataGrid`) now shows exactly these columns:

| # | Column | Implementation |
|---|--------|----------------|
| 1 | Lead No | Clickable `TableLink` → route-aware view page |
| 2 | Prospect | Company name from Company Master, else prospect name |
| 3 | Source | Read-only chip from Company Master or lead record |
| 4 | Industry | Read-only from Company Master or lead record |
| 5 | Lead Owner | `leadOwnerName` from user assignment |
| 6 | Expected Value | `formatCurrency`, right-aligned |
| 7 | Probability | Percentage + mini progress bar, center-aligned |
| 8 | Status | `ErpStatusChip` (Active/Inactive/Open/Closed/Converted) |
| 9 | Stage | `LeadStageChip` (7-stage model) |
| 10 | Last Modified On | `formatDateTime`, default sort descending |
| 11 | Actions | View, Edit, History, Delete icons (always visible) |

---

## Source / Industry Fetch Logic

Implemented in `src/utils/leadListUtils.ts`:

- **`resolveLeadSourceIndustry(lead, customer)`** — If a Company Master record is linked (`customerId`), industry comes from `customer.industry`. Source always comes from the normalized lead record (set when company/prospect was created).
- **`enrichLeadRow(lead, customer)`** — Builds display row with `prospectDisplay`, `sourceDisplay`, `industryDisplay`, composite `displayStatus`, and `lastModified`.
- Source and Industry are **not** editable on the lead form; list view is read-only display only.

---

## Action Icons

| Icon | Behavior |
|------|----------|
| View | Navigates to `/sales/leads/:id` or `/crm/leads/:id` based on current route |
| Edit | Navigates to `/:base/:id/edit` (disabled when stage is locked) |
| History | Opens `LeadHistoryDrawer` (created/modified, stage, owner, follow-ups, activities) |
| Delete | Opens `DeleteLeadModal`; soft-archives via `archiveLead` when allowed |

---

## Delete Behavior

- **Soft delete** via `salesStore.archiveLead()` — sets `isArchived: true` and `activityStatus: 'inactive'`.
- Archived leads are hidden from the active register list.
- **Blocked** when lead is converted, has opportunity, quotation, inquiry, or CRM activity/follow-up history.
- Block message: *"This lead cannot be deleted because it has linked CRM records. Mark it inactive or closed instead."*
- Modal title: **Delete Lead?** with audit retention message and Cancel / Delete Lead actions.

---

## Permission Rules

| Action | Permission |
|--------|------------|
| View | `sales` view (standard page access) |
| Edit | `canPermission('sales', 'edit')` |
| History | Lead view (same as page access) |
| Delete | `canPermission('sales', 'override')` — Admin/Sales Manager; icon disabled with tooltip when denied |

---

## Filters Updated

- Search (lead no / prospect / owner)
- Source, Industry, Lead Owner, Status, Stage, Priority
- Probability min/max range
- Last modified date range
- Clear Filters button + filter chips via `SmartFilterBar`
- Save View via `useSavedViews` + `SaveViewDialog`

---

## Route Mapping

| Route | Component |
|-------|-----------|
| `/crm/leads` | `LeadListPage` → `CrmLeadListPage` (`crmRoutes.tsx`) |
| `/sales/leads` | `LeadListPage` → `CrmLeadListPage` (`routes/index.tsx`) |
| `/crm/leads/:id` | `LeadDetailPage` |
| `/sales/leads/:id` | `LeadDetailPage` |
| `/crm/leads/:id/edit` | `CrmLeadFormPage` |
| `/sales/leads/:id/edit` | `CrmLeadFormPage` |

`useLeadRoutes()` detects base path from `useLocation()` for navigation consistency.

---

## Command Bar

- **Primary:** New Lead
- **Secondary:** Import, Export, Refresh, Save View

---

## Tests

Script: `npm run test:crm-leads-list-view` (64 checks)

Wired into:

- `test:ci`
- `test:uat`
- `test:eeta-100`
- `test:crm-eeata-fix` (CRM freeze suite)

---

## Remaining Gaps

1. **Import Leads** — placeholder toast; connect to data import module when available.
2. **Expected value range filter** — filter logic exists in `leadListUtils`; UI inputs for value min/max not yet added to filter bar (probability + modified date ranges are present).
3. **Created date range filter** — logic exists; date inputs not yet in filter bar.
4. **Quotation linkage on delete** — `canDeleteLead` checks `quotationCount`; demo data may have few/no lead-linked quotations to exercise in UI.
5. **Hard delete** — not implemented; archive-only as specified.

---

## Files Touched

- `src/modules/crm/CrmLeadListPage.tsx` (new)
- `src/components/crm/CrmLeadsTable.tsx` (new)
- `src/components/crm/DeleteLeadModal.tsx`
- `src/components/erp/ErpDataGrid.tsx`
- `src/components/erp/ErpStatusChip.tsx`
- `src/utils/leadListUtils.ts`
- `src/utils/format.ts` — `formatDateTime`
- `src/store/salesStore.ts` — `archiveLead`
- `src/modules/sales/SalesPages.tsx` — re-export shared list
- `src/styles/dynamics-components.css`
- `src/hooks/useLeadRoutes.ts`
- `src/utils/crmLeadNavigation.ts`
- `src/components/crm/LeadSaveNextActionsPanel.tsx`
- `src/config/navigation.ts`
