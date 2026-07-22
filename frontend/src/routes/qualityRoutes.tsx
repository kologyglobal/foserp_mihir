import type { RouteObject } from 'react-router-dom'
import { isApiMode } from '@/config/apiConfig'
import { QualityWorkspacePage } from '@/modules/workspaces'
import {
  QcQueuePage,
  QcInspectionDetailPage,
  ReworkWorkbenchPage,
  NcrRegisterPage,
  NcrDetailPage,
} from '@/modules/quality/QualityPages'
import { ApiQcQueuePage } from '@/modules/quality/ApiQcQueuePage'
import { ApiQcInspectionDetailPage } from '@/modules/quality/ApiQcInspectionDetailPage'
import { ApiReworkWorkbenchPage } from '@/modules/quality/ApiReworkWorkbenchPage'
import { ApiNcrRegisterPage, ApiNcrDetailPage } from '@/modules/quality/ApiNcrPages'
import {
  ApiQcParameterMasterPage,
  ApiQcParameterFormPage,
  ApiInspectionPlanMasterPage,
  ApiInspectionPlanDetailPage,
} from '@/modules/quality/ApiQcMasterPages'
import { QualityReportsPage, IncomingQcQueuePage } from '@/modules/quality/QualityProductionPages'
import { QcParameterMasterPage, QcParameterFormPage, InspectionPlanMasterPage, InspectionPlanDetailPage } from '@/modules/quality/QcMasterPages'
import { demoOnlyRoute } from '@/components/system/DemoOnlyRouteGate'

/** Demo-only quality surfaces hard-stop in API mode (8B-R-010). */
const QUALITY_QUEUE_LINK = { label: 'Open Quality Queue', to: '/quality/queue' }

export const qualityRouteChildren: RouteObject[] = [
  { path: 'quality', element: <QualityWorkspacePage /> },
  { path: 'quality/queue', element: isApiMode() ? <ApiQcQueuePage /> : <QcQueuePage /> },
  { path: 'quality/inspections/:id', element: isApiMode() ? <ApiQcInspectionDetailPage /> : <QcInspectionDetailPage /> },
  {
    path: 'quality/rework',
    element: isApiMode() ? <ApiReworkWorkbenchPage /> : <ReworkWorkbenchPage />,
  },
  {
    path: 'quality/ncr',
    element: isApiMode() ? <ApiNcrRegisterPage /> : <NcrRegisterPage />,
  },
  {
    path: 'quality/ncr/:id',
    element: isApiMode() ? <ApiNcrDetailPage /> : <NcrDetailPage />,
  },
  { path: 'quality/incoming', element: <IncomingQcQueuePage /> },
  {
    path: 'quality/reports',
    element: demoOnlyRoute(<QualityReportsPage />, {
      title: 'Quality Reports',
      description: 'Quality reports are demo-only. Live quality throughput is visible from the Quality Queue and inspections.',
      links: [QUALITY_QUEUE_LINK],
    }),
  },
  { path: 'quality/parameters', element: isApiMode() ? <ApiQcParameterMasterPage /> : <QcParameterMasterPage /> },
  { path: 'quality/parameters/new', element: isApiMode() ? <ApiQcParameterFormPage /> : <QcParameterFormPage /> },
  { path: 'quality/parameters/:id', element: isApiMode() ? <ApiQcParameterFormPage /> : <QcParameterFormPage /> },
  { path: 'quality/inspection-plans', element: isApiMode() ? <ApiInspectionPlanMasterPage /> : <InspectionPlanMasterPage /> },
  { path: 'quality/inspection-plans/new', element: isApiMode() ? <ApiInspectionPlanDetailPage /> : <InspectionPlanDetailPage /> },
  { path: 'quality/inspection-plans/:id', element: isApiMode() ? <ApiInspectionPlanDetailPage /> : <InspectionPlanDetailPage /> },
]
