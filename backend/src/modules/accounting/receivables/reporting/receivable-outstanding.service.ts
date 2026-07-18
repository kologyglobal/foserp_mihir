import { formatForPersistence, sumDecimals } from '../../shared/finance-decimal.js'
import {
  ALL_DUE_DATE_BUCKETS,
  ALL_INVOICE_AGE_BUCKETS,
} from './receivable-ageing.service.js'
import { findOutstandingOpenItems, listOutstandingOpenItems, mapOpenItemToOutstandingDto } from './receivable-outstanding.repository.js'
import { resolveReceivableReportingContext } from './receivable-reporting-context.service.js'
import type {
  AgeingBasis,
  AgeingQuery,
  AgeingReportDto,
  CurrencyBreakdownRow,
  ListOutstandingQuery,
} from './receivable-reporting.types.js'

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

export async function listOutstanding(tenantId: string, query: ListOutstandingQuery) {
  const ctx = await resolveReceivableReportingContext(tenantId, query.legalEntityId, query.reportDate)
  const result = await listOutstandingOpenItems(ctx, query)
  return {
    reportDate: ctx.reportDate,
    limitations: ctx.limitations,
    ...result,
  }
}

export async function listCustomerOpenItems(
  tenantId: string,
  customerId: string,
  query: Omit<ListOutstandingQuery, 'customerId'>,
) {
  return listOutstanding(tenantId, { ...query, customerId })
}

export async function getAgeingReport(tenantId: string, query: AgeingQuery): Promise<AgeingReportDto> {
  const ctx = await resolveReceivableReportingContext(tenantId, query.legalEntityId, query.reportDate)
  const basis: AgeingBasis = query.ageingBasis ?? 'due_date'
  const rows = await findOutstandingOpenItems(ctx, {
    includeSettled: query.includeSettled,
    customerId: query.customerId,
    receivableAccountId: query.receivableAccountId,
  })
  const items = rows.map((row) => mapOpenItemToOutstandingDto(row, ctx.reportDate))

  const bucketKeys = basis === 'due_date' ? ALL_DUE_DATE_BUCKETS : ALL_INVOICE_AGE_BUCKETS
  const bucketMap = new Map<string, { count: number; amounts: string[]; baseAmounts: string[] }>()
  for (const key of bucketKeys) {
    bucketMap.set(key, { count: 0, amounts: [], baseAmounts: [] })
  }

  for (const item of items) {
    const bucket = basis === 'due_date' ? item.dueDateBucket : item.invoiceAgeBucket
    const entry = bucketMap.get(bucket)
    if (!entry) continue
    entry.count += 1
    entry.amounts.push(item.outstandingAmount)
    entry.baseAmounts.push(item.baseOutstandingAmount)
  }

  const buckets = bucketKeys.map((bucket) => {
    const entry = bucketMap.get(bucket)!
    return {
      bucket,
      openItemCount: entry.count,
      outstandingAmount: formatForPersistence(sumDecimals(entry.amounts)),
      baseOutstandingAmount: formatForPersistence(sumDecimals(entry.baseAmounts)),
    }
  })

  return {
    reportDate: ctx.reportDate,
    ageingBasis: basis,
    limitations: ctx.limitations,
    totals: {
      openItemCount: items.length,
      outstandingAmount: formatForPersistence(sumDecimals(items.map((i) => i.outstandingAmount))),
      baseOutstandingAmount: formatForPersistence(sumDecimals(items.map((i) => i.baseOutstandingAmount))),
    },
    buckets,
    currencyBreakdown: buildCurrencyBreakdown(items),
  }
}

export { resolveReceivableReportingContext } from './receivable-reporting-context.service.js'
