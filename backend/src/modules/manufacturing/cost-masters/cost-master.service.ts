import type { Request } from 'express'
import { prisma } from '../../../config/database.js'
import { NotFoundError, ValidationError } from '../../../utils/errors.js'
import type {
  CreateLabourRateCardInput,
  CreateOverheadCostPoolInput,
  ListCostMastersQuery,
  UpdateLabourRateCardInput,
  UpdateOverheadCostPoolInput,
} from './cost-master.schemas.js'

const pageArgs = (query: ListCostMastersQuery) => {
  const page = query.page ?? 1
  const limit = query.limit ?? 50
  return { page, limit, skip: (page - 1) * limit }
}

async function assertWorkCentre(tenantId: string, workCentreId?: string | null) {
  if (!workCentreId) return
  const found = await prisma.manufacturingWorkCentre.findFirst({
    where: { id: workCentreId, tenantId, deletedAt: null },
    select: { id: true },
  })
  if (!found) throw new ValidationError('Work centre not found for tenant')
}

export async function listLabourRateCards(tenantId: string, query: ListCostMastersQuery) {
  const { page, limit, skip } = pageArgs(query)
  const where = { tenantId, deletedAt: null, ...(query.isActive ? { isActive: query.isActive === 'true' } : {}) }
  const [total, items] = await Promise.all([
    prisma.labourRateCard.count({ where }),
    prisma.labourRateCard.findMany({ where, skip, take: limit, orderBy: [{ code: 'asc' }, { effectiveFrom: 'desc' }] }),
  ])
  return { total, page, limit, items }
}

export async function getLabourRateCard(tenantId: string, id: string) {
  const row = await prisma.labourRateCard.findFirst({ where: { id, tenantId, deletedAt: null } })
  if (!row) throw new NotFoundError('Labour rate card not found')
  return row
}

export async function createLabourRateCard(req: Request, tenantId: string, input: CreateLabourRateCardInput) {
  await assertWorkCentre(tenantId, input.workCentreId)
  const userId = req.context?.userId
  return prisma.labourRateCard.create({ data: { ...input, tenantId, createdBy: userId, updatedBy: userId } })
}

export async function updateLabourRateCard(req: Request, tenantId: string, id: string, input: UpdateLabourRateCardInput) {
  const current = await getLabourRateCard(tenantId, id)
  await assertWorkCentre(tenantId, input.workCentreId)
  const effectiveFrom = input.effectiveFrom ?? current.effectiveFrom
  const effectiveTo = input.effectiveTo === undefined ? current.effectiveTo : input.effectiveTo
  if (effectiveTo && effectiveTo < effectiveFrom) throw new ValidationError('effectiveTo must be on or after effectiveFrom')
  return prisma.labourRateCard.update({ where: { id }, data: { ...input, updatedBy: req.context?.userId } })
}

export async function deleteLabourRateCard(req: Request, tenantId: string, id: string) {
  await getLabourRateCard(tenantId, id)
  return prisma.labourRateCard.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false, updatedBy: req.context?.userId },
  })
}

export async function listOverheadCostPools(tenantId: string, query: ListCostMastersQuery) {
  const { page, limit, skip } = pageArgs(query)
  const where = { tenantId, deletedAt: null, ...(query.isActive ? { isActive: query.isActive === 'true' } : {}) }
  const [total, items] = await Promise.all([
    prisma.overheadCostPool.count({ where }),
    prisma.overheadCostPool.findMany({ where, skip, take: limit, orderBy: [{ periodStart: 'desc' }, { code: 'asc' }] }),
  ])
  return { total, page, limit, items }
}

export async function getOverheadCostPool(tenantId: string, id: string) {
  const row = await prisma.overheadCostPool.findFirst({ where: { id, tenantId, deletedAt: null } })
  if (!row) throw new NotFoundError('Overhead cost pool not found')
  return row
}

export async function createOverheadCostPool(req: Request, tenantId: string, input: CreateOverheadCostPoolInput) {
  const userId = req.context?.userId
  return prisma.overheadCostPool.create({ data: { ...input, tenantId, createdBy: userId, updatedBy: userId } })
}

export async function updateOverheadCostPool(req: Request, tenantId: string, id: string, input: UpdateOverheadCostPoolInput) {
  const current = await getOverheadCostPool(tenantId, id)
  const periodStart = input.periodStart ?? current.periodStart
  const periodEnd = input.periodEnd ?? current.periodEnd
  if (periodEnd < periodStart) throw new ValidationError('periodEnd must be on or after periodStart')
  return prisma.overheadCostPool.update({ where: { id }, data: { ...input, updatedBy: req.context?.userId } })
}

export async function deleteOverheadCostPool(req: Request, tenantId: string, id: string) {
  await getOverheadCostPool(tenantId, id)
  return prisma.overheadCostPool.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false, updatedBy: req.context?.userId },
  })
}
