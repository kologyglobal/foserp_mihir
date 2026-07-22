import type { Request } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { formatForPersistence } from '../../shared/finance-decimal.js'
import { getLegalEntityOrThrow } from '../../shared/finance.helpers.js'
import { getClosingControls } from './closing-controls.service.js'
import { getDailyLiquidity } from './daily-liquidity.service.js'
import {
  TreasuryDayCloseAlreadyExistsError,
  TreasuryDayCloseInvalidStatusError,
  TreasuryDayCloseNotFoundError,
  TreasuryDayCloseStaleVersionError,
} from './treasury-liquidity.errors.js'
import type {
  CreateDayCloseInput,
  DayCloseLifecycleInput,
  ListDayClosesQuery,
  ReopenDayCloseInput,
} from './treasury-liquidity.schemas.js'
import type { ClosingControlItem, TreasuryDayCloseDto } from './treasury-liquidity.types.js'

function serializeDayClose(
  row: {
    id: string
    legalEntityId: string
    closeDate: Date
    status: 'OPEN' | 'REVIEWED' | 'CLOSED'
    bookBankBalance: Prisma.Decimal
    bookCashBalance: Prisma.Decimal
    availableLiquidity: Prisma.Decimal
    currencyCode: string
    checklistJson: Prisma.JsonValue
    notes: string | null
    reviewedAt: Date | null
    closedAt: Date | null
    createdAt: Date
    updatedAt: Date
  },
): TreasuryDayCloseDto {
  const checklist = (Array.isArray(row.checklistJson) ? row.checklistJson : []) as unknown as ClosingControlItem[]
  return {
    id: row.id,
    legalEntityId: row.legalEntityId,
    closeDate: row.closeDate.toISOString().slice(0, 10),
    status: row.status,
    bookBankBalance: formatForPersistence(row.bookBankBalance),
    bookCashBalance: formatForPersistence(row.bookCashBalance),
    availableLiquidity: formatForPersistence(row.availableLiquidity),
    currencyCode: row.currencyCode,
    checklist,
    notes: row.notes,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    allowedActions: {
      view: true,
      review: row.status === 'OPEN',
      close: row.status === 'OPEN' || row.status === 'REVIEWED',
      reopen: row.status === 'CLOSED' || row.status === 'REVIEWED',
    },
  }
}

