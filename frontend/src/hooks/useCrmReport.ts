import { useEffect, useState } from 'react'
import { isApiMode } from '../config/apiConfig'
import { fetchCrmReport, isCrmApiReport, type CrmApiReportId } from '../services/api/crmApi'
import { CRM_REPORT_GETTERS, type CrmReportId } from '../utils/crmReports'

export function useCrmReportRows(reportId: CrmReportId) {
  const [rows, setRows] = useState<Record<string, unknown>[]>(() =>
    isApiMode() && isCrmApiReport(reportId) ? [] : CRM_REPORT_GETTERS[reportId](),
  )
  const [loading, setLoading] = useState(isApiMode() && isCrmApiReport(reportId))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isApiMode() || !isCrmApiReport(reportId)) {
      setRows(CRM_REPORT_GETTERS[reportId]())
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    fetchCrmReport(reportId as CrmApiReportId)
      .then((res) => {
        if (!cancelled) setRows(res.data)
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message || 'Failed to load report')
          setRows([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [reportId])

  return { rows, loading, error, isApiBacked: isApiMode() && isCrmApiReport(reportId) }
}
