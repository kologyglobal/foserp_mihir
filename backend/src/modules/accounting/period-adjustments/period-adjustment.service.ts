/**
 * Period-close adjustments — month-end accruals + prepaid amortisation.
 *
 * ACCRUAL: Dr expense / Cr accrued-liability on the period end date, reversed into
 * the following period so the expense lands once in the period it belongs to.
 * PREPAID: an already-capitalised prepaid asset amortised into expense, one
 * schedule row per accounting period.
 */
import type { Request } from 'express'
import type { Account, AccountingPeriod, Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { createAuditLog } from '../../../services/audit.service.js'
import { NotFoundError, ValidationError } from '../../../utils/errors.js'
import { add, divide, formatForPersistence, multiply, subtract, toDecimal } from '../shared/finance-decimal.js'
import { PERIOD_ADJUSTMENT_ERROR_CODES as CODES, unprocessable } from './period-adjustment.errors.js'
import * as repo from './period-adjustment.repository.js'
import type {
  CancelPeriodAdjustmentInput,
  CreatePeriodAdjustmentInput,
  ListPeriodAdjustmentsQuery,
  UpdatePeriodAdjustmentInput,
} from './period-adjustment.schemas.js'

const OPEN_PERIOD_STATUSES: AccountingPeriod['status'][] = ['OPEN', 'REOPENED']

type AccountSummary = Pick<Account, 'id' | 'accountCode' | 'accountName' | 'category' | 'isActive' | 'isGroup'>

/** Minimum period shape needed to walk the period chain (list includes select a subset). */
type PeriodCursor = Pick<
  AccountingPeriod,
  'id' | 'name' | 'periodNumber' | 'startDate' | 'endDate' | 'financialYearId' | 'status'
>

export interface PeriodAdjustmentScheduleDto {
  id: string
  sequence: number
  periodId: string
  periodName: string
  periodStatus: string
  periodEndDate: string
  amount: string
  status: string
  voucherId: string | null
  voucherNumber: string | null
  postedAt: string | null
}

export interface PeriodAdjustmentDto {
  id: string
  kind: string
  adjustmentNumber: string
  status: string
  legalEntityId: string
  description: string
  narration: string | null
  totalAmount: string
  recognisedAmount: string
  remainingAmount: string
  currencyCode: string
  expenseAccount: { id: string; accountCode: string; accountName: string }
  balanceSheetAccount: { id: string; accountCode: string; accountName: string }
  costCentre: { id: string; code: string; name: string } | null
  departmentReference: string | null
  projectReference: string | null
  period: { id: string; name: string; status: string; startDate: string; endDate: string }
  postingDate: string
  autoReverse: boolean
  reversalPeriod: { id: string; name: string; status: string; startDate: string } | null
  numberOfPeriods: number | null
  voucherId: string | null
  voucherNumber: string | null
  reversalVoucherId: string | null
  reversalVoucherNumber: string | null
  postedAt: string | null
  reversedAt: string | null
  cancelledAt: string | null
  cancelReason: string | null
  schedules: PeriodAdjustmentScheduleDto[]
  createdAt: string
  updatedAt: string
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

export function serializeAdjustment(row: repo.PeriodAdjustmentWithRelations): PeriodAdjustmentDto {
  return {
    id: row.id,
    kind: row.kind,
    adjustmentNumber: row.adjustmentNumber,
    status: row.status,
    legalEntityId: row.legalEntityId,
    description: row.description,
    narration: row.narration,
    totalAmount: formatForPersistence(row.totalAmount, 4),
    recognisedAmount: formatForPersistence(row.recognisedAmount, 4),
    remainingAmount: formatForPersistence(subtract(row.totalAmount, row.recognisedAmount), 4),
    currencyCode: row.currencyCode,
    expenseAccount: {
      id: row.expenseAccount.id,
      accountCode: row.expenseAccount.accountCode,
      accountName: row.expenseAccount.accountName,
    },
    balanceSheetAccount: {
      id: row.balanceSheetAccount.id,
      accountCode: row.balanceSheetAccount.accountCode,
      accountName: row.balanceSheetAccount.accountName,
    },
    costCentre: row.costCentre ? { id: row.costCentre.id, code: row.costCentre.code, name: row.costCentre.name } : null,
    departmentReference: row.departmentReference,
    projectReference: row.projectReference,
    period: {
      id: row.period.id,
      name: row.period.name,
      status: row.period.status,
      startDate: toIsoDate(row.period.startDate),
      endDate: toIsoDate(row.period.endDate),
    },
    postingDate: toIsoDate(row.period.endDate),
    autoReverse: row.autoReverse,
    reversalPeriod: row.reversalPeriod
      ? {
          id: row.reversalPeriod.id,
          name: row.reversalPeriod.name,
          status: row.reversalPeriod.status,
          startDate: toIsoDate(row.reversalPeriod.startDate),
        }
      : null,
    numberOfPeriods: row.numberOfPeriods,
    voucherId: row.voucherId,
    voucherNumber: row.voucherNumber,
    reversalVoucherId: row.reversalVoucherId,
    reversalVoucherNumber: row.reversalVoucherNumber,
    postedAt: row.postedAt?.toISOString() ?? null,
    reversedAt: row.reversedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    cancelReason: row.cancelReason,
    schedules: row.schedules.map((s) => ({
      id: s.id,
      sequence: s.sequence,
      periodId: s.periodId,
      periodName: s.period.name,
      periodStatus: s.period.status,
      periodEndDate: toIsoDate(s.period.endDate),
      amount: formatForPersistence(s.amount, 4),
      status: s.status,
      voucherId: s.voucherId,
      voucherNumber: s.voucherNumber,
      postedAt: s.postedAt?.toISOString() ?? null,
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function audit(req: Request, tenantId: string, id: string, action: string, values?: Record<string, unknown>) {
  await createAuditLog({
    tenantId,
    userId: req.context?.userId,
    module: 'ACCOUNTING',
    entity: 'PeriodEndAdjustment',
    entityId: id,
    action,
    newValues: values,
    ipAddress: req.ip,
    userAgent: req.headers?.['user-agent'] as string | undefined,
  })
}

export async function assertFinanceActive(tenantId: string, legalEntityId: string): Promise<void> {
  const settings = await prisma.financeSettings.findFirst({ where: { tenantId, legalEntityId } })
  if (!settings?.financeActivated) {
    throw unprocessable('Finance is not activated for this legal entity', CODES.FINANCE_NOT_ACTIVATED)
  }
}

async function loadPeriodOrThrow(tenantId: string, legalEntityId: string, periodId: string): Promise<AccountingPeriod> {
  const period = await prisma.accountingPeriod.findFirst({ where: { id: periodId, tenantId, legalEntityId } })
  if (!period) throw new NotFoundError('Accounting period not found for this legal entity')
  return period
}

/**
 * Next chronological period: same financial year by periodNumber, otherwise the
 * earliest period of a later financial year.
 */
export async function resolveNextPeriod(
  tenantId: string,
  legalEntityId: string,
  period: PeriodCursor,
): Promise<AccountingPeriod | null> {
  const sameYear = await prisma.accountingPeriod.findFirst({
    where: { tenantId, legalEntityId, financialYearId: period.financialYearId, periodNumber: { gt: period.periodNumber } },
    orderBy: { periodNumber: 'asc' },
  })
  if (sameYear) return sameYear

  return prisma.accountingPeriod.findFirst({
    where: { tenantId, legalEntityId, startDate: { gt: period.endDate } },
    orderBy: { startDate: 'asc' },
  })
}

/** The consecutive periods a prepaid schedule amortises over, starting at `period`. */
async function resolveSchedulePeriods(
  tenantId: string,
  legalEntityId: string,
  period: PeriodCursor,
  count: number,
): Promise<PeriodCursor[]> {
  const periods: PeriodCursor[] = [period]
  let cursor: PeriodCursor = period
  while (periods.length < count) {
    const next = await resolveNextPeriod(tenantId, legalEntityId, cursor)
    if (!next) break
    periods.push(next)
    cursor = next
  }
  if (periods.length < count) {
    throw unprocessable(
      `Only ${periods.length} accounting period(s) exist from ${period.name}; generate periods for the next financial year before scheduling ${count}`,
      CODES.NEXT_PERIOD_MISSING,
      { availablePeriods: periods.length, requestedPeriods: count },
    )
  }
  return periods
}

async function loadAccountOrThrow(
  tenantId: string,
  legalEntityId: string,
  accountId: string,
  label: string,
): Promise<AccountSummary> {
  const account = await prisma.account.findFirst({
    where: { id: accountId, tenantId, legalEntityId },
    select: { id: true, accountCode: true, accountName: true, category: true, isActive: true, isGroup: true },
  })
  if (!account) throw new NotFoundError(`${label} account not found for this legal entity`)
  if (account.isGroup) {
    throw unprocessable(`${label} account ${account.accountCode} is a group account and cannot be posted to`, CODES.ACCOUNT_INVALID)
  }
  if (!account.isActive) {
    throw unprocessable(`${label} account ${account.accountCode} is inactive`, CODES.ACCOUNT_INVALID)
  }
  return account
}

async function resolveMappedAccount(
  tenantId: string,
  legalEntityId: string,
  mappingKey: 'ACCRUED_EXPENSE_LIABILITY' | 'PREPAID_EXPENSE_ASSET',
): Promise<string> {
  const mapping = await prisma.defaultAccountMapping.findFirst({
    where: { tenantId, legalEntityId, mappingKey },
    select: { accountId: true },
  })
  if (!mapping) {
    throw unprocessable(
      `Default account mapping ${mappingKey} is not configured. Set it under Finance Settings → Default Mappings or pass balanceSheetAccountId.`,
      CODES.MAPPING_MISSING,
      { mappingKey },
    )
  }
  return mapping.accountId
}

/** Even split with the rounding remainder placed on the final period. */
export function buildScheduleAmounts(total: Prisma.Decimal | string | number, count: number): string[] {
  const totalDecimal = toDecimal(total)
  const per = divide(totalDecimal, count)
  const rounded = toDecimal(per.toFixed(4))
  const amounts: string[] = []
  for (let i = 0; i < count - 1; i += 1) amounts.push(formatForPersistence(rounded, 4))
  const remainder = subtract(totalDecimal, multiply(rounded, count - 1))
  amounts.push(formatForPersistence(remainder, 4))
  return amounts
}

export async function listPeriodAdjustments(tenantId: string, query: ListPeriodAdjustmentsQuery) {
  const result = await repo.listAdjustments(tenantId, query)
  return { ...result, items: result.items.map(serializeAdjustment) }
}

export async function getPeriodAdjustment(tenantId: string, id: string): Promise<PeriodAdjustmentDto> {
  return serializeAdjustment(await repo.findByIdOrThrow(tenantId, id))
}

export async function createPeriodAdjustment(
  req: Request,
  tenantId: string,
  input: CreatePeriodAdjustmentInput,
): Promise<PeriodAdjustmentDto> {
  await assertFinanceActive(tenantId, input.legalEntityId)
  const period = await loadPeriodOrThrow(tenantId, input.legalEntityId, input.periodId)
  if (!OPEN_PERIOD_STATUSES.includes(period.status)) {
    throw unprocessable(`Period ${period.name} is ${period.status}; adjustments can only be created in an open period`, CODES.PERIOD_NOT_OPEN)
  }

  const expense = await loadAccountOrThrow(tenantId, input.legalEntityId, input.expenseAccountId, 'Expense')
  if (expense.category !== 'EXPENSE') {
    throw unprocessable(
      `Expense account ${expense.accountCode} is category ${expense.category}; period-end adjustments debit an EXPENSE account`,
      CODES.ACCOUNT_INVALID,
    )
  }

  const mappingKey = input.kind === 'ACCRUAL' ? 'ACCRUED_EXPENSE_LIABILITY' : 'PREPAID_EXPENSE_ASSET'
  const balanceSheetAccountId =
    input.balanceSheetAccountId ?? (await resolveMappedAccount(tenantId, input.legalEntityId, mappingKey))
  const balanceSheet = await loadAccountOrThrow(
    tenantId,
    input.legalEntityId,
    balanceSheetAccountId,
    input.kind === 'ACCRUAL' ? 'Accrued liability' : 'Prepaid asset',
  )
  const expectedCategory = input.kind === 'ACCRUAL' ? 'LIABILITY' : 'ASSET'
  if (balanceSheet.category !== expectedCategory) {
    throw unprocessable(
      `${input.kind === 'ACCRUAL' ? 'Accrued liability' : 'Prepaid asset'} account ${balanceSheet.accountCode} is category ${balanceSheet.category}; expected ${expectedCategory}`,
      CODES.ACCOUNT_INVALID,
    )
  }

  if (input.costCentreId) {
    const costCentre = await prisma.costCentre.findFirst({
      where: { id: input.costCentreId, tenantId, legalEntityId: input.legalEntityId, isActive: true, isGroup: false },
      select: { id: true },
    })
    if (!costCentre) throw new NotFoundError('Cost centre not found for this legal entity')
  }

  const schedulePeriods =
    input.kind === 'PREPAID'
      ? await resolveSchedulePeriods(tenantId, input.legalEntityId, period, input.numberOfPeriods)
      : []
  const scheduleAmounts =
    input.kind === 'PREPAID' ? buildScheduleAmounts(input.totalAmount, input.numberOfPeriods) : []

  const data = {
    tenantId,
    legalEntityId: input.legalEntityId,
    kind: input.kind,
    description: input.description,
    narration: input.narration ?? null,
    expenseAccountId: expense.id,
    balanceSheetAccountId: balanceSheet.id,
    totalAmount: input.totalAmount,
    currencyCode: 'INR',
    costCentreId: input.costCentreId ?? null,
    departmentReference: input.departmentReference ?? null,
    projectReference: input.projectReference ?? null,
    periodId: period.id,
    autoReverse: input.kind === 'ACCRUAL' ? (input.autoReverse ?? true) : false,
    numberOfPeriods: input.kind === 'PREPAID' ? input.numberOfPeriods : null,
    createdBy: req.context?.userId ?? null,
    ...(input.kind === 'PREPAID'
      ? {
          schedules: {
            create: schedulePeriods.map((p, index) => ({
              tenantId,
              sequence: index + 1,
              periodId: p.id,
              amount: scheduleAmounts[index]!,
            })),
          },
        }
      : {}),
  }

  // Retry the sequential number on unique-constraint collisions from concurrent creates.
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const adjustmentNumber = await repo.nextAdjustmentNumber(tenantId, input.kind)
    try {
      const created = await prisma.periodEndAdjustment.create({
        data: { ...data, adjustmentNumber },
        include: repo.adjustmentInclude,
      })
      await audit(req, tenantId, created.id, 'PERIOD_ADJUSTMENT_CREATED', {
        adjustmentNumber: created.adjustmentNumber,
        kind: created.kind,
        totalAmount: created.totalAmount.toString(),
      })
      return serializeAdjustment(created)
    } catch (error) {
      const isCollision =
        typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002'
      if (!isCollision || attempt === 7) throw error
    }
  }
  throw new ValidationError('Could not allocate a period-end adjustment number')
}

export async function updatePeriodAdjustment(
  req: Request,
  tenantId: string,
  id: string,
  input: UpdatePeriodAdjustmentInput,
): Promise<PeriodAdjustmentDto> {
  const existing = await repo.findByIdOrThrow(tenantId, id)
  if (existing.status !== 'DRAFT') {
    throw unprocessable(`Adjustment ${existing.adjustmentNumber} is ${existing.status}; only DRAFT adjustments can be edited`, CODES.NOT_EDITABLE)
  }

  const legalEntityId = existing.legalEntityId
  const period = input.periodId ? await loadPeriodOrThrow(tenantId, legalEntityId, input.periodId) : existing.period
  if (input.periodId && !OPEN_PERIOD_STATUSES.includes(period.status)) {
    throw unprocessable(`Period ${period.name} is ${period.status}; pick an open period`, CODES.PERIOD_NOT_OPEN)
  }

  if (input.expenseAccountId) {
    const expense = await loadAccountOrThrow(tenantId, legalEntityId, input.expenseAccountId, 'Expense')
    if (expense.category !== 'EXPENSE') {
      throw unprocessable(`Expense account ${expense.accountCode} is category ${expense.category}; expected EXPENSE`, CODES.ACCOUNT_INVALID)
    }
  }
  if (input.balanceSheetAccountId) {
    const expectedCategory = existing.kind === 'ACCRUAL' ? 'LIABILITY' : 'ASSET'
    const bs = await loadAccountOrThrow(tenantId, legalEntityId, input.balanceSheetAccountId, 'Balance sheet')
    if (bs.category !== expectedCategory) {
      throw unprocessable(`Account ${bs.accountCode} is category ${bs.category}; expected ${expectedCategory}`, CODES.ACCOUNT_INVALID)
    }
  }
  if (input.costCentreId) {
    const costCentre = await prisma.costCentre.findFirst({
      where: { id: input.costCentreId, tenantId, legalEntityId, isActive: true, isGroup: false },
      select: { id: true },
    })
    if (!costCentre) throw new NotFoundError('Cost centre not found for this legal entity')
  }

  const nextTotal = input.totalAmount ?? formatForPersistence(existing.totalAmount, 4)
  const nextCount = existing.kind === 'PREPAID' ? (input.numberOfPeriods ?? existing.numberOfPeriods ?? 1) : null
  const scheduleNeedsRebuild =
    existing.kind === 'PREPAID' &&
    (input.totalAmount !== undefined || input.numberOfPeriods !== undefined || input.periodId !== undefined)

  const schedulePeriods = scheduleNeedsRebuild
    ? await resolveSchedulePeriods(tenantId, legalEntityId, period, nextCount!)
    : []
  const scheduleAmounts = scheduleNeedsRebuild ? buildScheduleAmounts(nextTotal, nextCount!) : []

  const updated = await prisma.$transaction(async (tx) => {
    if (scheduleNeedsRebuild) {
      await tx.periodEndAdjustmentSchedule.deleteMany({ where: { tenantId, adjustmentId: id } })
    }
    return tx.periodEndAdjustment.update({
      where: { id },
      data: {
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.narration !== undefined ? { narration: input.narration } : {}),
        ...(input.totalAmount !== undefined ? { totalAmount: input.totalAmount } : {}),
        ...(input.expenseAccountId !== undefined ? { expenseAccountId: input.expenseAccountId } : {}),
        ...(input.balanceSheetAccountId !== undefined ? { balanceSheetAccountId: input.balanceSheetAccountId } : {}),
        ...(input.costCentreId !== undefined ? { costCentreId: input.costCentreId } : {}),
        ...(input.departmentReference !== undefined ? { departmentReference: input.departmentReference } : {}),
        ...(input.projectReference !== undefined ? { projectReference: input.projectReference } : {}),
        ...(input.periodId !== undefined ? { periodId: input.periodId } : {}),
        ...(existing.kind === 'ACCRUAL' && input.autoReverse !== undefined ? { autoReverse: input.autoReverse } : {}),
        ...(nextCount !== null ? { numberOfPeriods: nextCount } : {}),
        updatedBy: req.context?.userId ?? null,
        ...(scheduleNeedsRebuild
          ? {
              schedules: {
                create: schedulePeriods.map((p, index) => ({
                  tenantId,
                  sequence: index + 1,
                  periodId: p.id,
                  amount: scheduleAmounts[index]!,
                })),
              },
            }
          : {}),
      },
      include: repo.adjustmentInclude,
    })
  })

  await audit(req, tenantId, id, 'PERIOD_ADJUSTMENT_UPDATED', { adjustmentNumber: updated.adjustmentNumber })
  return serializeAdjustment(updated)
}

export async function markPeriodAdjustmentReady(req: Request, tenantId: string, id: string): Promise<PeriodAdjustmentDto> {
  const existing = await repo.findByIdOrThrow(tenantId, id)
  if (existing.status !== 'DRAFT') {
    throw unprocessable(`Adjustment ${existing.adjustmentNumber} is ${existing.status}; only DRAFT can be marked ready`, CODES.NOT_EDITABLE)
  }
  await assertFinanceActive(tenantId, existing.legalEntityId)
  if (!OPEN_PERIOD_STATUSES.includes(existing.period.status)) {
    throw unprocessable(`Period ${existing.period.name} is ${existing.period.status}`, CODES.PERIOD_NOT_OPEN)
  }
  if (existing.kind === 'ACCRUAL' && existing.autoReverse) {
    const period = await loadPeriodOrThrow(tenantId, existing.legalEntityId, existing.periodId)
    const next = await resolveNextPeriod(tenantId, existing.legalEntityId, period)
    if (!next) {
      throw unprocessable(
        `No accounting period follows ${existing.period.name}; generate the next period before posting an auto-reversing accrual`,
        CODES.NEXT_PERIOD_MISSING,
      )
    }
  }

  const updated = await prisma.periodEndAdjustment.update({
    where: { id },
    data: { status: 'READY_TO_POST', updatedBy: req.context?.userId ?? null },
    include: repo.adjustmentInclude,
  })
  await audit(req, tenantId, id, 'PERIOD_ADJUSTMENT_MARKED_READY', { adjustmentNumber: updated.adjustmentNumber })
  return serializeAdjustment(updated)
}

export async function revisePeriodAdjustment(req: Request, tenantId: string, id: string): Promise<PeriodAdjustmentDto> {
  const existing = await repo.findByIdOrThrow(tenantId, id)
  if (existing.status !== 'READY_TO_POST') {
    throw unprocessable(`Adjustment ${existing.adjustmentNumber} is ${existing.status}; only READY_TO_POST can return to draft`, CODES.NOT_EDITABLE)
  }
  const updated = await prisma.periodEndAdjustment.update({
    where: { id },
    data: { status: 'DRAFT', updatedBy: req.context?.userId ?? null },
    include: repo.adjustmentInclude,
  })
  await audit(req, tenantId, id, 'PERIOD_ADJUSTMENT_REVISED', { adjustmentNumber: updated.adjustmentNumber })
  return serializeAdjustment(updated)
}

export async function cancelPeriodAdjustment(
  req: Request,
  tenantId: string,
  id: string,
  input: CancelPeriodAdjustmentInput,
): Promise<PeriodAdjustmentDto> {
  const existing = await repo.findByIdOrThrow(tenantId, id)
  if (existing.status !== 'DRAFT' && existing.status !== 'READY_TO_POST') {
    throw unprocessable(
      `Adjustment ${existing.adjustmentNumber} is ${existing.status}; posted adjustments must be reversed, not cancelled`,
      CODES.NOT_EDITABLE,
    )
  }
  const updated = await prisma.periodEndAdjustment.update({
    where: { id },
    data: {
      status: 'CANCELLED',
      cancelReason: input.reason,
      cancelledAt: new Date(),
      cancelledBy: req.context?.userId ?? null,
    },
    include: repo.adjustmentInclude,
  })
  await audit(req, tenantId, id, 'PERIOD_ADJUSTMENT_CANCELLED', { reason: input.reason })
  return serializeAdjustment(updated)
}

/** Period-close view: what is still outstanding for a period. */
export async function getPeriodAdjustmentSummary(tenantId: string, periodId: string) {
  const period = await prisma.accountingPeriod.findFirst({ where: { id: periodId, tenantId } })
  if (!period) throw new NotFoundError('Accounting period not found')

  const [unpostedAccruals, accrualsAwaitingReversal, pendingSchedules, postedAccruals] = await Promise.all([
    prisma.periodEndAdjustment.count({
      where: { tenantId, deletedAt: null, periodId, kind: 'ACCRUAL', status: { in: ['DRAFT', 'READY_TO_POST'] } },
    }),
    repo.listAccrualsAwaitingReversal(tenantId, periodId),
    repo.listPendingScheduleRowsForPeriod(tenantId, periodId),
    prisma.periodEndAdjustment.aggregate({
      where: { tenantId, deletedAt: null, periodId, kind: 'ACCRUAL', status: { in: ['POSTED', 'REVERSED'] } },
      _sum: { totalAmount: true },
    }),
  ])

  const pendingPrepaidAmount = pendingSchedules.reduce((sum, row) => add(sum, row.amount), toDecimal(0))

  return {
    periodId: period.id,
    periodName: period.name,
    periodStatus: period.status,
    unpostedAccrualCount: unpostedAccruals,
    accrualsAwaitingReversalCount: accrualsAwaitingReversal.length,
    postedAccrualAmount: formatForPersistence(postedAccruals._sum.totalAmount ?? 0, 4),
    pendingPrepaidScheduleCount: pendingSchedules.length,
    pendingPrepaidAmount: formatForPersistence(pendingPrepaidAmount, 4),
    pendingPrepaidRows: pendingSchedules.map((row) => ({
      scheduleId: row.id,
      adjustmentId: row.adjustmentId,
      adjustmentNumber: row.adjustment.adjustmentNumber,
      description: row.adjustment.description,
      sequence: row.sequence,
      amount: formatForPersistence(row.amount, 4),
    })),
    accrualsAwaitingReversal: accrualsAwaitingReversal.map((row) => ({
      id: row.id,
      adjustmentNumber: row.adjustmentNumber,
      description: row.description,
      amount: formatForPersistence(row.totalAmount, 4),
    })),
  }
}
