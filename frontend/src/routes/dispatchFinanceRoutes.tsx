import type { RouteObject } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
import { isApiMode } from '@/config/apiConfig'
import { DispatchWorkspacePage } from '@/modules/workspaces'
import {
  DispatchDashboardPage,
  DispatchDetailPage,
} from '@/modules/dispatch/DispatchPages'
import {
  ApiOutboundDispatchDetailPage,
  ApiOutboundDispatchRegisterPage,
} from '@/modules/dispatch/ApiOutboundDispatchPages'
import { DispatchWorkbenchPage } from '@/modules/dispatch/DispatchWorkbenchPage'
import {
  DispatchPickListDetailPage,
  DispatchPickListPickModePage,
  DispatchPickListRegisterPage,
} from '@/modules/dispatch/DispatchPickListPages'
import {
  DispatchPackingDetailPage,
  DispatchPackingPackModePage,
  DispatchPackingRegisterPage,
} from '@/modules/dispatch/DispatchPackingPages'
import {
  DispatchChallanDetailPage,
  DispatchChallanRegisterPage,
} from '@/modules/dispatch/DispatchChallanPages'
import { DispatchReportsPage } from '@/modules/dispatch/DispatchProductionPages'
import { ApiDispatchReportsPage } from '@/modules/dispatch/ApiDispatchReportsPage'

/** Live dispatch only — demo scan/plan/gate-pass/invoices/costing removed. */
export const dispatchFinanceRouteChildren: RouteObject[] = [
  { path: 'dispatch', element: isApiMode() ? <DispatchWorkbenchPage /> : <DispatchWorkspacePage /> },
  {
    path: 'dispatch/workbench',
    element: isApiMode() ? <DispatchWorkbenchPage /> : <DispatchWorkspacePage />,
  },
  {
    path: 'dispatch/register',
    element: isApiMode() ? <ApiOutboundDispatchRegisterPage /> : <DispatchDashboardPage />,
  },
  { path: 'dispatch/pick-lists', element: <DispatchPickListRegisterPage /> },
  { path: 'dispatch/pick-lists/:id/pick', element: <DispatchPickListPickModePage /> },
  { path: 'dispatch/pick-lists/:id', element: <DispatchPickListDetailPage /> },
  { path: 'dispatch/packing-sessions', element: <DispatchPackingRegisterPage /> },
  { path: 'dispatch/packing-sessions/:id/pack', element: <DispatchPackingPackModePage /> },
  { path: 'dispatch/packing-sessions/:id', element: <DispatchPackingDetailPage /> },
  { path: 'dispatch/delivery-challans', element: <DispatchChallanRegisterPage /> },
  { path: 'dispatch/delivery-challans/:id', element: <DispatchChallanDetailPage /> },
  { path: 'dispatch/plan', element: <Navigate to="/dispatch/workbench" replace /> },
  { path: 'dispatch/reports', element: isApiMode() ? <ApiDispatchReportsPage /> : <DispatchReportsPage /> },
  {
    path: 'dispatch/:id',
    element: isApiMode() ? <ApiOutboundDispatchDetailPage /> : <DispatchDetailPage />,
  },
]
