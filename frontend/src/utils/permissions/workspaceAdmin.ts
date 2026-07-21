/**
 * Soft-guard only: workspace / platform admin roles open UI modules even when
 * RolePermission rows briefly lag a catalog expansion. Does not weaken gates for
 * other roles. Backend APIs must still authorize when they ship.
 */

import { getStoredSession, type AuthSession } from '../../services/api/client'

const WORKSPACE_ADMIN_ROLES = new Set([
  'super admin',
  'tenant admin',
  'admin',
  'administrator',
])

export function hasWorkspaceAdminRole(session?: AuthSession | null): boolean {
  const roles = (session ?? getStoredSession())?.user.roles ?? []
  return roles.some((r) => WORKSPACE_ADMIN_ROLES.has(r.trim().toLowerCase()))
}
