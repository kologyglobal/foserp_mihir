import { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import { getPagination } from '../../../utils/pagination.js'
import { ConflictError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { assertItem, assertWarehouse } from '../shared/manufacturing.helpers.js'
import type { CreateProfileInput, ListProfilesQuery, UpdateProfileInput } from './profile.schemas.js'

function buildProfileWhere(tenantId: string, query: ListProfilesQuery) {
  const where: Prisma.ManufacturingProfileWhereInput = {
    ...tenantActiveFilter(tenantId),
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    ...(query.productItemId ? { productItemId: query.productItemId } : {}),
    ...(query.productionType ? { productionType: query.productionType } : {}),
  }
  if (query.search) {
    where.OR = [{ code: { contains: query.search } }, { name: { contains: query.search } }]
  }
  return where
}

export async function listProfiles(tenantId: string, query: ListProfilesQuery) {
  const { skip, take } = getPagination(query)
  const where = buildProfileWhere(tenantId, query)
  const sortField = query.sortBy === 'code' || query.sortBy === 'name' ? query.sortBy : 'createdAt'
  const [items, total] = await Promise.all([
    prisma.manufacturingProfile.findMany({ where, skip, take, orderBy: { [sortField]: query.sortOrder } }),
    prisma.manufacturingProfile.count({ where }),
  ])
  return { items, total, page: query.page, limit: query.limit }
}

export async function getProfile(tenantId: string, profileId: string) {
  const profile = await prisma.manufacturingProfile.findFirst({
    where: { id: profileId, ...tenantActiveFilter(tenantId) },
  })
  if (!profile) throw new NotFoundError('Manufacturing profile not found')
  return profile
}

async function assertBomVersionMatchesProduct(tenantId: string, bomVersionId: string, productItemId: string) {
  const version = await prisma.manufacturingBomVersion.findFirst({
    where: { id: bomVersionId, ...tenantActiveFilter(tenantId) },
    include: { bom: true },
  })
  if (!version) throw new ValidationError(`BOM version not found in tenant: ${bomVersionId}`)
  if (version.bom.productItemId !== productItemId) {
    throw new ValidationError('defaultBomVersionId must belong to a BOM for the same productItemId')
  }
}

async function assertRoutingVersionMatchesProduct(tenantId: string, routingVersionId: string, productItemId: string) {
  const version = await prisma.manufacturingRoutingVersion.findFirst({
    where: { id: routingVersionId, ...tenantActiveFilter(tenantId) },
    include: { routing: true },
  })
  if (!version) throw new ValidationError(`Routing version not found in tenant: ${routingVersionId}`)
  if (version.routing.productItemId && version.routing.productItemId !== productItemId) {
    throw new ValidationError('defaultRoutingVersionId must belong to a routing for the same productItemId')
  }
}

async function assertProfileRefs(
  tenantId: string,
  input: {
    productItemId: string
    defaultBomVersionId?: string | null
    defaultRoutingVersionId?: string | null
    productionWarehouseId?: string | null
    wipWarehouseId?: string | null
    finishedGoodsWarehouseId?: string | null
    scrapWarehouseId?: string | null
  },
) {
  if (input.defaultBomVersionId) {
    await assertBomVersionMatchesProduct(tenantId, input.defaultBomVersionId, input.productItemId)
  }
  if (input.defaultRoutingVersionId) {
    await assertRoutingVersionMatchesProduct(tenantId, input.defaultRoutingVersionId, input.productItemId)
  }
  if (input.productionWarehouseId) await assertWarehouse(tenantId, input.productionWarehouseId)
  if (input.wipWarehouseId) await assertWarehouse(tenantId, input.wipWarehouseId)
  if (input.finishedGoodsWarehouseId) await assertWarehouse(tenantId, input.finishedGoodsWarehouseId)
  if (input.scrapWarehouseId) await assertWarehouse(tenantId, input.scrapWarehouseId)
}

export async function createProfile(tenantId: string, userId: string, input: CreateProfileInput) {
  await assertItem(tenantId, input.productItemId)
  await assertProfileRefs(tenantId, input)

  try {
    return await prisma.manufacturingProfile.create({
      data: {
        tenantId,
        code: input.code,
        name: input.name,
        productItemId: input.productItemId,
        productionType: input.productionType,
        executionMode: input.executionMode,
        defaultBomVersionId: input.defaultBomVersionId ?? null,
        defaultRoutingVersionId: input.defaultRoutingVersionId ?? null,
        defaultQualityPlanRef: input.defaultQualityPlanRef ?? null,
        planningMethod: input.planningMethod,
        materialConsumptionMethod: input.materialConsumptionMethod,
        wipTrackingMethod: input.wipTrackingMethod,
        outputTrackingMethod: input.outputTrackingMethod,
        plantCode: input.plantCode ?? null,
        productionWarehouseId: input.productionWarehouseId ?? null,
        wipWarehouseId: input.wipWarehouseId ?? null,
        finishedGoodsWarehouseId: input.finishedGoodsWarehouseId ?? null,
        scrapWarehouseId: input.scrapWarehouseId ?? null,
        directProductionOrderAllowed: input.directProductionOrderAllowed,
        partialCompletionAllowed: input.partialCompletionAllowed,
        overproductionTolerancePercent: input.overproductionTolerancePercent,
        underproductionTolerancePercent: input.underproductionTolerancePercent,
        serialTrackingRequired: input.serialTrackingRequired,
        batchTrackingRequired: input.batchTrackingRequired,
        jobTrackingRequired: input.jobTrackingRequired,
        heatTrackingRequired: input.heatTrackingRequired,
        subcontractingAllowed: input.subcontractingAllowed,
        childProductionOrdersEnabled: input.childProductionOrdersEnabled,
        approvalRuleRef: input.approvalRuleRef ?? null,
        isActive: input.isActive,
        createdBy: userId,
        updatedBy: userId,
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('Duplicate profile code in tenant')
    }
    throw err
  }
}

export async function updateProfile(tenantId: string, userId: string, profileId: string, input: UpdateProfileInput) {
  const existing = await getProfile(tenantId, profileId)
  const productItemId = input.productItemId ?? existing.productItemId
  if (input.productItemId) await assertItem(tenantId, input.productItemId)
  await assertProfileRefs(tenantId, {
    productItemId,
    defaultBomVersionId: input.defaultBomVersionId,
    defaultRoutingVersionId: input.defaultRoutingVersionId,
    productionWarehouseId: input.productionWarehouseId,
    wipWarehouseId: input.wipWarehouseId,
    finishedGoodsWarehouseId: input.finishedGoodsWarehouseId,
    scrapWarehouseId: input.scrapWarehouseId,
  })

  try {
    return await prisma.manufacturingProfile.update({
      where: { id: profileId, tenantId },
      data: { ...input, updatedBy: userId },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('Duplicate profile code in tenant')
    }
    throw err
  }
}

export async function deleteProfile(tenantId: string, profileId: string) {
  await getProfile(tenantId, profileId)
  return prisma.manufacturingProfile.update({
    where: { id: profileId, tenantId },
    data: { deletedAt: new Date() },
  })
}

export async function setProfileActive(tenantId: string, userId: string, profileId: string, isActive: boolean) {
  await getProfile(tenantId, profileId)
  return prisma.manufacturingProfile.update({
    where: { id: profileId, tenantId },
    data: { isActive, updatedBy: userId },
  })
}

export async function getProfileReadiness(tenantId: string, profileId: string) {
  const profile = await getProfile(tenantId, profileId)

  const [defaultBomVersion, defaultRoutingVersion] = await Promise.all([
    profile.defaultBomVersionId
      ? prisma.manufacturingBomVersion.findFirst({
          where: { id: profile.defaultBomVersionId, ...tenantActiveFilter(tenantId) },
        })
      : Promise.resolve(null),
    profile.defaultRoutingVersionId
      ? prisma.manufacturingRoutingVersion.findFirst({
          where: { id: profile.defaultRoutingVersionId, ...tenantActiveFilter(tenantId) },
        })
      : Promise.resolve(null),
  ])

  return { profile, defaultBomVersion, defaultRoutingVersion }
}
