import { prisma } from '../../../../config/database.js'
import { formatForPersistence, sumDecimals } from '../../shared/finance-decimal.js'
import {
  buildOutstandingStatusFilter,
  findOutstandingOpenItems,
  mapOpenItemToOutstandingDto,
} from './receivable-outstanding.repository.js'
import { DEBIT_OPEN_ITEM_SIDE_FILTER } from '../receipts/receivable-open-item-side.validators.js'
import { resolveReceivableReportingContext } from './receivable-reporting-context.service.js'
import type { CurrencyBreakdownRow, OverviewQuery, ReceivableOverviewDto } from './receivable-reporting.types.js'

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
    prisma.salesInvoice.count({
      where: {
        tenantId,
        legalEntityId,
        status: 'POSTED',
        receivableOpenItems: { none: {} },
      },
    }),
    prisma.receivableOpenItem.count({
      where: {
        tenantId,
        legalEntityId,
        ...DEBIT_OPEN_ITEM_SIDE_FILTER,
        ...buildOutstandingStatusFilter(false),
        accountingVoucherId: null,
      },
    }),
  ])
  return postedWithoutOpenItem + openItemWithoutVoucher
}

export async function getReceivableOverview(tenantId: string, query: OverviewQuery): Promise<ReceivableOverviewDto> {
  const ctx = await resolveReceivableReportingContext(tenantId, query.legalEntityId, query.reportDate)
  const rows = await findOutstandingOpenItems(ctx, { includeSettled: query.includeSettled })
  const items = rows.map((row) => mapOpenItemToOutstandingDto(row, ctx.reportDate))
  const monthStart = `${ctx.reportDate.slice(0, 7)}-01`

  const [readyToPostCount, postedThisMonthCount, dataQualityExceptionCount] = await Promise.all([
    prisma.salesInvoice.count({
      where: { tenantId, legalEntityId: ctx.legalEntityId, status: 'READY_TO_POST' },
    }),
    prisma.salesInvoice.count({
      where: {
        tenantId,
        legalEntityId: ctx.legalEntityId,
        status: 'POSTED',
        postingDate: { gte: new Date(`${monthStart}T00:00:00.000Z`), lte: new Date(`${ctx.reportDate}T23:59:59.999Z`) },
      },
    }),
    countDataQualityExceptions(tenantId, ctx.legalEntityId),
  ])

  const customerIds = new Set(items.map((item) => item.customerId))

  return {
    reportDate: ctx.reportDate,
    legalEntityId: ctx.legalEntityId,
    limitations: ctx.limitations,
    totals: {
      openItemCount: items.length,
      customerCount: customerIds.size,
      outstandingAmount: formatForPersistence(sumDecimals(items.map((i) => i.outstandingAmount))),
      baseOutstandingAmount: formatForPersistence(sumDecimals(items.map((i) => i.baseOutstandingAmount))),
    },
    readyToPostCount,
    postedThisMonthCount,
    dataQualityExceptionCount,
    currencyBreakdown: buildCurrencyBreakdown(items),
  }
}
