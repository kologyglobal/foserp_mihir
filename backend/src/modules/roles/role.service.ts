import { prisma } from '../../config/prisma.js'
import { createAuditLog } from '../../services/audit.service.js'
import {
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../utils/errors.js'
import type { CreateRoleInput, UpdateRoleInput } from './role.validation.js'
import {
  ensureViewDependencies,
  filterAssignablePermissions,
  tenantWouldRetainAdminAfterRoleChange,
} from './effective-access.service.js'

export interface RoleSummary {
  id: string
  tenantId: string | null
  name: string
  description: string | null
  isSystem: boolean
  permissionCount: number
}

export interface RoleDetail {
  id: string
  tenantId: string | null
  name: string
  description: string | null
  isSystem: boolean
  userCount: number
  permissions: string[]
  createdAt: Date
  updatedAt: Date
}

export interface PermissionCatalogEntry {
  id: string
  name: string
  module: string
  description: string | null
}

interface AuditMeta {
  userId?: string
  ipAddress?: string | null
  userAgent?: string | null
}

export interface ActorAccess {
  userId: string
  roles: string[]
  permissions: string[]
}

const roleDetailInclude = {
  rolePermissions: { include: { permission: true } },
  _count: { select: { userRoles: true } },
} as const

function toRoleDetail(role: {
  id: string
  tenantId: string | null
  name: string
  description: string | null
  isSystem: boolean
  createdAt: Date
  updatedAt: Date
  rolePermissions: Array<{ permission: { name: string } }>
  _count: { userRoles: number }
}): RoleDetail {
  return {
    id: role.id,
    tenantId: role.tenantId,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    userCount: role._count.userRoles,
    permissions: role.rolePermissions.map((rp) => rp.permission.name).sort(),
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  }
}

function assertNotSystemRole(isSystem: boolean, action: 'modified' | 'deleted'): void {
  if (isSystem) {
    throw new AuthorizationError(`System roles cannot be ${action}`)
  }
}

async function resolvePermissionIds(permissionNames: string[]): Promise<string[]> {
  if (!permissionNames.length) return []
  const permissions = await prisma.permission.findMany({
    where: { name: { in: permissionNames } },
  })
  if (permissions.length !== permissionNames.length) {
    const found = new Set(permissions.map((p) => p.name))
    const missing = permissionNames.filter((name) => !found.has(name))
    throw new ValidationError(
      'Unknown permission name(s)',
      missing.map((field) => ({ field, message: 'Unknown permission' })),
    )
  }
  return permissions.map((p) => p.id)
}

async function preparePermissionNames(
  requested: readonly string[],
  actor?: ActorAccess,
): Promise<string[]> {
  const expanded = ensureViewDependencies(requested)
  const known = await prisma.permission.findMany({
    where: { name: { in: expanded } },
    select: { name: true },
  })
  const knownSet = new Set(known.map((p) => p.name))
  const missingRequested = requested.filter((name) => !knownSet.has(name))
  if (missingRequested.length) {
    throw new ValidationError(
      'Unknown permission name(s)',
      missingRequested.map((field) => ({ field, message: 'Unknown permission' })),
    )
  }
  // Keep requested names + only those auto-view deps that exist in the catalog.
  const withExistingViews = expanded.filter((name) => knownSet.has(name))

  if (!actor) return withExistingViews

  const { allowed, rejected } = filterAssignablePermissions(
    withExistingViews,
    actor.permissions,
    actor.roles,
  )
  if (rejected.length) {
    throw new AuthorizationError(
      `Cannot assign permissions you do not hold: ${rejected.slice(0, 8).join(', ')}${rejected.length > 8 ? '…' : ''}`,
    )
  }
  return allowed
}

export async function listRolesForTenant(tenantId: string): Promise<RoleSummary[]> {
  const roles = await prisma.role.findMany({
    where: {
      deletedAt: null,
      OR: [{ tenantId }, { tenantId: null }],
    },
    include: {
      _count: { select: { rolePermissions: true } },
    },
    orderBy: [{ tenantId: 'asc' }, { name: 'asc' }],
  })

  return roles.map((role) => ({
    id: role.id,
    tenantId: role.tenantId,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    permissionCount: role._count.rolePermissions,
  }))
}

export async function getRoleById(tenantId: string, roleId: string): Promise<RoleDetail> {
  const role = await prisma.role.findFirst({
    where: { id: roleId, deletedAt: null, OR: [{ tenantId }, { tenantId: null }] },
    include: roleDetailInclude,
  })
  if (!role) {
    throw new NotFoundError('Role not found')
  }
  return toRoleDetail(role)
}

export async function listPermissionCatalog(): Promise<PermissionCatalogEntry[]> {
  const permissions = await prisma.permission.findMany({
    orderBy: [{ module: 'asc' }, { name: 'asc' }],
  })
  return permissions.map((p) => ({
    id: p.id,
    name: p.name,
    module: p.module,
    description: p.description,
  }))
}

export async function createRole(
  tenantId: string,
  input: CreateRoleInput,
  audit?: AuditMeta,
  actor?: ActorAccess,
): Promise<RoleDetail> {
  const existing = await prisma.role.findFirst({
    where: { tenantId, name: input.name, deletedAt: null },
  })
  if (existing) {
    throw new ConflictError('Role with this name already exists')
  }

  const permissionNames = await preparePermissionNames(input.permissionNames, actor)
  const permissionIds = await resolvePermissionIds(permissionNames)

  const role = await prisma.role.create({
    data: {
      tenantId,
      name: input.name,
      description: input.description,
      isSystem: false,
      createdBy: audit?.userId,
      rolePermissions: permissionIds.length
        ? { create: permissionIds.map((permissionId) => ({ permissionId })) }
        : undefined,
    },
    include: roleDetailInclude,
  })

  const detail = toRoleDetail(role)

  await createAuditLog({
    tenantId,
    userId: audit?.userId ?? null,
    module: 'role',
    entity: 'Role',
    entityId: role.id,
    action: 'CREATE',
    newValues: detail,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return detail
}

export async function updateRole(
  tenantId: string,
  roleId: string,
  input: UpdateRoleInput,
  audit?: AuditMeta,
  actor?: ActorAccess,
): Promise<RoleDetail> {
  const existing = await prisma.role.findFirst({
    where: { id: roleId, tenantId, deletedAt: null },
    include: roleDetailInclude,
  })
  if (!existing) {
    throw new NotFoundError('Role not found')
  }
  assertNotSystemRole(existing.isSystem, 'modified')

  if (input.name && input.name !== existing.name) {
    const duplicate = await prisma.role.findFirst({
      where: { tenantId, name: input.name, deletedAt: null },
    })
    if (duplicate && duplicate.id !== roleId) {
      throw new ConflictError('Role with this name already exists')
    }
  }

  let permissionIds: string[] | undefined
  let nextPermissionNames: string[] | undefined
  if (input.permissionNames !== undefined) {
    nextPermissionNames = await preparePermissionNames(input.permissionNames, actor)
    const retainsAdmin = await tenantWouldRetainAdminAfterRoleChange(
      tenantId,
      roleId,
      nextPermissionNames,
    )
    if (!retainsAdmin) {
      throw new ConflictError(
        'Cannot strip permissions that would leave the tenant without an administrator',
      )
    }
    permissionIds = await resolvePermissionIds(nextPermissionNames)
  }

  const role = await prisma.role.update({
    where: { id: roleId },
    data: {
      name: input.name,
      description: input.description,
      updatedBy: audit?.userId,
      ...(permissionIds !== undefined
        ? {
            rolePermissions: {
              deleteMany: {},
              create: permissionIds.map((permissionId) => ({ permissionId })),
            },
          }
        : {}),
    },
    include: roleDetailInclude,
  })

  const detail = toRoleDetail(role)

  await createAuditLog({
    tenantId,
    userId: audit?.userId ?? null,
    module: 'role',
    entity: 'Role',
    entityId: roleId,
    action: 'UPDATE',
    oldValues: toRoleDetail(existing),
    newValues: detail,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return detail
}

export async function deleteRole(
  tenantId: string,
  roleId: string,
  audit?: AuditMeta,
): Promise<RoleDetail> {
  const existing = await prisma.role.findFirst({
    where: { id: roleId, tenantId, deletedAt: null },
    include: roleDetailInclude,
  })
  if (!existing) {
    throw new NotFoundError('Role not found')
  }
  assertNotSystemRole(existing.isSystem, 'deleted')
  if (existing._count.userRoles > 0) {
    throw new ConflictError('Role is assigned to users; unassign before deleting')
  }

  const retainsAdmin = await tenantWouldRetainAdminAfterRoleChange(tenantId, roleId, null)
  if (!retainsAdmin) {
    throw new ConflictError(
      'Cannot delete a role that would leave the tenant without an administrator',
    )
  }

  const role = await prisma.role.update({
    where: { id: roleId },
    data: { deletedAt: new Date(), updatedBy: audit?.userId },
    include: roleDetailInclude,
  })

  const detail = toRoleDetail(role)

  await createAuditLog({
    tenantId,
    userId: audit?.userId ?? null,
    module: 'role',
    entity: 'Role',
    entityId: roleId,
    action: 'DELETE',
    oldValues: toRoleDetail(existing),
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return detail
}

export async function cloneRole(
  tenantId: string,
  roleId: string,
  name: string | undefined,
  audit?: AuditMeta,
  actor?: ActorAccess,
): Promise<RoleDetail> {
  const source = await getRoleById(tenantId, roleId)
  const cloneName = (name?.trim() || `${source.name} (copy)`).slice(0, 100)
  return createRole(
    tenantId,
    {
      name: cloneName,
      description: source.description
        ? `Cloned from ${source.name}: ${source.description}`
        : `Cloned from ${source.name}`,
      permissionNames: source.permissions,
    },
    audit,
    actor,
  )
}
