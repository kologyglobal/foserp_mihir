import { Link, useLocation } from 'react-router-dom'
import { FileQuestion } from 'lucide-react'
import { Button } from '../ui/Button'

export type PageNotFoundScope = 'app' | 'crm'

interface PageNotFoundPageProps {
  /** Soft CRM-scoped copy when unknown path is under /crm */
  scope?: PageNotFoundScope
}

function resolveScope(explicit: PageNotFoundScope | undefined, pathname: string): PageNotFoundScope {
  if (explicit) return explicit
  return pathname === '/crm' || pathname.startsWith('/crm/') ? 'crm' : 'app'
}

/** Soft 404 for unknown routes — not a crash. Links back to CRM / Home. */
export function PageNotFoundPage({ scope: scopeProp }: PageNotFoundPageProps = {}) {
  const location = useLocation()
  const scope = resolveScope(scopeProp, location.pathname)

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-24 text-center">
      <FileQuestion className="h-14 w-14 text-erp-muted" aria-hidden />
      <p className="text-xs font-semibold uppercase tracking-wide text-erp-muted">404</p>
      <h1 className="text-xl font-semibold text-erp-text">Page not found</h1>
      <p className="text-sm text-erp-muted">
        {scope === 'crm'
          ? 'This CRM path is not part of FOS ERP. Check the URL, or return to CRM / Home.'
          : 'This path is not part of FOS ERP. Use the navigation, or return to CRM / Home.'}
      </p>
      <p className="max-w-full truncate font-mono text-xs text-erp-muted" title={location.pathname}>
        {location.pathname}
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Link to="/crm">
          <Button type="button" size="sm">
            Go to CRM
          </Button>
        </Link>
        <Link to="/home">
          <Button type="button" size="sm" variant="secondary">
            Go to Home
          </Button>
        </Link>
      </div>
    </div>
  )
}

/** @deprecated Prefer PageNotFoundPage — kept for existing imports. */
export const AppNotFoundPage = PageNotFoundPage
