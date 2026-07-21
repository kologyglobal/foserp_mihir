import { Prisma } from '@prisma/client'
import { prisma } from '../../config/database.js'
import { tenantActiveFilter } from '../../shared/index.js'
import { getPagination } from '../../utils/pagination.js'
import type { MasterResourceConfig } from './master.registry.js'
import type { ListMastersQuery } from './master.validation.js'
import { createGstRateSchema } from './master.validation.js'
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors.js'

type Delegate = {
  findMany: (args: unknown) => Promise<unknown[]>
  findFirst: (args: unknown) => Promise<unknown | null>
  count: (args: unknown) => Promise<number>
  create: (args: unknown) => Promise<unknown>
  update: (args: unknown) => Promise<unknown>
}

function delegate(config: MasterResourceConfig): Delegate {
  return (prisma as unknown as Record<string, Delegate>)[config.prismaModel]
}

function parseDateOnly(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) throw new ValidationError('Invalid date value')
  return date
}

function normalizeInput(config: MasterResourceConfig, input: Record<string, unknown>): Record<string, unknown> {
  const data = { ...input }
  if (config.slug === 'gst-rates') {
    if (data.dateFrom !== undefined) data.dateFrom = parseDateOnly(data.dateFrom)
    if (data.dateTo !== undefined) data.dateTo = parseDateOnly(data.dateTo)
  }
  if (config.slug === 'item-categories') {
    if (data.parentId === '') data.parentId = null
    if (data.defaultWarehouseId === '') data.defaultWarehouseId = null
  }
  if (config.slug === 'warehouses' && data.plantId === '') data.plantId = null
  if (config.slug === 'products') {
    if (data.fgItemId === '') data.fgItemId = null
    if (data.baseUomId === '') data.baseUomId = null
    if (data.details === undefined) data.details = {}
  }
  return data
}

function validateGstRatePayload(input: Record<string, unknown>): void {
  const parsed = createGstRateSchema.safeParse({
    code: input.code ?? 'TEMP',
    gstGroupId: input.gstGroupId ?? '00000000-0000-4000-8000-000000000001',
    fromState: input.fromState ?? '',
    locationStateCode: input.locationStateCode ?? '',
    dateFrom: input.dateFrom instanceof Date ? input.dateFrom.toISOString().slice(0, 10) : input.dateFrom ?? '',
    dateTo:
      input.dateTo instanceof Date
        ? input.dateTo.toISOString().slice(0, 10)
        : input.dateTo === null
          ? null
          : input.dateTo,
    sgst: input.sgst ?? 0,
    cgst: input.cgst ?? 0,
    igst: input.igst ?? 0,
    status: input.status,
  })
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid GST rate'
    throw new ValidationError(message)
  }
}

function buildWhere(config: MasterResourceConfig, tenantId: string, query: ListMastersQuery): Record<string, unknown> {
  const isLocationLike = config.slug === 'locations' || config.slug === 'storage-locations'
  const where: Record<string, unknown> = {
    ...tenantActiveFilter(tenantId),
    ...(query.status ? { status: query.status } : {}),
    ...(query.stateId && config.slug === 'cities' ? { stateId: query.stateId } : {}),
    ...(query.warehouseId && (isLocationLike || config.slug === 'bins') ? { warehouseId: query.warehouseId } : {}),
    ...(query.plantId && config.slug === 'warehouses' ? { plantId: query.plantId } : {}),
    ...(query.storageLocationId && config.slug === 'bins' ? { storageLocationId: query.storageLocationId } : {}),
    ...(query.gstGroupId && (config.slug === 'hsn-sac' || config.slug === 'gst-rates')
      ? { gstGroupId: query.gstGroupId }
      : {}),
    ...(query.parentId && config.slug === 'item-categories' ? { parentId: query.parentId } : {}),
  }

  if (query.search) {
    if (config.slug === 'cities') {
      where.name = { contains: query.search }
    } else if (config.slug === 'hsn-sac' || config.slug === 'gst-groups') {
      where.OR = [{ code: { contains: query.search } }, { description: { contains: query.search } }]
    } else if (config.slug === 'gst-rates') {
      where.OR = [
        { code: { contains: query.search } },
        { fromState: { contains: query.search } },
        { locationStateCode: { contains: query.search } },
      ]
    } else {
      where.OR = [{ code: { contains: query.search } }, { name: { contains: query.search } }]
    }
  }

  return where
}

