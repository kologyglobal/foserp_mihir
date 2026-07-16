import { useEffect, useRef, useState } from 'react'
import { isApiMode } from '../config/apiConfig'
import { searchCrmApi, type CrmSearchResultsDto } from '../services/api/crmApi'
import { formatApiError } from '../services/api/apiErrors'

const MIN_QUERY_LENGTH = 2
const DEBOUNCE_MS = 300

export function useCrmGlobalSearch(query: string) {
  const [results, setResults] = useState<CrmSearchResultsDto | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  useEffect(() => {
    if (!isApiMode()) {
      setResults(null)
      setLoading(false)
      setError(null)
      return
    }

    const trimmed = query.trim()
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults(null)
      setLoading(false)
      setError(null)
      return
    }

    const id = ++requestId.current
    setLoading(true)
    setError(null)

    const timer = window.setTimeout(() => {
      void searchCrmApi(trimmed)
        .then((res) => {
          if (requestId.current !== id) return
          setResults(res.data)
        })
        .catch((err: Error) => {
          if (requestId.current !== id) return
          setError(formatApiError(err))
          setResults(null)
        })
        .finally(() => {
          if (requestId.current !== id) return
          setLoading(false)
        })
    }, DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [query])

  return {
    results,
    loading,
    error,
    isApiBacked: isApiMode(),
    minQueryLength: MIN_QUERY_LENGTH,
  }
}
