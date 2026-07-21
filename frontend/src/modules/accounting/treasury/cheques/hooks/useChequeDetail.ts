import { useCallback, useEffect, useState } from 'react'
import { notify } from '@/store/toastStore'
import { fetchCheque } from '../api/treasury-cheque.api'
import type { TreasuryChequeDto } from '../api/treasury-cheque.types'

export function useChequeDetail(id: string | undefined, enabled: boolean) {
  const [cheque, setCheque] = useState<TreasuryChequeDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id || !enabled) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setCheque(await fetchCheque(id))
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load cheque'
      setError(message)
      notify.error(message)
    } finally {
      setLoading(false)
    }
  }, [id, enabled])

  useEffect(() => {
    void load()
  }, [load])

  return { cheque, setCheque, loading, error, reload: load }
}
