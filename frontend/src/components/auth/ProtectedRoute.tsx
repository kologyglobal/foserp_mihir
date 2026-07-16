import { Link, useLocation } from 'react-router-dom'
import { ShieldX } from 'lucide-react'
import {
  getSessionUser,
  getSessionUserRoleLabel,
  canPermission,
  canRoute,
  getPermissionDenialReason,
  isPurchasePath,
  resolvePurchaseRoutePermission,
} from '../../utils/permissions'
import {
  resolveRoutePermission,
  resolveRoutePageName,
  type PermissionAction,
  type PermissionModule,
} from '../../config/permissionMatrix'
import { Button } from '../ui/Button'

export function AccessDeniedPage() {
  const location = useLocation()
  const user = getSessionUser()
  const roleLabel = getSessionUserRoleLabel()
  const purchaseResolved = isPurchasePath(location.pathname)
    ? resolvePurchaseRoutePermission(location.pathname)
    : null
  const required = purchaseResolved?.permission ?? resolveRoutePermission(location.pathname)
  const pageName = purchaseResolved?.pageName ?? resolveRoutePageName(location.pathname)

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-24 text-center">
      <ShieldX className="h-14 w-14 text-rose-500" />
      <h1 className="text-xl font-semibold text-slate-900">Access Denied</h1>
      <p className="text-sm text-slate-600">
        You do not have permission to access <strong>{pageName}</strong>.
      </p>
      <div className="w-full space-y-2 rounded-lg border bg-slate-50 p-4 text-left text-sm">
        <p>
          <span className="text-slate-500">Current role:</span>{' '}
          <strong>{roleLabel}</strong>
          {user.name ? (
            <span className="text-slate-400"> ({user.name})</span>
          ) : null}
        </p>
        {required && (
          <p>
            <span className="text-slate-500">Required permission:</span>{' '}
            <code className="rounded bg-white px-2 py-0.5 font-mono text-xs text-slate-800">{required}</code>
          </p>
        )}
        {purchaseResolved ? (
          <p className="text-xs text-slate-500">
            UI soft-guard only — purchase API must enforce the same permission when it ships.
          </p>
        ) : null}
      </div>
      <Link to="/home">
        <Button size="sm">Go to Dashboard</Button>
      </Link>
    </div>
  )
}

export function ProtectedOutlet({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  if (!canRoute(location.pathname)) {
    return <AccessDeniedPage />
  }
  return <>{children}</>
}

/** Hide children when permission missing */
export function PermissionGate({
  module,
  action,
  children,
  fallback = null,
}: {
  module: PermissionModule
  action: PermissionAction
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  if (!canPermission(module, action)) return <>{fallback}</>
  return <>{children}</>
}

/** Show disabled control with reason when permission missing; hide when hideWhenDenied */
export function ActionGuard({
  module,
  action,
  children,
  hideWhenDenied = false,
  disabledTitle,
}: {
  module: PermissionModule
  action: PermissionAction
  children: (props: { disabled: boolean; title?: string }) => React.ReactNode
  hideWhenDenied?: boolean
  disabledTitle?: string
}) {
  const allowed = canPermission(module, action)
  if (!allowed && hideWhenDenied) return null
  const reason = allowed ? undefined : disabledTitle ?? getPermissionDenialReason(module, action)
  return <>{children({ disabled: !allowed, title: reason })}</>
}
