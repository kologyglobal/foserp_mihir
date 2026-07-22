import type { RouteObject } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
import { isApiMode } from '@/config/apiConfig'
import { ManufacturingDashboardPage } from '@/modules/manufacturing/ManufacturingDashboardPage'
import { ProductionControlRoomPage } from '@/modules/manufacturing/ProductionControlRoomPage'
import { ShopfloorViewPage } from '@/modules/manufacturing/shopfloor/ShopfloorViewPage'
import { BomRegisterPage } from '@/modules/manufacturing/bom/BomRegisterPage'
import { BomFormPage } from '@/modules/manufacturing/bom/BomFormPage'
import { BomDetailPage } from '@/modules/manufacturing/bom/BomDetailPage'
import { BomTravelerPreviewPage } from '@/modules/manufacturing/bom/BomTravelerPreviewPage'
import { ProductionPlanPage } from '@/modules/manufacturing/production-plan/ProductionPlanPage'
import { ProductionPlanFormPage } from '@/modules/manufacturing/production-plan/ProductionPlanFormPage'
import { ProductionPlanDetailPage } from '@/modules/manufacturing/production-plan/ProductionPlanDetailPage'
import { WorkOrderRegisterPage } from '@/modules/manufacturing/work-orders/WorkOrderRegisterPage'
import { WorkOrderFormPage } from '@/modules/manufacturing/work-orders/WorkOrderFormPage'
import { WorkOrderDetailPage } from '@/modules/manufacturing/work-orders/WorkOrderDetailPage'
import { ApiWorkOrderRegisterPage } from '@/modules/manufacturing/work-orders/ApiWorkOrderRegisterPage'
import { ApiWorkOrderCreatePage } from '@/modules/manufacturing/work-orders/ApiWorkOrderCreatePage'
import { ApiWorkOrderDetailPage } from '@/modules/manufacturing/work-orders/ApiWorkOrderDetailPage'
import { TodayPage } from '@/modules/manufacturing/today/TodayPage'
import { MyWorkPage } from '@/modules/manufacturing/operator/MyWorkPage'
import { DailyUpdatePage } from '@/modules/manufacturing/daily-update/DailyUpdatePage'
import { IssuesQueuePage } from '@/modules/manufacturing/issues/IssuesQueuePage'
import { JobWorkRegisterPage } from '@/modules/manufacturing/job-work/JobWorkRegisterPage'
import { JobWorkFormPage } from '@/modules/manufacturing/job-work/JobWorkFormPage'
import { JobWorkDetailPage } from '@/modules/manufacturing/job-work/JobWorkDetailPage'
import { ManufacturingReportsPage } from '@/modules/manufacturing/reports/ManufacturingReportsPage'
import { ManufacturingReportRunnerPage } from '@/modules/manufacturing/reports/ManufacturingReportRunnerPage'
import { ShopfloorLivePage } from '@/modules/manufacturing/shopfloor/ShopfloorLivePage'
import { TraceabilityPage } from '@/modules/manufacturing/traceability/TraceabilityPage'
import { ManufacturingSettingsPage } from '@/modules/manufacturing/settings/ManufacturingSettingsPage'
import { RouteRegisterPage } from '@/modules/manufacturing/routes/RouteRegisterPage'
import { RouteFormPage } from '@/modules/manufacturing/routes/RouteFormPage'
import { RouteDetailPage } from '@/modules/manufacturing/routes/RouteDetailPage'
import { SetupHubPage } from '@/modules/manufacturing/setup/SetupHubPage'
import { WorkCentresSetupPage } from '@/modules/manufacturing/setup/WorkCentresSetupPage'
import { MachinesSetupPage } from '@/modules/manufacturing/setup/MachinesSetupPage'
import { ProfilesSetupPage } from '@/modules/manufacturing/setup/ProfilesSetupPage'
import { BomsSetupPage } from '@/modules/manufacturing/setup/boms/BomsSetupPage'
import { BomVersionEditorPage } from '@/modules/manufacturing/setup/boms/BomVersionEditorPage'
import { RoutingsSetupPage } from '@/modules/manufacturing/setup/routings/RoutingsSetupPage'
import { RoutingVersionEditorPage } from '@/modules/manufacturing/setup/routings/RoutingVersionEditorPage'
import { CorrectionsRegisterPage } from '@/modules/manufacturing/corrections/CorrectionsRegisterPage'
import { StoreWorkbenchPage } from '@/modules/manufacturing/store-workbench/StoreWorkbenchPage'
import { useParams } from 'react-router-dom'

/**
 * Phase 8C Wave 1 (8B-R-010): API mode must never render the demo work-order
 * edit form. Editing happens on the live WO detail (runtime changes/drawers).
 */
function ApiModeWorkOrderEditRedirect() {
  const { workOrderId } = useParams()
  return <Navigate to={workOrderId ? `/manufacturing/work-orders/${workOrderId}` : '/manufacturing/work-orders'} replace />
}

