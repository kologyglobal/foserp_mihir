import { useEffect, useState } from 'react'
import { isApiMode } from '@/config/apiConfig'
import { hydrateAdminFromApi } from '@/bootstrap/apiHydration'
import { formatApiError } from '@/services/api/apiErrors'

/**
 * When VITE_USE_API=true, hydrates admin users/roles/tenants from the backend.
 * Permission errors are swallowed inside the bridge so non-admin sessions stay empty
 * without failing the shell.
 */
export function useAdminApiSync() {
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
        await hydrateAdminFromApi()
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
