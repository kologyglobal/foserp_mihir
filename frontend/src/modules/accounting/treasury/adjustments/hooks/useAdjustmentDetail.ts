import { useCallback, useEffect, useState } from 'react'
import { notify } from '@/store/toastStore'
import { fetchAdjustment } from '../api/treasury-adjustment.api'
import type { TreasuryAdjustmentDto } from '../api/treasury-adjustment.types'

export function useAdjustmentDetail(id: string | undefined, enabled: boolean) {
  const [adjustment, setAdjustment] = useState<TreasuryAdjustmentDto | null>(null)
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
      setAdjustment(await fetchAdjustment(id))
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load treasury adjustment'
      setError(message)
      notify.error(message)
    } finally {
      setLoading(false)
    }
  }, [id, enabled])

  useEffect(() => {
    void load()
  }, [load])

  return { adjustment, setAdjustment, loading, error, reload: load }
}
