import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Home, LogOut, ShieldX } from 'lucide-react'
import {
  getSessionUser,
  getSessionUserRoleLabel,
  isPurchasePath,
  resolvePurchaseRoutePermission,
} from '../../utils/permissions'
import { resolveRoutePermission, resolveRoutePageName } from '../../config/permissionMatrix'
import { Button } from '../ui/Button'
import { useOptionalAuth } from '../../context/AuthProvider'
import { isApiMode } from '../../config/apiConfig'
import {
  isPermissionDeniedError,
  parseMissingPermissionKey,
} from '../../services/api/apiErrors'

interface PermissionDeniedPageProps {
  /** Override required permission key when known from a route/API error */
  requiredPermission?: string | null
  /** Override page label */
  pageName?: string | null
  /** Explicit denial reason from API / guard (e.g. "Super Admin access required") */
  reason?: string | null
  /**
   * When set (e.g. AppShell hydration recovery), call this instead of a normal
   * client-side navigation so the shell can soft-continue into home.
   */
  onGoHome?: () => void
}

function explainDenial(required: string | null | undefined, reason: string | null | undefined): string {
  const msg = (reason ?? '').trim()
  if (/super admin/i.test(msg) || required === 'tenant.manage') {
    return (
      'This area is limited to platform Super Admins (permission tenant.manage). ' +
      'Tenant Admins can manage users, roles, and modules inside their own workspace under Administration — ' +
      'but not the cross-tenant Tenants list.'
    )
  }
  if (required === 'module.view' || required === 'module.manage') {
    return (
      'Module enablement requires module.view (and module.manage to change flags). ' +
      'Ask a Tenant Admin or Super Admin to grant that permission on your role.'
    )
  }
  if (required?.startsWith('tenant.')) {
    return (
      'Tenant workspace administration requires a tenant.* permission. ' +
      'Listing all tenants across the platform additionally requires Super Admin (tenant.manage).'
    )
  }
  if (msg) return msg
  return 'Your role does not include the permission required for this page.'
}

/** Canonical permission-denied UI — shows role + required permission + clear reason. */
export function PermissionDeniedPage({
  requiredPermission,
  pageName: pageNameProp,
  reason,
  onGoHome,
}: PermissionDeniedPageProps = {}) {
  const location = useLocation()
  const navigate = useNavigate()
  const auth = useOptionalAuth()
  const [signingOut, setSigningOut] = useState(false)
  const user = getSessionUser()
  const roleLabel = getSessionUserRoleLabel()
  const purchaseResolved = isPurchasePath(location.pathname)
    ? resolvePurchaseRoutePermission(location.pathname)
    : null
  const required =
    requiredPermission ??
    (reason ? parseMissingPermissionKey(reason) : null) ??
    purchaseResolved?.permission ??
    resolveRoutePermission(location.pathname)
  const pageName =
    pageNameProp ?? purchaseResolved?.pageName ?? resolveRoutePageName(location.pathname)
  const explanation = explainDenial(required, reason)
  const isSuperAdminGate =
    /super admin/i.test(reason ?? '') || required === 'tenant.manage'

  async function handleSignOut() {
    setSigningOut(true)
    try {
      if (isApiMode() && auth?.logout) {
        await auth.logout()
      }
      navigate('/login', { replace: true })
    } finally {
      setSigningOut(false)
    }
  }

  function handleGoHome() {
    onGoHome?.()
    navigate('/home', { replace: true })
  }

  return (
    <div
      className="mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-24 text-center"
      role="alertdialog"
      aria-labelledby="permission-denied-title"
      aria-describedby="permission-denied-desc"
    >
      <ShieldX className="h-14 w-14 text-rose-500" aria-hidden />
      <p className="text-xs font-semibold uppercase tracking-wide text-erp-muted">403 · Access denied</p>
      <h1 id="permission-denied-title" className="text-xl font-semibold text-erp-text">
        {isSuperAdminGate ? 'Super Admin access required' : 'You do not have access to this page'}
      </h1>
      <p id="permission-denied-desc" className="text-sm text-erp-muted">
        You are not allowed to open <strong className="text-erp-text">{pageName}</strong>.
      </p>
      <div className="w-full space-y-2 rounded-lg border border-rose-200 bg-rose-50/50 p-4 text-left text-sm">
        <p>
          <span className="font-medium text-erp-muted">Why:</span>{' '}
          <span className="text-erp-text">{explanation}</span>
        </p>
        {reason && reason !== explanation ? (
          <p>
            <span className="font-medium text-erp-muted">Server message:</span>{' '}
            <span className="text-rose-800">{reason}</span>
          </p>
        ) : null}
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
            {required === 'tenant.manage' ? (
              <span className="mt-1 block text-xs text-erp-muted">
                Held by the platform <strong>Super Admin</strong> role only.
              </span>
            ) : null}
          </p>
        ) : null}
        {purchaseResolved ? (
          <p className="text-xs text-erp-muted">
            UI soft-guard only — purchase API must enforce the same permission when it ships.
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button type="button" size="sm" onClick={handleGoHome}>
          <Home className="h-4 w-4" /> Go to home page
        </Button>
        {!isSuperAdminGate ? (
          <Button type="button" size="sm" variant="secondary" onClick={() => navigate('/admin')}>
            Open Administration
          </Button>
        ) : (
          <Button type="button" size="sm" variant="secondary" onClick={() => navigate('/admin')}>
            Go to tenant Admin
          </Button>
        )}
        {isApiMode() && auth?.isAuthenticated ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={signingOut}
            onClick={() => void handleSignOut()}
          >
            <LogOut className="h-4 w-4" /> {signingOut ? 'Signing out…' : 'Sign out'}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

/** Build props for PermissionDeniedPage from an API / thrown error. */
export function permissionDeniedPropsFromError(
  err: unknown,
  fallbackPageName?: string,
): PermissionDeniedPageProps | null {
  if (!isPermissionDeniedError(err)) return null
  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : 'Permission denied'
  const code =
    typeof err === 'object' && err && 'code' in err && typeof (err as { code?: unknown }).code === 'string'
      ? (err as { code: string }).code
      : ''
  const required =
    parseMissingPermissionKey(message) ??
    (/super admin/i.test(message) ? 'tenant.manage' : null)
  return {
    reason: message || (code === 'PERMISSION_DENIED' ? 'Permission denied' : null),
    requiredPermission: required,
    pageName: fallbackPageName ?? null,
  }
}

/** @deprecated Prefer PermissionDeniedPage — kept for existing imports. */
export const AccessDeniedPage = PermissionDeniedPage
