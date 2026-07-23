import type { RouteObject } from 'react-router-dom'
import { GateDashboardPage } from '@/modules/gate/pages/GateDashboardPage'
import { GateRegisterPage } from '@/modules/gate/pages/GateRegisterPage'
import { GateNewEntryPage } from '@/modules/gate/pages/GateNewEntryPage'
import { VisitorsListPage } from '@/modules/gate/pages/visitors/VisitorsListPage'
import { VisitorFormPage } from '@/modules/gate/pages/visitors/VisitorFormPage'
import { ExpectedVisitorsPage } from '@/modules/gate/pages/visitors/ExpectedVisitorsPage'
import { VisitorDetailPage } from '@/modules/gate/pages/visitors/VisitorDetailPage'
import { VehiclesListPage } from '@/modules/gate/pages/vehicles/VehiclesListPage'
import { VehicleFormPage } from '@/modules/gate/pages/vehicles/VehicleFormPage'
import { VehicleDetailPage } from '@/modules/gate/pages/vehicles/VehicleDetailPage'
import { MaterialInwardListPage } from '@/modules/gate/pages/material-inward/MaterialInwardListPage'
import { MaterialInwardFormPage } from '@/modules/gate/pages/material-inward/MaterialInwardFormPage'
import { MaterialInwardDetailPage } from '@/modules/gate/pages/material-inward/MaterialInwardDetailPage'
import { MaterialOutwardListPage } from '@/modules/gate/pages/material-outward/MaterialOutwardListPage'
import { MaterialOutwardVerifyPage } from '@/modules/gate/pages/material-outward/MaterialOutwardVerifyPage'
import { MaterialOutwardDetailPage } from '@/modules/gate/pages/material-outward/MaterialOutwardDetailPage'
import { GatePassListPage } from '@/modules/gate/pages/passes/GatePassListPage'
import { GatePassFormPage } from '@/modules/gate/pages/passes/GatePassFormPage'
import { GatePassDetailPage } from '@/modules/gate/pages/passes/GatePassDetailPage'
import { ContractorListPage } from '@/modules/gate/pages/contractors/ContractorListPage'
import { ContractorFormPage } from '@/modules/gate/pages/contractors/ContractorFormPage'
import { ContractorDetailPage } from '@/modules/gate/pages/contractors/ContractorDetailPage'
import { CourierListPage } from '@/modules/gate/pages/couriers/CourierListPage'
import { CourierFormPage } from '@/modules/gate/pages/couriers/CourierFormPage'
import { CourierDetailPage } from '@/modules/gate/pages/couriers/CourierDetailPage'
import { GateApprovalsPage } from '@/modules/gate/pages/GateApprovalsPage'
import { GateReportsPage } from '@/modules/gate/pages/GateReportsPage'
import { GateSettingsPage } from '@/modules/gate/pages/GateSettingsPage'

export const gateRouteChildren: RouteObject[] = [
  /** Core */
  { path: 'gate', element: <GateDashboardPage /> },
  { path: 'gate/register', element: <GateRegisterPage /> },
  { path: 'gate/entries/new', element: <GateNewEntryPage /> },

  /** Visitors */
  { path: 'gate/visitors', element: <VisitorsListPage /> },
  { path: 'gate/visitors/new', element: <VisitorFormPage /> },
  { path: 'gate/visitors/expected', element: <ExpectedVisitorsPage /> },
  { path: 'gate/visitors/inside', element: <VisitorsListPage initialTab="inside" /> },
  { path: 'gate/visitors/:id', element: <VisitorDetailPage /> },
  { path: 'gate/visitors/:id/edit', element: <VisitorFormPage /> },

  /** Vehicles */
  { path: 'gate/vehicles', element: <VehiclesListPage /> },
  { path: 'gate/vehicles/new', element: <VehicleFormPage /> },
  { path: 'gate/vehicles/inside', element: <VehiclesListPage initialTab="inside" /> },
  { path: 'gate/vehicles/:id', element: <VehicleDetailPage /> },

  /** Material inward */
  { path: 'gate/material-inward', element: <MaterialInwardListPage /> },
  { path: 'gate/material-inward/new', element: <MaterialInwardFormPage /> },
  { path: 'gate/material-inward/:id', element: <MaterialInwardDetailPage /> },

  /** Material outward */
  { path: 'gate/material-outward', element: <MaterialOutwardListPage /> },
  { path: 'gate/material-outward/verify', element: <MaterialOutwardVerifyPage /> },
  { path: 'gate/material-outward/:id', element: <MaterialOutwardDetailPage /> },

  /** Gate passes */
  { path: 'gate/passes', element: <GatePassListPage /> },
  { path: 'gate/passes/new', element: <GatePassFormPage /> },
  { path: 'gate/passes/overdue', element: <GatePassListPage initialTab="overdue" /> },
  { path: 'gate/passes/:id', element: <GatePassDetailPage /> },

  /** Contractors */
  { path: 'gate/contractors', element: <ContractorListPage /> },
  { path: 'gate/contractors/new', element: <ContractorFormPage /> },
  { path: 'gate/contractors/:id', element: <ContractorDetailPage /> },

  /** Couriers */
  { path: 'gate/couriers', element: <CourierListPage /> },
  { path: 'gate/couriers/new', element: <CourierFormPage /> },
  { path: 'gate/couriers/:id', element: <CourierDetailPage /> },

  /** Other */
  { path: 'gate/approvals', element: <GateApprovalsPage /> },
  { path: 'gate/reports', element: <GateReportsPage /> },
  { path: 'gate/settings', element: <GateSettingsPage /> },
]
