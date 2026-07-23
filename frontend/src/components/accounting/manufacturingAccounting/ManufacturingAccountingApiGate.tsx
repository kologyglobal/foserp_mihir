import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { isApiMode } from '@/config/apiConfig'
import { ManufacturingAccountingWorkspacePage } from '@/modules/accounting/manufacturing/ManufacturingAccountingWorkspacePage'

const WORKSPACE_PATH = '/accounting/manufacturing'

/**
 * Phase 7E gate: seed demo pages removed.
 *
 * API mode always mounts the live workspace — including when MANUFACTURING_ACCOUNTING
 * is OFF — so readiness / Enable stay reachable. Flag state is owned by the workspace
 * banner + enablement panel, not this shell.
 *
 * Demo mode redirects to Work Orders (costing still available there).
 */
export function ManufacturingAccountingApiGate(_props?: { children?: ReactNode }) {
  if (!isApiMode()) return <Navigate to="/manufacturing/work-orders" replace />
  return <ApiModeManufacturingAccounting />
}

function ApiModeManufacturingAccounting() {
  const location = useLocation()
  if (location.pathname !== WORKSPACE_PATH) {
    return <Navigate to={WORKSPACE_PATH} replace />
  }
  return <ManufacturingAccountingWorkspacePage />
}

export function withManufacturingAccountingApiGate(page: ReactNode): ReactNode {
  return <ManufacturingAccountingApiGate>{page}</ManufacturingAccountingApiGate>
}
