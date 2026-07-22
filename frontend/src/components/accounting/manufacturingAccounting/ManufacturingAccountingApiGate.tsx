import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { LoadingState } from '@/design-system/components/LoadingState'
import { isApiMode } from '@/config/apiConfig'
import {
  getManufacturingAccountingGateStatus,
  type ManufacturingAccountingGateStatus,
} from '@/services/api/manufacturingCostingApi'
import { canViewAccounting } from '@/utils/permissions/manufacturing'
import { ManufacturingAccountingEmptyState } from './ManufacturingAccountingSummaryCards'
import { ManufacturingAccountingWorkspacePage } from '@/modules/accounting/manufacturing/ManufacturingAccountingWorkspacePage'

const WORKSPACE_PATH = '/accounting/manufacturing'

/**
 * Phase 7E gate: demo mode keeps the seed demo pages; API mode never shows
 * seed KPIs — it renders the live Phase 7E workspace when the tenant flag is
 * on (or the user holds manufacturing.accounting.view), otherwise an honest
 * "not enabled" empty state pointing at Work Order costing.
 */
export function ManufacturingAccountingApiGate({ children }: { children: ReactNode }) {
  if (!isApiMode()) return <>{children}</>
  return <ApiModeManufacturingAccounting />
}

function ApiModeManufacturingAccounting() {
  const location = useLocation()
  const [gate, setGate] = useState<ManufacturingAccountingGateStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getManufacturingAccountingGateStatus()
      .then((res) => {
        if (!cancelled) setGate(res.data)
      })
      .catch(() => {
        if (!cancelled) setGate(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Manufacturing Accounting"
        breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Manufacturing Accounting' }]}
        autoBreadcrumbs={false}
        favoritePath={WORKSPACE_PATH}
      >
        <LoadingState variant="card" />
      </OperationalPageShell>
    )
  }

  const workspaceAllowed = Boolean(gate?.enabled) || canViewAccounting()

  if (workspaceAllowed) {
    // Legacy demo sub-pages (wip, variances, cost-sheet, …) collapse into the
    // single live workspace in API mode — no seed data anywhere.
    if (location.pathname !== WORKSPACE_PATH) return <Navigate to={WORKSPACE_PATH} replace />
    return <ManufacturingAccountingWorkspacePage />
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Manufacturing Accounting"
      breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Manufacturing Accounting' }]}
      autoBreadcrumbs={false}
      favoritePath={WORKSPACE_PATH}
    >
      <ManufacturingAccountingEmptyState
        title="Manufacturing Accounting is not enabled for this tenant."
        description="The MANUFACTURING_ACCOUNTING feature flag is off and your account does not hold manufacturing.accounting.view. Work-order cost calculation is still available from the Work Order Costing tab."
        actions={
          <Link
            to="/manufacturing/work-orders"
            className="inline-flex items-center rounded-md border border-erp-border bg-white px-3 py-1.5 text-[12px] font-semibold text-erp-primary hover:bg-slate-50"
          >
            Open Work Orders (Costing)
          </Link>
        }
      />
    </OperationalPageShell>
  )
}

export function withManufacturingAccountingApiGate(page: ReactNode): ReactNode {
  return <ManufacturingAccountingApiGate>{page}</ManufacturingAccountingApiGate>
}
