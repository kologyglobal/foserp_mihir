import type { RouteObject } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
import { isApiMode } from '@/config/apiConfig'
import { DispatchWorkspacePage, FinanceWorkspacePage } from '@/modules/workspaces'
import { CostingDashboardPage } from '@/modules/costing/CostingPages'
import {
  DispatchDashboardPage,
  DispatchDetailPage,
  DispatchPlanPage,
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
import { DispatchReportsPage, GatePassPrintPage } from '@/modules/dispatch/DispatchProductionPages'
import { ApiDispatchReportsPage } from '@/modules/dispatch/ApiDispatchReportsPage'
import { InvoiceDashboardPage, InvoiceDetailPage } from '@/modules/invoice/InvoicePages'
import { ScanTrailerPage, ScanDispatchConfirmPage } from '@/modules/barcode'
import { demoOnlyRoute } from '@/components/system/DemoOnlyRouteGate'

/** Demo dispatch surfaces without a live equivalent hard-stop in API mode (8B-R-010). */
const DISPATCH_DEMO_GATE = {
  title: 'Dispatch (demo screen)',
  description:
    'This dispatch screen is demo-only and reads local demo records. Live outbound dispatch runs from the dispatch workbench and register.',
  links: [
    { label: 'Dispatch workbench', to: '/dispatch' },
    { label: 'Dispatch register', to: '/dispatch/register' },
  ],
}

/** Demo invoicing reads the local invoice store — live billing is Money In (8B-R-010). */
const INVOICE_DEMO_GATE = {
  title: 'Invoices workspace',
  description:
    'The invoices workspace is demo-only and reads local demo records. Live receivables and receipts run from Money In.',
  links: [{ label: 'Open Money In', to: '/accounting/money-in' }],
}

export const dispatchFinanceRouteChildren: RouteObject[] = [
  {
    path: 'costing',
    element: demoOnlyRoute(<CostingDashboardPage />, {
      title: 'Costing dashboard',
      description:
        'The costing dashboard is demo-only. Live work-order costing is available from the Work Order detail costing tab.',
      links: [{ label: 'Open Work Orders', to: '/manufacturing/work-orders' }],
    }),
  },

  { path: 'dispatch', element: isApiMode() ? <DispatchWorkbenchPage /> : <DispatchWorkspacePage /> },
  {
    path: 'dispatch/workbench',
    element: isApiMode() ? <DispatchWorkbenchPage /> : <DispatchWorkspacePage />,
  },
  {
    path: 'dispatch/register',
    element: isApiMode() ? <ApiOutboundDispatchRegisterPage /> : <DispatchDashboardPage />,
  },
  {
    path: 'dispatch/pick-lists',
    element: <DispatchPickListRegisterPage />,
  },
  {
    path: 'dispatch/pick-lists/:id/pick',
    element: <DispatchPickListPickModePage />,
  },
  {
    path: 'dispatch/pick-lists/:id',
    element: <DispatchPickListDetailPage />,
  },
  {
    path: 'dispatch/packing-sessions',
    element: <DispatchPackingRegisterPage />,
  },
  {
    path: 'dispatch/packing-sessions/:id/pack',
    element: <DispatchPackingPackModePage />,
  },
  {
    path: 'dispatch/packing-sessions/:id',
    element: <DispatchPackingDetailPage />,
  },
  {
    path: 'dispatch/delivery-challans',
    element: <DispatchChallanRegisterPage />,
  },
  {
    path: 'dispatch/delivery-challans/:id',
    element: <DispatchChallanDetailPage />,
  },
  /** Live planning happens on the requirements workbench (7C1) — demo plan page stays demo-only. */
  { path: 'dispatch/plan', element: isApiMode() ? <Navigate to="/dispatch/workbench" replace /> : <DispatchPlanPage /> },
  { path: 'dispatch/scan/trailer', element: demoOnlyRoute(<ScanTrailerPage />, DISPATCH_DEMO_GATE) },
  { path: 'dispatch/scan/dispatch', element: demoOnlyRoute(<ScanDispatchConfirmPage />, DISPATCH_DEMO_GATE) },
  /** Reports: live 7C0/7C1-backed page in API mode; demo report engine in demo mode. */
  { path: 'dispatch/reports', element: isApiMode() ? <ApiDispatchReportsPage /> : <DispatchReportsPage /> },
  { path: 'dispatch/:id/gate-pass', element: demoOnlyRoute(<GatePassPrintPage />, DISPATCH_DEMO_GATE) },
  {
    path: 'dispatch/:id',
    element: isApiMode() ? <ApiOutboundDispatchDetailPage /> : <DispatchDetailPage />,
  },

  { path: 'invoices', element: demoOnlyRoute(<FinanceWorkspacePage />, INVOICE_DEMO_GATE) },
  { path: 'invoices/register', element: demoOnlyRoute(<InvoiceDashboardPage />, INVOICE_DEMO_GATE) },
  { path: 'invoices/:id', element: demoOnlyRoute(<InvoiceDetailPage />, INVOICE_DEMO_GATE) },
]
