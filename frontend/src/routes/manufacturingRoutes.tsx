import type { RouteObject } from 'react-router-dom'
import { ManufacturingDashboardPage } from '@/modules/manufacturing/ManufacturingDashboardPage'
import { BomRegisterPage } from '@/modules/manufacturing/bom/BomRegisterPage'
import { BomFormPage } from '@/modules/manufacturing/bom/BomFormPage'
import { BomDetailPage } from '@/modules/manufacturing/bom/BomDetailPage'
import { ProductionPlanPage } from '@/modules/manufacturing/production-plan/ProductionPlanPage'
import { WorkOrderRegisterPage } from '@/modules/manufacturing/work-orders/WorkOrderRegisterPage'
import { WorkOrderFormPage } from '@/modules/manufacturing/work-orders/WorkOrderFormPage'
import { WorkOrderDetailPage } from '@/modules/manufacturing/work-orders/WorkOrderDetailPage'
import { JobWorkRegisterPage } from '@/modules/manufacturing/job-work/JobWorkRegisterPage'
import { JobWorkFormPage } from '@/modules/manufacturing/job-work/JobWorkFormPage'
import { JobWorkDetailPage } from '@/modules/manufacturing/job-work/JobWorkDetailPage'
import { ManufacturingReportsPage } from '@/modules/manufacturing/reports/ManufacturingReportsPage'
import { ManufacturingSettingsPage } from '@/modules/manufacturing/settings/ManufacturingSettingsPage'

/** Manufacturing & Production routes (Phases 1–4, demo FE). */
export const manufacturingRouteChildren: RouteObject[] = [
  { path: 'manufacturing', element: <ManufacturingDashboardPage /> },
  { path: 'manufacturing/bom', element: <BomRegisterPage /> },
  { path: 'manufacturing/bom/new', element: <BomFormPage /> },
  { path: 'manufacturing/bom/:bomId/edit', element: <BomFormPage /> },
  { path: 'manufacturing/bom/:bomId', element: <BomDetailPage /> },
  { path: 'manufacturing/production-plan', element: <ProductionPlanPage /> },
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
