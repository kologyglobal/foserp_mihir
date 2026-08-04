import { prisma } from '../../config/prisma.js'
import { NotFoundError } from '../../utils/errors.js'
import { listUserResponsibilities } from '../responsibilities/responsibility.service.js'
import { loadUserDataScope, type UserDataScope } from '../access-scopes/scope.service.js'
import { listUserModuleAdministrations } from '../modules/module.service.js'
import { isSensitivePermission } from './sensitive-permissions.js'

export interface EffectivePermissionGrant {
  name: string
  module: string
  description: string | null
  sensitive: boolean
  /** Role names that grant this permission (before overrides). */
  sources: string[]
  /** Final source of effective grant after allow/deny. */
  grantSource: 'ROLE' | 'USER_ALLOW' | 'USER_DENY' | 'DENIED'
  effect: 'ALLOW' | 'DENY'
}

export interface EffectiveAccessReport {
  user: {
    id: string
    firstName: string
    lastName: string
    email: string
    status: string
    department: string | null
    departmentId: string | null
    dataAccessLevel?: string
  }
  roles: Array<{ id: string; name: string; isSystem: boolean; permissionCount: number }>
  permissions: EffectivePermissionGrant[]
  permissionCount: number
  /** Permissions denied by explicit user override */
  deniedPermissions: string[]
  sensitivePermissions: string[]
  modules: Array<{ module: string; count: number; sensitiveCount: number }>
  scopes: UserDataScope
  responsibilities: Awaited<ReturnType<typeof listUserResponsibilities>>
  /** Catalog keys where this user is a designated module administrator */
  moduleAdministrations: string[]
  overrides: Array<{ permissionName: string; effect: 'ALLOW' | 'DENY'; reason: string | null }>
  explain: {
    summary: string
    notes: string[]
  }
  generatedAt: string
}

