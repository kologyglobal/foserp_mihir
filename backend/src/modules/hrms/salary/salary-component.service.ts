import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { createAuditLog } from '../../../services/audit.service.js'
import { ConflictError, NotFoundError } from '../../../utils/errors.js'
import { getPagination } from '../../../utils/pagination.js'
import type { UserDataScope } from '../../access-scopes/scope.service.js'
import { assertHrAccess, hrLegalEntityScopeWhere } from '../hrms-scope.js'
import type {
  CreateComponentInput,
  ListComponentsQuery,
  UpdateComponentInput,
} from './salary.schemas.js'

interface AuditMeta {
  userId?: string
  ipAddress?: string | null
  userAgent?: string | null
}

function dec(n: Prisma.Decimal | number | string | null | undefined): number | null {
  if (n == null) return null
  return Number(n)
}

function mapComponent(row: {
  id: string
  code: string
  name: string
  legalEntityId: string | null
  type: string
  calculationType: string
  taxable: boolean
  affectsGross: boolean
  affectsNet: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    legalEntityId: row.legalEntityId,
    type: row.type,
    calculationType: row.calculationType,
    taxable: row.taxable,
    affectsGross: row.affectsGross,
    affectsNet: row.affectsNet,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function componentWhere(tenantId: string, scope: UserDataScope, query: ListComponentsQuery): Prisma.HrSalaryComponentWhereInput {
  return {
    tenantId,
    deletedAt: null,
    ...(query.legalEntityId ? { legalEntityId: query.legalEntityId } : {}),
    ...(query.type ? { type: query.type } : {}),
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    ...(query.search
      ? { OR: [{ code: { contains: query.search } }, { name: { contains: query.search } }] }
      : {}),
    ...hrLegalEntityScopeWhere(scope),
  }
}

export async function listComponents(tenantId: string, scope: UserDataScope, query: ListComponentsQuery) {
  const { page, limit, skip } = getPagination(query)
  const where = componentWhere(tenantId, scope, query)
  const [total, rows] = await Promise.all([
    prisma.hrSalaryComponent.count({ where }),
    prisma.hrSalaryComponent.findMany({ where, orderBy: { code: 'asc' }, skip, take: limit }),
  ])
  return { items: rows.map(mapComponent), total, page, limit }
}

export async function getComponent(tenantId: string, componentId: string, scope: UserDataScope) {
  const row = await prisma.hrSalaryComponent.findFirst({
    where: { id: componentId, tenantId, deletedAt: null, ...hrLegalEntityScopeWhere(scope) },
  })
  if (!row) throw new NotFoundError('Salary component not found')
  return mapComponent(row)
}

export async function createComponent(
  tenantId: string,
  input: CreateComponentInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  if (input.legalEntityId) {
    assertHrAccess(scope, { legalEntityId: input.legalEntityId })
  }
  const code = input.code.trim().toUpperCase()
  const clash = await prisma.hrSalaryComponent.findFirst({ where: { tenantId, code, deletedAt: null } })
  if (clash) throw new ConflictError(`Salary component ${code} already exists`)

  const row = await prisma.hrSalaryComponent.create({
    data: {
      tenantId,
      code,
      name: input.name.trim(),
      legalEntityId: input.legalEntityId ?? null,
      type: input.type,
      calculationType: input.calculationType,
      taxable: input.taxable ?? true,
      affectsGross: input.affectsGross ?? true,
      affectsNet: input.affectsNet ?? true,
      isActive: input.isActive ?? true,
      createdBy: audit?.userId,
      updatedBy: audit?.userId,
    },
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrSalaryComponent',
    entityId: row.id,
    action: 'CREATE',
    newValues: { code: row.code, name: row.name },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapComponent(row)
}

export async function updateComponent(
  tenantId: string,
  componentId: string,
  input: UpdateComponentInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  const existing = await prisma.hrSalaryComponent.findFirst({
    where: { id: componentId, tenantId, deletedAt: null, ...hrLegalEntityScopeWhere(scope) },
  })
  if (!existing) throw new NotFoundError('Salary component not found')

  const nextLe = input.legalEntityId !== undefined ? input.legalEntityId : existing.legalEntityId
  if (nextLe) assertHrAccess(scope, { legalEntityId: nextLe })

  if (input.code) {
    const code = input.code.trim().toUpperCase()
    const clash = await prisma.hrSalaryComponent.findFirst({
      where: { tenantId, code, deletedAt: null, NOT: { id: componentId } },
    })
    if (clash) throw new ConflictError(`Salary component ${code} already exists`)
  }

  const row = await prisma.hrSalaryComponent.update({
    where: { id: componentId },
    data: {
      ...(input.code ? { code: input.code.trim().toUpperCase() } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.legalEntityId !== undefined ? { legalEntityId: input.legalEntityId } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.calculationType !== undefined ? { calculationType: input.calculationType } : {}),
      ...(input.taxable !== undefined ? { taxable: input.taxable } : {}),
      ...(input.affectsGross !== undefined ? { affectsGross: input.affectsGross } : {}),
      ...(input.affectsNet !== undefined ? { affectsNet: input.affectsNet } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedBy: audit?.userId,
    },
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrSalaryComponent',
    entityId: row.id,
    action: 'UPDATE',
    oldValues: { code: existing.code, isActive: existing.isActive },
    newValues: { code: row.code, isActive: row.isActive },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapComponent(row)
}

export { dec as decSalaryAmount }
