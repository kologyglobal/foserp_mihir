import { Link, useLocation } from 'react-router-dom'
import { ShieldX } from 'lucide-react'
import {
  getSessionUser,
  getSessionUserRoleLabel,
  isPurchasePath,
  resolvePurchaseRoutePermission,
} from '../../utils/permissions'
import { resolveRoutePermission, resolveRoutePageName } from '../../config/permissionMatrix'
import { Button } from '../ui/Button'

interface PermissionDeniedPageProps {
  /** Override required permission key when known from a route/API error */
  requiredPermission?: string | null
  /** Override page label */
  pageName?: string | null
}

/** Canonical permission-denied UI — shows role + required permission from the matrix. */
export function PermissionDeniedPage({
  requiredPermission,
  pageName: pageNameProp,
}: PermissionDeniedPageProps = {}) {
  const location = useLocation()
  const user = getSessionUser()
  const roleLabel = getSessionUserRoleLabel()
  const purchaseResolved = isPurchasePath(location.pathname)
    ? resolvePurchaseRoutePermission(location.pathname)
    : null
  const required =
    requiredPermission ?? purchaseResolved?.permission ?? resolveRoutePermission(location.pathname)
  const pageName =
    pageNameProp ?? purchaseResolved?.pageName ?? resolveRoutePageName(location.pathname)

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-24 text-center">
      <ShieldX className="h-14 w-14 text-rose-500" aria-hidden />
      <p className="text-xs font-semibold uppercase tracking-wide text-erp-muted">403</p>
      <h1 className="text-xl font-semibold text-erp-text">Permission denied</h1>
      <p className="text-sm text-erp-muted">
        You do not have permission to access <strong className="text-erp-text">{pageName}</strong>.
      </p>
      <div className="w-full space-y-2 rounded-lg border border-erp-border bg-erp-surface p-4 text-left text-sm">
        <p>
          <span className="text-erp-muted">Current role:</span>{' '}
          <strong className="text-erp-text">{roleLabel}</strong>
          {user.name ? <span className="text-erp-muted"> ({user.name})</span> : null}
        </p>
        {required ? (
          <p>
            <span className="text-erp-muted">Required permission:</span>{' '}
            <code className="rounded bg-white px-2 py-0.5 font-mono text-xs text-erp-text">
              {required}
            </code>
          </p>
        ) : (
          <p className="text-xs text-erp-muted">
            No specific permission key is mapped for this path. Ask an admin to review your role.
          </p>
        )}
        {purchaseResolved ? (
          <p className="text-xs text-erp-muted">
            UI soft-guard only — purchase API must enforce the same permission when it ships.
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Link to="/home">
          <Button type="button" size="sm">
            Go to Dashboard
          </Button>
        </Link>
        <Link to="/crm">
          <Button type="button" size="sm" variant="secondary">
            Go to CRM
          </Button>
        </Link>
      </div>
    </div>
  )
}

/** @deprecated Prefer PermissionDeniedPage — kept for existing imports. */
export const AccessDeniedPage = PermissionDeniedPage
