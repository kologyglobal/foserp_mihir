import { getExecutiveDashboardData } from '../../utils/controlTowerMetrics'
import { getErpExecutiveAnalytics } from '../../services/erpAnalyticsService'

export interface DemoReportsValidation {
  ok: boolean
  executiveOrderBook: number
  analyticsOrderBook: number
  mismatches: string[]
}

/** Validate dashboard KPIs match seeded transactional data */
export function validateDemoReportsData(): DemoReportsValidation {
  const exec = getExecutiveDashboardData()
  const analytics = getErpExecutiveAnalytics()
  const mismatches: string[] = []

  if (exec.orderBookCount !== analytics.orderBookCount) {
    mismatches.push(`orderBookCount exec=${exec.orderBookCount} analytics=${analytics.orderBookCount}`)
  }
  if (Math.abs(exec.orderBookValue - analytics.orderBookValue) > 1) {
    mismatches.push(`orderBookValue exec=${exec.orderBookValue} analytics=${analytics.orderBookValue}`)
  }
  if (exec.openNcr !== analytics.openNcr) {
    mismatches.push(`openNcr exec=${exec.openNcr} analytics=${analytics.openNcr}`)
  }

  return {
    ok: mismatches.length === 0,
    executiveOrderBook: exec.orderBookValue,
    analyticsOrderBook: analytics.orderBookValue,
    mismatches,
  }
}
