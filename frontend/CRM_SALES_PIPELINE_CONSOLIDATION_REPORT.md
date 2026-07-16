# CRM / Sales Pipeline Consolidation Report

**Project:** Vasant Trailer ERP  
**Date:** 2026-06-24  
**Verdict:** **CRM and Sales Navigation Consolidated**

## Summary

Sales Pipeline is no longer a separate top-level module. Pre-sales relationship management lives under **CRM**; confirmed order execution lives under **Sales**. All existing routes remain functional; legacy `/sales-pipeline` redirects to CRM Opportunity Kanban.

## Navigation Changes

| Before | After |
|--------|-------|
| Advanced CRM (sidebar) | **CRM** |
| Sales Pipeline (sidebar) | **Sales** (order execution only) |
| Leads under Sales nav | Leads under **CRM** |
| Quotations under Sales nav | Quotations under **CRM** |
| No CRM Reports in sidebar | **CRM Reports** at `/crm/reports` |

### CRM Sidebar

- Dashboard, Leads, Customers, Contacts, Opportunities, Pipeline Kanban, Follow-ups, Activities, Quotations, Quotation Templates, CRM Reports

### Sales Sidebar

- Sales Dashboard, Sales Orders, Customer 360, Order Status, SO to MRP, Sales Reports

## Route Changes

| Route | Purpose |
|-------|---------|
| `/crm/leads` | Lead register (same component as legacy `/sales/leads`) |
| `/crm/reports` | CRM reports hub |
| `/crm/reports/:reportId` | Individual CRM report |
| `/sales/order-status` | Confirmed SO status board |
| `/sales/reports` | Sales execution reports hub |
| `/sales/orders/:id/360` | Sales order detail alias |

## Redirects

| Old Route | Redirect |
|-----------|----------|
| `/sales-pipeline` | `/crm/opportunities/kanban` |

Legacy `/sales/leads`, `/sales/inquiries`, `/sales/quotations`, `/sales/approvals` **remain active** (no data or bookmark breakage).

## Module Ownership

### CRM (pre-sales)

Leads, customers, contacts, opportunities, pipeline kanban, follow-ups, activities, editable quotations, revisions, approval, CRM reports.

### Sales (order execution)

Sales orders, SO freeze/MRP handoff, production/dispatch/invoicing chain, order status, sales reports.

### Quotation Flow

1. Quotation created from opportunity in CRM  
2. Edited / revised / approved in CRM  
3. Approved quotation converts to Sales Order with `quotationDocumentId` + `quotationDocumentRevisionNo`  
4. CRM retains quotation history; Sales owns execution  

## Dashboard Updates

| Dashboard | Focus |
|-----------|-------|
| CRM (`/crm`) | Open opportunities, pipeline value, follow-ups, quotations pending, won/lost, conversion, pipeline snapshot |
| Sales (`/sales`) | Confirmed SOs, order value, pending MRP, in production, QC hold, dispatch ready, invoiced, closed |

## Sidebar Badges

| Category | Count logic |
|----------|-------------|
| CRM | Open opportunities + due follow-ups + pending quotations |
| Sales | Open SOs + pending MRP + dispatch-ready |

## Customer 360

Single customer view shows:

- **CRM tab:** opportunities, follow-ups, activities, quotations  
- **Sales tab:** sales orders, dispatches, invoices, payments  
- **Opportunity Pipeline tab** (renamed from Sales Pipeline)

## Tests

| Suite | Result |
|-------|--------|
| `npm run test:crm-sales-navigation` | **21/21 PASS** |
| `npm run test:crm-integration` | PASS (unchanged) |
| `npm run test:advanced-crm` | PASS (unchanged) |
| Added to `test:ci`, `test:uat`, `test:eeta-100`, `test:full-system-uat` | ✓ |

## Remaining Naming Gaps (Low)

- Legacy `/sales/inquiries` and `/sales/quotations` pages still exist for backward compatibility (not in sidebar)  
- Some internal seed files still reference `salesPipelineSeed` naming (data only, not user-facing)  
- ERP Sales quotation register (`/sales/quotations`) coexists with CRM editable quotations — CRM is canonical for new pre-sales work  

## Files Changed

- `src/config/navigation.ts` — CRM + Sales sidebar restructure  
- `src/routes/crmRoutes.tsx` — leads + CRM reports routes  
- `src/routes/index.tsx` — sales execution routes + `/sales-pipeline` redirect  
- `src/modules/sales/SalesNavigationPages.tsx` — new sales pages + redirect  
- `src/modules/workspaces/SalesWorkspace.tsx` — order execution dashboard  
- `src/modules/crm/CrmDashboardPage.tsx` — terminology + pipeline snapshot  
- `src/utils/sidebarLiveCounts.ts` — CRM + Sales badges  
- `src/utils/workspaceMetrics.ts` — sales execution metrics  
- `scripts/test-crm-sales-navigation.ts` — new test suite  

## Final Verdict

**CRM and Sales Navigation Consolidated**
