import type { Prisma } from '@prisma/client'
import { prisma } from '../../config/database.js'
import { createAuditLog } from '../../services/audit.service.js'
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors.js'
import { buildPaginationMeta, getPagination } from '../../utils/pagination.js'
import type {
  AssignResponsibilityInput,
  CreateResponsibilityInput,
  ListResponsibilitiesQuery,
  UpdateResponsibilityInput,
} from './responsibility.validation.js'

export interface SafeResponsibility {
  id: string
  tenantId: string | null
  code: string
  name: string
  module: string
  description: string | null
  isSystem: boolean
  isActive: boolean
  assignmentCount: number
  createdAt: Date
  updatedAt: Date
}

export interface SafeUserResponsibility {
  id: string
  tenantId: string
  userId: string
  responsibilityId: string
  legalEntityId: string | null
  branchId: string | null
  departmentId: string | null
  warehouseId: string | null
  externalRefType: string | null
  externalRefId: string | null
  createdAt: Date
  responsibility: {
    id: string
    code: string
    name: string
    module: string
    isSystem: boolean
  }
}

interface AuditMeta {
  userId?: string
  ipAddress?: string | null
  userAgent?: string | null
}

function toSafe(
  row: {
    id: string
    tenantId: string | null
    code: string
    name: string
    module: string
    description: string | null
    isSystem: boolean
    isActive: boolean
    createdAt: Date
    updatedAt: Date
    _count?: { assignments: number }
  },
): SafeResponsibility {
  return {
    id: row.id,
    tenantId: row.tenantId,
    code: row.code,
    name: row.name,
    module: row.module,
    description: row.description,
    isSystem: row.isSystem,
    isActive: row.isActive,
    assignmentCount: row._count?.assignments ?? 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function toAssignmentSafe(
  row: {
    id: string
    tenantId: string
    userId: string
    responsibilityId: string
    legalEntityId: string | null
    branchId: string | null
    departmentId: string | null
    warehouseId: string | null
    externalRefType: string | null
    externalRefId: string | null
    createdAt: Date
    responsibility: {
      id: string
      code: string
      name: string
      module: string
      isSystem: boolean
    }
  },
): SafeUserResponsibility {
  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    responsibilityId: row.responsibilityId,
    legalEntityId: row.legalEntityId,
    branchId: row.branchId,
    departmentId: row.departmentId,
    warehouseId: row.warehouseId,
    externalRefType: row.externalRefType,
    externalRefId: row.externalRefId,
    createdAt: row.createdAt,
    responsibility: row.responsibility,
  }
}

export async function listResponsibilities(tenantId: string, query: ListResponsibilitiesQuery) {
  const { skip, take } = getPagination(query)
  const where: Prisma.ResponsibilityWhereInput = {
    deletedAt: null,
    OR: [{ tenantId: null }, { tenantId }],
    ...(query.active === 'true'
      ? { isActive: true }
      : query.active === 'false'
        ? { isActive: false }
        : {}),
    ...(query.module ? { module: query.module } : {}),
    ...(query.search
      ? {
          AND: [
            {
              OR: [
                { code: { contains: query.search } },
                { name: { contains: query.search } },
              ],
            },
          ],
        }
      : {}),
  }

  const [items, total] = await prisma.$transaction([
    prisma.responsibility.findMany({
      where,
      skip,
      take,
      include: { _count: { select: { assignments: { where: { tenantId, deletedAt: null } } } } },
      orderBy: [{ isSystem: 'desc' }, { [query.sortBy ?? 'name']: query.sortOrder }],
    }),
    prisma.responsibility.count({ where }),
  ])

  return {
    items: items.map(toSafe),
    meta: buildPaginationMeta(total, query.page, query.limit),
  }
}

export async function createResponsibility(
  tenantId: string,
  input: CreateResponsibilityInput,
  audit?: AuditMeta,
): Promise<SafeResponsibility> {
  const code = input.code.toUpperCase()
  const dup = await prisma.responsibility.findFirst({
    where: {
      deletedAt: null,
      code,
      OR: [{ tenantId }, { tenantId: null }],
    },
  })
  if (dup) throw new ConflictError('Responsibility code already exists')

  const row = await prisma.responsibility.create({
    data: {
      tenantId,
      code,
      name: input.name,
      module: input.module.toLowerCase(),
      description: input.description,
      isSystem: false,
      isActive: input.isActive ?? true,
      createdBy: audit?.userId,
    },
    include: { _count: { select: { assignments: true } } },
  })

  const safe = toSafe(row)
  await createAuditLog({
    tenantId,
    userId: audit?.userId ?? null,
    module: 'responsibility',
    entity: 'Responsibility',
    entityId: row.id,
    action: 'CREATE',
    newValues: safe,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })
  return safe
}

export async function updateResponsibility(
  tenantId: string,
  responsibilityId: string,
  input: UpdateResponsibilityInput,
  audit?: AuditMeta,
): Promise<SafeResponsibility> {
  const existing = await prisma.responsibility.findFirst({
    where: {
      id: responsibilityId,
      deletedAt: null,
      OR: [{ tenantId }, { tenantId: null }],
    },
  })
  if (!existing) throw new NotFoundError('Responsibility not found')
  if (existing.tenantId === null || existing.isSystem) {
    throw new ValidationError('System responsibilities are read-only')
  }
  if (existing.tenantId !== tenantId) {
    throw new NotFoundError('Responsibility not found')
  }

  const row = await prisma.responsibility.update({
    where: { id: responsibilityId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.module !== undefined ? { module: input.module.toLowerCase() } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedBy: audit?.userId,
    },
    include: { _count: { select: { assignments: { where: { tenantId, deletedAt: null } } } } },
  })

  const safe = toSafe(row)
  await createAuditLog({
    tenantId,
    userId: audit?.userId ?? null,
    module: 'responsibility',
    entity: 'Responsibility',
    entityId: responsibilityId,
    action: 'UPDATE',
    oldValues: existing,
    newValues: safe,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })
  return safe
}

export async function deleteResponsibility(
  tenantId: string,
  responsibilityId: string,
  audit?: AuditMeta,
): Promise<SafeResponsibility> {
  const existing = await prisma.responsibility.findFirst({
    where: { id: responsibilityId, tenantId, deletedAt: null },
    include: { _count: { select: { assignments: { where: { tenantId, deletedAt: null } } } } },
  })
  if (!existing) throw new NotFoundError('Responsibility not found')
  if (existing.isSystem) throw new ValidationError('System responsibilities cannot be deleted')

  const row = await prisma.$transaction(async (tx) => {
    await tx.userResponsibility.updateMany({
      where: { tenantId, responsibilityId, deletedAt: null },
      data: { deletedAt: new Date(), updatedBy: audit?.userId },
    })
    return tx.responsibility.update({
      where: { id: responsibilityId },
      data: { deletedAt: new Date(), isActive: false, updatedBy: audit?.userId },
      include: { _count: { select: { assignments: true } } },
    })
  })

  const safe = toSafe(row)
  await createAuditLog({
    tenantId,
    userId: audit?.userId ?? null,
    module: 'responsibility',
    entity: 'Responsibility',
    entityId: responsibilityId,
    action: 'DELETE',
    oldValues: toSafe(existing),
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })
  return safe
}

export async function listUserResponsibilities(tenantId: string, userId: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, tenantId, deletedAt: null } })
  if (!user) throw new NotFoundError('User not found')

  const rows = await prisma.userResponsibility.findMany({
    where: { tenantId, userId, deletedAt: null },
    include: {
      responsibility: { select: { id: true, code: true, name: true, module: true, isSystem: true } },
    },
    orderBy: { createdAt: 'asc' },
  })
  return rows.map(toAssignmentSafe)
}

