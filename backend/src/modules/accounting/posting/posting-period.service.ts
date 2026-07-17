import type { AccountingPeriod, FinancialYear, FinanceSettings } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { parseDateOnly } from '../shared/finance.helpers.js'
import { PostingError } from './posting.errors.js'

export interface ResolvedPostingPeriod {
  financialYear: FinancialYear
  period: AccountingPeriod
  settings: FinanceSettings | null
}

async function lookupPeriodByDate(
  tenantId: string,
  legalEntityId: string,
  postingDateStr: string,
): Promise<ResolvedPostingPeriod> {
  const postingDate = parseDateOnly(postingDateStr)

  const [financialYear, settings] = await Promise.all([
    prisma.financialYear.findFirst({
      where: {
        tenantId,
        legalEntityId,
        startDate: { lte: postingDate },
        endDate: { gte: postingDate },
      },
      orderBy: { startDate: 'desc' },
    }),
    prisma.financeSettings.findFirst({ where: { tenantId, legalEntityId } }),
  ])

  if (!financialYear) {
    throw new PostingError('FINANCIAL_YEAR_NOT_FOUND', 'No financial year covers the posting date')
  }

  const period = await prisma.accountingPeriod.findFirst({
    where: {
      tenantId,
      legalEntityId,
      financialYearId: financialYear.id,
      startDate: { lte: postingDate },
      endDate: { gte: postingDate },
    },
    orderBy: { periodNumber: 'asc' },
  })

  if (!period) {
    throw new PostingError('ACCOUNTING_PERIOD_NOT_FOUND', 'No accounting period covers the posting date')
  }

  return { financialYear, period, settings }
}

/** Resolve FY + period for a date without enforcing open-period rules (draft save). */
export async function resolvePeriodByDate(
  tenantId: string,
  legalEntityId: string,
  postingDateStr: string,
): Promise<ResolvedPostingPeriod> {
  return lookupPeriodByDate(tenantId, legalEntityId, postingDateStr)
}

export async function resolvePostingPeriod(
  tenantId: string,
  legalEntityId: string,
  postingDateStr: string,
): Promise<ResolvedPostingPeriod> {
  const postingDate = parseDateOnly(postingDateStr)
  const resolved = await lookupPeriodByDate(tenantId, legalEntityId, postingDateStr)

  if (resolved.financialYear.status !== 'ACTIVE') {
    throw new PostingError('FINANCIAL_YEAR_INACTIVE', 'Financial year is not active for posting')
  }

  enforcePeriodOpenForPosting(resolved.period, postingDate, resolved.settings)
  return resolved
}

export function enforcePeriodOpenForPosting(
  period: AccountingPeriod,
  postingDate: Date,
  settings: FinanceSettings | null,
): void {
  if (period.status === 'CLOSED') {
    throw new PostingError('ACCOUNTING_PERIOD_CLOSED', 'Accounting period is closed for posting')
  }
  if (period.status === 'UNDER_REVIEW') {
    throw new PostingError('ACCOUNTING_PERIOD_UNDER_REVIEW', 'Accounting period is under review and cannot accept postings')
  }
  if (period.status !== 'OPEN' && period.status !== 'REOPENED') {
    throw new PostingError('ACCOUNTING_PERIOD_CLOSED', `Accounting period status ${period.status} does not allow posting`)
  }

  const today = startOfUtcDay(new Date())
  const postDay = startOfUtcDay(postingDate)
  if (postDay < today) {
    if (!settings?.allowBackdatedPosting) {
      throw new PostingError('BACKDATED_POSTING_NOT_ALLOWED', 'Backdated posting is not enabled in finance settings')
    }
    const limitDays = settings.backdatedDaysLimit ?? 0
    if (limitDays >= 0) {
      const earliest = new Date(today)
      earliest.setUTCDate(earliest.getUTCDate() - limitDays)
      if (postDay < startOfUtcDay(earliest)) {
        throw new PostingError(
          'BACKDATED_POSTING_NOT_ALLOWED',
          `Posting date is earlier than the allowed backdated limit of ${limitDays} day(s)`,
        )
      }
    }
  }
}

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
}
