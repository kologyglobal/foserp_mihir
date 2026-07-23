import type { RouteObject } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
import {
  OrgAccountMappingPage,
  OrgChartOfAccountsPage,
  OrgFiscalYearsPage,
  OrgLegalEntityPage,
  OrgPostingPeriodsPage,
  OrgRegistrationsPage,
} from '@/modules/organisation'

export const organisationRouteChildren: RouteObject[] = [
  { path: 'settings/organisation', element: <Navigate to="/settings/organisation/legal-entity" replace /> },
  { path: 'settings/organisation/legal-entity', element: <OrgLegalEntityPage /> },
  { path: 'settings/organisation/registrations', element: <OrgRegistrationsPage /> },
  { path: 'settings/organisation/chart-of-accounts', element: <OrgChartOfAccountsPage /> },
  { path: 'settings/organisation/account-mapping', element: <OrgAccountMappingPage /> },
  { path: 'settings/organisation/fiscal-years', element: <OrgFiscalYearsPage /> },
  { path: 'settings/organisation/posting-periods', element: <OrgPostingPeriodsPage /> },
]
