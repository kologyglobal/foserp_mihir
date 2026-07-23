import { prisma } from '../../config/database.js'
import { createAuditLog } from '../../services/audit.service.js'
import { NotFoundError, ValidationError } from '../../utils/errors.js'
import type { ReplaceUserScopesInput } from './scope.validation.js'

export interface UserDataScope {
  unrestricted: boolean
  legalEntities: Array<{
    id: string
    legalEntityId: string
    accessLevel: string
    isDefault: boolean
    code: string
    name: string
  }>
  branches: Array<{ id: string; branchId: string; code: string; name: string; legalEntityId: string }>
  warehouses: Array<{ id: string; warehouseId: string; code: string; name: string }>
}

interface AuditMeta {
  userId?: string
  ipAddress?: string | null
  userAgent?: string | null
}

/**
 * Fail-open: empty grants ⇒ unrestricted within the tenant.
 * Modules should call `scopeAllows` / `loadUserDataScope` when they opt into IAM scoping.
 */
export async function loadUserDataScope(tenantId: string, userId: string): Promise<UserDataScope> {
  const user = await prisma.user.findFirst({ where: { id: userId, tenantId, deletedAt: null } })
  if (!user) throw new NotFoundError('User not found')

  const [leRows, branchRows, whRows] = await Promise.all([
    prisma.userLegalEntityAccess.findMany({
      where: { tenantId, userId, deletedAt: null },
      include: { legalEntity: { select: { code: true, displayName: true, legalName: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.userBranchAccess.findMany({
      where: { tenantId, userId, deletedAt: null },
      include: { branch: { select: { code: true, name: true, legalEntityId: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.userWarehouseAccess.findMany({
      where: { tenantId, userId, deletedAt: null },
      include: { warehouse: { select: { code: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  const legalEntities = leRows.map((r) => ({
    id: r.id,
    legalEntityId: r.legalEntityId,
    accessLevel: r.accessLevel,
    isDefault: r.isDefault,
    code: r.legalEntity.code,
    name: r.legalEntity.displayName || r.legalEntity.legalName,
  }))
  const branches = branchRows.map((r) => ({
    id: r.id,
    branchId: r.branchId,
    code: r.branch.code,
    name: r.branch.name,
    legalEntityId: r.branch.legalEntityId,
  }))
  const warehouses = whRows.map((r) => ({
    id: r.id,
    warehouseId: r.warehouseId,
    code: r.warehouse.code,
    name: r.warehouse.name,
  }))

  return {
    unrestricted: legalEntities.length === 0 && branches.length === 0 && warehouses.length === 0,
    legalEntities,
    branches,
    warehouses,
  }
}

export function scopeAllows(
  scope: UserDataScope,
  dims: { legalEntityId?: string | null; branchId?: string | null; warehouseId?: string | null },
): boolean {
  if (scope.unrestricted) return true
  if (dims.legalEntityId) {
    if (scope.legalEntities.length > 0 && !scope.legalEntities.some((x) => x.legalEntityId === dims.legalEntityId)) {
      return false
    }
  }
  if (dims.branchId) {
    if (scope.branches.length > 0 && !scope.branches.some((x) => x.branchId === dims.branchId)) {
      return false
    }
  }
  if (dims.warehouseId) {
    if (scope.warehouses.length > 0 && !scope.warehouses.some((x) => x.warehouseId === dims.warehouseId)) {
      return false
    }
  }
  return true
}

export async function replaceUserScopes(
  tenantId: string,
  userId: string,
  input: ReplaceUserScopesInput,
  audit?: AuditMeta,
): Promise<UserDataScope> {
  const user = await prisma.user.findFirst({ where: { id: userId, tenantId, deletedAt: null } })
  if (!user) throw new NotFoundError('User not found')

  const defaults = input.legalEntities.filter((x) => x.isDefault)
  if (defaults.length > 1) {
    throw new ValidationError('Only one default legal entity is allowed')
  }

  const leIds = [...new Set(input.legalEntities.map((x) => x.legalEntityId))]
  const branchIds = [...new Set(input.branchIds)]
  const warehouseIds = [...new Set(input.warehouseIds)]

  if (leIds.length) {
    const count = await prisma.legalEntity.count({
      where: { tenantId, id: { in: leIds }, isActive: true },
    })
    if (count !== leIds.length) throw new ValidationError('One or more legal entities are invalid')
  }
  if (branchIds.length) {
    const branches = await prisma.branch.findMany({
      where: { tenantId, id: { in: branchIds }, isActive: true },
      select: { id: true, legalEntityId: true },
    })
    if (branches.length !== branchIds.length) throw new ValidationError('One or more branches are invalid')
    if (leIds.length) {
      const orphan = branches.find((b) => !leIds.includes(b.legalEntityId))
      if (orphan) {
        throw new ValidationError('Branch scope must belong to a granted legal entity when LE scope is set')
      }
    }
  }
  if (warehouseIds.length) {
    const count = await prisma.masterWarehouse.count({
      where: { tenantId, id: { in: warehouseIds }, deletedAt: null, status: 'ACTIVE' },
    })
    if (count !== warehouseIds.length) throw new ValidationError('One or more warehouses are invalid')
  }

  await prisma.$transaction(async (tx) => {
    const now = new Date()
    await tx.userLegalEntityAccess.updateMany({
      where: { tenantId, userId, deletedAt: null },
      data: { deletedAt: now, updatedBy: audit?.userId },
    })
    await tx.userBranchAccess.updateMany({
      where: { tenantId, userId, deletedAt: null },
      data: { deletedAt: now, updatedBy: audit?.userId },
    })
    await tx.userWarehouseAccess.updateMany({
      where: { tenantId, userId, deletedAt: null },
      data: { deletedAt: now, updatedBy: audit?.userId },
    })

    for (const le of input.legalEntities) {
      const existing = await tx.userLegalEntityAccess.findFirst({
        where: { tenantId, userId, legalEntityId: le.legalEntityId },
      })
      if (existing) {
        await tx.userLegalEntityAccess.update({
          where: { id: existing.id },
          data: {
            deletedAt: null,
            accessLevel: le.accessLevel ?? 'TRANSACT',
            isDefault: le.isDefault ?? false,
            updatedBy: audit?.userId,
          },
        })
      } else {
        await tx.userLegalEntityAccess.create({
          data: {
            tenantId,
            userId,
            legalEntityId: le.legalEntityId,
            accessLevel: le.accessLevel ?? 'TRANSACT',
            isDefault: le.isDefault ?? false,
            createdBy: audit?.userId,
          },
        })
      }
    }

    for (const branchId of branchIds) {
      const existing = await tx.userBranchAccess.findFirst({ where: { tenantId, userId, branchId } })
      if (existing) {
        await tx.userBranchAccess.update({
          where: { id: existing.id },
          data: { deletedAt: null, updatedBy: audit?.userId },
        })
      } else {
        await tx.userBranchAccess.create({
          data: { tenantId, userId, branchId, createdBy: audit?.userId },
        })
      }
    }

    for (const warehouseId of warehouseIds) {
      const existing = await tx.userWarehouseAccess.findFirst({ where: { tenantId, userId, warehouseId } })
      if (existing) {
        await tx.userWarehouseAccess.update({
          where: { id: existing.id },
          data: { deletedAt: null, updatedBy: audit?.userId },
        })
      } else {
        await tx.userWarehouseAccess.create({
          data: { tenantId, userId, warehouseId, createdBy: audit?.userId },
        })
      }
    }
  })

  const scope = await loadUserDataScope(tenantId, userId)
  await createAuditLog({
    tenantId,
    userId: audit?.userId ?? null,
    module: 'scope',
    entity: 'UserDataScope',
    entityId: userId,
    action: 'UPDATE',
    newValues: scope,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })
  return scope
}