export async function assignUserResponsibility(
  tenantId: string,
  userId: string,
  input: AssignResponsibilityInput,
  audit?: AuditMeta,
): Promise<SafeUserResponsibility> {
  const user = await prisma.user.findFirst({ where: { id: userId, tenantId, deletedAt: null } })
  if (!user) throw new NotFoundError('User not found')

  const responsibility = await prisma.responsibility.findFirst({
    where: {
      id: input.responsibilityId,
      deletedAt: null,
      isActive: true,
      OR: [{ tenantId: null }, { tenantId }],
    },
  })
  if (!responsibility) throw new NotFoundError('Responsibility not found')

  if (input.departmentId) {
    const dept = await prisma.department.findFirst({
      where: { id: input.departmentId, tenantId, deletedAt: null },
    })
    if (!dept) throw new ValidationError('Invalid department')
  }
  if (input.legalEntityId) {
    const le = await prisma.legalEntity.findFirst({
      where: { id: input.legalEntityId, tenantId, isActive: true },
    })
    if (!le) throw new ValidationError('Invalid legal entity')
  }
  if (input.branchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: input.branchId, tenantId, isActive: true },
    })
    if (!branch) throw new ValidationError('Invalid branch')
  }
  if (input.warehouseId) {
    const wh = await prisma.masterWarehouse.findFirst({
      where: { id: input.warehouseId, tenantId, deletedAt: null, status: 'ACTIVE' },
    })
    if (!wh) throw new ValidationError('Invalid warehouse')
  }

  const row = await prisma.userResponsibility.create({
    data: {
      tenantId,
      userId,
      responsibilityId: input.responsibilityId,
      legalEntityId: input.legalEntityId ?? null,
      branchId: input.branchId ?? null,
      departmentId: input.departmentId ?? null,
      warehouseId: input.warehouseId ?? null,
      externalRefType: input.externalRefType ?? null,
      externalRefId: input.externalRefId ?? null,
      createdBy: audit?.userId,
    },
    include: {
      responsibility: { select: { id: true, code: true, name: true, module: true, isSystem: true } },
    },
  })

  const safe = toAssignmentSafe(row)
  await createAuditLog({
    tenantId,
    userId: audit?.userId ?? null,
    module: 'responsibility',
    entity: 'UserResponsibility',
    entityId: row.id,
    action: 'CREATE',
    newValues: safe,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })
  return safe
}

export async function removeUserResponsibility(
  tenantId: string,
  userId: string,
  assignmentId: string,
  audit?: AuditMeta,
): Promise<SafeUserResponsibility> {
  const existing = await prisma.userResponsibility.findFirst({
    where: { id: assignmentId, tenantId, userId, deletedAt: null },
    include: {
      responsibility: { select: { id: true, code: true, name: true, module: true, isSystem: true } },
    },
  })
  if (!existing) throw new NotFoundError('Assignment not found')

  const row = await prisma.userResponsibility.update({
    where: { id: assignmentId },
    data: { deletedAt: new Date(), updatedBy: audit?.userId },
    include: {
      responsibility: { select: { id: true, code: true, name: true, module: true, isSystem: true } },
    },
  })

  const safe = toAssignmentSafe(row)
  await createAuditLog({
    tenantId,
    userId: audit?.userId ?? null,
    module: 'responsibility',
    entity: 'UserResponsibility',
    entityId: assignmentId,
    action: 'DELETE',
    oldValues: toAssignmentSafe(existing),
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })
  return safe
}
