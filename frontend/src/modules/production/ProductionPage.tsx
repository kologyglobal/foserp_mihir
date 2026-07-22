import { Navigate } from 'react-router-dom'

/** Legacy production hub — fold into Manufacturing Today (no parallel shell). */
export function ProductionPage() {
  return <Navigate to="/manufacturing/today" replace />
}
