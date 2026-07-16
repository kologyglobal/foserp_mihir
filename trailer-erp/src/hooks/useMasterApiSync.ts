import { useEffect, useState } from 'react'
import { isApiMode } from '@/config/apiConfig'
import { hydrateCoreMastersFromApi } from '@/bootstrap/apiHydration'
import { hydrateBatchMastersFromApi } from '@/bootstrap/apiHydration'
import { formatApiError } from '@/services/api/apiErrors'

/** Hydrates core master slices from backend when VITE_USE_API=true. */
export function useMasterApiSync() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isApiMode()) {
      setStatus('ready')
      return
    }

    let cancelled = false
    setStatus('loading')

    async function sync() {
      try {
        await hydrateCoreMastersFromApi()
        await hydrateBatchMastersFromApi()
        if (!cancelled) setStatus('ready')
      } catch (e) {
        if (!cancelled) {
          setError(formatApiError(e))
          setStatus('error')
        }
      }
    }

    void sync()
    return () => {
      cancelled = true
    }
  }, [])

  return { status, error }
}
