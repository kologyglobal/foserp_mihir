import { useEffect, useState, type ReactNode } from 'react'
import { PageLoadingFallback } from '@/components/system/PageLoadingFallback'
import { Link } from 'react-router-dom'
import { ErpButton } from '@/components/erp/ErpButton'
import { ArrowLeft } from 'lucide-react'

/**
 * Avoid flashing “not found” while Zustand/API hydrate settles.
 * Shows a short loader, then the not-found UI if the record is still missing.
 */
export function useCrmRecordLoadState(found: boolean, graceMs = 500) {
  const [elapsed, setElapsed] = useState(found)
  useEffect(() => {
    if (found) {
      setElapsed(true)
      return
    }
    setElapsed(false)
    const t = window.setTimeout(() => setElapsed(true), graceMs)
    return () => window.clearTimeout(t)
  }, [found, graceMs])

  return {
    showLoader: !found && !elapsed,
    showNotFound: !found && elapsed,
  }
}

export function CrmRecordLoadGate({
  found,
  label = 'Loading…',
  notFoundTitle = 'Record not found',
  notFoundHint,
  backTo,
  backLabel = 'Back',
  children,
}: {
  found: boolean
  label?: string
  notFoundTitle?: string
  notFoundHint?: string
  backTo?: string
  backLabel?: string
  children: ReactNode
}) {
  const { showLoader, showNotFound } = useCrmRecordLoadState(found)

  if (showLoader) return <PageLoadingFallback label={label} />

  if (showNotFound) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <p className="text-lg font-semibold text-erp-text">{notFoundTitle}</p>
        {notFoundHint ? <p className="text-sm text-erp-muted">{notFoundHint}</p> : null}
        {backTo ? (
          <Link to={backTo}>
            <ErpButton variant="secondary" size="sm" icon={ArrowLeft}>{backLabel}</ErpButton>
          </Link>
        ) : null}
      </div>
    )
  }

  return <>{children}</>
}

