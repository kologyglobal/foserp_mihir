import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Info } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { isApiMode } from '@/config/apiConfig'
import { cn } from '@/utils/cn'

const SETUP_NAV: Array<{ label: string; path: string; end?: boolean }> = [
  { label: 'Setup Hub', path: '/manufacturing/setup', end: true },
  { label: 'Profiles', path: '/manufacturing/profiles' },
  { label: 'BOMs', path: '/manufacturing/setup/boms' },
  { label: 'Routings', path: '/manufacturing/setup/routings' },
  { label: 'Work Centres', path: '/manufacturing/work-centres' },
  { label: 'Machines', path: '/manufacturing/machines' },
]

function isSetupNavActive(pathname: string, item: { path: string; end?: boolean }): boolean {
  return item.end ? pathname === item.path : pathname === item.path || pathname.startsWith(`${item.path}/`)
}

/** Demo-mode notice — Phase 1 setup masters are API-backed only; no mock data is invented. */
function ApiModeRequiredBanner() {
  return (
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
  )
}

export function ManufacturingSetupShell({
  title,
  description,
  actions,
  children,
  badge = 'Manufacturing Setup',
}: {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  badge?: string
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
        { label: title },
      ]}
      autoBreadcrumbs={false}
      favoritePath={pathname}
      actions={actions}
    >
      <nav
        className="mb-3 flex flex-wrap gap-0.5 border-b border-erp-border pb-2"
        aria-label="Manufacturing setup"
      >
        {SETUP_NAV.map((item) => {
          const active = isSetupNavActive(pathname, item)
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'rounded px-2.5 py-1 text-[12px] font-medium transition-colors',
                active
                  ? 'bg-erp-primary-soft text-erp-primary'
                  : 'text-erp-muted hover:bg-erp-surface-alt hover:text-erp-text',
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      {!apiMode ? <ApiModeRequiredBanner /> : null}

      <div className={cn('min-w-0', !apiMode && 'pointer-events-none opacity-60')}>{children}</div>
    </OperationalPageShell>
  )
}
