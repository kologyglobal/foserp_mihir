import { isApiMode } from '../../config/apiConfig'
import { getStoredSession } from '../../services/api/client'
import { canPermission } from './index'

/** Check a system-admin permission (user.*, role.*, tenant.*) — session permissions in API mode, demo matrix otherwise. */
export function canAdminPermission(permission: string): boolean {
  if (isApiMode()) {
    const perms = getStoredSession()?.user.permissions ?? []
    return perms.includes(permission) || perms.includes('tenant.manage')
  }
  if (permission.endsWith('.view')) return canPermission('settings', 'view')
  return canPermission('settings', 'edit')
}

/** Super Admin (platform-level) check — controls visibility of the Tenants list. */
export function isSuperAdminUser(): boolean {
  if (isApiMode()) {
    const perms = getStoredSession()?.user.permissions ?? []
    return perms.includes('tenant.manage')
  }
  return canPermission('settings', 'edit')
}

/** Administration shell visibility — any user/role/tenant/module admin permission. */
export function canAccessAdminShell(): boolean {
  return (
    canAdminPermission('user.view')
    || canAdminPermission('role.view')
    || canAdminPermission('tenant.view')
    || canAdminPermission('module.view')
    || isSuperAdminUser()
  )
}

/** Soft UI gate for Administration sub-nav items (backend still enforces). */
export function canViewAdminNavItem(path: string): boolean {
  if (!canAccessAdminShell()) return false
  if (path === '/admin/tenants' || path.startsWith('/admin/tenants/')) {
    return isSuperAdminUser()
  }
  if (path === '/admin/users' || path.startsWith('/admin/users/')) {
    return canAdminPermission('user.view')
  }
  if (path === '/admin/roles' || path.startsWith('/admin/roles/')) {
    return canAdminPermission('role.view')
  }
  // Overview, Organization, Tenant Profile — any admin-shell access
  return true
}
