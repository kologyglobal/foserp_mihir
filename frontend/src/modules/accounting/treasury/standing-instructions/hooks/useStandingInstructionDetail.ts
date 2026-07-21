import { useCallback, useEffect, useState } from 'react'
import { notify } from '@/store/toastStore'
import { fetchStandingInstruction } from '../api/standing-instruction.api'
import type { StandingInstructionDto } from '../api/standing-instruction.types'

export function useStandingInstructionDetail(id: string | undefined, enabled: boolean) {
  const [instruction, setInstruction] = useState<StandingInstructionDto | null>(null)
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
      setInstruction(await fetchStandingInstruction(id))
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load standing instruction'
      setError(message)
      notify.error(message)
    } finally {
      setLoading(false)
    }
  }, [id, enabled])

  useEffect(() => {
    void load()
  }, [load])

  return { instruction, setInstruction, loading, error, reload: load }
}
