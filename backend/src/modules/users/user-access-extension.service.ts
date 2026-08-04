import { z } from 'zod'
import { prisma } from '../../config/prisma.js'
import { NotFoundError, ValidationError } from '../../utils/errors.js'
import { createAuditLog } from '../../services/audit.service.js'

interface AuditMeta {
  userId?: string
  ipAddress?: string | null
  userAgent?: string | null
}

export const setOverrideSchema = z.object({
  permissionName: z.string().min(1),
  effect: z.enum(['ALLOW', 'DENY']),
  reason: z.string().max(500).optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
})

export const copyAccessSchema = z.object({
  fromUserId: z.string().uuid(),
  includeRoles: z.boolean().optional().default(true),
  includeScopes: z.boolean().optional().default(true),
  includeOverrides: z.boolean().optional().default(true),
  includeDataAccessLevel: z.boolean().optional().default(true),
})

export const bulkUsersSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum([
    'assign_role',
    'remove_role',
    'activate',
    'deactivate',
    'revoke_sessions',
    'set_data_access_level',
    'assign_branch',
    'assign_warehouse',
  ]),
  roleId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  dataAccessLevel: z
    .enum(['OWN', 'TEAM', 'DEPARTMENT', 'BRANCH', 'LEGAL_ENTITY', 'WAREHOUSE', 'ALL'])
    .optional(),
})

export async function listUserOverrides(tenantId: string, userId: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, tenantId, deletedAt: null } })
  if (!user) throw new NotFoundError('User not found')

  const rows = await prisma.userPermissionOverride.findMany({
    where: { tenantId, userId, deletedAt: null },
    include: { permission: true },
    orderBy: { updatedAt: 'desc' },
  })
  return rows.map((r) => ({
    id: r.id,
    permissionName: r.permission.name,
    module: r.permission.module,
    effect: r.effect,
    reason: r.reason,
    expiresAt: r.expiresAt,
    updatedAt: r.updatedAt,
  }))
}

export async function upsertUserOverride(
  tenantId: string,
  userId: string,
  input: z.infer<typeof setOverrideSchema>,
  audit: AuditMeta,
) {
  const user = await prisma.user.findFirst({ where: { id: userId, tenantId, deletedAt: null } })
  if (!user) throw new NotFoundError('User not found')
  const permission = await prisma.permission.findUnique({ where: { name: input.permissionName } })
  if (!permission) throw new ValidationError(`Unknown permission: ${input.permissionName}`)

  const row = await prisma.userPermissionOverride.upsert({
    where: {
      tenantId_userId_permissionId: {
        tenantId,
        userId,
        permissionId: permission.id,
      },
    },
    create: {
      tenantId,
      userId,
      permissionId: permission.id,
      effect: input.effect,
      reason: input.reason ?? null,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      createdBy: audit.userId,
      updatedBy: audit.userId,
    },
    update: {
      effect: input.effect,
      reason: input.reason ?? null,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      updatedBy: audit.userId,
      deletedAt: null,
    },
    include: { permission: true },
  })

  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'user',
    entity: 'UserPermissionOverride',
    entityId: userId,
    action: 'UPSERT',
    newValues: { permission: input.permissionName, effect: input.effect },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })

  return {
    id: row.id,
    permissionName: row.permission.name,
    effect: row.effect,
    reason: row.reason,
    expiresAt: row.expiresAt,
  }
}

export async function removeUserOverride(
  tenantId: string,
  userId: string,
  permissionName: string,
  audit: AuditMeta,
) {
  const permission = await prisma.permission.findUnique({ where: { name: permissionName } })
  if (!permission) throw new NotFoundError('Permission not found')
  const existing = await prisma.userPermissionOverride.findFirst({
    where: { tenantId, userId, permissionId: permission.id, deletedAt: null },
  })
  if (!existing) throw new NotFoundError('Override not found')
  await prisma.userPermissionOverride.update({
    where: { id: existing.id },
    data: { deletedAt: new Date(), updatedBy: audit.userId },
  })
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'user',
    entity: 'UserPermissionOverride',
    entityId: userId,
    action: 'DELETE',
    newValues: { permission: permissionName },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return { ok: true as const }
}

