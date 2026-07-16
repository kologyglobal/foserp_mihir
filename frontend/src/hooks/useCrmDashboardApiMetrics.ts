import { useCallback, useEffect, useRef, useState } from 'react'
import { isApiMode } from '../config/apiConfig'
import { fetchCrmDashboardMetrics, type CrmDashboardMetricsDto } from '../services/api/crmApi'

export function useCrmDashboardApiMetrics(period = 'month') {
  const [data, setData] = useState<CrmDashboardMetricsDto | null>(null)
  const [loading, setLoading] = useState(isApiMode())
  const [error, setError] = useState<string | null>(null)
  const hasDataRef = useRef(false)

  const load = useCallback(
    (opts?: { silent?: boolean }) => {
      if (!isApiMode()) {
        setLoading(false)
        setError(null)
        return Promise.resolve()
      }

      const silent = opts?.silent && hasDataRef.current
      if (!silent) setLoading(true)
      setError(null)
      return fetchCrmDashboardMetrics({ period })
        .then((res) => {
          setData(res.data)
          hasDataRef.current = true
        })
        .catch((err: Error) => {
          setError(err.message || 'Failed to load dashboard metrics')
        })
        .finally(() => {
          if (!silent) setLoading(false)
        })
    },
    [period],
  )

  useEffect(() => {
    if (!isApiMode()) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    fetchCrmDashboardMetrics({ period })
      .then((res) => {
        if (!cancelled) {
          setData(res.data)
          hasDataRef.current = true
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || 'Failed to load dashboard metrics')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    const onFocus = () => {
      if (cancelled || document.visibilityState !== 'visible') return
      void load({ silent: true })
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)

    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [period, load])

  return { data, loading, error, refetch: () => load({ silent: false }) }
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
