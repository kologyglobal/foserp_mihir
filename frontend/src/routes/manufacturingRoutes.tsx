import type { RouteObject } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
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
import { JobWorkRegisterPage } from '@/modules/manufacturing/job-work/JobWorkRegisterPage'
import { JobWorkFormPage } from '@/modules/manufacturing/job-work/JobWorkFormPage'
import { JobWorkDetailPage } from '@/modules/manufacturing/job-work/JobWorkDetailPage'
import { ManufacturingReportsPage } from '@/modules/manufacturing/reports/ManufacturingReportsPage'
import { ManufacturingSettingsPage } from '@/modules/manufacturing/settings/ManufacturingSettingsPage'
import { RouteRegisterPage } from '@/modules/manufacturing/routes/RouteRegisterPage'
import { RouteFormPage } from '@/modules/manufacturing/routes/RouteFormPage'
import { RouteDetailPage } from '@/modules/manufacturing/routes/RouteDetailPage'

/** Manufacturing & Production routes — simple WO-centric demo FE. */
export const manufacturingRouteChildren: RouteObject[] = [
  { path: 'manufacturing', element: <Navigate to="/manufacturing/control-room" replace /> },
  { path: 'manufacturing/control-room', element: <ProductionControlRoomPage /> },
  { path: 'manufacturing/dashboard', element: <ManufacturingDashboardPage /> },
  { path: 'manufacturing/shopfloor', element: <ShopfloorViewPage /> },
  { path: 'manufacturing/bom', element: <BomRegisterPage /> },
  { path: 'manufacturing/bom/traveler-preview', element: <BomTravelerPreviewPage /> },
  { path: 'manufacturing/bom/new', element: <BomFormPage /> },
  { path: 'manufacturing/bom/:bomId/edit', element: <BomFormPage /> },
  { path: 'manufacturing/bom/:bomId', element: <BomDetailPage /> },
  { path: 'manufacturing/routes', element: <RouteRegisterPage /> },
  { path: 'manufacturing/routes/new', element: <RouteFormPage /> },
  { path: 'manufacturing/routes/:routeId/edit', element: <RouteFormPage /> },
  { path: 'manufacturing/routes/:routeId', element: <RouteDetailPage /> },
  { path: 'manufacturing/production-plan', element: <ProductionPlanPage /> },
  { path: 'manufacturing/production-plan/new', element: <ProductionPlanFormPage /> },
  { path: 'manufacturing/production-plan/:planId', element: <ProductionPlanDetailPage /> },
  { path: 'manufacturing/work-orders', element: <WorkOrderRegisterPage /> },
  { path: 'manufacturing/work-orders/new', element: <WorkOrderFormPage /> },
  { path: 'manufacturing/work-orders/:workOrderId/edit', element: <WorkOrderFormPage /> },
  { path: 'manufacturing/work-orders/:workOrderId', element: <WorkOrderDetailPage /> },
  { path: 'manufacturing/job-work', element: <JobWorkRegisterPage /> },
  { path: 'manufacturing/job-work/new', element: <JobWorkFormPage /> },
  { path: 'manufacturing/job-work/:jobWorkId/edit', element: <JobWorkFormPage /> },
  { path: 'manufacturing/job-work/:jobWorkId', element: <JobWorkDetailPage /> },
  { path: 'manufacturing/reports', element: <ManufacturingReportsPage /> },
  { path: 'manufacturing/settings', element: <ManufacturingSettingsPage /> },
]
