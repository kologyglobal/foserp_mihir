import type { BudgetLine, BudgetVersion, BudgetVersionKind, BudgetVersionStatus, Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { getPagination } from '../../../utils/pagination.js'
import { BudgetLineNotFoundError, BudgetStaleVersionError, BudgetVersionNotFoundError } from './budgeting.errors.js'
import type { ListBudgetVersionsQuery } from './budgeting.schemas.js'

function notDeleted(): Prisma.BudgetVersionWhereInput {
  return { deletedAt: null }
}

export async function listVersions(tenantId: string, query: ListBudgetVersionsQuery) {
  const { skip, take } = getPagination(query)
  const where: Prisma.BudgetVersionWhereInput = {
    tenantId,
    ...notDeleted(),
    ...(query.legalEntityId ? { legalEntityId: query.legalEntityId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? { OR: [{ code: { contains: query.search } }, { name: { contains: query.search } }] }
      : {}),
  }
  const [items, total] = await Promise.all([
    prisma.budgetVersion.findMany({ where, skip, take, orderBy: [{ updatedAt: 'desc' }] }),
    prisma.budgetVersion.count({ where }),
  ])
  return { items, total, page: query.page, limit: query.limit }
}

export async function getVersion(tenantId: string, id: string): Promise<BudgetVersion> {
  const row = await prisma.budgetVersion.findFirst({ where: { id, tenantId, ...notDeleted() } })
  if (!row) throw new BudgetVersionNotFoundError()
  return row
}

export async function findByCode(tenantId: string, code: string): Promise<BudgetVersion | null> {
  return prisma.budgetVersion.findFirst({ where: { tenantId, code, ...notDeleted() } })
}

export async function createVersion(data: {
  tenantId: string
  legalEntityId: string
  code: string
  name: string
  kind: BudgetVersionKind
  financialYearLabel: string
  fyStartDate: Date
  fyEndDate: Date
  currencyCode: string
  notes: string | null
  isPrimary: boolean
  createdBy: string | null
}): Promise<BudgetVersion> {
  return prisma.budgetVersion.create({
    data: {
      tenantId: data.tenantId,
      legalEntityId: data.legalEntityId,
      code: data.code,
      name: data.name,
      kind: data.kind,
      financialYearLabel: data.financialYearLabel,
      fyStartDate: data.fyStartDate,
      fyEndDate: data.fyEndDate,
      currencyCode: data.currencyCode,
      notes: data.notes,
      isPrimary: data.isPrimary,
      createdBy: data.createdBy,
      updatedBy: data.createdBy,
    },
  })
}

export async function updateVersion(
  tenantId: string,
  id: string,
  data: Prisma.BudgetVersionUpdateInput & { expectedUpdatedAt: Date },
): Promise<BudgetVersion> {
  const current = await getVersion(tenantId, id)
  if (current.updatedAt.getTime() !== data.expectedUpdatedAt.getTime()) {
    throw new BudgetStaleVersionError()
  }
  const { expectedUpdatedAt: _, ...rest } = data
  return prisma.budgetVersion.update({ where: { id }, data: rest })
}

export async function countByStatus(tenantId: string, legalEntityId: string) {
  const rows = await prisma.budgetVersion.groupBy({
    by: ['status'],
    where: { tenantId, legalEntityId, ...notDeleted() },
    _count: { _all: true },
  })
  return rows
}

export async function listLines(tenantId: string, versionId: string) {
  return prisma.budgetLine.findMany({
    where: { tenantId, versionId },
    include: { account: { select: { accountCode: true, accountName: true } } },
    orderBy: [{ account: { accountCode: 'asc' } }],
  })
}

export async function getLine(tenantId: string, versionId: string, lineId: string): Promise<BudgetLine> {
  const row = await prisma.budgetLine.findFirst({ where: { id: lineId, tenantId, versionId } })
  if (!row) throw new BudgetLineNotFoundError()
  return row
}

export async function findLineByAccount(
  tenantId: string,
  versionId: string,
  accountId: string,
): Promise<BudgetLine | null> {
  return prisma.budgetLine.findFirst({ where: { tenantId, versionId, accountId } })
}

export async function createLine(data: Prisma.BudgetLineUncheckedCreateInput): Promise<BudgetLine> {
  return prisma.budgetLine.create({ data })
}

export async function updateLine(
  tenantId: string,
  versionId: string,
  lineId: string,
  data: Prisma.BudgetLineUpdateInput,
): Promise<BudgetLine> {
  await getLine(tenantId, versionId, lineId)
  return prisma.budgetLine.update({ where: { id: lineId }, data })
}

export async function deleteLine(tenantId: string, versionId: string, lineId: string): Promise<void> {
  await getLine(tenantId, versionId, lineId)
  await prisma.budgetLine.delete({ where: { id: lineId } })
}

export async function sumLineTotals(tenantId: string, versionId: string): Promise<string> {
  const lines = await prisma.budgetLine.findMany({ where: { tenantId, versionId } })
  let total = 0
  for (const l of lines) {
    total +=
      Number(l.amountApr) +
      Number(l.amountMay) +
      Number(l.amountJun) +
      Number(l.amountJul) +
      Number(l.amountAug) +
      Number(l.amountSep) +
      Number(l.amountOct) +
      Number(l.amountNov) +
      Number(l.amountDec) +
      Number(l.amountJan) +
      Number(l.amountFeb) +
      Number(l.amountMar)
  }
  return total.toFixed(4)
}

export type { BudgetVersionStatus }