/** Manufacturing & Production routes — simple WO-centric demo FE. */
export const manufacturingRouteChildren: RouteObject[] = [
  { path: 'manufacturing', element: <Navigate to="/manufacturing/today" replace /> },
  { path: 'manufacturing/control-room', element: <ProductionControlRoomPage /> },
  { path: 'manufacturing/dashboard', element: <ManufacturingDashboardPage /> },
  {
    path: 'manufacturing/shopfloor',
    element: isApiMode() ? <ShopfloorLivePage /> : <ShopfloorViewPage />,
  },
  { path: 'manufacturing/traceability', element: <TraceabilityPage /> },
  /** Legacy demo BOM / routing UIs — API mode uses `/manufacturing/setup/*` (8B-R-010). */
  { path: 'manufacturing/bom', element: isApiMode() ? <Navigate to="/manufacturing/setup/boms" replace /> : <BomRegisterPage /> },
  { path: 'manufacturing/bom/traveler-preview', element: isApiMode() ? <Navigate to="/manufacturing/setup/boms" replace /> : <BomTravelerPreviewPage /> },
  { path: 'manufacturing/bom/new', element: isApiMode() ? <Navigate to="/manufacturing/setup/boms" replace /> : <BomFormPage /> },
  { path: 'manufacturing/bom/:bomId/edit', element: isApiMode() ? <Navigate to="/manufacturing/setup/boms" replace /> : <BomFormPage /> },
  { path: 'manufacturing/bom/:bomId', element: isApiMode() ? <Navigate to="/manufacturing/setup/boms" replace /> : <BomDetailPage /> },
  { path: 'manufacturing/routes', element: isApiMode() ? <Navigate to="/manufacturing/setup/routings" replace /> : <RouteRegisterPage /> },
  { path: 'manufacturing/routes/new', element: isApiMode() ? <Navigate to="/manufacturing/setup/routings" replace /> : <RouteFormPage /> },
  { path: 'manufacturing/routes/:routeId/edit', element: isApiMode() ? <Navigate to="/manufacturing/setup/routings" replace /> : <RouteFormPage /> },
  { path: 'manufacturing/routes/:routeId', element: isApiMode() ? <Navigate to="/manufacturing/setup/routings" replace /> : <RouteDetailPage /> },
  /** Production Plans (Phase 6A) — dual-mode: demo store or live `/manufacturing/plans`. */
  { path: 'manufacturing/production-plan', element: <ProductionPlanPage /> },
  { path: 'manufacturing/production-plan/new', element: <ProductionPlanFormPage /> },
  { path: 'manufacturing/production-plan/:planId', element: <ProductionPlanDetailPage /> },
  { path: 'manufacturing/today', element: <TodayPage /> },
  { path: 'manufacturing/daily-update', element: <DailyUpdatePage /> },
  { path: 'manufacturing/my-work', element: <MyWorkPage /> },
  { path: 'manufacturing/issues', element: <IssuesQueuePage /> },
  { path: 'manufacturing/corrections', element: <CorrectionsRegisterPage /> },
  { path: 'manufacturing/store-workbench', element: <StoreWorkbenchPage /> },
  {
    path: 'manufacturing/work-orders',
    element: isApiMode() ? <ApiWorkOrderRegisterPage /> : <WorkOrderRegisterPage />,
  },
  {
    path: 'manufacturing/work-orders/new',
    element: isApiMode() ? <ApiWorkOrderCreatePage /> : <WorkOrderFormPage />,
  },
  {
    path: 'manufacturing/work-orders/:workOrderId/edit',
    element: isApiMode() ? <ApiModeWorkOrderEditRedirect /> : <WorkOrderFormPage />,
  },
  {
    path: 'manufacturing/work-orders/:workOrderId',
    element: isApiMode() ? <ApiWorkOrderDetailPage /> : <WorkOrderDetailPage />,
  },
  { path: 'manufacturing/job-work', element: <JobWorkRegisterPage /> },
  { path: 'manufacturing/job-work/new', element: <JobWorkFormPage /> },
  { path: 'manufacturing/job-work/:jobWorkId/edit', element: <JobWorkFormPage /> },
  { path: 'manufacturing/job-work/:jobWorkId', element: <JobWorkDetailPage /> },
  { path: 'manufacturing/reports', element: <ManufacturingReportsPage /> },
  { path: 'manufacturing/reports/:reportKey', element: <ManufacturingReportRunnerPage /> },
  { path: 'manufacturing/settings', element: <ManufacturingSettingsPage /> },

  // ── Phase 1 setup masters (API-backed) ───────────────────────────────────
  { path: 'manufacturing/setup', element: <SetupHubPage /> },
  { path: 'manufacturing/profiles', element: <ProfilesSetupPage /> },
  { path: 'manufacturing/work-centres', element: <WorkCentresSetupPage /> },
  { path: 'manufacturing/machines', element: <MachinesSetupPage /> },
  { path: 'manufacturing/setup/boms', element: <BomsSetupPage /> },
  { path: 'manufacturing/setup/boms/:bomId', element: <BomVersionEditorPage /> },
  { path: 'manufacturing/setup/bom-versions/:versionId', element: <BomVersionEditorPage /> },
  { path: 'manufacturing/setup/routings', element: <RoutingsSetupPage /> },
  { path: 'manufacturing/setup/routings/:routingId', element: <RoutingVersionEditorPage /> },
  { path: 'manufacturing/setup/routing-versions/:versionId', element: <RoutingVersionEditorPage /> },
]
