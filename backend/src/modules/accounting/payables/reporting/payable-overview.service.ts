import { prisma } from '../../../../config/database.js'
import { formatForPersistence, sumDecimals } from '../../shared/finance-decimal.js'
import {
  buildOutstandingStatusFilter,
  findOutstandingOpenItems,
  mapOpenItemToOutstandingDto,
} from './payable-outstanding.repository.js'
import { CREDIT_OUTSTANDING_DOCUMENT_FILTER } from './payable-open-item-side.filters.js'
import { resolvePayableReportingContext } from './payable-reporting-context.service.js'
import type { CurrencyBreakdownRow, OverviewQuery, PayableOverviewDto } from './payable-reporting.types.js'

function buildCurrencyBreakdown(items: ReturnType<typeof mapOpenItemToOutstandingDto>[]): CurrencyBreakdownRow[] {
  const byCurrency = new Map<string, { amount: string[]; base: string[]; count: number }>()
  for (const item of items) {
    const row = byCurrency.get(item.currencyCode) ?? { amount: [], base: [], count: 0 }
    row.amount.push(item.outstandingAmount)
    row.base.push(item.baseOutstandingAmount)
    row.count += 1
    byCurrency.set(item.currencyCode, row)
  }
  return [...byCurrency.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currencyCode, row]) => ({
      currencyCode,
      outstandingAmount: formatForPersistence(sumDecimals(row.amount)),
      baseOutstandingAmount: formatForPersistence(sumDecimals(row.base)),
      openItemCount: row.count,
    }))
}

async function countDataQualityExceptions(
  tenantId: string,
  legalEntityId: string,
): Promise<number> {
  const [postedWithoutOpenItem, openItemWithoutVoucher] = await Promise.all([
    prisma.vendorInvoice.count({
      where: {
        tenantId,
        legalEntityId,
        status: 'POSTED',
        payableOpenItem: null,
      },
    }),
    prisma.payableOpenItem.count({
      where: {
        tenantId,
        legalEntityId,
        ...CREDIT_OUTSTANDING_DOCUMENT_FILTER,
        ...buildOutstandingStatusFilter(false),
        accountingVoucherId: null,
      },
    }),
  ])
  return postedWithoutOpenItem + openItemWithoutVoucher
}

export async function getPayableOverview(tenantId: string, query: OverviewQuery): Promise<PayableOverviewDto> {
  const ctx = await resolvePayableReportingContext(tenantId, query.legalEntityId, query.reportDate)
  const rows = await findOutstandingOpenItems(ctx, { includeSettled: query.includeSettled })
  const items = rows.map((row) => mapOpenItemToOutstandingDto(row, ctx.reportDate))
  const monthStart = `${ctx.reportDate.slice(0, 7)}-01`

  const [readyToPostCount, postedThisMonthCount, dataQualityExceptionCount] = await Promise.all([
    prisma.vendorInvoice.count({
      where: { tenantId, legalEntityId: ctx.legalEntityId, status: 'READY_TO_POST' },
    }),
    prisma.vendorInvoice.count({
      where: {
        tenantId,
        legalEntityId: ctx.legalEntityId,
        status: 'POSTED',
        postingDate: { gte: new Date(`${monthStart}T00:00:00.000Z`), lte: new Date(`${ctx.reportDate}T23:59:59.999Z`) },
      },
    }),
    countDataQualityExceptions(tenantId, ctx.legalEntityId),
  ])

  const vendorIds = new Set(items.map((item) => item.vendorId))

  return {
    reportDate: ctx.reportDate,
    legalEntityId: ctx.legalEntityId,
    limitations: ctx.limitations,
    totals: {
      openItemCount: items.length,
      vendorCount: vendorIds.size,
      outstandingAmount: formatForPersistence(sumDecimals(items.map((i) => i.outstandingAmount))),
      baseOutstandingAmount: formatForPersistence(sumDecimals(items.map((i) => i.baseOutstandingAmount))),
    },
    readyToPostCount,
    postedThisMonthCount,
    dataQualityExceptionCount,
    currencyBreakdown: buildCurrencyBreakdown(items),
  }
}
