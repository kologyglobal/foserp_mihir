import { useEffect, useMemo, useState } from 'react'
import { isApiMode } from '../config/apiConfig'
import { fetchCrmSalesForecast, type CrmSalesForecastDto } from '../services/api/crmApi'
import { useCrmStore } from '../store/crmStore'
import {
  buildCrmSalesForecast,
  type CrmSalesForecastSnapshot,
  type ForecastOwnerRow,
} from '../utils/crmForecastMetrics'

function mapApiForecast(dto: CrmSalesForecastDto): CrmSalesForecastSnapshot {
  const byOwner: ForecastOwnerRow[] = dto.byOwner.map((row) => ({
    ownerName: row.ownerName,
    pipeline: row.pipeline,
    weighted: row.weighted,
    count: row.count,
  }))
  return {
    openCount: dto.openCount,
    pipelineValue: dto.pipelineValue,
    weightedForecast: dto.weightedForecast,
    avgProbability: dto.avgProbability,
    closingThisMonth: dto.closingThisMonth,
    closingThisQuarter: dto.closingThisQuarter,
    byMonth: dto.byMonth,
    byOwner,
    byStage: dto.byStage.map((row) => ({
      stage: row.stage,
      label: row.label,
      pipeline: row.pipeline,
      weighted: row.weighted,
      count: row.count,
    })),
    atRisk: dto.atRisk,
  }
}

/**
 * Demo mode: client rollup of Zustand opportunities.
 * API mode: `GET /crm/forecast` — never mix sources.
 */
export function useCrmSalesForecast() {
  const opportunities = useCrmStore((s) => s.opportunities)
  const demoForecast = useMemo(() => buildCrmSalesForecast(opportunities), [opportunities])

  const [apiForecast, setApiForecast] = useState<CrmSalesForecastSnapshot | null>(null)
  const [loading, setLoading] = useState(isApiMode())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isApiMode()) {
      setApiForecast(null)
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    fetchCrmSalesForecast()
      .then((res) => {
        if (!cancelled) setApiForecast(mapApiForecast(res.data))
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message || 'Failed to load sales forecast')
          setApiForecast(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (!isApiMode()) {
    return { forecast: demoForecast, loading: false, error: null, isApiBacked: false }
  }

  return {
    forecast: apiForecast,
    loading,
    error,
    isApiBacked: true,
  }
}
