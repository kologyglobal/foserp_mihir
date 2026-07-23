import { prisma } from '../../config/database.js'
import { NotFoundError } from '../../utils/errors.js'
import { listUserResponsibilities } from '../responsibilities/responsibility.service.js'
import { loadUserDataScope, type UserDataScope } from '../access-scopes/scope.service.js'
import { isSensitivePermission } from './sensitive-permissions.js'

export interface EffectivePermissionGrant {
  name: string
  module: string
  description: string | null
  sensitive: boolean
  /** Role names that grant this permission */
  sources: string[]
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
  }
  roles: Array<{ id: string; name: string; isSystem: boolean; permissionCount: number }>
  permissions: EffectivePermissionGrant[]
  permissionCount: number
  sensitivePermissions: string[]
  modules: Array<{ module: string; count: number; sensitiveCount: number }>
  scopes: UserDataScope
  responsibilities: Awaited<ReturnType<typeof listUserResponsibilities>>
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

  const permissions: EffectivePermissionGrant[] = [...sourceMap.values()]
    .map(({ perm, roles: roleSet }) => ({
      name: perm.name,
      module: perm.module,
      description: perm.description,
      sensitive: isSensitivePermission(perm.name),
      sources: [...roleSet].sort(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const sensitivePermissions = permissions.filter((p) => p.sensitive).map((p) => p.name)

  const moduleMap = new Map<string, { count: number; sensitiveCount: number }>()
  for (const p of permissions) {
    const cur = moduleMap.get(p.module) ?? { count: 0, sensitiveCount: 0 }
    cur.count += 1
    if (p.sensitive) cur.sensitiveCount += 1
    moduleMap.set(p.module, cur)
  }
  const modules = [...moduleMap.entries()]
    .map(([module, v]) => ({ module, ...v }))
    .sort((a, b) => a.module.localeCompare(b.module))

  const [scopes, responsibilities] = await Promise.all([
    loadUserDataScope(tenantId, userId),
    listUserResponsibilities(tenantId, userId),
  ])

  const notes: string[] = [
    'Permissions are granted only through assigned roles (no direct user permission overrides in Phase 7).',
    scopes.unrestricted
      ? 'Data scope is unrestricted (fail-open): empty LE/branch/warehouse grants allow all tenant org units.'
      : `Data scope is limited: ${scopes.legalEntities.length} company(ies), ${scopes.branches.length} branch(es), ${scopes.warehouses.length} warehouse(s).`,
  ]
  if (roles.length === 0) {
    notes.push('User has no roles — effective permission set is empty.')
  }
  if (sensitivePermissions.length > 0 && scopes.unrestricted) {
    notes.push('Attention: sensitive permissions with unrestricted data scope.')
  }
  if (responsibilities.length === 0) {
    notes.push('No cross-module responsibilities assigned.')
  } else {
    notes.push(`${responsibilities.length} responsibility assignment(s) (labels only — do not replace approval engines).`)
  }

  const summary = [
    `${user.firstName} ${user.lastName}`,
    `${roles.length} role(s)`,
    `${permissions.length} permission(s)`,
    scopes.unrestricted ? 'unrestricted scope' : 'scoped',
    `${responsibilities.length} responsibility(ies)`,
  ].join(' · ')

  return {
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      status: user.status,
      department: user.department,
      departmentId: user.departmentId,
    },
    roles,
    permissions,
    permissionCount: permissions.length,
    sensitivePermissions,
    modules,
    scopes,
    responsibilities,
    explain: { summary, notes },
    generatedAt: new Date().toISOString(),
  }
}
