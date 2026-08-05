import { Prisma } from '@prisma/client'
import { prisma } from '../../config/prisma.js'
import { tenantActiveFilter } from '../../shared/index.js'
import { getPagination } from '../../utils/pagination.js'
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors.js'
import { applySalesFieldDefaults } from './item-sales-defaults.js'
import {
  legacyFieldsToConversionInputs,
  mapConversionRow,
  syncItemUomConversions,
  type ItemUomConversionInput,
} from './item-uom-conversion.service.js'
import type { ItemLookupQuery, ListItemsQuery } from './item.validation.js'
import { assertRawMaterialItemName } from './item-naming.rules.js'

const itemConversionInclude = {
  uomConversions: {
    include: { uom: { select: { id: true, code: true, name: true } } },
    orderBy: [{ isDefaultPurchase: 'desc' as const }, { uom: { code: 'asc' as const } }],
  },
} as const

function stripUomConversions(input: Record<string, unknown>): {
  data: Record<string, unknown>
  uomConversions?: ItemUomConversionInput[]
  hasUomConversions: boolean
} {
  const data = { ...input }
  const hasUomConversions = Object.prototype.hasOwnProperty.call(data, 'uomConversions')
  const raw = data.uomConversions
  delete data.uomConversions
  if (!hasUomConversions || !Array.isArray(raw)) {
    return { data, hasUomConversions: false }
  }
  return {
    data,
    hasUomConversions: true,
    uomConversions: raw.map((row) => ({
      uomId: String((row as { uomId?: string }).uomId ?? ''),
      conversionFactor: Number((row as { conversionFactor?: unknown }).conversionFactor ?? 1),
      isPurchaseAllowed: (row as { isPurchaseAllowed?: boolean }).isPurchaseAllowed,
      isDefaultPurchase: (row as { isDefaultPurchase?: boolean }).isDefaultPurchase,
    })),
  }
}

function attachUomConversions<T extends { uomConversions?: Array<Parameters<typeof mapConversionRow>[0]> }>(
  item: T,
) {
  const { uomConversions, ...rest } = item
  return {
    ...rest,
    uomConversions: (uomConversions ?? []).map(mapConversionRow),
  }
}

