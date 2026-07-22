import { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import { getPagination } from '../../../utils/pagination.js'
import { ConflictError, NotFoundError } from '../../../utils/errors.js'
import { assertLocation, assertUom } from '../shared/manufacturing.helpers.js'
import type { CreateWorkCentreInput, ListWorkCentresQuery, UpdateWorkCentreInput } from './work-centre.schemas.js'

function buildWhere(tenantId: string, query: ListWorkCentresQuery) {
  const where: Prisma.ManufacturingWorkCentreWhereInput = {
    ...tenantActiveFilter(tenantId),
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
  }
  if (query.search) {
    where.OR = [{ code: { contains: query.search } }, { name: { contains: query.search } }]
  }
  return where
}

export async function listWorkCentres(tenantId: string, query: ListWorkCentresQuery) {
  const { skip, take } = getPagination(query)
  const where = buildWhere(tenantId, query)
  const sortField = query.sortBy === 'code' || query.sortBy === 'name' ? query.sortBy : 'createdAt'

  const [items, total] = await Promise.all([
    prisma.manufacturingWorkCentre.findMany({ where, skip, take, orderBy: { [sortField]: query.sortOrder } }),
    prisma.manufacturingWorkCentre.count({ where }),
  ])
  return { items, total, page: query.page, limit: query.limit }
}

export async function getWorkCentre(tenantId: string, id: string) {
  const item = await prisma.manufacturingWorkCentre.findFirst({ where: { id, ...tenantActiveFilter(tenantId) } })
  if (!item) throw new NotFoundError('Work centre not found')
  return item
}

async function validateRefs(tenantId: string, input: Partial<CreateWorkCentreInput>): Promise<void> {
  if (input.locationId) await assertLocation(tenantId, input.locationId)
  if (input.capacityUomId) await assertUom(tenantId, input.capacityUomId)
}

export async function createWorkCentre(tenantId: string, userId: string, input: CreateWorkCentreInput) {
  await validateRefs(tenantId, input)
  try {
    return await prisma.manufacturingWorkCentre.create({
      data: {
        tenantId,
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        plantCode: input.plantCode ?? null,
        departmentRef: input.departmentRef ?? null,
        locationId: input.locationId ?? null,
        capacityPerShift: input.capacityPerShift ?? null,
        capacityUomId: input.capacityUomId ?? null,
        defaultShiftRef: input.defaultShiftRef ?? null,
        costRate: input.costRate ?? null,
        isActive: input.isActive ?? true,
        createdBy: userId,
        updatedBy: userId,
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('Duplicate work centre code in tenant')
    }
    throw err
  }
}

export async function updateWorkCentre(
  tenantId: string,
  id: string,
  userId: string,
  input: UpdateWorkCentreInput,
) {
  await getWorkCentre(tenantId, id)
  await validateRefs(tenantId, input)
  try {
    return await prisma.manufacturingWorkCentre.update({
      where: { id, tenantId },
      data: { ...input, updatedBy: userId },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('Duplicate work centre code in tenant')
    }
    throw err
  }
}

export async function softDeleteWorkCentre(tenantId: string, id: string, userId: string) {
  await getWorkCentre(tenantId, id)
  return prisma.manufacturingWorkCentre.update({
    where: { id, tenantId },
    data: { deletedAt: new Date(), isActive: false, updatedBy: userId },
  })
}

export async function setWorkCentreActive(tenantId: string, id: string, userId: string, isActive: boolean) {
  await getWorkCentre(tenantId, id)
  return prisma.manufacturingWorkCentre.update({
    where: { id, tenantId },
    data: { isActive, updatedBy: userId },
  })
}