export async function getEffectiveAccess(tenantId: string, userId: string): Promise<EffectiveAccessReport> {
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId, deletedAt: null },
    include: {
      userRoles: {
        include: {
          role: {
            include: {
              rolePermissions: {
                include: { permission: true },
              },
            },
          },
        },
      },
    },
  })
  if (!user) throw new NotFoundError('User not found')

  const sourceMap = new Map<string, { perm: { name: string; module: string; description: string | null }; roles: Set<string> }>()

  const roles = user.userRoles.map((ur) => {
    const rolePerms = ur.role.rolePermissions
    for (const rp of rolePerms) {
      const key = rp.permission.name
      const existing = sourceMap.get(key)
      if (existing) {
        existing.roles.add(ur.role.name)
      } else {
        sourceMap.set(key, {
          perm: {
            name: rp.permission.name,
            module: rp.permission.module,
            description: rp.permission.description,
          },
          roles: new Set([ur.role.name]),
        })
      }
    }
    return {
      id: ur.role.id,
      name: ur.role.name,
      isSystem: ur.role.isSystem,
      permissionCount: rolePerms.length,
    }
  })

  const overrideRows = await prisma.userPermissionOverride.findMany({
    where: {
      tenantId,
      userId,
      deletedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: { permission: true },
  })
  const overrides = overrideRows.map((o) => ({
    permissionName: o.permission.name,
    effect: o.effect as 'ALLOW' | 'DENY',
    reason: o.reason,
  }))
  const allowSet = new Set(overrides.filter((o) => o.effect === 'ALLOW').map((o) => o.permissionName))
  const denySet = new Set(overrides.filter((o) => o.effect === 'DENY').map((o) => o.permissionName))

  // Apply overrides: DENY removes role grants; ALLOW adds permission not from roles.
  const permissions: EffectivePermissionGrant[] = []
  for (const { perm, roles: roleSet } of sourceMap.values()) {
    if (denySet.has(perm.name)) {
      permissions.push({
        name: perm.name,
        module: perm.module,
        description: perm.description,
        sensitive: isSensitivePermission(perm.name),
        sources: [...roleSet].sort(),
        grantSource: 'USER_DENY',
        effect: 'DENY',
      })
      continue
    }
    permissions.push({
      name: perm.name,
      module: perm.module,
      description: perm.description,
      sensitive: isSensitivePermission(perm.name),
      sources: [...roleSet].sort(),
      grantSource: 'ROLE',
      effect: 'ALLOW',
    })
  }
  for (const o of overrides.filter((x) => x.effect === 'ALLOW')) {
    if (sourceMap.has(o.permissionName) || denySet.has(o.permissionName)) continue
    const p = overrideRows.find((r) => r.permission.name === o.permissionName)?.permission
    if (!p) continue
    permissions.push({
      name: p.name,
      module: p.module,
      description: p.description,
      sensitive: isSensitivePermission(p.name),
      sources: ['User override'],
      grantSource: 'USER_ALLOW',
      effect: 'ALLOW',
    })
  }
  permissions.sort((a, b) => a.name.localeCompare(b.name))

  const allowedPermissions = permissions.filter((p) => p.effect === 'ALLOW')
  const deniedPermissions = permissions.filter((p) => p.effect === 'DENY').map((p) => p.name)

  const sensitivePermissions = allowedPermissions.filter((p) => p.sensitive).map((p) => p.name)

  const moduleMap = new Map<string, { count: number; sensitiveCount: number }>()
  for (const p of allowedPermissions) {
    const cur = moduleMap.get(p.module) ?? { count: 0, sensitiveCount: 0 }
    cur.count += 1
    if (p.sensitive) cur.sensitiveCount += 1
    moduleMap.set(p.module, cur)
  }
  const modules = [...moduleMap.entries()]
    .map(([module, v]) => ({ module, ...v }))
    .sort((a, b) => a.module.localeCompare(b.module))

  const [scopes, responsibilities, moduleAdministrations] = await Promise.all([
    loadUserDataScope(tenantId, userId),
    listUserResponsibilities(tenantId, userId),
    listUserModuleAdministrations(tenantId, userId),
  ])

  const notes: string[] = [
    'Explicit DENY overrides always win over role grants and ALLOW overrides.',
    overrides.length
      ? `${overrides.length} user override(s) applied (${allowSet.size} ALLOW, ${denySet.size} DENY).`
      : 'No user permission overrides (roles only).',
    scopes.unrestricted
      ? 'Data scope is unrestricted (empty LE/branch/warehouse grants allow all tenant org units).'
      : `Data scope is limited: ${scopes.legalEntities.length} company(ies), ${scopes.branches.length} branch(es), ${scopes.warehouses.length} warehouse(s).`,
    `Data access level: ${user.dataAccessLevel ?? 'ALL'}.`,
  ]
  if (roles.length === 0) {
    notes.push('User has no roles — effective permission set depends only on ALLOW overrides.')
  }
  if (sensitivePermissions.length > 0 && scopes.unrestricted) {
    notes.push('Attention: sensitive permissions with unrestricted data scope.')
  }
  if (responsibilities.length === 0) {
    notes.push('No cross-module responsibilities assigned.')
  } else {
    notes.push(`${responsibilities.length} responsibility assignment(s) (labels only — do not replace approval engines).`)
  }
  if (moduleAdministrations.length === 0) {
    notes.push('Not designated as a module administrator for any catalog module.')
  } else {
    notes.push(
      `Module administrator for: ${moduleAdministrations.join(', ')} (designation only — does not grant module.manage).`,
    )
  }

  const summary = [
    `${user.firstName} ${user.lastName}`,
    `${roles.length} role(s)`,
    `${allowedPermissions.length} allowed permission(s)`,
    deniedPermissions.length ? `${deniedPermissions.length} denied` : null,
    scopes.unrestricted ? 'unrestricted scope' : 'scoped',
    user.dataAccessLevel ?? 'ALL',
  ]
    .filter(Boolean)
    .join(' · ')

  return {
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      status: user.status,
      department: user.department,
      departmentId: user.departmentId,
      dataAccessLevel: user.dataAccessLevel,
    },
    roles,
    permissions,
    permissionCount: allowedPermissions.length,
    deniedPermissions,
    sensitivePermissions,
    modules,
    scopes,
    responsibilities,
    moduleAdministrations,
    overrides,
    explain: { summary, notes },
    generatedAt: new Date().toISOString(),
  }
}
