import { useEffect, useState } from 'react'
import { isApiMode } from '@/config/apiConfig'
import { hydrateCrmFromApi } from '@/bootstrap/apiHydration'
import { formatApiError, isPermissionDeniedError } from '@/services/api/apiErrors'

/**
 * When VITE_USE_API=true, hydrates CRM stores from backend on mount.
 * Does not mix with demo seed data — replaces store slices entirely.
 */
export function useCrmApiSync() {
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
        await hydrateCrmFromApi()
        if (!cancelled) setStatus('ready')
      } catch (e) {
        if (!cancelled) {
          // Missing module permission must not trap the whole shell — route guards handle UX.
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
