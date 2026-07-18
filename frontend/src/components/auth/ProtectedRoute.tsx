import { useLocation } from 'react-router-dom'
import { canPermission, canRoute, getPermissionDenialReason } from '../../utils/permissions'
import type { PermissionAction, PermissionModule } from '../../config/permissionMatrix'
import {
  AccessDeniedPage,
  PermissionDeniedPage,
} from '../system/PermissionDeniedPage'

export { AccessDeniedPage, PermissionDeniedPage }

export function ProtectedOutlet({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  if (!canRoute(location.pathname)) {
    return <PermissionDeniedPage />
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
