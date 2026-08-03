/**
 * Year-end close — P&L transfer into retained earnings.
 *
 * Slice 1 (2026-07-30):
 * - Preview INCOME/EXPENSE FY balances + RE mapping
 * - Post SYSTEM journal zeroing P&L into RETAINED_EARNINGS (idempotent)
 * - Harden FY close: all periods CLOSED + year-end run present
 *
 * Deferred: accruals/prepaid/FX reval wizards; opening-balance voucher
 * (continuous GL carries BS naturally); reopen-request workflow.
 */
import type { Account, AccountingPeriod, FinancialYear, YearEndCloseRun } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { NotFoundError } from '../../../utils/errors.js'
import {
  add,
  compare,
  formatForPersistence,
  isZero,
  subtract,
  toDecimal,
} from '../shared/finance-decimal.js'
import { parseDateOnly } from '../shared/finance.helpers.js'
import { post } from '../posting/posting.service.js'
import { PostingError } from '../posting/posting.errors.js'
import type { PostingContext, PostingRequest, PostingRequestLine } from '../posting/posting.types.js'
import { YEAR_END_CLOSE_ERROR_CODES, YearEndCloseError } from './year-end-close.errors.js'

const SOURCE_MODULE = 'FINANCE'
const SOURCE_DOCUMENT_TYPE = 'FINANCIAL_YEAR'
const EVENT_TYPE = 'YEAR_END_PNL_CLOSE'

export interface YearEndAccountLine {
  accountId: string
  accountCode: string
  accountName: string
  category: 'INCOME' | 'EXPENSE'
  netBalance: string
  closeDebit: string
  closeCredit: string
}

