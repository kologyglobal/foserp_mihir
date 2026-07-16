import type { RouteObject } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
import { RouteErrorPage } from '@/components/system/AppErrorBoundary'
import { CrmOwnersLegacyRedirect } from '@/modules/admin/CrmOwnersLegacyRedirect'
import {
  CrmDashboardPage,
  CrmCustomersPage,
  CrmContactsPage,
  OpportunityPipelinePage,
  Opportunity360Page,
  OpportunityEditPage,
  OpportunityNewPage,
  CrmActivitiesPage,
  CrmFollowUpsPage,
} from '@/modules/crm'
import { CrmSalesForecastPage } from '@/modules/crm/CrmSalesForecastPage'
import { GuidedDealFlowPage } from '@/modules/crm/GuidedDealFlowPage'
import { Contact360Page } from '@/modules/crm/Contact360Page'
import { CrmContactFormPage } from '@/modules/crm/CrmContactFormPage'
import { CrmSalesOrderListPage } from '@/modules/crm/CrmSalesOrderListPage'
import { SalesOrder360Page } from '@/modules/sales/SalesOrder360Page'
import { LeadListPage, LeadDetailPage } from '@/modules/sales/SalesPages'
import { LeadFormPage } from '@/modules/crm/CrmLeadFormPage'
import { CrmReportsIndexPage, CrmReportPage } from '@/modules/reports/CrmReportsPages'
import { CrmMastersHubPage } from '@/modules/crm/masters/CrmMastersHubPage'
import {
  CrmMasterListPage,
  CrmMasterFormPage,
  CrmMasterDetailPage,
  CrmLinkedMasterPage,
} from '@/modules/crm/masters/CrmMasterPages'
import { quotationRouteChildren } from './quotationRoutes'

export const crmRouteChildren: RouteObject[] = [
  { index: true, element: <CrmDashboardPage /> },
  { path: 'guided-deal', element: <GuidedDealFlowPage /> },
  { path: 'forecast', element: <CrmSalesForecastPage /> },
  { path: 'leads', element: <LeadListPage /> },
  { path: 'leads/new', element: <LeadFormPage /> },
  { path: 'leads/:id/edit', element: <LeadFormPage /> },
  { path: 'leads/:id', element: <LeadDetailPage /> },
  { path: 'customers', element: <CrmCustomersPage /> },
  { path: 'contacts', element: <CrmContactsPage /> },
  { path: 'contacts/new', element: <CrmContactFormPage /> },
  { path: 'contacts/:id/edit', element: <CrmContactFormPage /> },
  { path: 'contacts/:id', element: <Contact360Page /> },
  { path: 'opportunities', element: <OpportunityPipelinePage /> },
  { path: 'opportunities/kanban', element: <Navigate to="/crm/opportunities" replace /> },
  { path: 'opportunities/new', element: <OpportunityNewPage /> },
  { path: 'opportunities/:id', element: <Opportunity360Page /> },
  { path: 'opportunities/:id/edit', element: <OpportunityEditPage /> },
  { path: 'activities', element: <CrmActivitiesPage /> },
  { path: 'follow-ups', element: <CrmFollowUpsPage /> },
  ...quotationRouteChildren,
  { path: 'sales-orders', element: <CrmSalesOrderListPage /> },
  { path: 'sales-orders/:id', element: <SalesOrder360Page /> },
  { path: 'reports', element: <CrmReportsIndexPage /> },
  { path: 'reports/:reportId', element: <CrmReportPage /> },
  { path: 'masters', element: <CrmMastersHubPage /> },
  { path: 'masters/companies', element: <CrmLinkedMasterPage /> },
  { path: 'masters/companies/new', element: <CrmLinkedMasterPage /> },
  { path: 'masters/companies/:id', element: <CrmLinkedMasterPage /> },
  { path: 'masters/companies/:id/edit', element: <CrmLinkedMasterPage /> },
  { path: 'masters/contacts', element: <Navigate to="/masters/contacts" replace /> },
  { path: 'masters/contacts/new', element: <Navigate to="/masters/contacts/new" replace /> },
  { path: 'masters/contacts/:id/edit', element: <CrmContactFormPage /> },
  { path: 'masters/quotation-templates', element: <CrmLinkedMasterPage /> },
  { path: 'masters/quotation-templates/new', element: <CrmLinkedMasterPage /> },
  { path: 'masters/quotation-templates/:id', element: <CrmLinkedMasterPage /> },
  { path: 'masters/owners', element: <Navigate to="/masters/users" replace /> },
  { path: 'masters/owners/*', element: <CrmOwnersLegacyRedirect /> },
  { path: 'masters/competitors', element: <Navigate to="/crm/masters" replace /> },
  { path: 'masters/competitors/*', element: <Navigate to="/crm/masters" replace /> },
  { path: 'masters/follow-up-types', element: <Navigate to="/crm/masters/activity-types" replace /> },
  { path: 'masters/follow-up-types/*', element: <Navigate to="/crm/masters/activity-types" replace /> },
  { path: 'masters/product-interests', element: <Navigate to="/masters/product-interests" replace /> },
  { path: 'masters/product-interests/*', element: <Navigate to="/masters/product-interests" replace /> },
  { path: 'masters/:kind', element: <CrmMasterListPage /> },
  { path: 'masters/:kind/new', element: <CrmMasterFormPage /> },
  { path: 'masters/:kind/:id/edit', element: <CrmMasterFormPage /> },
  { path: 'masters/:kind/:id', element: <CrmMasterDetailPage /> },
  { path: '*', element: <Navigate to="/crm" replace /> },
]

export const crmRouteTree = {
  path: 'crm',
  errorElement: <RouteErrorPage />,
  children: crmRouteChildren,
}