export async function listDayCloses(tenantId: string, query: ListDayClosesQuery) {
  const page = query.page ?? 1
  const limit = query.limit ?? 20
  const where: Prisma.TreasuryDayCloseWhereInput = {
    tenantId,
    legalEntityId: query.legalEntityId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.dateFrom || query.dateTo
      ? {
          closeDate: {
            ...(query.dateFrom ? { gte: new Date(`${query.dateFrom}T00:00:00.000Z`) } : {}),
            ...(query.dateTo ? { lte: new Date(`${query.dateTo}T00:00:00.000Z`) } : {}),
          },
        }
      : {}),
  }
  const [total, rows] = await Promise.all([
    prisma.treasuryDayClose.count({ where }),
    prisma.treasuryDayClose.findMany({
      where,
      orderBy: { closeDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])
  return {
    items: rows.map(serializeDayClose),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  }
}

export async function getDayClose(tenantId: string, id: string): Promise<TreasuryDayCloseDto> {
  const row = await prisma.treasuryDayClose.findFirst({ where: { id, tenantId } })
  if (!row) throw new TreasuryDayCloseNotFoundError()
  return serializeDayClose(row)
}

export async function createDayClose(req: Request, tenantId: string, input: CreateDayCloseInput): Promise<TreasuryDayCloseDto> {
  await getLegalEntityOrThrow(tenantId, input.legalEntityId)
  const controls = await getClosingControls(tenantId, {
    legalEntityId: input.legalEntityId,
    asOfDate: input.closeDate,
  })
  const liquidity = await getDailyLiquidity(tenantId, {
    legalEntityId: input.legalEntityId,
    asOfDate: input.closeDate,
  })

  try {
    const row = await prisma.treasuryDayClose.create({
      data: {
        tenantId,
        legalEntityId: input.legalEntityId,
        closeDate: new Date(`${input.closeDate}T00:00:00.000Z`),
        status: 'OPEN',
        bookBankBalance: liquidity.bookBankBalance,
        bookCashBalance: liquidity.bookCashBalance,
        availableLiquidity: liquidity.availableLiquidity,
        currencyCode: liquidity.currencyCode,
        checklistJson: controls.items as unknown as Prisma.InputJsonValue,
        notes: input.notes ?? null,
        createdById: req.context?.userId ?? null,
        updatedById: req.context?.userId ?? null,
      },
    })
    return serializeDayClose(row)
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new TreasuryDayCloseAlreadyExistsError()
    }
    throw e
  }
}

async function loadForMutation(tenantId: string, id: string, expectedUpdatedAt: string) {
  const row = await prisma.treasuryDayClose.findFirst({ where: { id, tenantId } })
  if (!row) throw new TreasuryDayCloseNotFoundError()
  if (row.updatedAt.toISOString() !== expectedUpdatedAt) throw new TreasuryDayCloseStaleVersionError()
  return row
}

export async function markDayCloseReviewed(
  req: Request,
  tenantId: string,
  id: string,
  input: DayCloseLifecycleInput,
): Promise<TreasuryDayCloseDto> {
  const existing = await loadForMutation(tenantId, id, input.expectedUpdatedAt)
  if (existing.status !== 'OPEN') {
    throw new TreasuryDayCloseInvalidStatusError('Only OPEN day closes can be marked reviewed')
  }
  const closeDate = existing.closeDate.toISOString().slice(0, 10)
  const controls = await getClosingControls(tenantId, {
    legalEntityId: existing.legalEntityId,
    asOfDate: closeDate,
  })
  const liquidity = await getDailyLiquidity(tenantId, {
    legalEntityId: existing.legalEntityId,
    asOfDate: closeDate,
  })
  const row = await prisma.treasuryDayClose.update({
    where: { id: existing.id },
    data: {
      status: 'REVIEWED',
      bookBankBalance: liquidity.bookBankBalance,
      bookCashBalance: liquidity.bookCashBalance,
      availableLiquidity: liquidity.availableLiquidity,
      checklistJson: controls.items as unknown as Prisma.InputJsonValue,
      notes: input.notes ?? existing.notes,
      reviewedAt: new Date(),
      reviewedById: req.context?.userId ?? null,
      updatedById: req.context?.userId ?? null,
    },
  })
  return serializeDayClose(row)
}

export async function closeDayClose(
  req: Request,
  tenantId: string,
  id: string,
  input: DayCloseLifecycleInput,
): Promise<TreasuryDayCloseDto> {
  const existing = await loadForMutation(tenantId, id, input.expectedUpdatedAt)
  if (existing.status === 'CLOSED') {
    throw new TreasuryDayCloseInvalidStatusError('Day close is already CLOSED')
  }
  const closeDate = existing.closeDate.toISOString().slice(0, 10)
  const controls = await getClosingControls(tenantId, {
    legalEntityId: existing.legalEntityId,
    asOfDate: closeDate,
  })
  if (!controls.readyToClose && controls.items.some((i) => !i.passed && i.severity === 'critical')) {
    throw new TreasuryDayCloseInvalidStatusError('Critical closing controls failed — resolve before closing the day')
  }
  const liquidity = await getDailyLiquidity(tenantId, {
    legalEntityId: existing.legalEntityId,
    asOfDate: closeDate,
  })
  const row = await prisma.treasuryDayClose.update({
    where: { id: existing.id },
    data: {
      status: 'CLOSED',
      bookBankBalance: liquidity.bookBankBalance,
      bookCashBalance: liquidity.bookCashBalance,
      availableLiquidity: liquidity.availableLiquidity,
      checklistJson: controls.items as unknown as Prisma.InputJsonValue,
      notes: input.notes ?? existing.notes,
      closedAt: new Date(),
      closedById: req.context?.userId ?? null,
      reviewedAt: existing.reviewedAt ?? new Date(),
      reviewedById: existing.reviewedById ?? req.context?.userId ?? null,
      updatedById: req.context?.userId ?? null,
    },
  })
  return serializeDayClose(row)
}

export async function reopenDayClose(
  req: Request,
  tenantId: string,
  id: string,
  input: ReopenDayCloseInput,
): Promise<TreasuryDayCloseDto> {
  const existing = await loadForMutation(tenantId, id, input.expectedUpdatedAt)
  if (existing.status === 'OPEN') {
    throw new TreasuryDayCloseInvalidStatusError('Day close is already OPEN')
  }
  const row = await prisma.treasuryDayClose.update({
    where: { id: existing.id },
    data: {
      status: 'OPEN',
      reopenReason: input.reason,
      closedAt: null,
      closedById: null,
      notes: input.notes ?? existing.notes,
      updatedById: req.context?.userId ?? null,
    },
  })
  return serializeDayClose(row)
}