async function assertTenantRecord(
  finder: () => Promise<unknown | null>,
  message: string,
): Promise<void> {
  const record = await finder()
  if (!record) throw new ValidationError(message)
}

async function assertTenantFk(
  tenantId: string,
  config: MasterResourceConfig,
  input: Record<string, unknown>,
): Promise<void> {
  if (config.slug === 'cities' && input.stateId) {
    await assertTenantRecord(
      () =>
        prisma.masterState.findFirst({
          where: { id: String(input.stateId), ...tenantActiveFilter(tenantId) },
        }),
      'State not found in tenant',
    )
  }
  if ((config.slug === 'locations' || config.slug === 'storage-locations') && input.warehouseId) {
    await assertTenantRecord(
      () =>
        prisma.masterWarehouse.findFirst({
          where: { id: String(input.warehouseId), ...tenantActiveFilter(tenantId) },
        }),
      'Warehouse not found in tenant',
    )
  }
  if (config.slug === 'warehouses' && input.plantId) {
    await assertTenantRecord(
      () =>
        prisma.masterPlant.findFirst({
          where: { id: String(input.plantId), ...tenantActiveFilter(tenantId), status: 'ACTIVE' },
        }),
      'Plant not found in tenant',
    )
  }
  if (config.slug === 'bins') {
    if (input.warehouseId) {
      await assertTenantRecord(
        () =>
          prisma.masterWarehouse.findFirst({
            where: { id: String(input.warehouseId), ...tenantActiveFilter(tenantId), status: 'ACTIVE' },
          }),
        'Warehouse not found in tenant',
      )
    }
    if (input.storageLocationId) {
      const location = await prisma.masterLocation.findFirst({
        where: { id: String(input.storageLocationId), ...tenantActiveFilter(tenantId), status: 'ACTIVE' },
      })
      if (!location) throw new ValidationError('Storage location not found in tenant')
      if (input.warehouseId && location.warehouseId !== String(input.warehouseId)) {
        throw new ValidationError('Storage location does not belong to the selected warehouse')
      }
    }
  }
  if (config.slug === 'item-categories') {
    if (input.parentId) {
      await assertTenantRecord(
        () =>
          prisma.masterItemCategory.findFirst({
            where: { id: String(input.parentId), ...tenantActiveFilter(tenantId) },
          }),
        'Parent category not found in tenant',
      )
    }
    if (input.defaultWarehouseId) {
      await assertTenantRecord(
        () =>
          prisma.masterWarehouse.findFirst({
            where: { id: String(input.defaultWarehouseId), ...tenantActiveFilter(tenantId) },
          }),
        'Warehouse not found in tenant',
      )
    }
  }
  if ((config.slug === 'hsn-sac' || config.slug === 'gst-rates') && input.gstGroupId) {
    await assertTenantRecord(
      () =>
        prisma.masterGstGroup.findFirst({
          where: { id: String(input.gstGroupId), ...tenantActiveFilter(tenantId) },
        }),
      'GST group not found in tenant',
    )
  }
}

