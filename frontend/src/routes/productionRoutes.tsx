import type { RouteObject } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
import {
  MrpPlannerWorkbenchPage,
  ShopFloorJobQueuePage,
} from '@/modules/control-towers'
import { MrpPlannerRedirect } from '@/modules/control-towers/ControlTowerRedirects'
import { MRPDashboardPage } from '@/modules/mrp/MRPDashboard'
import { RunMRPPage } from '@/modules/mrp/RunMRPPage'
import { MRPRunDetailPage } from '@/modules/mrp/MRPRunDetailPage'
import { WorkOrderDetailPage, CreateWorkOrderFromMrpPage } from '@/modules/workorder/WorkOrderPages'
import {
  WorkOrder360Page,
  JobWorkOrderDetailPage,
  JobWorkChallanPrintPage,
  VendorJobWorkWorkspacePage,
} from '@/modules/execution-layer'
import {
  ScanOperationStartPage,
  ScanOperationCompletePage,
  ScanWipMovePage,
  ScanSubcontractSendPage,
  ScanSubcontractReceivePage,
} from '@/modules/barcode'

/** MRP planner routes (registered before sales in the main layout). */
export const mrpRouteChildren: RouteObject[] = [
  { path: 'mrp', element: <MRPDashboardPage /> },
  { path: 'mrp/planner', element: <MrpPlannerWorkbenchPage /> },
  { path: 'mrp/workbench', element: <MrpPlannerRedirect /> },
  { path: 'mrp/run', element: <RunMRPPage /> },
  { path: 'mrp/runs/:id', element: <MRPRunDetailPage /> },
]

/**
 * Legacy production URLs — hubs redirect into Manufacturing & Production shell.
 * Detail / scan pages remain until later phases delete or fold them.
 */
export const productionRouteChildren: RouteObject[] = [
  { path: 'production/control-tower', element: <Navigate to="/manufacturing/control-room" replace /> },
  { path: 'production', element: <Navigate to="/manufacturing/control-room" replace /> },
  {
    path: 'production/job-cards',
    element: <Navigate to="/manufacturing/work-orders" replace />,
  },
  { path: 'production/scan/start', element: <ScanOperationStartPage /> },
  { path: 'production/scan/complete', element: <ScanOperationCompletePage /> },
  { path: 'production/scan/wip-move', element: <ScanWipMovePage /> },
  { path: 'shop-floor', element: <ShopFloorJobQueuePage /> },
  { path: 'work-orders', element: <Navigate to="/manufacturing/work-orders" replace /> },
  { path: 'work-orders/create-from-mrp', element: <CreateWorkOrderFromMrpPage /> },
  { path: 'work-orders/:id/360', element: <WorkOrder360Page /> },
  { path: 'work-orders/:id', element: <WorkOrderDetailPage /> },

  { path: 'job-work', element: <Navigate to="/manufacturing/job-work" replace /> },
  { path: 'job-work/scan/send', element: <ScanSubcontractSendPage /> },
  { path: 'job-work/scan/receive', element: <ScanSubcontractReceivePage /> },
  { path: 'job-work/vendors/:vendorId', element: <VendorJobWorkWorkspacePage /> },
  { path: 'job-work/:id/print', element: <JobWorkChallanPrintPage /> },
  { path: 'job-work/:id', element: <JobWorkOrderDetailPage /> },
]
