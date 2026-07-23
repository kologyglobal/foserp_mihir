import { Navigate } from 'react-router-dom'
import { RouteErrorBoundary } from '../components/system/RouteErrorBoundary'
import { MobileLayout } from '../components/mobile/MobileLayout'
import {
  MobileHomePage,
  MobileTasksPage,
  MobileModulesPage,
  MobileProfilePage,
} from '../modules/mobile/MobileShellPages'
import {
  MobileGatePage,
  MobileGateInwardPage,
  MobileGateOutwardPage,
  MobileGatePassPage,
} from '../modules/mobile/MobileGatePages'
import {
  MobileGrnListPage,
  MobileGrnDetailPage,
  MobileGrnReceivePage,
} from '../modules/mobile/MobileGrnPages'
import {
  MobileStockCountPage,
  MobileMaterialIssuePage,
  MobileMaterialReturnPage,
  MobileWarehouseTransferPage,
} from '../modules/mobile/MobileInventoryPages'
import {
  MobileQcListPage,
  MobileQcDetailPage,
  MobileNcrPage,
} from '../modules/mobile/MobileQualityPages'
import { MobileKioskHomePage } from '../modules/mobile/kiosk/MobileKioskHomePage'
import { MobileShopfloorKioskPage } from '../modules/mobile/kiosk/MobileShopfloorKioskPage'
import {
  MobileDispatchListPage,
  MobileDispatchDetailPage,
} from '../modules/mobile/MobileDispatchPages'
import {
  MobileJobWorkListPage,
  MobileJobWorkSendPage,
  MobileJobWorkReceivePage,
} from '../modules/mobile/MobileJobWorkPages'
import { MobileApprovalsPage } from '../modules/mobile/MobileApprovalsPage'
import {
  MobileCrmOpportunitiesPage,
  MobileCrmCustomersPage,
  MobileCrmLeadsPage,
  MobileCrmQuotationsPage,
  MobileCrmSalesOrdersPage,
  MobileCrmFollowUpsPage,
  MobileCrmActivitiesPage,
} from '../modules/mobile/MobileCrmPages'
import { MobileCrmPipelinePage } from '../modules/mobile/MobileCrmPipelinePage'

/** Mobile shell — dual-mode: shopfloor/QC/gate/GRN/inventory/dispatch/job-work/approvals hit live APIs when VITE_USE_API=true. */
export const mobileRouteTree = {
  path: '/m',
  element: <MobileLayout />,
  errorElement: <RouteErrorBoundary />,
  children: [
    { index: true, element: <Navigate to="home" replace /> },
    { path: 'home', element: <MobileHomePage /> },
    { path: 'tasks', element: <MobileTasksPage /> },
    { path: 'modules', element: <MobileModulesPage /> },
    { path: 'profile', element: <MobileProfilePage /> },
    { path: 'gate', element: <MobileGatePage /> },
    { path: 'gate/inward', element: <MobileGateInwardPage /> },
    { path: 'gate/outward', element: <MobileGateOutwardPage /> },
    { path: 'gate/visitors/new', element: <Navigate to="/gate/visitors/new" replace /> },
    { path: 'gate/visitors/*', element: <Navigate to="/gate/visitors" replace /> },
    { path: 'grn', element: <MobileGrnListPage /> },
    { path: 'grn/:id', element: <MobileGrnDetailPage /> },
    { path: 'grn/:id/receive', element: <MobileGrnReceivePage /> },
    { path: 'stock-count', element: <MobileStockCountPage /> },
    { path: 'material-issue', element: <MobileMaterialIssuePage /> },
    { path: 'material-return', element: <MobileMaterialReturnPage /> },
    { path: 'warehouse-transfer', element: <MobileWarehouseTransferPage /> },
    { path: 'kiosk', element: <MobileKioskHomePage /> },
    { path: 'shop-floor', element: <MobileShopfloorKioskPage /> },
    { path: 'qc', element: <MobileQcListPage /> },
    { path: 'qc/:id', element: <MobileQcDetailPage /> },
    { path: 'ncr/:id', element: <MobileNcrPage /> },
    { path: 'dispatch', element: <MobileDispatchListPage /> },
    { path: 'dispatch/:id', element: <MobileDispatchDetailPage /> },
    { path: 'gate-pass/:id', element: <MobileGatePassPage /> },
    { path: 'job-work', element: <MobileJobWorkListPage /> },
    { path: 'job-work/:id/send', element: <MobileJobWorkSendPage /> },
    { path: 'job-work/:id/receive', element: <MobileJobWorkReceivePage /> },
    { path: 'approvals', element: <MobileApprovalsPage /> },
    { path: 'crm', element: <MobileCrmPipelinePage /> },
    { path: 'crm/follow-ups', element: <MobileCrmFollowUpsPage /> },
    { path: 'crm/leads', element: <MobileCrmLeadsPage /> },
    { path: 'crm/quotations', element: <MobileCrmQuotationsPage /> },
    { path: 'crm/sales-orders', element: <MobileCrmSalesOrdersPage /> },
    { path: 'crm/opportunities', element: <MobileCrmOpportunitiesPage /> },
    { path: 'crm/customers', element: <MobileCrmCustomersPage /> },
    { path: 'crm/activities', element: <MobileCrmActivitiesPage /> },
  ],
}