async function assertNotReferenced(
  tenantId: string,
  config: MasterResourceConfig,
  id: string,
): Promise<void> {
  if (config.slug === 'countries') {
    const vendorCount = await prisma.masterVendor.count({
      where: { tenantId, countryId: id, deletedAt: null },
    })
    if (vendorCount > 0) throw new ConflictError('Country is referenced by vendors')
  }
  if (config.slug === 'states') {
    const cityCount = await prisma.masterCity.count({
      where: { tenantId, stateId: id, deletedAt: null },
    })
    if (cityCount > 0) throw new ConflictError('State is referenced by cities')
    const vendorCount = await prisma.masterVendor.count({
      where: { tenantId, stateId: id, deletedAt: null },
    })
    if (vendorCount > 0) throw new ConflictError('State is referenced by vendors')
  }
  if (config.slug === 'cities') {
    const vendorCount = await prisma.masterVendor.count({
      where: { tenantId, cityId: id, deletedAt: null },
    })
    if (vendorCount > 0) throw new ConflictError('City is referenced by vendors')
  }
  // gst-rates: no inbound FK references from other master entities
  if (config.slug === 'plants') {
    const whCount = await prisma.masterWarehouse.count({
      where: { tenantId, plantId: id, deletedAt: null },
    })
    if (whCount > 0) throw new ConflictError('Plant is referenced by warehouses')
  }
  if (config.slug === 'warehouses') {
    const locCount = await prisma.masterLocation.count({
      where: { tenantId, warehouseId: id, deletedAt: null },
    })
    if (locCount > 0) throw new ConflictError('Warehouse is referenced by locations')
    const binCount = await prisma.masterBin.count({
      where: { tenantId, warehouseId: id, deletedAt: null },
    })
    if (binCount > 0) throw new ConflictError('Warehouse is referenced by bins')
    const catCount = await prisma.masterItemCategory.count({
      where: { tenantId, defaultWarehouseId: id, deletedAt: null },
    })
    if (catCount > 0) throw new ConflictError('Warehouse is referenced by item categories')
  }
  if (config.slug === 'locations' || config.slug === 'storage-locations') {
    const binCount = await prisma.masterBin.count({
      where: { tenantId, storageLocationId: id, deletedAt: null },
    })
    if (binCount > 0) throw new ConflictError('Storage location is referenced by bins')
  }
  if (config.slug === 'uom') {
    const itemCount = await prisma.masterItem.count({
      where: {
        tenantId,
        deletedAt: null,
        OR: [{ baseUomId: id }, { purchaseUomId: id }],
      },
    })
    if (itemCount > 0) throw new ConflictError('UOM is referenced by items')
  }
  if (config.slug === 'item-categories') {
    const childCount = await prisma.masterItemCategory.count({
      where: { tenantId, parentId: id, deletedAt: null },
    })
    if (childCount > 0) throw new ConflictError('Category is referenced by child categories')
    const itemCount = await prisma.masterItem.count({
      where: { tenantId, categoryId: id, deletedAt: null },
    })
    if (itemCount > 0) throw new ConflictError('Category is referenced by items')
  }
  if (config.slug === 'hsn-sac') {
    const itemCount = await prisma.masterItem.count({
      where: { tenantId, hsnId: id, deletedAt: null },
    })
    if (itemCount > 0) throw new ConflictError('HSN code is referenced by items')
  }
  if (config.slug === 'gst-groups') {
    const hsnCount = await prisma.masterHsnCode.count({
      where: { tenantId, gstGroupId: id, deletedAt: null },
    })
    if (hsnCount > 0) throw new ConflictError('GST group is referenced by HSN codes')
    const rateCount = await prisma.masterGstRate.count({
      where: { tenantId, gstGroupId: id, deletedAt: null },
    })
    if (rateCount > 0) throw new ConflictError('GST group is referenced by GST rates')
    const itemCount = await prisma.masterItem.count({
      where: { tenantId, gstGroupId: id, deletedAt: null },
    })
    if (itemCount > 0) throw new ConflictError('GST group is referenced by items')
  }
}

export async function listMasterRecords(
  tenantId: string,
  config: MasterResourceConfig,
  query: ListMastersQuery,
) {
  const { skip, take } = getPagination(query)
  const where = buildWhere(config, tenantId, query)
  const model = delegate(config)
  const sortField =
    query.sortBy === 'code' || query.sortBy === 'name' || query.sortBy === 'description'
      ? query.sortBy
      : 'createdAt'

  const [items, total] = await Promise.all([
    model.findMany({
      where,
      skip,
      take,
      orderBy: { [sortField]: query.sortOrder },
    }),
    model.count({ where }),
  ])

  return { items, total, page: query.page, limit: query.limit }
}

