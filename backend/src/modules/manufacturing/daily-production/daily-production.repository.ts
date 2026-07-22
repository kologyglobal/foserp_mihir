import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { NotFoundError } from '../../../utils/errors.js'
import { getPagination } from '../../../utils/pagination.js'
import type { ListDailyBatchesQuery } from './daily-production.schemas.js'

const batchInclude = {
  lines: { orderBy: { lineOrder: 'asc' as const } },
  workCentre: { select: { id: true, code: true, name: true } },
}

export async function getBatch(tenantId: string, id: string) {
  const row = await prisma.dailyProductionBatch.findFirst({ where: { id, tenantId }, include: batchInclude })
  if (!row) throw new NotFoundError('Daily production batch not found')
  return row
}

export async function listBatches(tenantId: string, query: ListDailyBatchesQuery) {
  const { skip, take, page, limit } = getPagination(query)
  const where: Prisma.DailyProductionBatchWhereInput = {
    tenantId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.workCentreId ? { workCentreId: query.workCentreId } : {}),
    ...(query.productionDate ? { productionDate: new Date(query.productionDate) } : {}),
  }

  const [items, total] = await Promise.all([
    prisma.dailyProductionBatch.findMany({ where, include: batchInclude, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.dailyProductionBatch.count({ where }),
  ])

  return { items, total, page, limit }
}

export async function getLine(tenantId: string, batchId: string, lineId: string) {
  const row = await prisma.dailyProductionLine.findFirst({ where: { id: lineId, batchId, tenantId } })
  if (!row) throw new NotFoundError('Daily production line not found')
  return row
}

export async function refreshBatchLineCount(tenantId: string, batchId: string) {
  const count = await prisma.dailyProductionLine.count({ where: { batchId, tenantId } })
  await prisma.dailyProductionBatch.update({ where: { id: batchId }, data: { totalLines: count } })
}
