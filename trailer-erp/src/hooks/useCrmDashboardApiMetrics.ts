import { useEffect, useState } from 'react'
import { isApiMode } from '../config/apiConfig'
import { fetchCrmDashboardMetrics, type CrmDashboardMetricsDto } from '../services/api/crmApi'

export function useCrmDashboardApiMetrics(period = 'month') {
  const [data, setData] = useState<CrmDashboardMetricsDto | null>(null)
  const [loading, setLoading] = useState(isApiMode())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isApiMode()) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    fetchCrmDashboardMetrics({ period })
      .then((res) => {
        if (!cancelled) setData(res.data)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || 'Failed to load dashboard metrics')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [period])

  return { data, loading, error }
}

/** Overlay backend KPI values onto locally computed dashboard metrics. */
export function applyApiDashboardOverlay<T extends {
  openOpportunities: number
  pipelineValue: number
  weightedForecast: number
  followUpsDueToday: number
  dealsWon: number
  dealsLost: number
  conversionRate: number
  newLeads: number
  qualifiedLeads: number
  convertedLeads: number
  notQualifiedLeads: number
  activeLeads: number
}>(
  metrics: T,
  api: CrmDashboardMetricsDto | null,
): T {
  if (!api) return metrics
  return {
    ...metrics,
    openOpportunities: api.opportunities.open,
    pipelineValue: api.opportunities.pipelineValue,
    weightedForecast: api.opportunities.weightedForecast,
    followUpsDueToday: api.followUps.dueToday,
    dealsWon: api.opportunities.won,
    dealsLost: api.opportunities.lost,
    conversionRate: api.rates.conversionRate,
    newLeads: api.leads.new,
    qualifiedLeads: api.leads.qualified,
    convertedLeads: api.leads.converted,
    notQualifiedLeads: api.leads.lost,
    activeLeads: api.leads.total - api.leads.converted,
  }
}
