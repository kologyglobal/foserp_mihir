import type { RouteObject } from 'react-router-dom'
import { DispatchWorkspacePage, FinanceWorkspacePage } from '@/modules/workspaces'
import { CostingDashboardPage } from '@/modules/costing/CostingPages'
import {
  DispatchDashboardPage,
  DispatchDetailPage,
  DispatchPlanPage,
} from '@/modules/dispatch/DispatchPages'
import { DispatchReportsPage, GatePassPrintPage } from '@/modules/dispatch/DispatchProductionPages'
import { InvoiceDashboardPage, InvoiceDetailPage } from '@/modules/invoice/InvoicePages'
import { ScanTrailerPage, ScanDispatchConfirmPage } from '@/modules/barcode'

export const dispatchFinanceRouteChildren: RouteObject[] = [
  { path: 'costing', element: <CostingDashboardPage /> },

  { path: 'dispatch', element: <DispatchWorkspacePage /> },
  { path: 'dispatch/register', element: <DispatchDashboardPage /> },
  { path: 'dispatch/plan', element: <DispatchPlanPage /> },
  { path: 'dispatch/scan/trailer', element: <ScanTrailerPage /> },
  { path: 'dispatch/scan/dispatch', element: <ScanDispatchConfirmPage /> },
  { path: 'dispatch/reports', element: <DispatchReportsPage /> },
  { path: 'dispatch/:id/gate-pass', element: <GatePassPrintPage /> },
  { path: 'dispatch/:id', element: <DispatchDetailPage /> },

  { path: 'invoices', element: <FinanceWorkspacePage /> },
  { path: 'invoices/register', element: <InvoiceDashboardPage /> },
  { path: 'invoices/:id', element: <InvoiceDetailPage /> },
]
