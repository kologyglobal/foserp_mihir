import { useEffect, useState } from 'react'
import { isApiMode } from '@/config/apiConfig'
import { hydrateCoreMastersFromApi } from '@/bootstrap/apiHydration'
import { hydrateBatchMastersFromApi } from '@/bootstrap/apiHydration'
import { formatApiError, isPermissionDeniedError } from '@/services/api/apiErrors'

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
        // Unblock the shell after core masters (uoms, warehouses, geography).
        // Batch masters (items/vendors/HSN) continue in the background.
        await hydrateCoreMastersFromApi()
        if (!cancelled) setStatus('ready')
        void hydrateBatchMastersFromApi().catch((e) => {
          if (cancelled) return
          if (isPermissionDeniedError(e)) return
          // Soft-fail batch: keep shell usable; items load on demand via APIs.
          console.warn('[masters] batch hydrate deferred/failed:', formatApiError(e))
        })
      } catch (e) {
        if (!cancelled) {
          if (isPermissionDeniedError(e)) {
            setError(null)
            setStatus('ready')
            return
          }
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
