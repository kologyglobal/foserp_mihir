import { useCallback, useEffect, useState } from 'react'
import { notify } from '@/store/toastStore'
import { fetchTransfers } from '../api/treasury-transfer.api'
import type { ListTransfersQuery, TreasuryTransferDto } from '../api/treasury-transfer.types'

export function useTransferList(query: ListTransfersQuery, enabled: boolean) {
  const [items, setItems] = useState<TreasuryTransferDto[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetchTransfers(query)
      setItems(res.items)
      setTotal(res.total)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load transfers'
      setError(message)
      notify.error(message)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, JSON.stringify(query)])

  useEffect(() => {
    void load()
  }, [load])

  return { items, total, loading, error, reload: load }
}