export async function previewCopyAccess(tenantId: string, toUserId: string, fromUserId: string) {
  if (toUserId === fromUserId) throw new ValidationError('Source and target user must differ')
  const [from, to] = await Promise.all([
    prisma.user.findFirst({
      where: { id: fromUserId, tenantId, deletedAt: null },
      include: {
        userRoles: { include: { role: true } },
        legalEntityAccess: { where: { deletedAt: null } },
        branchAccess: { where: { deletedAt: null } },
        warehouseAccess: { where: { deletedAt: null } },
        permissionOverrides: {
          where: { deletedAt: null },
          include: { permission: true },
        },
      },
    }),
    prisma.user.findFirst({ where: { id: toUserId, tenantId, deletedAt: null } }),
  ])
  if (!from || !to) throw new NotFoundError('User not found')
  return {
    from: {
      id: from.id,
      name: `${from.firstName} ${from.lastName}`,
      email: from.email,
      dataAccessLevel: from.dataAccessLevel,
      roles: from.userRoles.map((r) => ({ id: r.role.id, name: r.role.name })),
      legalEntityIds: from.legalEntityAccess.map((x) => x.legalEntityId),
      branchIds: from.branchAccess.map((x) => x.branchId),
      warehouseIds: from.warehouseAccess.map((x) => x.warehouseId),
      overrides: from.permissionOverrides.map((o) => ({
        permissionName: o.permission.name,
        effect: o.effect,
      })),
    },
    to: { id: to.id, name: `${to.firstName} ${to.lastName}`, email: to.email },
  }
}

export async function applyCopyAccess(
  tenantId: string,
  toUserId: string,
  input: z.infer<typeof copyAccessSchema>,
  audit: AuditMeta,
) {
  const preview = await previewCopyAccess(tenantId, toUserId, input.fromUserId)
  const from = preview.from

  await prisma.$transaction(async (tx) => {
    if (input.includeRoles) {
      await tx.userRole.deleteMany({ where: { userId: toUserId, tenantId } })
      for (const role of from.roles) {
        await tx.userRole.create({
          data: {
            userId: toUserId,
            roleId: role.id,
            tenantId,
            createdBy: audit.userId,
          },
        })
      }
    }

    if (input.includeDataAccessLevel) {
      await tx.user.update({
        where: { id: toUserId },
        data: { dataAccessLevel: from.dataAccessLevel as never, updatedBy: audit.userId },
      })
    }

    if (input.includeScopes) {
      await tx.userLegalEntityAccess.updateMany({
        where: { tenantId, userId: toUserId, deletedAt: null },
        data: { deletedAt: new Date() },
      })
      await tx.userBranchAccess.updateMany({
        where: { tenantId, userId: toUserId, deletedAt: null },
        data: { deletedAt: new Date() },
      })
      await tx.userWarehouseAccess.updateMany({
        where: { tenantId, userId: toUserId, deletedAt: null },
        data: { deletedAt: new Date() },
      })
      for (const legalEntityId of from.legalEntityIds) {
        await tx.userLegalEntityAccess.create({
          data: { tenantId, userId: toUserId, legalEntityId, createdBy: audit.userId, updatedBy: audit.userId },
        })
      }
      for (const branchId of from.branchIds) {
        await tx.userBranchAccess.create({
          data: { tenantId, userId: toUserId, branchId, createdBy: audit.userId, updatedBy: audit.userId },
        })
      }
      for (const warehouseId of from.warehouseIds) {
        await tx.userWarehouseAccess.create({
          data: { tenantId, userId: toUserId, warehouseId, createdBy: audit.userId, updatedBy: audit.userId },
        })
      }
    }

    if (input.includeOverrides) {
      await tx.userPermissionOverride.updateMany({
        where: { tenantId, userId: toUserId, deletedAt: null },
        data: { deletedAt: new Date() },
      })
      for (const o of from.overrides) {
        const perm = await tx.permission.findUnique({ where: { name: o.permissionName } })
        if (!perm) continue
        await tx.userPermissionOverride.create({
          data: {
            tenantId,
            userId: toUserId,
            permissionId: perm.id,
            effect: o.effect as 'ALLOW' | 'DENY',
            createdBy: audit.userId,
            updatedBy: audit.userId,
          },
        })
      }
    }
  })

  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'user',
    entity: 'User',
    entityId: toUserId,
    action: 'COPY_ACCESS',
    newValues: { fromUserId: input.fromUserId, ...input },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })

  return { ok: true as const, appliedFrom: from.id }
}

