import { Prisma } from '@prisma/client'
import { prisma } from '../../config/database.js'
import { tenantActiveFilter } from '../../shared/index.js'
import { getPagination } from '../../utils/pagination.js'
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors.js'
import { applySalesFieldDefaults } from './item-sales-defaults.js'
import type { ItemLookupQuery, ListItemsQuery } from './item.validation.js'

function normalizeNullableIds(input: Record<string, unknown>): Record<string, unknown> {
  const data = { ...input }
  for (const key of [
    'hsnId',
    'gstGroupId',
    'purchaseUomId',
    'salesUomId',
    'productionBomId',
    'qualityTestGroupCode',
    'routingNo',
    'drawingNo',
    'subAssemblyRule',
    'salesDescription',
  ] as const) {
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
  if (input.salesUomId) {
    const uom = await prisma.masterUom.findFirst({
      where: { id: String(input.salesUomId), ...tenantActiveFilter(tenantId) },
    })
    if (!uom) throw new ValidationError('Sales UOM not found in tenant')
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
  if ('salesAllowed' in query && query.salesAllowed !== undefined) {
    where.salesAllowed = query.salesAllowed
  }
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
        defaultSalesRate: true,
        salesAllowed: true,
        defaultFulfilmentMethod: true,
        salesUomId: true,
        salesLeadDays: true,
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

async function applyCategoryStockDefaults(
  tenantId: string,
  input: Record<string, unknown>,
  opts: { isCreate: boolean },
): Promise<Record<string, unknown>> {
  const data = { ...input }
  if (!data.categoryId) return data

  const category = await prisma.masterItemCategory.findFirst({
    where: { id: String(data.categoryId), ...tenantActiveFilter(tenantId) },
    select: {
      code: true,
      stockPolicy: true,
      defaultIsStockable: true,
      defaultInventoryType: true,
    },
  })
  if (!category) throw new ValidationError('Item category not found in tenant')

  const policy = category.stockPolicy || 'REQUIRED'

  if (opts.isCreate) {
    if (data.isStockable === undefined) data.isStockable = category.defaultIsStockable
    if (data.inventoryType === undefined || data.inventoryType === null || data.inventoryType === '') {
      data.inventoryType = category.defaultInventoryType
    }
  }

  const isStockable = data.isStockable === undefined ? undefined : Boolean(data.isStockable)
  const inventoryType = data.inventoryType === undefined ? undefined : String(data.inventoryType)

  if (policy === 'FORBIDDEN') {
    if (isStockable === true) {
      throw new ValidationError('Service / non-stock categories cannot be stockable — stock is not affected')
    }
    if (inventoryType === 'inventory') {
      throw new ValidationError('Service category items must use inventory type "service" (non-stock)')
    }
    if (opts.isCreate || data.isStockable !== undefined) data.isStockable = false
    if (opts.isCreate || data.inventoryType !== undefined) data.inventoryType = 'service'
  } else if (policy === 'REQUIRED') {
    if (isStockable === false) {
      throw new ValidationError(
        `Category ${category.code} requires stockable items (RM / BO / FG / CON / SCRAP)`,
      )
    }
    if (inventoryType === 'service' || inventoryType === 'non_inventory') {
      throw new ValidationError(
        `Category ${category.code} requires inventory-type stockable items`,
      )
    }
    if (opts.isCreate || data.isStockable !== undefined) data.isStockable = true
    if (opts.isCreate || data.inventoryType !== undefined) data.inventoryType = 'inventory'
  }
  // OPTIONAL (SFG): allow stockable inventory or logical non_inventory; never "service".
  else if (policy === 'OPTIONAL') {
    if (inventoryType === 'service') {
      throw new ValidationError('Semi-finished items cannot use inventory type "service"')
    }
    if (isStockable === false && (inventoryType === undefined || inventoryType === 'inventory')) {
      data.inventoryType = 'non_inventory'
    }
  }

  return data
}

export async function createItem(
  tenantId: string,
  userId: string,
  input: Record<string, unknown>,
) {
  let data = normalizeNullableIds(input)
  await assertTenantFk(tenantId, data)
  data = await applyCategoryStockDefaults(tenantId, data, { isCreate: true })
  data = applySalesFieldDefaults(data, { isCreate: true })
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
  let data = normalizeNullableIds(input)
  await assertTenantFk(tenantId, data)
  data = await applyCategoryStockDefaults(tenantId, data, { isCreate: false })
  data = applySalesFieldDefaults(data, { isCreate: false })
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
