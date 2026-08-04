import { prisma } from '../../config/prisma.js'

export type PermissionOverrideEffect = 'ALLOW' | 'DENY'

export interface PermissionOverrideInput {
  permissionName: string
  effect: PermissionOverrideEffect
}

/**
 * Apply user ALLOW/DENY overrides over role permission names.
 * DENY always wins over role grants and ALLOW.
 */
export function applyPermissionOverrides(
  rolePermissionNames: Iterable<string>,
  overrides: PermissionOverrideInput[],
): string[] {
  const permSet = new Set(rolePermissionNames)
  const denySet = new Set(
    overrides.filter((o) => o.effect === 'DENY').map((o) => o.permissionName),
  )
  const allowSet = overrides
    .filter((o) => o.effect === 'ALLOW')
    .map((o) => o.permissionName)
    .filter((name) => !denySet.has(name))

  for (const name of denySet) {
    permSet.delete(name)
  }
  for (const name of allowSet) {
    permSet.add(name)
  }
  return [...permSet]
}

/**
 * Load role grants + active (non-expired) user overrides and resolve the effective
 * permission name list used by API authz (`attachRequestContext`, JWT issue).
 */
export async function loadEffectivePermissionNames(
  userId: string,
  tenantId: string,
): Promise<{ roles: string[]; permissions: string[]; denied: string[] }> {
  const [userRoles, overrideRows] = await Promise.all([
    prisma.userRole.findMany({
      where: { userId, tenantId },
      include: {
        role: {
          include: {
            rolePermissions: { include: { permission: true } },
          },
        },
      },
    }),
    prisma.userPermissionOverride.findMany({
      where: {
        tenantId,
        userId,
        deletedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: { permission: { select: { name: true } } },
    }),
  ])

  const roles = userRoles.map((ur) => ur.role.name)
  const rolePermissions = [
    ...new Set(userRoles.flatMap((ur) => ur.role.rolePermissions.map((rp) => rp.permission.name))),
  ]
  const overrides: PermissionOverrideInput[] = overrideRows.map((o) => ({
    permissionName: o.permission.name,
    effect: o.effect as PermissionOverrideEffect,
  }))
  const denied = overrides.filter((o) => o.effect === 'DENY').map((o) => o.permissionName)
  const permissions = applyPermissionOverrides(rolePermissions, overrides)

  return { roles, permissions, denied }
}
