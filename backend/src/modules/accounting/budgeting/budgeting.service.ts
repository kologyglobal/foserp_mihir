import type { Request } from 'express'
import { prisma } from '../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import { getLegalEntityOrThrow } from '../shared/finance.helpers.js'
import {
  BudgetCodeConflictError,
  BudgetLifecycleError,
  BudgetLineConflictError,
  BudgetValidationError,
} from './budgeting.errors.js'
import * as repo from './budgeting.repository.js'
import type {
  BudgetLifecycleInput,
  BudgetVsActualQuery,
  CreateBudgetLineInput,
  CreateBudgetVersionInput,
  ListBudgetVersionsQuery,
  OverviewQuery,
  UpdateBudgetLineInput,
  UpdateBudgetVersionInput,
} from './budgeting.schemas.js'
import {
  FY_MONTHS,
  emptyMonths,
  lineAmountFields,
  monthsFromLine,
  sumMonths,
  toBudgetLineDto,
  toBudgetVersionDto,
  type FyMonthKey,
} from './budgeting.types.js'

function auditMeta(req: Request) {
  return auditFromRequest(req)
}

function assertEditable(status: string) {
  if (status === 'LOCKED' || status === 'CANCELLED' || status === 'SUPERSEDED') {
    throw new BudgetLifecycleError(`Cannot edit a ${status} budget version`)
  }
}

export async function getOverview(tenantId: string, query: OverviewQuery) {
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const byStatus = await repo.countByStatus(tenantId, query.legalEntityId)
  const counts: Record<string, number> = {}
  let totalVersions = 0
  for (const row of byStatus) {
    counts[row.status] = row._count._all
    totalVersions += row._count._all
  }
  const versions = await repo.listVersions(tenantId, {
    legalEntityId: query.legalEntityId,
    page: 1,
    limit: 5,
    sortOrder: 'desc',
  })
  let budgetTotal = '0.0000'
  const primary = versions.items.find((v) => v.isPrimary && v.status === 'APPROVED') ?? versions.items[0]
  if (primary) budgetTotal = await repo.sumLineTotals(tenantId, primary.id)

  return {
    legalEntityId: query.legalEntityId,
    totalVersions,
    countsByStatus: counts,
    primaryVersionId: primary?.id ?? null,
    primaryBudgetTotal: budgetTotal,
    recentVersions: versions.items.map(toBudgetVersionDto),
  }
}

export async function listVersions(tenantId: string, query: ListBudgetVersionsQuery) {
  if (query.legalEntityId) await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const result = await repo.listVersions(tenantId, query)
  return { ...result, items: result.items.map(toBudgetVersionDto) }
}

export async function getVersion(tenantId: string, id: string) {
  return toBudgetVersionDto(await repo.getVersion(tenantId, id))
}

export async function createVersion(req: Request, tenantId: string, input: CreateBudgetVersionInput) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? null
  await getLegalEntityOrThrow(tenantId, input.legalEntityId)
  const code = input.code.toUpperCase()
  if (await repo.findByCode(tenantId, code)) throw new BudgetCodeConflictError()
  if (input.fyEndDate < input.fyStartDate) {
    throw new BudgetValidationError('fyEndDate must be on or after fyStartDate', [
      { field: 'fyEndDate', message: 'Invalid range' },
    ])
  }
  const record = await repo.createVersion({
    tenantId,
    legalEntityId: input.legalEntityId,
    code,
    name: input.name,
    kind: input.kind,
    financialYearLabel: input.financialYearLabel,
    fyStartDate: new Date(input.fyStartDate),
    fyEndDate: new Date(input.fyEndDate),
    currencyCode: input.currencyCode,
    notes: input.notes ?? null,
    isPrimary: input.isPrimary ?? false,
    createdBy: userId,
  })
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'budget_version',
    entityId: record.id,
    action: 'CREATE',
    newValues: toBudgetVersionDto(record),
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return toBudgetVersionDto(record)
}