function normalizeNullableIds(input: Record<string, unknown>): Record<string, unknown> {
  const data = { ...input }
  for (const key of [
    'hsnId',
    'gstGroupId',
    'purchaseUomId',
    'salesUomId',
    'receivingToleranceId',
    'weightReceivingToleranceId',
    'weightUomId',
    'productionBomId',
    'qualityTestGroupCode',
    'routingNo',
    'drawingNo',
    'subAssemblyRule',
    'salesDescription',
  ] as const) {
    if (data[key] === '') data[key] = null
  }

  // Keep uomConversionFactor ↔ purchaseQtyPerUom in sync; force 1 when UOMs match.
  const baseUomId = data.baseUomId != null ? String(data.baseUomId) : null
  const purchaseUomId = data.purchaseUomId != null ? String(data.purchaseUomId) : null
  const rawFactor =
    data.uomConversionFactor !== undefined
      ? Number(data.uomConversionFactor)
      : data.purchaseQtyPerUom !== undefined
        ? Number(data.purchaseQtyPerUom)
        : undefined
  if (rawFactor !== undefined || baseUomId || purchaseUomId !== undefined) {
    const sameUom = !purchaseUomId || !baseUomId || purchaseUomId === baseUomId
    const factor = sameUom ? 1 : rawFactor !== undefined && rawFactor > 0 ? rawFactor : 1
    data.uomConversionFactor = factor
    data.purchaseQtyPerUom = factor
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
  let resolvedHsn: { gstGroupId: string } | null = null
  if (input.hsnId) {
    const hsn = await prisma.masterHsnCode.findFirst({
      where: { id: String(input.hsnId), ...tenantActiveFilter(tenantId) },
    })
    if (!hsn) throw new ValidationError('HSN code not found in tenant')
    resolvedHsn = hsn
  }
  if (input.gstGroupId) {
    const group = await prisma.masterGstGroup.findFirst({
      where: { id: String(input.gstGroupId), ...tenantActiveFilter(tenantId) },
    })
    if (!group) throw new ValidationError('GST group not found in tenant')
    if (resolvedHsn && resolvedHsn.gstGroupId !== String(input.gstGroupId)) {
      throw new ValidationError('HSN code does not belong to the selected GST group')
    }
  }
  if (input.receivingToleranceId) {
    const tol = await prisma.masterReceivingTolerance.findFirst({
      where: { id: String(input.receivingToleranceId), ...tenantActiveFilter(tenantId), status: 'ACTIVE' },
    })
    if (!tol) throw new ValidationError('Receiving tolerance not found or inactive in tenant')
  }
  if (input.weightReceivingToleranceId) {
    const tol = await prisma.masterReceivingTolerance.findFirst({
      where: {
        id: String(input.weightReceivingToleranceId),
        ...tenantActiveFilter(tenantId),
        status: 'ACTIVE',
      },
    })
    if (!tol) throw new ValidationError('Weight receiving tolerance not found or inactive in tenant')
  }
  if (input.weightUomId) {
    const uom = await prisma.masterUom.findFirst({
      where: { id: String(input.weightUomId), ...tenantActiveFilter(tenantId) },
    })
    if (!uom) throw new ValidationError('Weight UOM not found in tenant')
  }
}

async function syncReceivingToleranceLegacyPct(
  tenantId: string,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (data.receivingToleranceId === undefined) return data
  if (data.receivingToleranceId) {
    const tol = await prisma.masterReceivingTolerance.findFirst({
      where: { id: String(data.receivingToleranceId), ...tenantActiveFilter(tenantId), status: 'ACTIVE' },
      select: { percentage: true },
    })
    if (!tol) throw new ValidationError('Receiving tolerance not found or inactive in tenant')
    data.receivingTolerancePercentage = Number(tol.percentage)
  }
  return data
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
      include: itemConversionInclude,
    }),
    prisma.masterItem.count({ where }),
  ])

  return { items: items.map(attachUomConversions), total, page: query.page, limit: query.limit }
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
    include: itemConversionInclude,
  })
  if (!item) throw new NotFoundError('Item not found')
  return attachUomConversions(item)
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
  const { data: itemData, uomConversions, hasUomConversions } = stripUomConversions(data)
  data = itemData
  await assertTenantFk(tenantId, data)
  data = await syncReceivingToleranceLegacyPct(tenantId, data)
  data = await applyCategoryStockDefaults(tenantId, data, { isCreate: true })
  data = applySalesFieldDefaults(data, { isCreate: true })
  const baseUomId = String(data.baseUomId ?? '')
  if (!baseUomId) throw new ValidationError('baseUomId is required')

  assertRawMaterialItemName(
    String(data.name ?? ''),
    String(data.itemType ?? ''),
    data.productType != null ? String(data.productType) : undefined,
  )

  try {
    return await prisma.$transaction(async (tx) => {
      const record = await tx.masterItem.create({
        data: {
          tenantId,
          ...(data as Omit<Prisma.MasterItemUncheckedCreateInput, 'tenantId' | 'createdBy' | 'updatedBy'>),
          createdBy: userId,
          updatedBy: userId,
        },
      })
      const seedConversions =
        hasUomConversions
          ? uomConversions
          : legacyFieldsToConversionInputs(
              baseUomId,
              (data.purchaseUomId as string | null | undefined) ?? record.purchaseUomId,
              Number(data.uomConversionFactor ?? data.purchaseQtyPerUom ?? record.uomConversionFactor ?? 1),
            )
      const conversions = await syncItemUomConversions(
        tenantId,
        record.id,
        baseUomId,
        seedConversions,
        tx,
      )
      return { ...record, uomConversions: conversions }
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
  const existing = await getItem(tenantId, id)
  let data = normalizeNullableIds(input)
  const { data: itemData, uomConversions, hasUomConversions } = stripUomConversions(data)
  data = itemData
  await assertTenantFk(tenantId, data)
  data = await syncReceivingToleranceLegacyPct(tenantId, data)
  data = await applyCategoryStockDefaults(tenantId, data, { isCreate: false })
  data = applySalesFieldDefaults(data, { isCreate: false })
  const baseUomId =
    data.baseUomId != null
      ? String(data.baseUomId)
      : (await prisma.masterItem.findFirst({ where: { id, tenantId }, select: { baseUomId: true } }))?.baseUomId
  if (!baseUomId) throw new ValidationError('baseUomId is required')

  assertRawMaterialItemName(
    String(data.name ?? existing.name),
    String(data.itemType ?? existing.itemType),
    data.productType != null ? String(data.productType) : existing.productType,
  )

  try {
    return await prisma.$transaction(async (tx) => {
      const record = await tx.masterItem.update({
        where: { id, tenantId },
        data: {
          ...(data as Prisma.MasterItemUncheckedUpdateInput),
          updatedBy: userId,
        },
      })
      const conversions = hasUomConversions
        ? await syncItemUomConversions(tenantId, id, baseUomId, uomConversions, tx)
        : (
            await tx.masterItemUomConversion.findMany({
              where: { tenantId, itemId: id },
              include: { uom: { select: { id: true, code: true, name: true } } },
              orderBy: [{ isDefaultPurchase: 'desc' }, { uom: { code: 'asc' } }],
            })
          ).map(mapConversionRow)
      return { ...record, uomConversions: conversions }
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

export async function setItemImageUrl(
  tenantId: string,
  id: string,
  userId: string,
  imageUrl: string | null,
) {
  await getItem(tenantId, id)
  return prisma.masterItem.update({
    where: { id, tenantId },
    data: { imageUrl, updatedBy: userId },
  })
}
