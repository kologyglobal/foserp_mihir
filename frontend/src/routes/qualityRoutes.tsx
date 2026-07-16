import type { RouteObject } from 'react-router-dom'
import { QualityWorkspacePage } from '@/modules/workspaces'
import {
  QcQueuePage,
  QcInspectionDetailPage,
  ReworkWorkbenchPage,
  NcrRegisterPage,
  NcrDetailPage,
} from '@/modules/quality/QualityPages'
import { QualityReportsPage, IncomingQcQueuePage } from '@/modules/quality/QualityProductionPages'
import { QcParameterMasterPage, QcParameterFormPage, InspectionPlanMasterPage, InspectionPlanDetailPage } from '@/modules/quality/QcMasterPages'

export const qualityRouteChildren: RouteObject[] = [
  { path: 'quality', element: <QualityWorkspacePage /> },
  { path: 'quality/queue', element: <QcQueuePage /> },
  { path: 'quality/inspections/:id', element: <QcInspectionDetailPage /> },
  { path: 'quality/rework', element: <ReworkWorkbenchPage /> },
  { path: 'quality/ncr', element: <NcrRegisterPage /> },
  { path: 'quality/ncr/:id', element: <NcrDetailPage /> },
  { path: 'quality/incoming', element: <IncomingQcQueuePage /> },
  { path: 'quality/reports', element: <QualityReportsPage /> },
  { path: 'quality/parameters', element: <QcParameterMasterPage /> },
  { path: 'quality/parameters/new', element: <QcParameterFormPage /> },
  { path: 'quality/parameters/:id', element: <QcParameterFormPage /> },
  { path: 'quality/inspection-plans', element: <InspectionPlanMasterPage /> },
  { path: 'quality/inspection-plans/new', element: <InspectionPlanDetailPage /> },
  { path: 'quality/inspection-plans/:id', element: <InspectionPlanDetailPage /> },
]
