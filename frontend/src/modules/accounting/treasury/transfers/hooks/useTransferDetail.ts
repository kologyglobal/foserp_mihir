import { useCallback, useEffect, useState } from 'react'
import { notify } from '@/store/toastStore'
import { fetchTransfer } from '../api/treasury-transfer.api'
import type { TreasuryTransferDto } from '../api/treasury-transfer.types'

export function useTransferDetail(id: string | undefined, enabled: boolean) {
  const [transfer, setTransfer] = useState<TreasuryTransferDto | null>(null)
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
      setTransfer(await fetchTransfer(id))
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load transfer'
      setError(message)
      notify.error(message)
    } finally {
      setLoading(false)
    }
  }, [id, enabled])

  useEffect(() => {
    void load()
  }, [load])

  return { transfer, setTransfer, loading, error, reload: load }
}
