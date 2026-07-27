import { prisma } from '../../config/database.js'
import { NotFoundError } from '../../utils/errors.js'

/** Seeded tenant-admin persona names (see prisma/seed + ROLE_PERMISSIONS). */
export const TENANT_ADMIN_ROLE_NAMES = new Set([
  'Super Admin',
  'Tenant Admin',
  'Admin',
  'Administrator',
  'CEO',
])

/** Users in these statuses can still administer the tenant (invited admins count). */
const ADMIN_ELIGIBLE_STATUSES = new Set(['ACTIVE', 'INVITED'])

export interface EffectiveAccessRole {
  id: string
  name: string
  description: string | null
  isSystem: boolean
}

export interface EffectiveAccess {
  userId: string
  tenantId: string
  roles: EffectiveAccessRole[]
  permissions: string[]
  permissionCount: number
  /** Platform Super Admin — holds `tenant.manage`. */
  isSuperAdmin: boolean
  /** Tenant Admin persona — seeded admin role name and/or `tenant.manage`. */
  isTenantAdmin: boolean
}

export function isTenantAdminAccess(roles: readonly string[], permissions: readonly string[]): boolean {
  if (permissions.includes('tenant.manage')) return true
  return roles.some((name) => TENANT_ADMIN_ROLE_NAMES.has(name))
}

export function isActorPrivilegedAdmin(roles: readonly string[], permissions: readonly string[]): boolean {
  return isTenantAdminAccess(roles, permissions)
}

/**
 * Mutating actions imply a sibling `.view` permission when the name follows
 * `module.resource.action` (or `module.resource.sub.action`).
 */
export function viewDependencyFor(permissionName: string): string | null {
  const parts = permissionName.split('.')
  if (parts.length < 2) return null
  const action = parts[parts.length - 1]
  if (!action || action === 'view') return null
  return [...parts.slice(0, -1), 'view'].join('.')
}

/** Expand permission set so every mutate grant also includes its `.view` sibling. */
export function ensureViewDependencies(permissionNames: readonly string[]): string[] {
  const next = new Set(permissionNames)
  for (const name of permissionNames) {
    const view = viewDependencyFor(name)
    if (view) next.add(view)
  }
  return [...next].sort()
}

/**
 * Non-privileged actors may only assign permissions they themselves hold.
 * Privileged (super / tenant admin) actors may assign any catalog permission.
 */
export function filterAssignablePermissions(
  requested: readonly string[],
  actorPermissions: readonly string[],
  actorRoles: readonly string[],
): { allowed: string[]; rejected: string[] } {
  if (isActorPrivilegedAdmin(actorRoles, actorPermissions)) {
    return { allowed: [...requested], rejected: [] }
  }
  const owned = new Set(actorPermissions)
  const allowed: string[] = []
  const rejected: string[] = []
  for (const name of requested) {
    if (owned.has(name)) allowed.push(name)
    else rejected.push(name)
  }
  return { allowed, rejected }
}

export async function getEffectiveAccess(tenantId: string, userId: string): Promise<EffectiveAccess> {
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId, deletedAt: null },
    include: {
      userRoles: {
        include: {
          role: {
            include: {
              rolePermissions: { include: { permission: { select: { name: true } } } },
            },
          },
        },
      },
    },
  })

  if (!user) {
    throw new NotFoundError('User not found')
  }

  const roles: EffectiveAccessRole[] = user.userRoles.map((ur) => ({
    id: ur.role.id,
    name: ur.role.name,
    description: ur.role.description,
    isSystem: ur.role.isSystem,
  }))

  const permissions = [
    ...new Set(
      user.userRoles.flatMap((ur) => ur.role.rolePermissions.map((rp) => rp.permission.name)),
    ),
  ].sort()

  const roleNames = roles.map((r) => r.name)
  const isSuperAdmin = permissions.includes('tenant.manage')
  const isTenantAdmin = isTenantAdminAccess(roleNames, permissions)

  return {
    userId,
    tenantId,
    roles,
    permissions,
    permissionCount: permissions.length,
    isSuperAdmin,
    isTenantAdmin,
  }
}

