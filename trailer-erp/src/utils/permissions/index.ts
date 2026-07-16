/** Mock session user + RBAC until AuthModule ships */

import type { ExperienceRole } from '../../types/roleExperience'
import { EXPERIENCE_ROLE_LABELS } from '../../types/roleExperience'
import {
  ROLE_PERMISSION_MATRIX,
  formatPermissionKey,
  type PermissionAction,
  type PermissionKey,
  type PermissionModule,
  resolveRoutePermission,
} from '../../config/permissionMatrix'
import { isApiMode } from '../../config/apiConfig'
import type { AuthSession } from '../../services/api/client'

/** Primary ERP roles — legacy aliases retained for backward compatibility */
export type ErpRole =
  | 'admin'
  | 'ceo'
  | 'director'
  | 'engineering_head'
  | 'sales_manager'
  | 'planning_manager'
  | 'purchase_head'
  | 'purchase_user'
  | 'store_manager'
  | 'store_user'
  | 'production_head'
  | 'production_supervisor'
  | 'shop_floor'
  | 'quality_head'
  | 'quality_inspector'
  | 'dispatch_manager'
  | 'dispatch_user'
  | 'accounts_head'
  | 'accounts_user'
  // Legacy aliases
  | 'management'
  | 'purchase'
  | 'stores'
  | 'sales'
  | 'planning'
  | 'quality'
  | 'dispatch'
  | 'accounts'
  | 'engineering'
  | 'production'

export type { PermissionAction, PermissionModule, PermissionKey }

export interface SessionUser {
  id: string
  name: string
  role: ErpRole
  experienceRole: ExperienceRole
}

const DEFAULT_EXPERIENCE_BY_ERP_ROLE: Record<ErpRole, ExperienceRole> = {
  admin: 'ceo',
  ceo: 'ceo',
  director: 'coo',
  engineering_head: 'planning',
  sales_manager: 'planning',
  planning_manager: 'planning',
  purchase_head: 'purchase',
  purchase_user: 'purchase',
  store_manager: 'stores',
  store_user: 'stores',
  production_head: 'production',
  production_supervisor: 'production',
  shop_floor: 'production',
  quality_head: 'quality',
  quality_inspector: 'quality',
  dispatch_manager: 'dispatch',
  dispatch_user: 'dispatch',
  accounts_head: 'accounts',
  accounts_user: 'accounts',
  management: 'coo',
  purchase: 'purchase',
  stores: 'stores',
  sales: 'planning',
  planning: 'planning',
  quality: 'quality',
  dispatch: 'dispatch',
  accounts: 'accounts',
  engineering: 'planning',
  production: 'production',
}

const MOCK_USER: SessionUser = {
  id: 'user-demo',
  name: 'Demo User',
  role: 'admin',
  experienceRole: 'ceo',
}

let sessionUser: SessionUser = { ...MOCK_USER }

function mapBackendRoleToErpRole(roles: string[]): ErpRole {
  const normalized = roles.map((r) => r.toLowerCase())
  if (normalized.some((r) => r.includes('super admin') || r.includes('tenant admin'))) return 'admin'
  if (normalized.some((r) => r.includes('ceo') || r.includes('director') || r.includes('managing'))) return 'ceo'
  if (normalized.some((r) => r.includes('sales') || r.includes('crm'))) return 'sales_manager'
  if (normalized.some((r) => r.includes('planning') || r.includes('engineering'))) return 'planning_manager'
  if (normalized.some((r) => r.includes('purchase'))) return 'purchase_head'
  if (normalized.some((r) => r.includes('store') || r.includes('inventory'))) return 'store_manager'
  if (normalized.some((r) => r.includes('production') || r.includes('shop floor'))) return 'production_head'
  if (normalized.some((r) => r.includes('quality'))) return 'quality_head'
  if (normalized.some((r) => r.includes('dispatch') || r.includes('logistics'))) return 'dispatch_manager'
  if (normalized.some((r) => r.includes('accounts') || r.includes('finance'))) return 'accounts_head'
  return 'admin'
}

/** Sync RBAC session from API auth (login / me / logout). */
export function syncSessionUserFromAuth(session: AuthSession | null): void {
  if (!session?.user) {
    sessionUser = { ...MOCK_USER }
    return
  }

  const { user } = session
  const name = `${user.firstName} ${user.lastName}`.trim() || user.email
  const erpRole = mapBackendRoleToErpRole(user.roles ?? [])

  sessionUser = {
    id: user.id,
    name,
    role: erpRole,
    experienceRole: DEFAULT_EXPERIENCE_BY_ERP_ROLE[erpRole],
  }
}

export function getSessionUser(): SessionUser {
  return sessionUser
}

