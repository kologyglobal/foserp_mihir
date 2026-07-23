import type { RouteObject } from 'react-router-dom'
import { CrmReportsIndexPage, CrmReportPage } from '@/modules/reports/CrmReportsPages'

/** Cross-module demo reports removed. CRM reports remain. */
export const reportsRouteChildren: RouteObject[] = [
  { path: 'reports/crm', element: <CrmReportsIndexPage /> },
  { path: 'reports/crm/:reportId', element: <CrmReportPage /> },
]
