import type { RouteObject } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
import { isApiMode } from '@/config/apiConfig'
import { MaintenanceDashboardPage } from '@/modules/maintenance/pages/MaintenanceDashboardPage'
import { MaintenanceTicketsPage } from '@/modules/maintenance/pages/MaintenanceTicketsPage'
import { ReportBreakdownPage } from '@/modules/maintenance/pages/ReportBreakdownPage'
import { MaintenanceTicketDetailPage } from '@/modules/maintenance/pages/MaintenanceTicketDetailPage'
import { MaintenanceMachinesPage } from '@/modules/maintenance/pages/MaintenanceMachinesPage'
import { MachineMaintenanceHistoryPage } from '@/modules/maintenance/pages/MachineMaintenanceHistoryPage'
import { MachineHealthPage } from '@/modules/maintenance/pages/MachineHealthPage'
import { MaintenanceReportsPage } from '@/modules/maintenance/pages/MaintenanceReportsPage'
import { PreventiveMaintenanceListPage } from '@/modules/maintenance/pages/PreventiveMaintenanceListPage'
import { PreventiveMaintenanceNewPage } from '@/modules/maintenance/pages/PreventiveMaintenanceNewPage'
import { PreventiveMaintenanceDetailPage } from '@/modules/maintenance/pages/PreventiveMaintenanceDetailPage'
import { MaintenanceApiRequiredPage } from '@/modules/maintenance/pages/MaintenanceApiRequiredPage'

const apiChildren: RouteObject[] = [
  { path: 'maintenance', element: <MaintenanceDashboardPage /> },
  { path: 'maintenance/tickets', element: <MaintenanceTicketsPage /> },
  { path: 'maintenance/tickets/new', element: <ReportBreakdownPage /> },
  { path: 'maintenance/tickets/:id', element: <MaintenanceTicketDetailPage /> },
  { path: 'maintenance/preventive', element: <PreventiveMaintenanceListPage /> },
  { path: 'maintenance/preventive/new', element: <PreventiveMaintenanceNewPage /> },
  { path: 'maintenance/preventive/:id', element: <PreventiveMaintenanceDetailPage /> },
  { path: 'maintenance/machine-health', element: <MachineHealthPage /> },
  { path: 'maintenance/machines', element: <MaintenanceMachinesPage /> },
  { path: 'maintenance/machines/:machineId/history', element: <MachineMaintenanceHistoryPage /> },
  { path: 'maintenance/reports', element: <MaintenanceReportsPage /> },
  { path: 'maintenance/setup', element: <Navigate to="/manufacturing/machines" replace /> },
]

const demoChildren: RouteObject[] = [
  { path: 'maintenance', element: <MaintenanceApiRequiredPage /> },
  { path: 'maintenance/*', element: <MaintenanceApiRequiredPage /> },
]

export const maintenanceRouteChildren: RouteObject[] = isApiMode() ? apiChildren : demoChildren