export async function updateVersion(
  req: Request,
  tenantId: string,
  id: string,
  input: UpdateBudgetVersionInput,
) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? null
  const before = await repo.getVersion(tenantId, id)
  assertEditable(before.status)
  const record = await repo.updateVersion(tenantId, id, {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.kind !== undefined ? { kind: input.kind } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    ...(input.isPrimary !== undefined ? { isPrimary: input.isPrimary } : {}),
    updatedBy: userId,
    expectedUpdatedAt: new Date(input.expectedUpdatedAt),
  })
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'budget_version',
    entityId: record.id,
    action: 'UPDATE',
    oldValues: toBudgetVersionDto(before),
    newValues: toBudgetVersionDto(record),
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return toBudgetVersionDto(record)
}

export async function submitVersion(req: Request, tenantId: string, id: string, input: BudgetLifecycleInput) {
  const userId = req.context?.userId ?? null
  const before = await repo.getVersion(tenantId, id)
  if (!['DRAFT', 'IN_PREPARATION'].includes(before.status)) {
    throw new BudgetLifecycleError(`Cannot submit from status ${before.status}`)
  }
  const record = await repo.updateVersion(tenantId, id, {
    status: 'PENDING_APPROVAL',
    submittedAt: new Date(),
    submittedBy: userId,
    updatedBy: userId,
    expectedUpdatedAt: new Date(input.expectedUpdatedAt),
  })
  return toBudgetVersionDto(record)
}

export async function approveVersion(req: Request, tenantId: string, id: string, input: BudgetLifecycleInput) {
  const userId = req.context?.userId ?? null
  const before = await repo.getVersion(tenantId, id)
  if (before.status !== 'PENDING_APPROVAL') {
    throw new BudgetLifecycleError(`Cannot approve from status ${before.status}`)
  }
  const record = await repo.updateVersion(tenantId, id, {
    status: 'APPROVED',
    approvedAt: new Date(),
    approvedBy: userId,
    updatedBy: userId,
    expectedUpdatedAt: new Date(input.expectedUpdatedAt),
  })
  return toBudgetVersionDto(record)
}

export async function lockVersion(req: Request, tenantId: string, id: string, input: BudgetLifecycleInput) {
  const userId = req.context?.userId ?? null
  const before = await repo.getVersion(tenantId, id)
  if (before.status !== 'APPROVED') {
    throw new BudgetLifecycleError(`Cannot lock from status ${before.status}`)
  }
  const record = await repo.updateVersion(tenantId, id, {
    status: 'LOCKED',
    lockedAt: new Date(),
    lockedBy: userId,
    updatedBy: userId,
    expectedUpdatedAt: new Date(input.expectedUpdatedAt),
  })
  return toBudgetVersionDto(record)
}

export async function listLines(tenantId: string, versionId: string) {
  await repo.getVersion(tenantId, versionId)
  const rows = await repo.listLines(tenantId, versionId)
  return rows.map((r) => toBudgetLineDto(r, r.account))
}

export async function createLine(
  req: Request,
  tenantId: string,
  versionId: string,
  input: CreateBudgetLineInput,
) {
  const userId = req.context?.userId ?? null
  const version = await repo.getVersion(tenantId, versionId)
  assertEditable(version.status)
  const account = await prisma.account.findFirst({
    where: { id: input.accountId, tenantId, legalEntityId: version.legalEntityId },
  })
  if (!account) {
    throw new BudgetValidationError('Account not found in this legal entity', [
      { field: 'accountId', message: 'Invalid account' },
    ])
  }
  if (await repo.findLineByAccount(tenantId, versionId, input.accountId)) {
    throw new BudgetLineConflictError()
  }
  const amounts = lineAmountFields(input.months)
  const row = await repo.createLine({
    tenantId,
    versionId,
    accountId: input.accountId,
    costCentreId: input.costCentreId ?? null,
    ...amounts,
    notes: input.notes ?? null,
    createdBy: userId,
    updatedBy: userId,
  })
  return toBudgetLineDto(row, account)
}

