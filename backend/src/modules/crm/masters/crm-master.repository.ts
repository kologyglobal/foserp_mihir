import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import type { CreateCrmMasterInput, ListCrmMastersQuery, UpdateCrmMasterInput } from './crm-master.validation.js'
import type { CrmMasterKind } from './crm-master.constants.js'

function mapRow(row: {
  id: string
  kind: string
  code: string
  name: string
  description: string | null
  status: string
  sortOrder: number
  attributes: unknown
  isSystem: boolean
  createdBy: string | null
  updatedBy: string | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: row.id,
    kind: row.kind,
    code: row.code,
    name: row.name,
    description: row.description ?? undefined,
    status: row.status,
    sortOrder: row.sortOrder,
    attributes: (row.attributes ?? {}) as Record<string, string | number | boolean | null>,
    systemControlled: row.isSystem,
    createdBy: row.createdBy ?? undefined,
    modifiedBy: row.updatedBy ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listMasters(tenantId: string, kind: CrmMasterKind, query: ListCrmMastersQuery) {
  const { getPagination } = await import('../../../utils/pagination.js')
  const { skip, take } = getPagination(query)
  const where: Prisma.CrmMasterWhereInput = {
    ...tenantActiveFilter(tenantId),
    kind,
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? { OR: [{ code: { contains: query.search } }, { name: { contains: query.search } }] }
      : {}),
  }
  const [items, total] = await Promise.all([
    prisma.crmMaster.findMany({ where, skip, take, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.crmMaster.count({ where }),
  ])
  return { items: items.map(mapRow), total, page: query.page, limit: query.limit }
}

export async function lookupMasters(tenantId: string, kind: CrmMasterKind) {
  const rows = await prisma.crmMaster.findMany({
    where: { ...tenantActiveFilter(tenantId), kind, status: 'active' },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })
  return rows.map(mapRow)
}

export async function findMasterById(tenantId: string, kind: CrmMasterKind, id: string) {
  const row = await prisma.crmMaster.findFirst({ where: { id, kind, ...tenantActiveFilter(tenantId) } })
  return row ? mapRow(row) : null
}

export async function createMaster(tenantId: string, kind: CrmMasterKind, userId: string, input: CreateCrmMasterInput) {
  const row = await prisma.crmMaster.create({
    data: {
      tenantId,
      kind,
      code: input.code,
      name: input.name,
      description: input.description,
      status: input.status,
      sortOrder: input.sortOrder,
      attributes: input.attributes as Prisma.InputJsonValue,
      createdBy: userId,
      updatedBy: userId,
    },
  })
  return mapRow(row)
}

export async function updateMaster(
  tenantId: string,
  kind: CrmMasterKind,
  id: string,
  userId: string,
  input: UpdateCrmMasterInput,
) {
  const row = await prisma.crmMaster.update({
    where: { id, tenantId, kind },
    data: {
      ...(input.code !== undefined ? { code: input.code } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.attributes !== undefined ? { attributes: input.attributes as Prisma.InputJsonValue } : {}),
      updatedBy: userId,
    },
  })
  return mapRow(row)
}

export async function softDeleteMaster(tenantId: string, kind: CrmMasterKind, id: string, userId: string) {
  const row = await prisma.crmMaster.update({
    where: { id, tenantId, kind },
    data: { deletedAt: new Date(), updatedBy: userId, status: 'inactive' },
  })
  return mapRow(row)
}

export async function setMasterStatus(
  tenantId: string,
  kind: CrmMasterKind,
  id: string,
  userId: string,
  status: 'active' | 'inactive',
) {
  const row = await prisma.crmMaster.update({
    where: { id, tenantId, kind },
    data: { status, updatedBy: userId },
  })
  return mapRow(row)
}

export async function listAllMastersByTenant(tenantId: string) {
  const rows = await prisma.crmMaster.findMany({
    where: tenantActiveFilter(tenantId),
    orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }],
  })
  return rows.map(mapRow)
}

/** Insert any missing canonical seed rows (e.g. existing_customer added after tenant was first seeded). */
export async function ensureSeedRows(
  tenantId: string,
  userId: string | null,
  rows: Array<{
    kind: string
    code: string
    name: string
    sortOrder: number
    attributes?: Record<string, string | number | boolean | null>
    isSystem?: boolean
  }>,
) {
  for (const row of rows) {
    await prisma.crmMaster.upsert({
      where: {
        tenantId_kind_code: { tenantId, kind: row.kind, code: row.code },
      },
      create: {
        tenantId,
        kind: row.kind,
        code: row.code,
        name: row.name,
        sortOrder: row.sortOrder,
        attributes: (row.attributes ?? {}) as Prisma.InputJsonValue,
        isSystem: row.isSystem ?? false,
        status: 'active',
        createdBy: userId,
        updatedBy: userId,
      },
      update: {
        // Revive soft-deleted / inactive canonical rows so dropdowns stay complete
        deletedAt: null,
        status: 'active',
        name: row.name,
        sortOrder: row.sortOrder,
        attributes: (row.attributes ?? {}) as Prisma.InputJsonValue,
        isSystem: row.isSystem ?? false,
      },
    })
  }
}
