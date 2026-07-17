import { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { getPagination } from '../../../utils/pagination.js'
import { ConflictError, InvalidStateError, NotFoundError } from '../../../utils/errors.js'
import {
  assertFyDateOrder,
  datesOverlap,
  generateMonthlyPeriodDefs,
  getLegalEntityOrThrow,
  parseDateOnly,
  unsetOtherCurrentFy,
} from '../shared/finance.helpers.js'
import type { CreateFinancialYearInput, ListFinancialYearsQuery, UpdateFinancialYearInput } from './financial-year.validation.js'

async function assertNoOverlap(
  tenantId: string,
  legalEntityId: string,
  startDate: Date,
  endDate: Date,
  excludeId?: string,
): Promise<void> {
  const existing = await prisma.financialYear.findMany({
    where: {
      tenantId,
      legalEntityId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  })
  for (const fy of existing) {
    if (datesOverlap(startDate, endDate, fy.startDate, fy.endDate)) {
      throw new ConflictError(`This financial year overlaps ${fy.name}`)
    }
  }
}

export async function listFinancialYears(tenantId: string, query: ListFinancialYearsQuery) {
  if (!query.legalEntityId) throw new NotFoundError('legalEntityId query parameter is required')
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const { skip, take } = getPagination(query)
  const where: Prisma.FinancialYearWhereInput = {
    tenantId,
    legalEntityId: query.legalEntityId,
    ...(query.status ? { status: query.status } : {}),
  }
  const [items, total] = await Promise.all([
    prisma.financialYear.findMany({ where, skip, take, orderBy: { startDate: 'desc' } }),
    prisma.financialYear.count({ where }),
  ])
  return { items, total, page: query.page, limit: query.limit }
}

export async function getFinancialYear(tenantId: string, id: string) {
  const item = await prisma.financialYear.findFirst({ where: { id, tenantId } })
  if (!item) throw new NotFoundError('Financial year not found')
  return item
}

export async function createFinancialYear(tenantId: string, userId: string, input: CreateFinancialYearInput) {
  await getLegalEntityOrThrow(tenantId, input.legalEntityId)
  const startDate = parseDateOnly(input.startDate)
  const endDate = parseDateOnly(input.endDate)
  assertFyDateOrder(startDate, endDate)
  await assertNoOverlap(tenantId, input.legalEntityId, startDate, endDate)

  const isCurrent = input.isCurrent ?? false
  return prisma.$transaction(async (tx) => {
    if (isCurrent) {
      await tx.financialYear.updateMany({
        where: { tenantId, legalEntityId: input.legalEntityId, isCurrent: true },
        data: { isCurrent: false },
      })
    }
    return tx.financialYear.create({
      data: {
        tenantId,
        legalEntityId: input.legalEntityId,
        name: input.name,
        startDate,
        endDate,
        status: 'DRAFT',
        isCurrent,
        createdBy: userId,
        updatedBy: userId,
      },
    })
  })
}

export async function updateFinancialYear(
  tenantId: string,
  id: string,
  userId: string,
  input: UpdateFinancialYearInput,
) {
  const existing = await getFinancialYear(tenantId, id)
  const startDate = input.startDate ? parseDateOnly(input.startDate) : existing.startDate
  const endDate = input.endDate ? parseDateOnly(input.endDate) : existing.endDate
  assertFyDateOrder(startDate, endDate)
  await assertNoOverlap(tenantId, existing.legalEntityId, startDate, endDate, id)

  if (input.isCurrent) {
    await unsetOtherCurrentFy(tenantId, existing.legalEntityId, id)
  }

  return prisma.financialYear.update({
    where: { id, tenantId },
    data: {
      name: input.name,
      startDate,
      endDate,
      isCurrent: input.isCurrent,
      updatedBy: userId,
    },
  })
}

export async function activateFinancialYear(tenantId: string, id: string, userId: string) {
  const fy = await getFinancialYear(tenantId, id)
  if (fy.status === 'CLOSED') throw new InvalidStateError('Closed financial year cannot be activated')

  return prisma.$transaction(async (tx) => {
    await tx.financialYear.updateMany({
      where: { tenantId, legalEntityId: fy.legalEntityId, isCurrent: true, id: { not: id } },
      data: { isCurrent: false },
    })

    const periodCount = await tx.accountingPeriod.count({ where: { financialYearId: id } })
    if (periodCount === 0) {
      const defs = generateMonthlyPeriodDefs(fy.startDate, fy.endDate)
      for (const def of defs) {
        await tx.accountingPeriod.create({
          data: {
            tenantId,
            legalEntityId: fy.legalEntityId,
            financialYearId: id,
            periodNumber: def.periodNumber,
            name: def.name,
            startDate: def.startDate,
            endDate: def.endDate,
            status: 'OPEN',
          },
        })
      }
    }

    return tx.financialYear.update({
      where: { id, tenantId },
      data: { status: 'ACTIVE', isCurrent: true, updatedBy: userId },
    })
  })
}

export async function closeFinancialYear(tenantId: string, id: string, userId: string) {
  const fy = await getFinancialYear(tenantId, id)
  if (fy.status === 'CLOSED') throw new InvalidStateError('Financial year is already closed')
  return prisma.financialYear.update({
    where: { id, tenantId },
    data: { status: 'CLOSED', isCurrent: false, updatedBy: userId },
  })
}
