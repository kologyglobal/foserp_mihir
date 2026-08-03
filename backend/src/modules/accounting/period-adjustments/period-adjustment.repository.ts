import type { Prisma, PeriodEndAdjustmentKind } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { NotFoundError } from '../../../utils/errors.js'
import { getPagination } from '../../../utils/pagination.js'
import type { ListPeriodAdjustmentsQuery } from './period-adjustment.schemas.js'

const NUMBER_PREFIX: Record<PeriodEndAdjustmentKind, string> = {
  ACCRUAL: 'ACR',
  PREPAID: 'PPD',
}

export const adjustmentInclude = {
  period: { select: { id: true, name: true, periodNumber: true, startDate: true, endDate: true, status: true, financialYearId: true } },
  reversalPeriod: { select: { id: true, name: true, startDate: true, status: true } },
  expenseAccount: { select: { id: true, accountCode: true, accountName: true } },
  balanceSheetAccount: { select: { id: true, accountCode: true, accountName: true } },
  costCentre: { select: { id: true, code: true, name: true } },
  schedules: {
    orderBy: { sequence: 'asc' },
    include: { period: { select: { id: true, name: true, startDate: true, endDate: true, status: true } } },
  },
} satisfies Prisma.PeriodEndAdjustmentInclude

export type PeriodAdjustmentWithRelations = Prisma.PeriodEndAdjustmentGetPayload<{
  include: typeof adjustmentInclude
}>

/**
 * Sequential per-tenant document number. Callers retry on unique-constraint
 * collision because concurrent creates can pick the same next value.
 */
export async function nextAdjustmentNumber(tenantId: string, kind: PeriodEndAdjustmentKind): Promise<string> {
  const prefix = NUMBER_PREFIX[kind]
  const latest = await prisma.periodEndAdjustment.findFirst({
    where: { tenantId, kind, adjustmentNumber: { startsWith: `${prefix}-` } },
    orderBy: { adjustmentNumber: 'desc' },
    select: { adjustmentNumber: true },
  })
  const lastSequence = latest ? Number.parseInt(latest.adjustmentNumber.slice(prefix.length + 1), 10) : 0
  const next = Number.isFinite(lastSequence) ? lastSequence + 1 : 1
  return `${prefix}-${String(next).padStart(5, '0')}`
}

export async function findByIdOrThrow(tenantId: string, id: string): Promise<PeriodAdjustmentWithRelations> {
  const found = await prisma.periodEndAdjustment.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: adjustmentInclude,
  })
  if (!found) throw new NotFoundError('Period-end adjustment not found')
  return found
}

export async function listAdjustments(tenantId: string, query: ListPeriodAdjustmentsQuery) {
  const { skip, take, page, limit } = getPagination(query)
  const where: Prisma.PeriodEndAdjustmentWhereInput = {
    tenantId,
    deletedAt: null,
    ...(query.legalEntityId ? { legalEntityId: query.legalEntityId } : {}),
    ...(query.kind ? { kind: query.kind } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.periodId ? { periodId: query.periodId } : {}),
    ...(query.search
      ? {
          OR: [
            { adjustmentNumber: { contains: query.search } },
            { description: { contains: query.search } },
            { narration: { contains: query.search } },
          ],
        }
      : {}),
  }

  const [items, total] = await Promise.all([
    prisma.periodEndAdjustment.findMany({
      where,
      include: adjustmentInclude,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.periodEndAdjustment.count({ where }),
  ])

  return { items, total, page, limit }
}

export async function listPendingScheduleRowsForPeriod(tenantId: string, periodId: string) {
  return prisma.periodEndAdjustmentSchedule.findMany({
    where: { tenantId, periodId, status: 'PENDING', adjustment: { deletedAt: null, status: { in: ['POSTED', 'PARTIALLY_RECOGNISED'] } } },
    include: { adjustment: { select: { id: true, adjustmentNumber: true, description: true } } },
    orderBy: { sequence: 'asc' },
  })
}

/** Accruals posted in a period that still need their reversal booked into the next period. */
export async function listAccrualsAwaitingReversal(tenantId: string, periodId: string) {
  return prisma.periodEndAdjustment.findMany({
    where: {
      tenantId,
      deletedAt: null,
      kind: 'ACCRUAL',
      status: 'POSTED',
      autoReverse: true,
      periodId,
      reversalVoucherId: null,
    },
    include: adjustmentInclude,
    orderBy: { adjustmentNumber: 'asc' },
  })
}