export async function bulkUserActions(
  tenantId: string,
  input: z.infer<typeof bulkUsersSchema>,
  audit: AuditMeta,
) {
  const users = await prisma.user.findMany({
    where: { tenantId, id: { in: input.userIds }, deletedAt: null },
    select: { id: true },
  })
  if (users.length === 0) throw new ValidationError('No matching users')
  const ids = users.map((u) => u.id)
  let affected = 0

  switch (input.action) {
    case 'activate': {
      const r = await prisma.user.updateMany({
        where: { id: { in: ids }, tenantId },
        data: { status: 'ACTIVE', updatedBy: audit.userId },
      })
      affected = r.count
      break
    }
    case 'deactivate': {
      const r = await prisma.user.updateMany({
        where: { id: { in: ids }, tenantId },
        data: { status: 'INACTIVE', updatedBy: audit.userId },
      })
      affected = r.count
      break
    }
    case 'set_data_access_level': {
      if (!input.dataAccessLevel) throw new ValidationError('dataAccessLevel required')
      const r = await prisma.user.updateMany({
        where: { id: { in: ids }, tenantId },
        data: { dataAccessLevel: input.dataAccessLevel as never, updatedBy: audit.userId },
      })
      affected = r.count
      break
    }
    case 'assign_role': {
      if (!input.roleId) throw new ValidationError('roleId required')
      const role = await prisma.role.findFirst({
        where: {
          id: input.roleId,
          deletedAt: null,
          OR: [{ tenantId }, { tenantId: null }],
        },
      })
      if (!role) throw new NotFoundError('Role not found')
      for (const userId of ids) {
        await prisma.userRole.upsert({
          where: { userId_roleId: { userId, roleId: role.id } },
          create: { userId, roleId: role.id, tenantId, createdBy: audit.userId },
          update: {},
        })
        affected += 1
      }
      break
    }
    case 'remove_role': {
      if (!input.roleId) throw new ValidationError('roleId required')
      const r = await prisma.userRole.deleteMany({
        where: { tenantId, roleId: input.roleId, userId: { in: ids } },
      })
      affected = r.count
      break
    }
    case 'revoke_sessions': {
      const r = await prisma.refreshToken.updateMany({
        where: { userId: { in: ids }, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      affected = r.count
      break
    }
    case 'assign_branch': {
      if (!input.branchId) throw new ValidationError('branchId required')
      const branch = await prisma.branch.findFirst({
        where: { id: input.branchId, tenantId, isActive: true },
      })
      if (!branch) throw new NotFoundError('Branch not found')
      for (const userId of ids) {
        const existing = await prisma.userBranchAccess.findFirst({
          where: { tenantId, userId, branchId: input.branchId },
        })
        if (existing) {
          await prisma.userBranchAccess.update({
            where: { id: existing.id },
            data: { deletedAt: null, updatedBy: audit.userId },
          })
        } else {
          await prisma.userBranchAccess.create({
            data: {
              tenantId,
              userId,
              branchId: input.branchId,
              createdBy: audit.userId,
              updatedBy: audit.userId,
            },
          })
        }
        affected += 1
      }
      break
    }
    case 'assign_warehouse': {
      if (!input.warehouseId) throw new ValidationError('warehouseId required')
      const wh = await prisma.masterWarehouse.findFirst({
        where: { id: input.warehouseId, tenantId, deletedAt: null, status: 'ACTIVE' },
      })
      if (!wh) throw new NotFoundError('Warehouse not found')
      for (const userId of ids) {
        const existing = await prisma.userWarehouseAccess.findFirst({
          where: { tenantId, userId, warehouseId: input.warehouseId },
        })
        if (existing) {
          await prisma.userWarehouseAccess.update({
            where: { id: existing.id },
            data: { deletedAt: null, updatedBy: audit.userId },
          })
        } else {
          await prisma.userWarehouseAccess.create({
            data: {
              tenantId,
              userId,
              warehouseId: input.warehouseId,
              createdBy: audit.userId,
              updatedBy: audit.userId,
            },
          })
        }
        affected += 1
      }
      break
    }
    default:
      throw new ValidationError('Unsupported bulk action')
  }

  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'user',
    entity: 'User',
    entityId: ids[0],
    action: 'BULK',
    newValues: { action: input.action, count: affected, userIds: ids },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })

  return { affected, action: input.action }
}

export async function updateUserDataAccessLevel(
  tenantId: string,
  userId: string,
  dataAccessLevel: string,
  audit: AuditMeta,
) {
  const user = await prisma.user.findFirst({ where: { id: userId, tenantId, deletedAt: null } })
  if (!user) throw new NotFoundError('User not found')
  await prisma.user.update({
    where: { id: userId },
    data: { dataAccessLevel: dataAccessLevel as never, updatedBy: audit.userId },
  })
  return { id: userId, dataAccessLevel }
}
