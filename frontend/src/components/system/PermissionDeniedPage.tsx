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

interface PermissionDeniedPageProps {
  /** Override required permission key when known from a route/API error */
  requiredPermission?: string | null
  /** Override page label */
  pageName?: string | null
  /**
   * When set (e.g. AppShell hydration recovery), call this instead of a normal
   * client-side navigation so the shell can soft-continue into home.
   */
  onGoHome?: () => void
}

/** Canonical permission-denied UI — shows role + required permission from the matrix. */
export function PermissionDeniedPage({
  requiredPermission,
  pageName: pageNameProp,
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
    requiredPermission ?? purchaseResolved?.permission ?? resolveRoutePermission(location.pathname)
  const pageName =
    pageNameProp ?? purchaseResolved?.pageName ?? resolveRoutePageName(location.pathname)

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
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-24 text-center">
      <ShieldX className="h-14 w-14 text-rose-500" aria-hidden />
      <p className="text-xs font-semibold uppercase tracking-wide text-erp-muted">403 · Access denied</p>
      <h1 className="text-xl font-semibold text-erp-text">You do not have access to this page</h1>
      <p className="text-sm text-erp-muted">
        Your account is signed in, but it does not have permission to open{' '}
        <strong className="text-erp-text">{pageName}</strong>. Go back to the home page or ask an
        administrator to update your role.
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
        <Button type="button" size="sm" onClick={handleGoHome}>
          <Home className="h-4 w-4" /> Go to home page
        </Button>
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

/** @deprecated Prefer PermissionDeniedPage — kept for existing imports. */
export const AccessDeniedPage = PermissionDeniedPage
