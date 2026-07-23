import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Info } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { isApiMode } from '@/config/apiConfig'
import { cn } from '@/utils/cn'

/**
 * Manufacturing setup pages use the fixed Manufacturing module workspace tabs
 * (same pattern as CRM / Purchase) — do not render a second local tab strip here.
 */
export function ManufacturingSetupShell({
  title,
  description,
  actions,
  children,
  badge = 'Manufacturing Setup',
  backLink,
  parentCrumb,
  breadcrumbLabel,
}: {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  badge?: string
  backLink?: { to: string; label: string }
  parentCrumb?: { label: string; to: string }
  /** Optional last breadcrumb label (defaults to title). */
  breadcrumbLabel?: string
}) {
  const { pathname } = useLocation()
  const apiMode = isApiMode()

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge={badge}
      title={title}
      description={description ?? 'Work centres, machines, BOMs, routings, and profiles.'}
      breadcrumbs={[
        { label: 'Manufacturing & Production', to: '/manufacturing' },
        { label: 'Setup', to: '/manufacturing/setup' },
        ...(parentCrumb ? [parentCrumb] : []),
        { label: breadcrumbLabel ?? title },
      ]}
      autoBreadcrumbs={false}
      favoritePath={pathname}
      actions={actions}
      backLink={backLink}
    >
      {!apiMode ? (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Manufacturing setup masters require API mode (<code className="font-mono">VITE_USE_API=true</code>). Demo BOM/Routes
            remain at{' '}
            <Link to="/manufacturing/bom" className="font-semibold underline">
              /manufacturing/bom
            </Link>{' '}
            and{' '}
            <Link to="/manufacturing/routes" className="font-semibold underline">
              /manufacturing/routes
            </Link>
            .
          </span>
        </div>
      ) : null}

      <div className={cn('min-w-0', !apiMode && 'pointer-events-none opacity-60')}>{children}</div>
    </OperationalPageShell>
  )
}
