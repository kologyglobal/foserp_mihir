import { useCallback, useEffect, useState } from 'react'
import { notify } from '@/store/toastStore'
import { fetchStandingInstructions } from '../api/standing-instruction.api'
import type { ListStandingInstructionsQuery, StandingInstructionDto } from '../api/standing-instruction.types'

export function useStandingInstructionList(query: ListStandingInstructionsQuery, enabled: boolean) {
  const [items, setItems] = useState<StandingInstructionDto[]>([])
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
      const res = await fetchStandingInstructions(query)
      setItems(res.items)
      setTotal(res.total)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load standing instructions'
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
