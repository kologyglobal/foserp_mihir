import { Prisma } from '@prisma/client'
import { prisma } from '../../config/database.js'
import { tenantActiveFilter } from '../../shared/index.js'
import { getPagination } from '../../utils/pagination.js'
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors.js'
import type { ListVendorsQuery, VendorLookupQuery } from './vendor.validation.js'

function normalizeNullableIds(input: Record<string, unknown>): Record<string, unknown> {
  const data = { ...input }
  for (const key of ['countryId', 'stateId', 'cityId'] as const) {
    if (data[key] === '') data[key] = null
  }
  return data
}

async function assertVendorGeography(tenantId: string, input: Record<string, unknown>): Promise<void> {
  let stateId = input.stateId ? String(input.stateId) : null
  const cityId = input.cityId ? String(input.cityId) : null

  if (input.countryId) {
    const country = await prisma.masterCountry.findFirst({
      where: { id: String(input.countryId), ...tenantActiveFilter(tenantId) },
    })
    if (!country) throw new ValidationError('Country not found in tenant')
  }

  if (stateId) {
    const state = await prisma.masterState.findFirst({
      where: { id: stateId, ...tenantActiveFilter(tenantId) },
    })
    if (!state) throw new ValidationError('State not found in tenant')
  }

  if (cityId) {
    const city = await prisma.masterCity.findFirst({
      where: { id: cityId, ...tenantActiveFilter(tenantId) },
    })
    if (!city) throw new ValidationError('City not found in tenant')
    if (stateId && city.stateId !== stateId) {
      throw new ValidationError('City does not belong to the selected state')
    }
    if (!stateId) stateId = city.stateId
  }
}

function buildWhere(tenantId: string, query: ListVendorsQuery) {
  const where: Record<string, unknown> = {
    ...tenantActiveFilter(tenantId),
    ...(query.status ? { status: query.status } : {}),
    ...(query.vendorType ? { vendorType: query.vendorType } : {}),
  }
  if (query.search) {
    where.OR = [
      { code: { contains: query.search } },
      { name: { contains: query.search } },
      { searchName: { contains: query.search } },
      { gstin: { contains: query.search } },
    ]
  }
  return where
}

export async function listVendors(tenantId: string, query: ListVendorsQuery) {
  const { skip, take } = getPagination(query)
  const where = buildWhere(tenantId, query)
  const sortField = query.sortBy === 'code' || query.sortBy === 'name' ? query.sortBy : 'createdAt'

  const [items, total] = await Promise.all([
    prisma.masterVendor.findMany({
      where,
      skip,
      take,
      orderBy: { [sortField]: query.sortOrder },
    }),
    prisma.masterVendor.count({ where }),
  ])

  return { items, total, page: query.page, limit: query.limit }
}

export async function getVendor(tenantId: string, id: string) {
  const item = await prisma.masterVendor.findFirst({
    where: { id, ...tenantActiveFilter(tenantId) },
  })
  if (!item) throw new NotFoundError('Vendor not found')
  return item
}

export async function createVendor(
  tenantId: string,
  userId: string,
  input: Record<string, unknown>,
) {
  const data = normalizeNullableIds(input)
  await assertVendorGeography(tenantId, data)
  try {
    return await prisma.masterVendor.create({
      data: {
        tenantId,
        ...(data as Omit<Prisma.MasterVendorUncheckedCreateInput, 'tenantId' | 'createdBy' | 'updatedBy'>),
        createdBy: userId,
        updatedBy: userId,
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('Duplicate vendor code in tenant')
    }
    throw err
  }
}

export async function updateVendor(
  tenantId: string,
  id: string,
  userId: string,
  input: Record<string, unknown>,
) {
  await getVendor(tenantId, id)
  const data = normalizeNullableIds(input)
  await assertVendorGeography(tenantId, data)
  try {
    return await prisma.masterVendor.update({
      where: { id, tenantId },
      data: { ...data, updatedBy: userId },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('Duplicate vendor code in tenant')
    }
    throw err
  }
}

export async function softDeleteVendor(tenantId: string, id: string, userId: string) {
  await getVendor(tenantId, id)
  return prisma.masterVendor.update({
    where: { id, tenantId },
    data: { deletedAt: new Date(), status: 'INACTIVE', updatedBy: userId },
  })
}

export async function setVendorStatus(
  tenantId: string,
  id: string,
  userId: string,
  status: 'ACTIVE' | 'INACTIVE',
) {
  await getVendor(tenantId, id)
  return prisma.masterVendor.update({
    where: { id, tenantId },
    data: { status, updatedBy: userId },
  })
}

export async function listVendorLookups(tenantId: string, query: VendorLookupQuery) {
  const { skip, take } = getPagination(query)
  const where: Record<string, unknown> = {
    ...tenantActiveFilter(tenantId),
  }
  if (query.activeOnly) where.status = 'ACTIVE'
  if (query.vendorType) where.vendorType = query.vendorType
  if (query.search) {
    where.OR = [
      { code: { contains: query.search } },
      { name: { contains: query.search } },
      { searchName: { contains: query.search } },
      { gstin: { contains: query.search } },
    ]
  }

  const [items, total] = await Promise.all([
    prisma.masterVendor.findMany({
      where,
      skip,
      take,
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        searchName: true,
        vendorType: true,
        gstin: true,
        city: true,
        state: true,
        country: true,
        countryId: true,
        stateId: true,
        cityId: true,
        status: true,
      },
    }),
    prisma.masterVendor.count({ where }),
  ])

  return { items, total, page: query.page, limit: query.limit }
}
