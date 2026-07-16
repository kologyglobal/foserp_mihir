import { Navigate } from 'react-router-dom'
import { CONTROL_TOWER_ROUTES } from '../../config/controlTowerRoutes'

export function ProductionTowerRedirect() {
  return <Navigate to={CONTROL_TOWER_ROUTES.production} replace />
}

export function MrpPlannerRedirect() {
  return <Navigate to={CONTROL_TOWER_ROUTES.mrpPlanner} replace />
}

export function ExecutiveRedirect() {
  return <Navigate to={CONTROL_TOWER_ROUTES.executive} replace />
}
