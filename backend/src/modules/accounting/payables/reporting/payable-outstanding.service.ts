import { formatForPersistence, sumDecimals } from '../../shared/finance-decimal.js'
import {
  ALL_DOCUMENT_AGE_BUCKETS,
  ALL_DUE_DATE_BUCKETS,
} from './payable-ageing.service.js'
import { findOutstandingOpenItems, listOutstandingOpenItems, mapOpenItemToOutstandingDto } from './payable-outstanding.repository.js'
import { resolvePayableReportingContext } from './payable-reporting-context.service.js'
import type {
  AgeingBasis,
  AgeingQuery,
  AgeingReportDto,
  CurrencyBreakdownRow,
  ListOutstandingQuery,
} from './payable-reporting.types.js'

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
  const ctx = await resolvePayableReportingContext(tenantId, query.legalEntityId, query.reportDate)
  const result = await listOutstandingOpenItems(ctx, query)
  return {
    reportDate: ctx.reportDate,
    limitations: ctx.limitations,
    ...result,
  }
}

export async function listVendorOpenItems(
  tenantId: string,
  vendorId: string,
  query: Omit<ListOutstandingQuery, 'vendorId'>,
) {
  return listOutstanding(tenantId, { ...query, vendorId })
}

export async function getAgeingReport(tenantId: string, query: AgeingQuery): Promise<AgeingReportDto> {
  const ctx = await resolvePayableReportingContext(tenantId, query.legalEntityId, query.reportDate)
  const basis: AgeingBasis = query.ageingBasis ?? 'due_date'
  const rows = await findOutstandingOpenItems(ctx, {
    includeSettled: query.includeSettled,
    vendorId: query.vendorId,
    vendorPayableAccountId: query.vendorPayableAccountId,
  })
  const items = rows.map((row) => mapOpenItemToOutstandingDto(row, ctx.reportDate))

  const bucketKeys = basis === 'due_date' ? ALL_DUE_DATE_BUCKETS : ALL_DOCUMENT_AGE_BUCKETS
  const bucketMap = new Map<string, { count: number; amounts: string[]; baseAmounts: string[] }>()
  for (const key of bucketKeys) {
    bucketMap.set(key, { count: 0, amounts: [], baseAmounts: [] })
  }

  for (const item of items) {
    const bucket = basis === 'due_date' ? item.dueDateBucket : item.documentAgeBucket
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

export { resolvePayableReportingContext } from './payable-reporting-context.service.js'
