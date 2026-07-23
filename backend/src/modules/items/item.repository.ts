import { Prisma } from '@prisma/client'
import { prisma } from '../../config/database.js'
import { tenantActiveFilter } from '../../shared/index.js'
import { getPagination } from '../../utils/pagination.js'
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors.js'
import type { ItemLookupQuery, ListItemsQuery } from './item.validation.js'

function normalizeNullableIds(input: Record<string, unknown>): Record<string, unknown> {
  const data = { ...input }
  for (const key of ['hsnId', 'gstGroupId', 'purchaseUomId', 'productionBomId', 'qualityTestGroupCode', 'routingNo', 'drawingNo', 'subAssemblyRule'] as const) {
    if (data[key] === '') data[key] = null
  }
  return data
}

async function assertTenantFk(tenantId: string, input: Record<string, unknown>): Promise<void> {
  if (input.categoryId) {
    const category = await prisma.masterItemCategory.findFirst({
      where: { id: String(input.categoryId), ...tenantActiveFilter(tenantId) },
    })
    if (!category) throw new ValidationError('Item category not found in tenant')
  }
  if (input.baseUomId) {
    const uom = await prisma.masterUom.findFirst({
      where: { id: String(input.baseUomId), ...tenantActiveFilter(tenantId) },
    })
    if (!uom) throw new ValidationError('Base UOM not found in tenant')
  }
  if (input.purchaseUomId) {
    const uom = await prisma.masterUom.findFirst({
      where: { id: String(input.purchaseUomId), ...tenantActiveFilter(tenantId) },
    })
    if (!uom) throw new ValidationError('Purchase UOM not found in tenant')
  }
  if (input.hsnId) {
    const hsn = await prisma.masterHsnCode.findFirst({
      where: { id: String(input.hsnId), ...tenantActiveFilter(tenantId) },
    })
    if (!hsn) throw new ValidationError('HSN code not found in tenant')
  }
  if (input.gstGroupId) {
    const group = await prisma.masterGstGroup.findFirst({
      where: { id: String(input.gstGroupId), ...tenantActiveFilter(tenantId) },
    })
    if (!group) throw new ValidationError('GST group not found in tenant')
  }
}

function buildWhere(tenantId: string, query: ListItemsQuery | ItemLookupQuery, activeOnly?: boolean) {
  const where: Record<string, unknown> = {
    ...tenantActiveFilter(tenantId),
  }
  if ('status' in query && query.status) where.status = query.status
  if ('categoryId' in query && query.categoryId) where.categoryId = query.categoryId
  const itemTypes = 'itemTypes' in query ? query.itemTypes : undefined
  if (itemTypes && itemTypes.length > 0) where.itemType = { in: itemTypes }
  else if (query.itemType) where.itemType = query.itemType
  if (activeOnly === true) where.status = 'ACTIVE'
  if (query.search) {
    where.OR = [{ code: { contains: query.search } }, { name: { contains: query.search } }]
  }
  return where
}

export async function listItems(tenantId: string, query: ListItemsQuery) {
  const { skip, take } = getPagination(query)
  const where = buildWhere(tenantId, query)
  const sortField = query.sortBy === 'code' || query.sortBy === 'name' ? query.sortBy : 'createdAt'

  const [items, total] = await Promise.all([
    prisma.masterItem.findMany({
      where,
      skip,
      take,
      orderBy: { [sortField]: query.sortOrder },
    }),
    prisma.masterItem.count({ where }),
  ])

  return { items, total, page: query.page, limit: query.limit }
}

export async function listItemLookups(tenantId: string, query: ItemLookupQuery) {
  const { skip, take } = getPagination(query)
  const where = buildWhere(tenantId, query, query.activeOnly)

  const [items, total] = await Promise.all([
    prisma.masterItem.findMany({
      where,
      skip,
      take,
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        itemType: true,
        productType: true,
        baseUomId: true,
        categoryId: true,
        hsnCode: true,
        hsnId: true,
        gstGroupId: true,
        standardRate: true,
        status: true,
      },
    }),
    prisma.masterItem.count({ where }),
  ])

  return { items, total, page: query.page, limit: query.limit }
}

export async function getItem(tenantId: string, id: string) {
  const item = await prisma.masterItem.findFirst({
    where: { id, ...tenantActiveFilter(tenantId) },
  })
  if (!item) throw new NotFoundError('Item not found')
  return item
}

export async function createItem(
  tenantId: string,
  userId: string,
  input: Record<string, unknown>,
) {
  const data = normalizeNullableIds(input)
  await assertTenantFk(tenantId, data)
  try {
    return await prisma.masterItem.create({
      data: {
        tenantId,
        ...(data as Omit<Prisma.MasterItemUncheckedCreateInput, 'tenantId' | 'createdBy' | 'updatedBy'>),
        createdBy: userId,
        updatedBy: userId,
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('Duplicate item code in tenant')
    }
    throw err
  }
}

export async function updateItem(
  tenantId: string,
  id: string,
  userId: string,
  input: Record<string, unknown>,
) {
  await getItem(tenantId, id)
  const data = normalizeNullableIds(input)
  await assertTenantFk(tenantId, data)
  try {
    return await prisma.masterItem.update({
      where: { id, tenantId },
      data: { ...data, updatedBy: userId },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('Duplicate item code in tenant')
    }
    throw err
  }
}

export async function softDeleteItem(tenantId: string, id: string, userId: string) {
  await getItem(tenantId, id)
  return prisma.masterItem.update({
    where: { id, tenantId },
    data: { deletedAt: new Date(), status: 'INACTIVE', updatedBy: userId },
  })
}

export async function setItemStatus(
  tenantId: string,
  id: string,
  userId: string,
  status: 'ACTIVE' | 'INACTIVE',
) {
  await getItem(tenantId, id)
  return prisma.masterItem.update({
    where: { id, tenantId },
    data: { status, updatedBy: userId },
  })
}
