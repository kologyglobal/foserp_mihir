import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { createAuditLog } from '../../../services/audit.service.js'
import { ConflictError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { buildPaginationMeta, getPagination } from '../../../utils/pagination.js'
import type { UserDataScope } from '../../access-scopes/scope.service.js'
import { assertHrAccess, hrScopeWhere } from '../hrms-scope.js'
import type {
  CreateDesignationInput,
  ListDesignationsQuery,
  UpdateDesignationInput,
} from './designation.schemas.js'

interface AuditMeta {
  userId?: string
  ipAddress?: string | null
  userAgent?: string | null
}

export async function listDesignations(tenantId: string, scope: UserDataScope, query: ListDesignationsQuery) {
  const { skip, take } = getPagination(query)
  const where: Prisma.HrDesignationWhereInput = {
    tenantId,
    deletedAt: null,
    ...hrScopeWhere(scope),
    ...(query.legalEntityId ? { legalEntityId: query.legalEntityId } : {}),
    ...(query.active === 'true' ? { isActive: true } : query.active === 'false' ? { isActive: false } : {}),
    ...(query.search
      ? { OR: [{ code: { contains: query.search } }, { name: { contains: query.search } }] }
      : {}),
  }

  const [items, total] = await prisma.$transaction([
    prisma.hrDesignation.findMany({
      where,
      skip,
      take,
      include: { _count: { select: { employees: { where: { deletedAt: null } } } } },
      orderBy: { [query.sortBy ?? 'name']: query.sortOrder },
    }),
    prisma.hrDesignation.count({ where }),
  ])

  return {
    items: items.map((row) => ({ ...row, employeeCount: row._count.employees })),
    meta: buildPaginationMeta(total, query.page, query.limit),
  }
}

export async function getDesignation(tenantId: string, scope: UserDataScope, designationId: string) {
  const row = await prisma.hrDesignation.findFirst({
    where: { id: designationId, tenantId, deletedAt: null },
    include: { _count: { select: { employees: { where: { deletedAt: null } } } } },
  })
  if (!row) throw new NotFoundError('Designation not found')
  assertHrAccess(scope, { legalEntityId: row.legalEntityId })
  return { ...row, employeeCount: row._count.employees }
}

export async function createDesignation(
  tenantId: string,
  scope: UserDataScope,
  input: CreateDesignationInput,
  audit?: AuditMeta,
) {
  if (input.legalEntityId) {
    assertHrAccess(scope, { legalEntityId: input.legalEntityId })
    const le = await prisma.legalEntity.findFirst({ where: { id: input.legalEntityId, tenantId, isActive: true } })
    if (!le) throw new ValidationError('Legal entity is invalid')
  }

  const code = input.code.toUpperCase()
  const existing = await prisma.hrDesignation.findFirst({ where: { tenantId, code, deletedAt: null } })
  if (existing) throw new ConflictError('Designation code already exists')

  const row = await prisma.hrDesignation.create({
    data: {
      tenantId,
      legalEntityId: input.legalEntityId ?? null,
      code,
      name: input.name,
      description: input.description,
      level: input.level,
      isActive: input.isActive ?? true,
      createdBy: audit?.userId,
    },
  })

  await createAuditLog({
    tenantId,
    userId: audit?.userId ?? null,
    module: 'hrms',
    entity: 'HrDesignation',
    entityId: row.id,
    action: 'CREATE',
    newValues: row,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })
  return { ...row, employeeCount: 0 }
}

export async function updateDesignation(
  tenantId: string,
  scope: UserDataScope,
  designationId: string,
  input: UpdateDesignationInput,
  audit?: AuditMeta,
) {
  const existing = await prisma.hrDesignation.findFirst({ where: { id: designationId, tenantId, deletedAt: null } })
  if (!existing) throw new NotFoundError('Designation not found')
  assertHrAccess(scope, { legalEntityId: existing.legalEntityId })

  let nextLegalEntityId = existing.legalEntityId
  if (input.legalEntityId !== undefined) {
    nextLegalEntityId = input.legalEntityId
    if (nextLegalEntityId) {
      assertHrAccess(scope, { legalEntityId: nextLegalEntityId })
      const le = await prisma.legalEntity.findFirst({ where: { id: nextLegalEntityId, tenantId, isActive: true } })
      if (!le) throw new ValidationError('Legal entity is invalid')
    }
  }

  let code = existing.code
  if (input.code && input.code.toUpperCase() !== existing.code) {
    code = input.code.toUpperCase()
    const dup = await prisma.hrDesignation.findFirst({
      where: { tenantId, code, deletedAt: null, id: { not: designationId } },
    })
    if (dup) throw new ConflictError('Designation code already exists')
  }

  const row = await prisma.hrDesignation.update({
    where: { id: designationId },
    data: {
      code,
      legalEntityId: nextLegalEntityId,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.level !== undefined ? { level: input.level } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedBy: audit?.userId,
    },
    include: { _count: { select: { employees: { where: { deletedAt: null } } } } },
  })

  await createAuditLog({
    tenantId,
    userId: audit?.userId ?? null,
    module: 'hrms',
    entity: 'HrDesignation',
    entityId: designationId,
    action: 'UPDATE',
    oldValues: existing,
    newValues: row,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })
  return { ...row, employeeCount: row._count.employees }
}
