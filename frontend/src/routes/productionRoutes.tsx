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
import { isApiMode } from '@/config/apiConfig'
import { useParams } from 'react-router-dom'
import { demoOnlyRoute } from '@/components/system/DemoOnlyRouteGate'

/** Classic MRP is demo-only and excluded from the pilot (8B-R-010). */
const MRP_DEMO_GATE = {
  title: 'MRP planner',
  description:
    'Classic MRP is a demo-only workbench and is excluded from live operation. Plan demand as Work Orders and track execution from Today.',
  links: [
    { label: 'Open Work Orders', to: '/manufacturing/work-orders' },
    { label: 'Open Today', to: '/manufacturing/today' },
  ],
}

/** Demo barcode scan actions mutate local stores only — never allowed in API mode (false success risk). */
const SCAN_DEMO_GATE = {
  title: 'Barcode scan action',
  description:
    'Barcode scan actions are demo-only and would not post to the live backend. Record progress from My Work or the Work Order detail.',
  links: [
    { label: 'Open My Work', to: '/manufacturing/my-work' },
    { label: 'Open Work Orders', to: '/manufacturing/work-orders' },
  ],
}

/** Legacy demo WO deep links (`/work-orders/:id`, `/work-orders/:id/360`) → live WO detail in API mode. */
function ApiModeLegacyWorkOrderRedirect() {
  const { id } = useParams()
  return <Navigate to={id ? `/manufacturing/work-orders/${id}` : '/manufacturing/work-orders'} replace />
}

/** Legacy demo job-work deep link → dual-mode job-work detail in API mode. */
function ApiModeLegacyJobWorkRedirect() {
  const { id } = useParams()
  return <Navigate to={id ? `/manufacturing/job-work/${id}` : '/manufacturing/job-work'} replace />
}

/** MRP planner routes (registered before sales in the main layout). */
export const mrpRouteChildren: RouteObject[] = [
  { path: 'mrp', element: demoOnlyRoute(<MRPDashboardPage />, MRP_DEMO_GATE) },
  { path: 'mrp/planner', element: demoOnlyRoute(<MrpPlannerWorkbenchPage />, MRP_DEMO_GATE) },
  { path: 'mrp/workbench', element: demoOnlyRoute(<MrpPlannerRedirect />, MRP_DEMO_GATE) },
  { path: 'mrp/run', element: demoOnlyRoute(<RunMRPPage />, MRP_DEMO_GATE) },
  { path: 'mrp/runs/:id', element: demoOnlyRoute(<MRPRunDetailPage />, MRP_DEMO_GATE) },
]

/**
 * Legacy production URLs — hubs redirect into Manufacturing & Production shell.
 * Detail / scan pages remain until later phases delete or fold them.
 */
export const productionRouteChildren: RouteObject[] = [
  { path: 'production/control-tower', element: <Navigate to="/manufacturing/control-room" replace /> },
  { path: 'production', element: <Navigate to="/manufacturing/today" replace /> },
  {
    path: 'production/job-cards',
    element: <Navigate to="/manufacturing/work-orders" replace />,
  },
  { path: 'production/scan/start', element: demoOnlyRoute(<ScanOperationStartPage />, SCAN_DEMO_GATE) },
  { path: 'production/scan/complete', element: demoOnlyRoute(<ScanOperationCompletePage />, SCAN_DEMO_GATE) },
  { path: 'production/scan/wip-move', element: demoOnlyRoute(<ScanWipMovePage />, SCAN_DEMO_GATE) },
  {
    path: 'shop-floor',
    element: demoOnlyRoute(<ShopFloorJobQueuePage />, {
      title: 'Shop-floor job queue',
      description: 'This shop-floor tower is demo-only. Operators execute live work from My Work; supervisors use Today and the Control Room.',
      links: [
        { label: 'Open My Work', to: '/manufacturing/my-work' },
        { label: 'Open Control Room', to: '/manufacturing/control-room' },
      ],
    }),
  },
  { path: 'work-orders', element: <Navigate to="/manufacturing/work-orders" replace /> },
  {
    path: 'work-orders/create-from-mrp',
    element: demoOnlyRoute(<CreateWorkOrderFromMrpPage />, MRP_DEMO_GATE),
  },
  { path: 'work-orders/:id/360', element: isApiMode() ? <ApiModeLegacyWorkOrderRedirect /> : <WorkOrder360Page /> },
  { path: 'work-orders/:id', element: isApiMode() ? <ApiModeLegacyWorkOrderRedirect /> : <WorkOrderDetailPage /> },

  { path: 'job-work', element: <Navigate to="/manufacturing/job-work" replace /> },
  { path: 'job-work/scan/send', element: demoOnlyRoute(<ScanSubcontractSendPage />, SCAN_DEMO_GATE) },
  { path: 'job-work/scan/receive', element: demoOnlyRoute(<ScanSubcontractReceivePage />, SCAN_DEMO_GATE) },
  {
    path: 'job-work/vendors/:vendorId',
    element: demoOnlyRoute(<VendorJobWorkWorkspacePage />, {
      title: 'Vendor job-work workspace',
      description: 'This vendor workspace is demo-only. Live job work runs from the Job Work register.',
      links: [{ label: 'Open Job Work', to: '/manufacturing/job-work' }],
    }),
  },
  {
    path: 'job-work/:id/print',
    element: demoOnlyRoute(<JobWorkChallanPrintPage />, {
      title: 'Job-work challan print',
      description: 'This challan print view is demo-only. Open the live job-work order from the register.',
      links: [{ label: 'Open Job Work', to: '/manufacturing/job-work' }],
    }),
  },
  { path: 'job-work/:id', element: isApiMode() ? <ApiModeLegacyJobWorkRedirect /> : <JobWorkOrderDetailPage /> },
]
