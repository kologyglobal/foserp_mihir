import { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import { getPagination } from '../../../utils/pagination.js'
import { ConflictError, NotFoundError } from '../../../utils/errors.js'
import { assertUom, assertWorkCentre } from '../shared/manufacturing.helpers.js'
import type { CreateMachineInput, ListMachinesQuery, UpdateMachineInput } from './machine.schemas.js'

function buildWhere(tenantId: string, query: ListMachinesQuery) {
  const where: Prisma.ManufacturingMachineWhereInput = {
    ...tenantActiveFilter(tenantId),
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    ...(query.workCentreId ? { workCentreId: query.workCentreId } : {}),
    ...(query.status ? { status: query.status } : {}),
  }
  if (query.search) {
    where.OR = [{ code: { contains: query.search } }, { name: { contains: query.search } }]
  }
  return where
}

export async function listMachines(tenantId: string, query: ListMachinesQuery) {
  const { skip, take } = getPagination(query)
  const where = buildWhere(tenantId, query)
  const sortField = query.sortBy === 'code' || query.sortBy === 'name' ? query.sortBy : 'createdAt'

  const [items, total] = await Promise.all([
    prisma.manufacturingMachine.findMany({ where, skip, take, orderBy: { [sortField]: query.sortOrder } }),
    prisma.manufacturingMachine.count({ where }),
  ])
  return { items, total, page: query.page, limit: query.limit }
}

export async function getMachine(tenantId: string, id: string) {
  const item = await prisma.manufacturingMachine.findFirst({ where: { id, ...tenantActiveFilter(tenantId) } })
  if (!item) throw new NotFoundError('Machine not found')
  return item
}

async function validateRefs(tenantId: string, input: Partial<CreateMachineInput>): Promise<void> {
  if (input.workCentreId) await assertWorkCentre(tenantId, input.workCentreId)
  if (input.capacityUomId) await assertUom(tenantId, input.capacityUomId)
}

export async function createMachine(tenantId: string, userId: string, input: CreateMachineInput) {
  await validateRefs(tenantId, input)
  try {
    return await prisma.manufacturingMachine.create({
      data: {
        tenantId,
        code: input.code,
        name: input.name,
        workCentreId: input.workCentreId,
        description: input.description ?? null,
        manufacturer: input.manufacturer ?? null,
        model: input.model ?? null,
        serialNumber: input.serialNumber ?? null,
        capacity: input.capacity ?? null,
        capacityUomId: input.capacityUomId ?? null,
        status: input.status ?? 'AVAILABLE',
        isActive: input.isActive ?? true,
        createdBy: userId,
        updatedBy: userId,
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('Duplicate machine code in tenant')
    }
    throw err
  }
}

export async function updateMachine(tenantId: string, id: string, userId: string, input: UpdateMachineInput) {
  await getMachine(tenantId, id)
  await validateRefs(tenantId, input)
  try {
    return await prisma.manufacturingMachine.update({
      where: { id, tenantId },
      data: { ...input, updatedBy: userId },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('Duplicate machine code in tenant')
    }
    throw err
  }
}

export async function softDeleteMachine(tenantId: string, id: string, userId: string) {
  await getMachine(tenantId, id)
  return prisma.manufacturingMachine.update({
    where: { id, tenantId },
    data: { deletedAt: new Date(), isActive: false, updatedBy: userId },
  })
}

export async function setMachineActive(tenantId: string, id: string, userId: string, isActive: boolean) {
  await getMachine(tenantId, id)
  return prisma.manufacturingMachine.update({ where: { id, tenantId }, data: { isActive, updatedBy: userId } })
}

export async function setMachineStatus(
  tenantId: string,
  id: string,
  userId: string,
  status: CreateMachineInput['status'],
) {
  await getMachine(tenantId, id)
  return prisma.manufacturingMachine.update({ where: { id, tenantId }, data: { status, updatedBy: userId } })
}