/** Primary role label for header/profile — uses backend role name in API mode. */
export function getSessionUserRoleLabel(): string {
  if (isApiMode()) {
    try {
      const raw = localStorage.getItem('fos-erp-auth')
      if (raw) {
        const session = JSON.parse(raw) as AuthSession
        const primaryRole = session.user?.roles?.[0]
        if (primaryRole) return primaryRole
      }
    } catch {
      /* ignore */
    }
  }
  return ERP_ROLE_LABELS[sessionUser.role]
}

export function setSessionUserForTests(user: Partial<SessionUser>) {
  const role = user.role ?? MOCK_USER.role
  sessionUser = {
    ...MOCK_USER,
    ...user,
    experienceRole: user.experienceRole ?? DEFAULT_EXPERIENCE_BY_ERP_ROLE[role],
  }
}

export function setExperienceRole(role: ExperienceRole) {
  sessionUser = { ...sessionUser, experienceRole: role }
}

export function setErpRole(role: ErpRole) {
  sessionUser = {
    ...sessionUser,
    role,
    experienceRole: DEFAULT_EXPERIENCE_BY_ERP_ROLE[role],
  }
}

export function getExperienceRole(): ExperienceRole {
  return sessionUser.experienceRole
}

export function getExperienceRoleLabel(): string {
  return EXPERIENCE_ROLE_LABELS[sessionUser.experienceRole]
}

export function resetSessionUserForTests() {
  sessionUser = { ...MOCK_USER }
}

export function canPermission(module: PermissionModule, action: PermissionAction): boolean {
  const user = getSessionUser()
  const perms = ROLE_PERMISSION_MATRIX[user.role]
  if (perms === '*') return true
  const key = `${module}.${action}` as PermissionKey
  return perms.includes(key)
}

export function getPermissionDenialReason(module: PermissionModule, action: PermissionAction): string {
  const key = `${module}.${action}` as PermissionKey
  const user = getSessionUser()
  return `Requires ${formatPermissionKey(key)} — your role (${ERP_ROLE_LABELS[user.role]}) does not have this permission`
}

export function canRoute(pathname: string): boolean {
  const required = resolveRoutePermission(pathname)
  if (!required) return true
  const [module, action] = required.split('.') as [PermissionModule, PermissionAction]
  return canPermission(module, action)
}

export function assertPermission(
  module: PermissionModule,
  action: PermissionAction,
): { ok: true } | { ok: false; error: string } {
  if (!canPermission(module, action)) {
    return { ok: false, error: getPermissionDenialReason(module, action) }
  }
  return { ok: true }
}

/** Legacy module-specific wrappers for existing store calls */
export function assertLegacyPermission(
  module: 'purchase' | 'quality' | 'dispatch' | 'sales',
  action: PermissionAction,
): { ok: true } | { ok: false; error: string } {
  return assertPermission(module, action)
}

export function canLegacyPermission(
  module: 'purchase' | 'quality' | 'dispatch' | 'sales',
  action: PermissionAction,
): boolean {
  return canPermission(module, action)
}

export const ERP_ROLE_LABELS: Record<ErpRole, string> = {
  admin: 'Admin',
  ceo: 'CEO',
  director: 'Director',
  engineering_head: 'Engineering Head',
  sales_manager: 'Sales Manager',
  planning_manager: 'Planning Manager',
  purchase_head: 'Purchase Head',
  purchase_user: 'Purchase User',
  store_manager: 'Store Manager',
  store_user: 'Store User',
  production_head: 'Production Head',
  production_supervisor: 'Production Supervisor',
  shop_floor: 'Shop Floor Operator',
  quality_head: 'Quality Head',
  quality_inspector: 'Quality Inspector',
  dispatch_manager: 'Dispatch Manager',
  dispatch_user: 'Dispatch User',
  accounts_head: 'Accounts Head',
  accounts_user: 'Accounts User',
  management: 'Management',
  purchase: 'Purchase',
  stores: 'Stores',
  sales: 'Sales',
  planning: 'Planning',
  quality: 'Quality',
  dispatch: 'Dispatch',
  accounts: 'Accounts',
  engineering: 'Engineering',
  production: 'Production',
}

export const PRIMARY_ERP_ROLES: ErpRole[] = [
  'admin',
  'ceo',
  'director',
  'engineering_head',
  'sales_manager',
  'planning_manager',
  'purchase_head',
  'purchase_user',
  'store_manager',
  'store_user',
  'production_head',
  'production_supervisor',
  'shop_floor',
  'quality_head',
  'quality_inspector',
  'dispatch_manager',
  'dispatch_user',
  'accounts_head',
  'accounts_user',
]

export { canCrmPermission } from './crm'
