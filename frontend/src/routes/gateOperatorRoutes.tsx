/**
 * Gatekeeper Mode — standalone route tree (like /m) that renders WITHOUT the
 * standard ERP sidebar. Default landing for the Security Guard role;
 * supervisors and admins keep the full /gate workspace.
 */

import { ApiAuthGate } from '@/modules/auth/ApiAuthGate'
import { RouteErrorBoundary } from '@/components/system/RouteErrorBoundary'
import { GateOperatorLayout } from '@/modules/gate/operator/GateOperatorLayout'
import { GateOperatorHomePage } from '@/modules/gate/operator/GateOperatorHomePage'
import { OperatorVisitorEntryPage } from '@/modules/gate/operator/OperatorVisitorEntryPage'
import { OperatorVisitorExitPage } from '@/modules/gate/operator/OperatorVisitorExitPage'
import { OperatorVehicleEntryPage } from '@/modules/gate/operator/OperatorVehicleEntryPage'
import { OperatorVehicleExitPage } from '@/modules/gate/operator/OperatorVehicleExitPage'
import { OperatorMaterialInwardPage } from '@/modules/gate/operator/OperatorMaterialInwardPage'
import { OperatorMaterialOutwardPage } from '@/modules/gate/operator/OperatorMaterialOutwardPage'

export const gateOperatorRouteTree = {
  path: '/gate/operator',
  element: (
    <ApiAuthGate>
      <GateOperatorLayout />
    </ApiAuthGate>
  ),
  errorElement: <RouteErrorBoundary />,
  children: [
    { index: true, element: <GateOperatorHomePage /> },
    { path: 'visitor-entry', element: <OperatorVisitorEntryPage /> },
    { path: 'visitor-exit', element: <OperatorVisitorExitPage /> },
    { path: 'vehicle-entry', element: <OperatorVehicleEntryPage /> },
    { path: 'vehicle-exit', element: <OperatorVehicleExitPage /> },
    { path: 'material-inward', element: <OperatorMaterialInwardPage /> },
    { path: 'material-outward', element: <OperatorMaterialOutwardPage /> },
  ],
}
