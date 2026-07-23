import type { Prisma } from '@prisma/client'
import { prisma } from '../../config/database.js'
import { createAuditLog } from '../../services/audit.service.js'
import { ConflictError, NotFoundError } from '../../utils/errors.js'
import { buildPaginationMeta, getPagination } from '../../utils/pagination.js'
import type {
  CreateDepartmentInput,
  ListDepartmentsQuery,
  UpdateDepartmentInput,
} from './department.validation.js'

export interface SafeDepartment {
  id: string
  tenantId: string
  code: string
  name: string
  description: string | null
  isActive: boolean
  userCount: number
  createdAt: Date
  updatedAt: Date
}

interface AuditMeta {
  userId?: string
  ipAddress?: string | null
  userAgent?: string | null
}

function toSafe(
  row: {
    id: string
    tenantId: string
    code: string
    name: string
    description: string | null
    isActive: boolean
    createdAt: Date
    updatedAt: Date
    _count?: { users: number }
  },
): SafeDepartment {
  return {
    id: row.id,
    tenantId: row.tenantId,
    code: row.code,
    name: row.name,
    description: row.description,
    isActive: row.isActive,
    userCount: row._count?.users ?? 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function listDepartments(tenantId: string, query: ListDepartmentsQuery) {
  const { skip, take } = getPagination(query)
  const where: Prisma.DepartmentWhereInput = {
    tenantId,
    deletedAt: null,
    ...(query.active === 'true'
      ? { isActive: true }
      : query.active === 'false'
        ? { isActive: false }
        : {}),
    ...(query.search
      ? {
          OR: [
            { code: { contains: query.search } },
            { name: { contains: query.search } },
          ],
        }
      : {}),
  }

  const [items, total] = await prisma.$transaction([
    prisma.department.findMany({
      where,
      skip,
      take,
      include: { _count: { select: { users: true } } },
      orderBy: { [query.sortBy ?? 'name']: query.sortOrder },
    }),
    prisma.department.count({ where }),
  ])

  return {
    items: items.map(toSafe),
    meta: buildPaginationMeta(total, query.page, query.limit),
  }
}

export async function getDepartment(tenantId: string, departmentId: string): Promise<SafeDepartment> {
  const row = await prisma.department.findFirst({
    where: { id: departmentId, tenantId, deletedAt: null },
    include: { _count: { select: { users: true } } },
  })
  if (!row) throw new NotFoundError('Department not found')
  return toSafe(row)
}

export async function createDepartment(
  tenantId: string,
  input: CreateDepartmentInput,
  audit?: AuditMeta,
): Promise<SafeDepartment> {
  const existing = await prisma.department.findFirst({
    where: { tenantId, code: input.code, deletedAt: null },
  })
  if (existing) throw new ConflictError('Department code already exists')

  const row = await prisma.department.create({
    data: {
      tenantId,
      code: input.code.toUpperCase(),
      name: input.name,
      description: input.description,
      isActive: input.isActive ?? true,
      createdBy: audit?.userId,
    },
    include: { _count: { select: { users: true } } },
  })

  const safe = toSafe(row)
  await createAuditLog({
    tenantId,
    userId: audit?.userId ?? null,
    module: 'department',
    entity: 'Department',
    entityId: row.id,
    action: 'CREATE',
    newValues: safe,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })
  return safe
}

export async function updateDepartment(
  tenantId: string,
  departmentId: string,
  input: UpdateDepartmentInput,
  audit?: AuditMeta,
): Promise<SafeDepartment> {
  const existing = await prisma.department.findFirst({
    where: { id: departmentId, tenantId, deletedAt: null },
  })
  if (!existing) throw new NotFoundError('Department not found')

  if (input.code && input.code.toUpperCase() !== existing.code) {
    const dup = await prisma.department.findFirst({
      where: { tenantId, code: input.code.toUpperCase(), deletedAt: null, id: { not: departmentId } },
    })
    if (dup) throw new ConflictError('Department code already exists')
  }

  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.department.update({
      where: { id: departmentId },
      data: {
        ...(input.code ? { code: input.code.toUpperCase() } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        updatedBy: audit?.userId,
      },
      include: { _count: { select: { users: true } } },
    })

    // Keep legacy User.department string in sync when name changes
    if (input.name && input.name !== existing.name) {
      await tx.user.updateMany({
        where: { tenantId, departmentId },
        data: { department: input.name },
      })
    }

    return updated
  })

  const safe = toSafe(row)
  await createAuditLog({
    tenantId,
    userId: audit?.userId ?? null,
    module: 'department',
    entity: 'Department',
    entityId: departmentId,
    action: 'UPDATE',
    oldValues: existing,
    newValues: safe,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })
  return safe
}

export async function deleteDepartment(
  tenantId: string,
  departmentId: string,
  audit?: AuditMeta,
): Promise<SafeDepartment> {
  const existing = await prisma.department.findFirst({
    where: { id: departmentId, tenantId, deletedAt: null },
    include: { _count: { select: { users: true } } },
  })
  if (!existing) throw new NotFoundError('Department not found')

  const row = await prisma.$transaction(async (tx) => {
    await tx.user.updateMany({
      where: { tenantId, departmentId },
      data: { departmentId: null },
    })
    return tx.department.update({
      where: { id: departmentId },
      data: { deletedAt: new Date(), isActive: false, updatedBy: audit?.userId },
      include: { _count: { select: { users: true } } },
    })
  })

  const safe = toSafe(row)
  await createAuditLog({
    tenantId,
    userId: audit?.userId ?? null,
    module: 'department',
    entity: 'Department',
    entityId: departmentId,
    action: 'DELETE',
    oldValues: toSafe(existing),
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })
  return safe
}