export async function updateLine(
  req: Request,
  tenantId: string,
  versionId: string,
  lineId: string,
  input: UpdateBudgetLineInput,
) {
  const userId = req.context?.userId ?? null
  const version = await repo.getVersion(tenantId, versionId)
  assertEditable(version.status)
  const row = await repo.updateLine(tenantId, versionId, lineId, {
    ...(input.costCentreId !== undefined ? { costCentreId: input.costCentreId } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    ...(input.months ? lineAmountFields(input.months) : {}),
    updatedBy: userId,
  })
  const account = await prisma.account.findFirst({
    where: { id: row.accountId },
    select: { accountCode: true, accountName: true },
  })
  return toBudgetLineDto(row, account)
}

export async function deleteLine(_req: Request, tenantId: string, versionId: string, lineId: string) {
  const version = await repo.getVersion(tenantId, versionId)
  assertEditable(version.status)
  await repo.deleteLine(tenantId, versionId, lineId)
  return { id: lineId, deleted: true }
}

function calendarMonthToFy(monthIndex0: number): FyMonthKey {
  // JS: 0=Jan … 11=Dec → Indian FY Apr–Mar
  const map: FyMonthKey[] = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]
  return map[monthIndex0]!
}

export async function getBudgetVsActual(tenantId: string, query: BudgetVsActualQuery) {
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const version = await repo.getVersion(tenantId, query.versionId)
  if (version.legalEntityId !== query.legalEntityId) {
    throw new BudgetValidationError('versionId does not belong to legalEntityId')
  }

  const lines = await repo.listLines(tenantId, version.id)
  const actuals = await prisma.accountingVoucherLine.findMany({
    where: {
      tenantId,
      legalEntityId: query.legalEntityId,
      voucher: {
        status: 'POSTED',
        postingDate: { gte: version.fyStartDate, lte: version.fyEndDate },
      },
    },
    select: {
      accountId: true,
      baseDebitAmount: true,
      baseCreditAmount: true,
      voucher: { select: { postingDate: true } },
    },
  })

  const actualByAccount = new Map<string, Record<FyMonthKey, number>>()
  for (const row of actuals) {
    const m = calendarMonthToFy(row.voucher.postingDate.getUTCMonth())
    const net = Number(row.baseDebitAmount) - Number(row.baseCreditAmount)
    const bucket = actualByAccount.get(row.accountId) ?? Object.fromEntries(FY_MONTHS.map((k) => [k, 0]))
    bucket[m] = (bucket[m] ?? 0) + net
    actualByAccount.set(row.accountId, bucket as Record<FyMonthKey, number>)
  }

  const accountIds = new Set<string>([
    ...lines.map((l) => l.accountId),
    ...actualByAccount.keys(),
  ])
  const accounts = await prisma.account.findMany({
    where: { tenantId, id: { in: [...accountIds] } },
    select: { id: true, accountCode: true, accountName: true },
  })
  const accountMap = new Map(accounts.map((a) => [a.id, a]))

  const rows = [...accountIds].map((accountId) => {
    const line = lines.find((l) => l.accountId === accountId)
    const budget = line ? monthsFromLine(line) : emptyMonths()
    const actRaw = actualByAccount.get(accountId)
    const actual = emptyMonths()
    const variance = emptyMonths()
    for (const m of FY_MONTHS) {
      actual[m] = (actRaw?.[m] ?? 0).toFixed(4)
      variance[m] = (Number(budget[m]) - Number(actual[m])).toFixed(4)
    }
    const acct = accountMap.get(accountId)
    return {
      accountId,
      accountCode: acct?.accountCode ?? null,
      accountName: acct?.accountName ?? null,
      budget,
      actual,
      variance,
      budgetTotal: sumMonths(budget),
      actualTotal: sumMonths(actual),
      varianceTotal: sumMonths(variance),
    }
  })

  rows.sort((a, b) => (a.accountCode ?? '').localeCompare(b.accountCode ?? ''))

  return {
    version: toBudgetVersionDto(version),
    rows,
  }
}
