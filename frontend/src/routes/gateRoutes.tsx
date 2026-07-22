import type { RouteObject } from 'react-router-dom'
import { GateWorkspacePage } from '@/modules/gate/pages/GateWorkspacePage'

/**
 * Gate & Security routes.
 *
 * Full operational pages (visitors/vehicles/material/passes + contractors/couriers
 * detail stacks) were partially wiped from disk; the module is re-listed in the
 * sidebar with a workspace hub so navigation works. Restore page imports here
 * when the FE tree is complete again.
 */
export const gateRouteChildren: RouteObject[] = [
  { path: 'gate', element: <GateWorkspacePage /> },
  { path: 'gate/register', element: <GateWorkspacePage /> },
  { path: 'gate/visitors', element: <GateWorkspacePage /> },
  { path: 'gate/visitors/*', element: <GateWorkspacePage /> },
  { path: 'gate/vehicles', element: <GateWorkspacePage /> },
  { path: 'gate/vehicles/*', element: <GateWorkspacePage /> },
  { path: 'gate/material-inward', element: <GateWorkspacePage /> },
  { path: 'gate/material-inward/*', element: <GateWorkspacePage /> },
  { path: 'gate/material-outward', element: <GateWorkspacePage /> },
  { path: 'gate/material-outward/*', element: <GateWorkspacePage /> },
  { path: 'gate/passes', element: <GateWorkspacePage /> },
  { path: 'gate/passes/*', element: <GateWorkspacePage /> },
  { path: 'gate/contractors', element: <GateWorkspacePage /> },
  { path: 'gate/contractors/*', element: <GateWorkspacePage /> },
  { path: 'gate/couriers', element: <GateWorkspacePage /> },
  { path: 'gate/couriers/*', element: <GateWorkspacePage /> },
  { path: 'gate/approvals', element: <GateWorkspacePage /> },
  { path: 'gate/reports', element: <GateWorkspacePage /> },
  { path: 'gate/settings', element: <GateWorkspacePage /> },
]