export async function getMasterRecord(tenantId: string, config: MasterResourceConfig, id: string) {
  const model = delegate(config)
  const item = await model.findFirst({ where: { id, ...tenantActiveFilter(tenantId) } })
  if (!item) throw new NotFoundError('Master record not found')
  return item
}

export async function createMasterRecord(
  tenantId: string,
  userId: string,
  config: MasterResourceConfig,
  input: Record<string, unknown>,
) {
  const data = normalizeInput(config, input)
  await assertTenantFk(tenantId, config, data)
  if (config.slug === 'gst-rates') validateGstRatePayload(data)
  const model = delegate(config)
  try {
    return await model.create({
      data: {
        tenantId,
        ...data,
        createdBy: userId,
        updatedBy: userId,
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('Duplicate code or name in tenant')
    }
    throw err
  }
}

export async function updateMasterRecord(
  tenantId: string,
  id: string,
  userId: string,
  config: MasterResourceConfig,
  input: Record<string, unknown>,
) {
  const existing = await getMasterRecord(tenantId, config, id)
  const data = normalizeInput(config, input)
  await assertTenantFk(tenantId, config, data)
  if (config.slug === 'gst-rates') {
    validateGstRatePayload({ ...(existing as Record<string, unknown>), ...data })
  }
  const model = delegate(config)
  try {
    return await model.update({
      where: { id, tenantId },
      data: { ...data, updatedBy: userId },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('Duplicate code or name in tenant')
    }
    throw err
  }
}

export async function softDeleteMasterRecord(
  tenantId: string,
  id: string,
  userId: string,
  config: MasterResourceConfig,
) {
  await getMasterRecord(tenantId, config, id)
  await assertNotReferenced(tenantId, config, id)
  const model = delegate(config)
  return model.update({
    where: { id, tenantId },
    data: { deletedAt: new Date(), status: 'INACTIVE', updatedBy: userId },
  })
}

export async function setMasterStatus(
  tenantId: string,
  id: string,
  userId: string,
  config: MasterResourceConfig,
  status: 'ACTIVE' | 'INACTIVE',
) {
  await getMasterRecord(tenantId, config, id)
  const model = delegate(config)
  return model.update({
    where: { id, tenantId },
    data: { status, updatedBy: userId },
  })
}

export async function listMasterLookups(
  tenantId: string,
  config: MasterResourceConfig,
  extraFilter?: Record<string, unknown>,
) {
  const model = delegate(config)
  const select =
    config.slug === 'cities'
      ? { id: true, name: true, stateId: true }
      : config.slug === 'locations' || config.slug === 'storage-locations'
        ? { id: true, code: true, name: true, warehouseId: true }
        : config.slug === 'warehouses'
          ? { id: true, code: true, name: true, plantId: true, warehouseType: true }
          : config.slug === 'bins'
            ? { id: true, code: true, name: true, warehouseId: true, storageLocationId: true }
            : config.slug === 'item-categories'
              ? { id: true, code: true, name: true, parentId: true, level: true }
              : config.slug === 'hsn-sac'
                ? { id: true, code: true, description: true, gstGroupId: true }
                : config.slug === 'gst-groups'
                  ? { id: true, code: true, description: true, goodsType: true }
                  : config.slug === 'gst-rates'
                    ? { id: true, code: true, gstGroupId: true, fromState: true, locationStateCode: true }
                    : { id: true, code: true, name: true }

  const items = await model.findMany({
    where: {
      ...tenantActiveFilter(tenantId),
      status: 'ACTIVE',
      ...extraFilter,
    },
    orderBy: config.slug === 'cities' ? { name: 'asc' } : { code: 'asc' },
    select,
  })
  return items
}
