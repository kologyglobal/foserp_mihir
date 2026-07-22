import { useCallback, useEffect, useState } from 'react'
import { notify } from '@/store/toastStore'
import { fetchBankbook, fetchCashbook } from '../api/treasury-books.api'
import type { BookQuery, BookResultDto } from '../api/treasury-books.types'

export function useBook(kind: 'bank' | 'cash', query: BookQuery | null, enabled: boolean) {
  const [result, setResult] = useState<BookResultDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!enabled || !query || !query.treasuryAccountId) {
      setLoading(false)
      setResult(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = kind === 'bank' ? await fetchBankbook(query) : await fetchCashbook(query)
      setResult(res)
    } catch (e) {
      const message = e instanceof Error ? e.message : `Failed to load ${kind}book`
      setError(message)
      notify.error(message)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, kind, JSON.stringify(query)])

  useEffect(() => {
    void load()
  }, [load])

  return { result, loading, error, reload: load }
}
