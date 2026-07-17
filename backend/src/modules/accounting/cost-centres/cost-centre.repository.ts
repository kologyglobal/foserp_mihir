import type { CostCentre } from '@prisma/client'
import { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { getPagination } from '../../../utils/pagination.js'
import { ConflictError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { MAX_COST_CENTRE_DEPTH } from '../shared/finance.constants.js'
import {
  assertCostCentreDepth,
  assertNoCircularParent,
  getLegalEntityOrThrow,
} from '../shared/finance.helpers.js'
import type { CostCentreTreeQuery, CreateCostCentreInput, ListCostCentresQuery, UpdateCostCentreInput } from './cost-centre.validation.js'

async function loadCostCentreParent(id: string) {
  return prisma.costCentre.findUnique({ where: { id }, select: { id: true, parentId: true } })
}

async function validateParent(tenantId: string, legalEntityId: string, parentId: string | null | undefined, selfId?: string) {
  if (!parentId) return 1
  const parent = await prisma.costCentre.findFirst({ where: { id: parentId, tenantId, legalEntityId } })
  if (!parent) throw new ValidationError('Parent cost centre not found')
  if (!parent.isGroup) throw new ValidationError('Parent must be a group cost centre')
  await assertNoCircularParent(selfId ?? 'new', parentId, loadCostCentreParent, 'parentId')
  return assertCostCentreDepth(undefined, MAX_COST_CENTRE_DEPTH)
}

export async function listCostCentres(tenantId: string, query: ListCostCentresQuery) {
  if (!query.legalEntityId) throw new NotFoundError('legalEntityId query parameter is required')
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const { skip, take } = getPagination(query)
  const where: Prisma.CostCentreWhereInput = { tenantId, legalEntityId: query.legalEntityId }
  const [items, total] = await Promise.all([
    prisma.costCentre.findMany({ where, skip, take, orderBy: { code: 'asc' } }),
    prisma.costCentre.count({ where }),
  ])
  return { items, total, page: query.page, limit: query.limit }
}

export async function getCostCentreTree(tenantId: string, query: CostCentreTreeQuery) {
  if (!query.legalEntityId) throw new NotFoundError('legalEntityId query parameter is required')
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const centres = await prisma.costCentre.findMany({
    where: { tenantId, legalEntityId: query.legalEntityId },
    orderBy: { code: 'asc' },
  })
  const byParent = new Map<string | null, CostCentre[]>()
  for (const cc of centres) {
    const key = cc.parentId ?? null
    const list = byParent.get(key) ?? []
    list.push(cc)
    byParent.set(key, list)
  }
  function build(parentId: string | null): Array<CostCentre & { children: ReturnType<typeof build> }> {
    return (byParent.get(parentId) ?? []).map((cc) => ({ ...cc, children: build(cc.id) }))
  }
  return build(null)
}

export async function createCostCentre(tenantId: string, input: CreateCostCentreInput) {
  await getLegalEntityOrThrow(tenantId, input.legalEntityId)
  await validateParent(tenantId, input.legalEntityId, input.parentId ?? null)
  try {
    return await prisma.costCentre.create({
      data: {
        tenantId,
        legalEntityId: input.legalEntityId,
        code: input.code,
        name: input.name,
        parentId: input.parentId ?? null,
        isGroup: input.isGroup,
        managerUserId: input.managerUserId ?? null,
        description: input.description,
        isActive: true,
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('Cost centre code must be unique within the legal entity')
    }
    throw err
  }
}

export async function updateCostCentre(tenantId: string, id: string, input: UpdateCostCentreInput) {
  const existing = await prisma.costCentre.findFirst({ where: { id, tenantId } })
  if (!existing) throw new NotFoundError('Cost centre not found')
  const parentId = input.parentId !== undefined ? input.parentId : existing.parentId
  await validateParent(tenantId, existing.legalEntityId, parentId, id)
  try {
    return await prisma.costCentre.update({
      where: { id, tenantId },
      data: {
        code: input.code,
        name: input.name,
        parentId,
        isGroup: input.isGroup,
        managerUserId: input.managerUserId,
        description: input.description,
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('Cost centre code must be unique within the legal entity')
    }
    throw err
  }
}

export async function activateCostCentre(tenantId: string, id: string) {
  const item = await prisma.costCentre.findFirst({ where: { id, tenantId } })
  if (!item) throw new NotFoundError('Cost centre not found')
  return prisma.costCentre.update({ where: { id, tenantId }, data: { isActive: true } })
}

export async function deactivateCostCentre(tenantId: string, id: string) {
  const item = await prisma.costCentre.findFirst({ where: { id, tenantId } })
  if (!item) throw new NotFoundError('Cost centre not found')
  return prisma.costCentre.update({ where: { id, tenantId }, data: { isActive: false } })
}
