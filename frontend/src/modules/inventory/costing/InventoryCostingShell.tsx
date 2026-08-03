import type { ReactNode } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ShieldOff } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { DynamicsTabs } from '@/components/dynamics/DynamicsTabs'
import { EmptyState } from '@/components/ui/EmptyState'
import { useInventoryPermissions } from '@/utils/permissions/inventory'
import { COSTING_SUBNAV, inventoryCostingPaths } from './inventoryCostingPaths'
import { shouldNavigate } from '@/utils/safeState'

type Props = {
  title: string
  description?: string
  favoritePath?: string
  commandBar?: ReactNode
  /** When false, children render without the white register card (rare). Default true. */
  panel?: boolean
  children: ReactNode
}

export function InventoryCostingShell({
  title,
  description,
  favoritePath,
  commandBar,
  panel = true,
  children,
}: Props) {
  const perms = useInventoryPermissions()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  if (!perms.canViewCost && !perms.canView && !perms.canViewStock) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Inventory"
        title="Costing"
        breadcrumbs={[{ label: 'Inventory', to: '/inventory' }, { label: 'Costing' }]}
        autoBreadcrumbs={false}
      >
        <EmptyState icon={ShieldOff} title="Access denied" description="inventory.view_cost is required." />
      </OperationalPageShell>
    )
  }

  if (!perms.canViewCost) {
    return <Navigate to="/inventory" replace />
  }

  const activePath = (() => {
    const nested = [...COSTING_SUBNAV]
      .filter((t) => t.path !== inventoryCostingPaths.summary)
      .filter((t) => pathname === t.path || pathname.startsWith(`${t.path}/`))
      .sort((a, b) => b.path.length - a.path.length)
    return nested[0]?.path ?? inventoryCostingPaths.summary
  })()

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Inventory"
      title={title}
      description={description}
      showDescription={Boolean(description)}
      breadcrumbs={[
        { label: 'Inventory', to: '/inventory' },
        { label: 'Costing', to: inventoryCostingPaths.summary },
        ...(title !== 'Inventory Costing' && title !== 'Valuation Summary' ? [{ label: title }] : []),
      ]}
      autoBreadcrumbs={false}
      favoritePath={favoritePath ?? inventoryCostingPaths.summary}
      commandBar={commandBar}
      mergeHeaderWithWorkspace
    >
      <div className="flex flex-col gap-3">
        <DynamicsTabs
          items={COSTING_SUBNAV.map((t) => ({ label: t.label, path: t.path }))}
          activePath={activePath}
          onChange={(path) => {
            if (shouldNavigate(pathname, path)) navigate(path)
          }}
        />
        {panel ? (
          <div className="min-w-0 overflow-hidden rounded-md border border-erp-border bg-white shadow-sm">{children}</div>
        ) : (
          children
        )}
      </div>
    </OperationalPageShell>
  )
}
