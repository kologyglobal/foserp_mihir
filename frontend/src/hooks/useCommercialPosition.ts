import { useEffect, useState } from 'react'
import { isApiMode } from '@/config/apiConfig'
import {
  fetchCompanyCommercialPosition,
  fetchSalesOrderCommercialPosition,
  type CompanyCommercialPositionDto,
  type SalesOrderCommercialPositionDto,
} from '@/services/api/salesOrderApi'

type LoadState<T> = {
  data: T | null
  loading: boolean
  error: string | null
}

export function useSalesOrderCommercialPosition(salesOrderId: string | undefined): LoadState<SalesOrderCommercialPositionDto> {
  const [state, setState] = useState<LoadState<SalesOrderCommercialPositionDto>>({
    data: null,
    loading: false,
    error: null,
  })

  useEffect(() => {
    if (!salesOrderId || !isApiMode()) {
      setState((prev) =>
        prev.data == null && !prev.loading && prev.error == null
          ? prev
          : { data: null, loading: false, error: null },
      )
      return
    }
    let cancelled = false
    setState((prev) => ({ ...prev, loading: true, error: null }))
    fetchSalesOrderCommercialPosition(salesOrderId)
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            data: null,
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load commercial position',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [salesOrderId])

  return state
}

export function useCompanyCommercialPosition(companyId: string | undefined): LoadState<CompanyCommercialPositionDto> {
  const [state, setState] = useState<LoadState<CompanyCommercialPositionDto>>({
    data: null,
    loading: false,
    error: null,
  })

  useEffect(() => {
    if (!companyId || !isApiMode()) {
      setState((prev) =>
        prev.data == null && !prev.loading && prev.error == null
          ? prev
          : { data: null, loading: false, error: null },
      )
      return
    }
    let cancelled = false
    setState((prev) => ({ ...prev, loading: true, error: null }))
    fetchCompanyCommercialPosition(companyId)
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            data: null,
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load commercial position',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [companyId])

  return state
}