export interface TenantAdminUserRef {
  userId: string
  email: string
  status: string
  roleNames: string[]
}

/** Active/invited users who currently hold tenant-admin-level access. */
export async function listTenantAdmins(tenantId: string): Promise<TenantAdminUserRef[]> {
  const users = await prisma.user.findMany({
    where: {
      tenantId,
      deletedAt: null,
      status: { in: [...ADMIN_ELIGIBLE_STATUSES] as Array<'ACTIVE' | 'INVITED'> },
    },
    include: {
      userRoles: {
        include: {
          role: {
            include: {
              rolePermissions: { include: { permission: { select: { name: true } } } },
            },
          },
        },
      },
    },
  })

  const admins: TenantAdminUserRef[] = []
  for (const user of users) {
    const roleNames = user.userRoles.map((ur) => ur.role.name)
    const permissions = [
      ...new Set(
        user.userRoles.flatMap((ur) => ur.role.rolePermissions.map((rp) => rp.permission.name)),
      ),
    ]
    if (isTenantAdminAccess(roleNames, permissions)) {
      admins.push({
        userId: user.id,
        email: user.email,
        status: user.status,
        roleNames,
      })
    }
  }
  return admins
}

/**
 * Returns true when `userId` is currently a tenant admin AND would be the last one
 * if they lost admin access (or left the eligible status pool).
 */
export async function wouldRemoveLastTenantAdmin(
  tenantId: string,
  userId: string,
  options?: {
    /** Simulated role ids remaining on the user after a role removal. */
    remainingRoleIds?: string[]
    /** If true, treat the user as leaving the eligible pool (deactivate/delete). */
    removingFromEligiblePool?: boolean
  },
): Promise<boolean> {
  const admins = await listTenantAdmins(tenantId)
  const current = admins.find((a) => a.userId === userId)
  if (!current) return false
  if (admins.length > 1) return false

  // Sole admin — any loss of admin access or eligibility locks the tenant.
  if (options?.removingFromEligiblePool) return true

  if (options?.remainingRoleIds !== undefined) {
    const roles = await prisma.role.findMany({
      where: { id: { in: options.remainingRoleIds }, deletedAt: null },
      include: {
        rolePermissions: { include: { permission: { select: { name: true } } } },
      },
    })
    const roleNames = roles.map((r) => r.name)
    const permissions = [
      ...new Set(roles.flatMap((r) => r.rolePermissions.map((rp) => rp.permission.name))),
    ]
    return !isTenantAdminAccess(roleNames, permissions)
  }

  return true
}

/**
 * After updating a role's permission set (or deleting it), ensure at least one
 * eligible tenant admin remains. Returns false when the change would lock out admins.
 */
export async function tenantWouldRetainAdminAfterRoleChange(
  tenantId: string,
  roleId: string,
  nextPermissionNames: string[] | null,
): Promise<boolean> {
  const users = await prisma.user.findMany({
    where: {
      tenantId,
      deletedAt: null,
      status: { in: [...ADMIN_ELIGIBLE_STATUSES] as Array<'ACTIVE' | 'INVITED'> },
    },
    include: {
      userRoles: {
        include: {
          role: {
            include: {
              rolePermissions: { include: { permission: { select: { name: true } } } },
            },
          },
        },
      },
    },
  })

  for (const user of users) {
    const roleNames: string[] = []
    const permissions = new Set<string>()
    for (const ur of user.userRoles) {
      if (ur.role.id === roleId) {
        if (nextPermissionNames === null) {
          // Role deleted / unassigned from consideration
          continue
        }
        roleNames.push(ur.role.name)
        for (const name of nextPermissionNames) permissions.add(name)
        continue
      }
      roleNames.push(ur.role.name)
      for (const rp of ur.role.rolePermissions) permissions.add(rp.permission.name)
    }
    if (isTenantAdminAccess(roleNames, [...permissions])) {
      return true
    }
  }
  return false
}