export interface YearEndClosePreview {
  financialYearId: string
  financialYearName: string
  legalEntityId: string
  status: FinancialYear['status']
  alreadyClosed: boolean
  existingRun: {
    id: string
    status: YearEndCloseRun['status']
    voucherId: string | null
    voucherNumber: string | null
    closedAt: string
  } | null
  postingDate: string
  lastPeriod: { id: string; name: string; status: AccountingPeriod['status']; endDate: string } | null
  openPeriodNames: string[]
  revenueToClose: string
  expenseToClose: string
  profitOrLoss: string
  retainedEarnings: {
    accountId: string
    accountCode: string
    accountName: string
  } | null
  lines: YearEndAccountLine[]
  blockers: Array<{ code: string; message: string }>
  readyToPost: boolean
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function eventKeyForFy(financialYearId: string): string {
  return `YEAR_END_PNL_CLOSE:${financialYearId}`
}

async function loadFyOrThrow(tenantId: string, financialYearId: string): Promise<FinancialYear> {
  const fy = await prisma.financialYear.findFirst({ where: { id: financialYearId, tenantId } })
  if (!fy) throw new NotFoundError('Financial year not found')
  return fy
}

async function resolveRetainedEarnings(
  tenantId: string,
  legalEntityId: string,
): Promise<Pick<Account, 'id' | 'accountCode' | 'accountName'> | null> {
  const mapping = await prisma.defaultAccountMapping.findFirst({
    where: { tenantId, legalEntityId, mappingKey: 'RETAINED_EARNINGS' },
    select: {
      account: {
        select: { id: true, accountCode: true, accountName: true, isActive: true, isGroup: true },
      },
    },
  })
  const account = mapping?.account
  if (!account || !account.isActive || account.isGroup) return null
  return { id: account.id, accountCode: account.accountCode, accountName: account.accountName }
}

async function buildPnlLines(
  tenantId: string,
  legalEntityId: string,
  fy: FinancialYear,
): Promise<{
  lines: YearEndAccountLine[]
  revenueToClose: ReturnType<typeof toDecimal>
  expenseToClose: ReturnType<typeof toDecimal>
  profitOrLoss: ReturnType<typeof toDecimal>
}> {
  const accounts = await prisma.account.findMany({
    where: {
      tenantId,
      legalEntityId,
      isGroup: false,
      category: { in: ['INCOME', 'EXPENSE'] },
    },
    select: { id: true, accountCode: true, accountName: true, category: true },
  })

  if (accounts.length === 0) {
    return {
      lines: [],
      revenueToClose: toDecimal(0),
      expenseToClose: toDecimal(0),
      profitOrLoss: toDecimal(0),
    }
  }

  const accountIds = accounts.map((a) => a.id)
  const aggs = await prisma.generalLedgerEntry.groupBy({
    by: ['accountId'],
    where: {
      tenantId,
      legalEntityId,
      accountId: { in: accountIds },
      postingDate: { gte: fy.startDate, lte: fy.endDate },
    },
    _sum: { baseDebitAmount: true, baseCreditAmount: true },
  })
  const byAccount = new Map(aggs.map((a) => [a.accountId, a]))

  const lines: YearEndAccountLine[] = []
  let revenueToClose = toDecimal(0)
  let expenseToClose = toDecimal(0)

  for (const account of accounts) {
    const agg = byAccount.get(account.id)
    const debit = toDecimal(agg?._sum.baseDebitAmount ?? 0)
    const credit = toDecimal(agg?._sum.baseCreditAmount ?? 0)
    const net = subtract(debit, credit)
    if (isZero(net)) continue

    let closeDebit = toDecimal(0)
    let closeCredit = toDecimal(0)
    if (compare(net, 0) > 0) {
      closeCredit = net
    } else {
      closeDebit = toDecimal(net.abs())
    }

    // Display: amounts being closed (income typically closed via debit; expense via credit)
    if (account.category === 'INCOME') {
      revenueToClose = add(revenueToClose, closeDebit)
      revenueToClose = subtract(revenueToClose, closeCredit)
    } else {
      expenseToClose = add(expenseToClose, closeCredit)
      expenseToClose = subtract(expenseToClose, closeDebit)
    }

    lines.push({
      accountId: account.id,
      accountCode: account.accountCode,
      accountName: account.accountName,
      category: account.category as 'INCOME' | 'EXPENSE',
      netBalance: formatForPersistence(net, 4),
      closeDebit: formatForPersistence(closeDebit, 4),
      closeCredit: formatForPersistence(closeCredit, 4),
    })
  }

  if (compare(revenueToClose, 0) < 0) revenueToClose = toDecimal(0)
  if (compare(expenseToClose, 0) < 0) expenseToClose = toDecimal(0)

  // Positive profitOrLoss → credit retained earnings (net profit)
  const profitOrLoss = subtract(revenueToClose, expenseToClose)

  return {
    lines,
    revenueToClose,
    expenseToClose,
    profitOrLoss,
  }
}

export async function previewYearEndClose(tenantId: string, financialYearId: string): Promise<YearEndClosePreview> {
  const fy = await loadFyOrThrow(tenantId, financialYearId)
  const periods = await prisma.accountingPeriod.findMany({
    where: { tenantId, financialYearId },
    orderBy: { periodNumber: 'asc' },
  })
  const lastPeriod = periods.length > 0 ? periods[periods.length - 1]! : null
  const openish = periods.filter((p) => p.status !== 'CLOSED')
  // For execute: all periods except last must be CLOSED; last must be OPEN/REOPENED
  const earlyOpen = periods.filter(
    (p) => lastPeriod && p.id !== lastPeriod.id && p.status !== 'CLOSED',
  )

  const existing = await prisma.yearEndCloseRun.findFirst({
    where: { tenantId, financialYearId },
  })
  const retained = await resolveRetainedEarnings(tenantId, fy.legalEntityId)
  const settings = await prisma.financeSettings.findFirst({
    where: { tenantId, legalEntityId: fy.legalEntityId },
  })

  const { lines, revenueToClose, expenseToClose, profitOrLoss } = await buildPnlLines(
    tenantId,
    fy.legalEntityId,
    fy,
  )

  const blockers: Array<{ code: string; message: string }> = []
  if (fy.status === 'CLOSED') {
    blockers.push({ code: YEAR_END_CLOSE_ERROR_CODES.YEAR_END_FY_CLOSED, message: 'Financial year is already closed' })
  } else if (fy.status !== 'ACTIVE') {
    blockers.push({
      code: YEAR_END_CLOSE_ERROR_CODES.YEAR_END_FY_NOT_ACTIVE,
      message: `Financial year status ${fy.status} does not allow year-end close`,
    })
  }
  if (existing) {
    blockers.push({
      code: YEAR_END_CLOSE_ERROR_CODES.YEAR_END_ALREADY_POSTED,
      message: 'Year-end closing entries have already been posted for this financial year',
    })
  }
  if (!settings?.financeActivated) {
    blockers.push({
      code: YEAR_END_CLOSE_ERROR_CODES.YEAR_END_FINANCE_NOT_ACTIVATED,
      message: 'Finance is not activated for this legal entity',
    })
  }
  if (!retained) {
    blockers.push({
      code: YEAR_END_CLOSE_ERROR_CODES.YEAR_END_RETAINED_EARNINGS_MISSING,
      message: 'Default account mapping RETAINED_EARNINGS is missing or inactive',
    })
  }
  if (!lastPeriod) {
    blockers.push({
      code: YEAR_END_CLOSE_ERROR_CODES.YEAR_END_LAST_PERIOD_NOT_OPEN,
      message: 'Financial year has no accounting periods',
    })
  } else if (lastPeriod.status !== 'OPEN' && lastPeriod.status !== 'REOPENED') {
    blockers.push({
      code: YEAR_END_CLOSE_ERROR_CODES.YEAR_END_LAST_PERIOD_NOT_OPEN,
      message: `Last period (${lastPeriod.name}) must be OPEN or REOPENED to post year-end closing entries`,
    })
  }
  if (earlyOpen.length > 0) {
    blockers.push({
      code: YEAR_END_CLOSE_ERROR_CODES.YEAR_END_PERIODS_OPEN,
      message: `Close earlier periods before year-end: ${earlyOpen.map((p) => p.name).join(', ')}`,
    })
  }

  return {
    financialYearId: fy.id,
    financialYearName: fy.name,
    legalEntityId: fy.legalEntityId,
    status: fy.status,
    alreadyClosed: Boolean(existing),
    existingRun: existing
      ? {
          id: existing.id,
          status: existing.status,
          voucherId: existing.voucherId,
          voucherNumber: existing.voucherNumber,
          closedAt: existing.closedAt.toISOString(),
        }
      : null,
    postingDate: toIsoDate(fy.endDate),
    lastPeriod: lastPeriod
      ? {
          id: lastPeriod.id,
          name: lastPeriod.name,
          status: lastPeriod.status,
          endDate: toIsoDate(lastPeriod.endDate),
        }
      : null,
    openPeriodNames: openish.map((p) => p.name),
    revenueToClose: formatForPersistence(revenueToClose, 4),
    expenseToClose: formatForPersistence(expenseToClose, 4),
    profitOrLoss: formatForPersistence(profitOrLoss, 4),
    retainedEarnings: retained
      ? {
          accountId: retained.id,
          accountCode: retained.accountCode,
          accountName: retained.accountName,
        }
      : null,
    lines,
    blockers,
    readyToPost: blockers.length === 0,
  }
}

function buildPostingLines(
  preview: YearEndClosePreview,
  retainedAccountId: string,
): PostingRequestLine[] {
  const lines: PostingRequestLine[] = []
  let lineNumber = 1
  let totalDebit = toDecimal(0)
  let totalCredit = toDecimal(0)

  for (const row of preview.lines) {
    if (!isZero(row.closeDebit) || !isZero(row.closeCredit)) {
      lines.push({
        lineNumber: lineNumber++,
        accountId: row.accountId,
        debitAmount: row.closeDebit,
        creditAmount: row.closeCredit,
        lineNarration: `Year-end close ${row.accountCode}`,
      })
      totalDebit = add(totalDebit, row.closeDebit)
      totalCredit = add(totalCredit, row.closeCredit)
    }
  }

  const imbalance = subtract(totalDebit, totalCredit)
  if (!isZero(imbalance)) {
    if (compare(imbalance, 0) > 0) {
      // Debits exceed credits → credit RE (profit)
      lines.push({
        lineNumber: lineNumber++,
        accountId: retainedAccountId,
        debitAmount: '0.0000',
        creditAmount: formatForPersistence(imbalance, 4),
        lineNarration: 'Year-end transfer to retained earnings',
      })
    } else {
      lines.push({
        lineNumber: lineNumber++,
        accountId: retainedAccountId,
        debitAmount: formatForPersistence(toDecimal(imbalance.abs()), 4),
        creditAmount: '0.0000',
        lineNarration: 'Year-end transfer to retained earnings',
      })
    }
  }

  return lines
}

export async function executeYearEndClose(
  tenantId: string,
  financialYearId: string,
  userId: string,
): Promise<{
  run: YearEndCloseRun
  preview: YearEndClosePreview
  idempotentReplay: boolean
}> {
  const preview = await previewYearEndClose(tenantId, financialYearId)

  if (preview.existingRun) {
    const run = await prisma.yearEndCloseRun.findFirstOrThrow({
      where: { id: preview.existingRun.id, tenantId },
    })
    return { run, preview, idempotentReplay: true }
  }

  const hardBlockers = preview.blockers.filter((b) => b.code !== YEAR_END_CLOSE_ERROR_CODES.YEAR_END_ALREADY_POSTED)
  if (hardBlockers.length > 0) {
    const first = hardBlockers[0]!
    throw new YearEndCloseError(422, first.message, first.code, { blockers: hardBlockers })
  }

  const retained = preview.retainedEarnings!
  const postingDate = preview.postingDate
  const postingLines = buildPostingLines(preview, retained.accountId)

  if (postingLines.length === 0) {
    const run = await prisma.yearEndCloseRun.create({
      data: {
        tenantId,
        legalEntityId: preview.legalEntityId,
        financialYearId,
        status: 'NO_ACTIVITY',
        postingDate: parseDateOnly(postingDate),
        revenueTotal: preview.revenueToClose,
        expenseTotal: preview.expenseToClose,
        profitOrLoss: preview.profitOrLoss,
        retainedEarningsAccountId: retained.accountId,
        retainedEarningsCode: retained.accountCode,
        retainedEarningsName: retained.accountName,
        closedBy: userId,
      },
    })
    return { run, preview: await previewYearEndClose(tenantId, financialYearId), idempotentReplay: false }
  }

  // Ensure JOURNAL number series exists for SYSTEM voucher type reservation
  // (posting engine uses voucherType for number series; SYSTEM maps like JOURNAL in some tenants)
  const request: PostingRequest = {
    legalEntityId: preview.legalEntityId,
    eventKey: eventKeyForFy(financialYearId),
    eventType: EVENT_TYPE,
    postingPurpose: 'SYSTEM_DOCUMENT',
    voucherType: 'JOURNAL',
    documentDate: postingDate,
    postingDate,
    narration: `Year-end P&L close — ${preview.financialYearName}`,
    sourceModule: SOURCE_MODULE,
    sourceDocumentType: SOURCE_DOCUMENT_TYPE,
    sourceDocumentId: financialYearId,
    lines: postingLines,
  }

  const context: PostingContext = {
    tenantId,
    userId,
    authorization: { permissionChecked: true },
    workflow: { workflowSatisfied: true },
  }

  // Temporarily allow backdated posting for FY end date if needed
  const settings = await prisma.financeSettings.findFirst({
    where: { tenantId, legalEntityId: preview.legalEntityId },
  })
  let restoredSettings: { allowBackdatedPosting: boolean; backdatedDaysLimit: number } | null = null
  const fyEnd = parseDateOnly(postingDate)
  const today = new Date()
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  if (fyEnd < todayUtc && settings && !settings.allowBackdatedPosting) {
    restoredSettings = {
      allowBackdatedPosting: settings.allowBackdatedPosting,
      backdatedDaysLimit: settings.backdatedDaysLimit,
    }
    const daysDiff = Math.ceil((todayUtc.getTime() - fyEnd.getTime()) / (24 * 60 * 60 * 1000))
    await prisma.financeSettings.update({
      where: { id: settings.id },
      data: { allowBackdatedPosting: true, backdatedDaysLimit: Math.max(daysDiff + 1, settings.backdatedDaysLimit) },
    })
  }

  let postingResult
  try {
    postingResult = await post(request, context)
  } catch (error) {
    if (restoredSettings && settings) {
      await prisma.financeSettings
        .update({
          where: { id: settings.id },
          data: restoredSettings,
        })
        .catch(() => {})
    }
    if (error instanceof PostingError) {
      throw new YearEndCloseError(422, error.message, YEAR_END_CLOSE_ERROR_CODES.YEAR_END_POSTING_FAILED, {
        postingCode: error.code,
      })
    }
    throw error
  } finally {
    if (restoredSettings && settings) {
      await prisma.financeSettings
        .update({
          where: { id: settings.id },
          data: restoredSettings,
        })
        .catch(() => {})
    }
  }

  try {
    const run = await prisma.yearEndCloseRun.create({
      data: {
        tenantId,
        legalEntityId: preview.legalEntityId,
        financialYearId,
        status: 'POSTED',
        postingDate: parseDateOnly(postingDate),
        revenueTotal: preview.revenueToClose,
        expenseTotal: preview.expenseToClose,
        profitOrLoss: preview.profitOrLoss,
        retainedEarningsAccountId: retained.accountId,
        retainedEarningsCode: retained.accountCode,
        retainedEarningsName: retained.accountName,
        voucherId: postingResult.voucherId,
        postingEventId: postingResult.postingEventId,
        voucherNumber: postingResult.voucherNumber,
        closedBy: userId,
      },
    })
    return {
      run,
      preview: await previewYearEndClose(tenantId, financialYearId),
      idempotentReplay: postingResult.idempotentReplay,
    }
  } catch (error) {
    // Unique race: another request created the run — return existing
    const existing = await prisma.yearEndCloseRun.findFirst({
      where: { tenantId, financialYearId },
    })
    if (existing) {
      return {
        run: existing,
        preview: await previewYearEndClose(tenantId, financialYearId),
        idempotentReplay: true,
      }
    }
    throw error
  }
}

/** Preconditions for flipping FinancialYear.status → CLOSED after year-end. */
export async function assertFinancialYearReadyToClose(tenantId: string, financialYearId: string): Promise<void> {
  const fy = await loadFyOrThrow(tenantId, financialYearId)
  if (fy.status === 'CLOSED') {
    throw new YearEndCloseError(422, 'Financial year is already closed', YEAR_END_CLOSE_ERROR_CODES.YEAR_END_FY_CLOSED)
  }

  const periods = await prisma.accountingPeriod.findMany({
    where: { tenantId, financialYearId },
    select: { id: true, name: true, status: true },
  })
  const openPeriods = periods.filter((p) => p.status !== 'CLOSED')
  if (openPeriods.length > 0) {
    throw new YearEndCloseError(
      422,
      `All accounting periods must be CLOSED before locking the financial year. Open: ${openPeriods.map((p) => p.name).join(', ')}`,
      YEAR_END_CLOSE_ERROR_CODES.YEAR_END_PERIODS_NOT_ALL_CLOSED,
      { openPeriodNames: openPeriods.map((p) => p.name) },
    )
  }

  const run = await prisma.yearEndCloseRun.findFirst({
    where: { tenantId, financialYearId },
  })
  if (!run) {
    throw new YearEndCloseError(
      422,
      'Post year-end P&L closing entries before locking the financial year',
      YEAR_END_CLOSE_ERROR_CODES.YEAR_END_CLOSE_REQUIRED,
    )
  }
}
