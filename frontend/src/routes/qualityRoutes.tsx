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
import { ApiQcInspectionReportPage } from '@/modules/quality/ApiQcInspectionReportPage'
import { ApiReworkWorkbenchPage } from '@/modules/quality/ApiReworkWorkbenchPage'
import { ApiNcrRegisterPage, ApiNcrDetailPage } from '@/modules/quality/ApiNcrPages'
import {
  ApiQcParameterMasterPage,
  ApiQcParameterFormPage,
  ApiInspectionPlanMasterPage,
  ApiInspectionPlanDetailPage,
} from '@/modules/quality/ApiQcMasterPages'
import { QualityReportsPage, IncomingQcQueuePage } from '@/modules/quality/QualityProductionPages'
import { ApiQualityReportsPage } from '@/modules/quality/ApiQualityReportsPage'
import { QcParameterMasterPage, QcParameterFormPage, InspectionPlanMasterPage, InspectionPlanDetailPage } from '@/modules/quality/QcMasterPages'

export const qualityRouteChildren: RouteObject[] = [
  { path: 'quality', element: <QualityWorkspacePage /> },
  { path: 'quality/queue', element: isApiMode() ? <ApiQcQueuePage /> : <QcQueuePage /> },
  { path: 'quality/inspections/:id', element: isApiMode() ? <ApiQcInspectionDetailPage /> : <QcInspectionDetailPage /> },
  {
    path: 'quality/inspections/:id/report',
    element: isApiMode() ? <ApiQcInspectionReportPage /> : <QcInspectionDetailPage />,
  },
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
    element: isApiMode() ? <ApiQualityReportsPage /> : <QualityReportsPage />,
  },
  { path: 'quality/parameters', element: isApiMode() ? <ApiQcParameterMasterPage /> : <QcParameterMasterPage /> },
  { path: 'quality/parameters/new', element: isApiMode() ? <ApiQcParameterFormPage /> : <QcParameterFormPage /> },
  { path: 'quality/parameters/:id', element: isApiMode() ? <ApiQcParameterFormPage /> : <QcParameterFormPage /> },
  { path: 'quality/inspection-plans', element: isApiMode() ? <ApiInspectionPlanMasterPage /> : <InspectionPlanMasterPage /> },
  { path: 'quality/inspection-plans/new', element: isApiMode() ? <ApiInspectionPlanDetailPage /> : <InspectionPlanDetailPage /> },
  { path: 'quality/inspection-plans/:id', element: isApiMode() ? <ApiInspectionPlanDetailPage /> : <InspectionPlanDetailPage /> },
]
