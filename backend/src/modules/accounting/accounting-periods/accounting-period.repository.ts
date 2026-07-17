import { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { getPagination } from '../../../utils/pagination.js'
import { ConflictError, InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import {
  assertPeriodInYear,
  generateMonthlyPeriodDefs,
  getLegalEntityOrThrow,
  parseDateOnly,
} from '../shared/finance.helpers.js'
import type { GeneratePeriodsInput, ListPeriodsQuery, ReopenPeriodInput, UpdatePeriodInput } from './accounting-period.validation.js'

export async function listPeriods(tenantId: string, query: ListPeriodsQuery) {
  if (!query.legalEntityId) throw new NotFoundError('legalEntityId query parameter is required')
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const { skip, take } = getPagination(query)
  const where: Prisma.AccountingPeriodWhereInput = {
    tenantId,
    legalEntityId: query.legalEntityId,
    ...(query.financialYearId ? { financialYearId: query.financialYearId } : {}),
    ...(query.status ? { status: query.status } : {}),
  }
  const [items, total] = await Promise.all([
    prisma.accountingPeriod.findMany({ where, skip, take, orderBy: { periodNumber: 'asc' } }),
    prisma.accountingPeriod.count({ where }),
  ])
  return { items, total, page: query.page, limit: query.limit }
}

export async function getPeriod(tenantId: string, id: string) {
  const item = await prisma.accountingPeriod.findFirst({ where: { id, tenantId } })
  if (!item) throw new NotFoundError('Accounting period not found')
  return item
}

export async function generatePeriods(tenantId: string, input: GeneratePeriodsInput) {
  await getLegalEntityOrThrow(tenantId, input.legalEntityId)
  const fy = await prisma.financialYear.findFirst({
    where: { id: input.financialYearId, tenantId, legalEntityId: input.legalEntityId },
  })
  if (!fy) throw new NotFoundError('Financial year not found')

  const existing = await prisma.accountingPeriod.count({ where: { financialYearId: fy.id } })
  if (existing > 0) throw new ConflictError('Accounting periods already exist for this financial year')

  const defs = generateMonthlyPeriodDefs(fy.startDate, fy.endDate)
  const created = await prisma.$transaction(
    defs.map((def) =>
      prisma.accountingPeriod.create({
        data: {
          tenantId,
          legalEntityId: input.legalEntityId,
          financialYearId: fy.id,
          periodNumber: def.periodNumber,
          name: def.name,
          startDate: def.startDate,
          endDate: def.endDate,
          status: 'OPEN',
        },
      }),
    ),
  )
  return created
}

export async function updatePeriod(tenantId: string, id: string, input: UpdatePeriodInput) {
  const period = await getPeriod(tenantId, id)
  const fy = await prisma.financialYear.findFirst({ where: { id: period.financialYearId, tenantId } })
  if (!fy) throw new NotFoundError('Financial year not found')

  const startDate = input.startDate ? parseDateOnly(input.startDate) : period.startDate
  const endDate = input.endDate ? parseDateOnly(input.endDate) : period.endDate
  assertPeriodInYear(startDate, endDate, fy.startDate, fy.endDate)

  return prisma.accountingPeriod.update({
    where: { id, tenantId },
    data: { name: input.name, startDate, endDate },
  })
}

export async function markUnderReview(tenantId: string, id: string) {
  const period = await getPeriod(tenantId, id)
  if (period.status === 'CLOSED') throw new InvalidStateError('Closed period cannot be marked under review')
  return prisma.accountingPeriod.update({
    where: { id, tenantId },
    data: { status: 'UNDER_REVIEW' },
  })
}

export async function closePeriod(tenantId: string, id: string, userId: string) {
  const period = await getPeriod(tenantId, id)
  if (period.status === 'CLOSED') throw new InvalidStateError('Period is already closed')
  return prisma.accountingPeriod.update({
    where: { id, tenantId },
    data: { status: 'CLOSED', closedAt: new Date(), closedBy: userId },
  })
}

export async function reopenPeriod(tenantId: string, id: string, userId: string, input: ReopenPeriodInput) {
  const period = await getPeriod(tenantId, id)
  if (period.status !== 'CLOSED' && period.status !== 'UNDER_REVIEW') {
    throw new InvalidStateError('Only closed or under-review periods can be reopened')
  }
  if (!input.reason?.trim()) {
    throw new ValidationError('This period cannot be reopened without a reason.')
  }
  return prisma.accountingPeriod.update({
    where: { id, tenantId },
    data: {
      status: 'REOPENED',
      reopenedAt: new Date(),
      reopenedBy: userId,
      reopenReason: input.reason.trim(),
    },
  })
}
