import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { MonitorOff } from 'lucide-react'
import { isApiMode } from '@/config/apiConfig'
import { Button } from '../ui/Button'

export interface DemoGateLink {
  label: string
  to: string
}

export interface ApiModeDemoGatePageProps {
  /** Screen name shown in the notice, e.g. "Inventory workspace". */
  title: string
  /** Why this screen is unavailable and where the live equivalent is. */
  description: string
  /** Canonical live alternatives to send the operator to. */
  links?: DemoGateLink[]
}

/**
 * Phase 8C Wave 1 (8B-R-010 / 8B-R-015): honest hard-stop for demo-only
 * screens when the app runs with VITE_USE_API=true. Demo/seed quantities must
 * never render as if they were live operational data. Demo mode
 * (VITE_USE_API=false) is unaffected — the original page renders.
 */
export function ApiModeDemoGatePage({ title, description, links = [] }: ApiModeDemoGatePageProps) {
  const location = useLocation()

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-24 text-center">
      <MonitorOff className="h-14 w-14 text-erp-muted" aria-hidden />
      <p className="text-xs font-semibold uppercase tracking-wide text-erp-muted">Demo-only screen</p>
      <h1 className="text-xl font-semibold text-erp-text">{title} is not available in live mode</h1>
      <p className="text-sm text-erp-muted">{description}</p>
      <p className="max-w-full truncate font-mono text-xs text-erp-muted" title={location.pathname}>
        {location.pathname}
      </p>
      {links.length > 0 && (
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          {links.map((link) => (
            <Link key={link.to} to={link.to}>
              <Button type="button" size="sm">
                {link.label}
              </Button>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Route helper: demo mode renders the original page; API mode renders the
 * hard-stop notice. Use at route registration so no demo store/service code
 * ever runs in API mode for the gated path.
 */
export function demoOnlyRoute(element: ReactNode, props: ApiModeDemoGatePageProps): ReactNode {
  return isApiMode() ? <ApiModeDemoGatePage {...props} /> : element
}
