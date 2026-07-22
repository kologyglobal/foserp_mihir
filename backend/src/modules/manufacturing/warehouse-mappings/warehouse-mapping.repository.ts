import { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import { getPagination } from '../../../utils/pagination.js'
import { ConflictError, NotFoundError } from '../../../utils/errors.js'
import type {
  CreateWarehouseMappingInput,
  ListWarehouseMappingsQuery,
  UpdateWarehouseMappingInput,
} from './warehouse-mapping.schemas.js'

function buildWhere(tenantId: string, query: ListWarehouseMappingsQuery) {
  const where: Prisma.ManufacturingWarehouseMappingWhereInput = {
    ...tenantActiveFilter(tenantId),
    ...(query.plantCode !== undefined ? { plantCode: query.plantCode } : {}),
    ...(query.isDefault !== undefined ? { isDefault: query.isDefault } : {}),
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
  }
  if (query.search) {
    where.OR = [{ plantCode: { contains: query.search } }]
  }
  return where
}

export async function listMappings(tenantId: string, query: ListWarehouseMappingsQuery) {
  const { skip, take } = getPagination(query)
  const where = buildWhere(tenantId, query)
  const [items, total] = await Promise.all([
    prisma.manufacturingWarehouseMapping.findMany({
      where,
      skip,
      take,
      orderBy: [{ isDefault: 'desc' }, { plantCode: 'asc' }, { createdAt: 'desc' }],
    }),
    prisma.manufacturingWarehouseMapping.count({ where }),
  ])
  return { items, total, page: query.page, limit: query.limit }
}

export async function getMapping(tenantId: string, id: string) {
  const row = await prisma.manufacturingWarehouseMapping.findFirst({
    where: { id, ...tenantActiveFilter(tenantId) },
  })
  if (!row) throw new NotFoundError('Warehouse mapping not found')
  return row
}

export async function findByPlantCode(tenantId: string, plantCode: string) {
  return prisma.manufacturingWarehouseMapping.findFirst({
    where: {
      ...tenantActiveFilter(tenantId),
      plantCode,
      isActive: true,
    },
  })
}

export async function findDefault(tenantId: string) {
  return prisma.manufacturingWarehouseMapping.findFirst({
    where: {
      ...tenantActiveFilter(tenantId),
      isDefault: true,
      isActive: true,
    },
    orderBy: { updatedAt: 'desc' },
  })
}

/** Active default with null plantCode (tenant-wide). Used to enforce at most one. */
export async function findConflictingTenantDefault(tenantId: string, excludeId?: string) {
  return prisma.manufacturingWarehouseMapping.findFirst({
    where: {
      ...tenantActiveFilter(tenantId),
      isDefault: true,
      plantCode: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  })
}

export async function createMapping(tenantId: string, userId: string, input: CreateWarehouseMappingInput) {
  try {
    return await prisma.manufacturingWarehouseMapping.create({
      data: {
        tenantId,
        plantCode: input.plantCode ?? null,
        rawMaterialWarehouseId: input.rawMaterialWarehouseId,
        productionIssueWarehouseId: input.productionIssueWarehouseId ?? null,
        wipWarehouseId: input.wipWarehouseId ?? null,
        finishedGoodsWarehouseId: input.finishedGoodsWarehouseId,
        qualityHoldWarehouseId: input.qualityHoldWarehouseId ?? null,
        reworkWarehouseId: input.reworkWarehouseId ?? null,
        scrapWarehouseId: input.scrapWarehouseId ?? null,
        jobWorkWarehouseId: input.jobWorkWarehouseId ?? null,
        defaultReturnWarehouseId: input.defaultReturnWarehouseId ?? null,
        isDefault: input.isDefault,
        isActive: input.isActive,
        createdBy: userId,
        updatedBy: userId,
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('Duplicate warehouse mapping for tenant/plantCode')
    }
    throw err
  }
}

export async function updateMapping(
  tenantId: string,
  userId: string,
  id: string,
  input: UpdateWarehouseMappingInput,
) {
  await getMapping(tenantId, id)
  try {
    return await prisma.manufacturingWarehouseMapping.update({
      where: { id, tenantId },
      data: {
        ...input,
        updatedBy: userId,
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('Duplicate warehouse mapping for tenant/plantCode')
    }
    throw err
  }
}

export async function deleteMapping(tenantId: string, id: string) {
  await getMapping(tenantId, id)
  return prisma.manufacturingWarehouseMapping.update({
    where: { id, tenantId },
    data: { deletedAt: new Date() },
  })
}

export async function setMappingActive(tenantId: string, userId: string, id: string, isActive: boolean) {
  await getMapping(tenantId, id)
  return prisma.manufacturingWarehouseMapping.update({
    where: { id, tenantId },
    data: { isActive, updatedBy: userId },
  })
}

export async function findProfileFallback(tenantId: string, plantCode?: string, profileId?: string) {
  if (profileId) {
    return prisma.manufacturingProfile.findFirst({
      where: { id: profileId, ...tenantActiveFilter(tenantId), isActive: true },
    })
  }
  if (plantCode) {
    const byPlant = await prisma.manufacturingProfile.findFirst({
      where: {
        ...tenantActiveFilter(tenantId),
        isActive: true,
        plantCode,
      },
      orderBy: { updatedAt: 'desc' },
    })
    if (byPlant) return byPlant
  }
  return prisma.manufacturingProfile.findFirst({
    where: {
      ...tenantActiveFilter(tenantId),
      isActive: true,
      OR: [
        { finishedGoodsWarehouseId: { not: null } },
        { productionWarehouseId: { not: null } },
      ],
    },
    orderBy: { updatedAt: 'desc' },
  })
}
