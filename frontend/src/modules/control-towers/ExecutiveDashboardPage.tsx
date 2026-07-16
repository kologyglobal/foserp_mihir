import { DynamicsExecutiveDashboard } from '../../components/dynamics/DynamicsExecutiveDashboard'
import { CONTROL_TOWER_ROUTES } from '../../config/controlTowerRoutes'
import { useErpExecutiveAnalytics } from '../../services/erpAnalyticsService'

export function ExecutiveDashboardPage() {
  const a = useErpExecutiveAnalytics()

  return (
    <DynamicsExecutiveDashboard
      title="Executive Command Center"
      subtitle={`CEO view · ${a.plantName} · ${a.shift}`}
      badge="Executive"
      favoritePath={CONTROL_TOWER_ROUTES.executive}
    />
  )
}
