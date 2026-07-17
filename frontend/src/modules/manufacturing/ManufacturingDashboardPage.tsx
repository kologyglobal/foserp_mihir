import { Navigate } from 'react-router-dom'

/** Legacy path — Production Control Room is the owner/manager hub. */
export function ManufacturingDashboardPage() {
  return <Navigate to="/manufacturing/control-room" replace />
}
