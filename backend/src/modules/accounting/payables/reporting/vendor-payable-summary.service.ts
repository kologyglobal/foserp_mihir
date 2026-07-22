import { prisma } from '../../../../config/database.js'
import { formatForPersistence, subtract, sumDecimals, toDecimal } from '../../shared/finance-decimal.js'
import { DEBIT_OPEN_ITEM_SIDE_FILTER } from './payable-open-item-side.filters.js'
import {
  buildOutstandingStatusFilter,
  findOutstandingOpenItems,
  mapOpenItemToOutstandingDto,
} from './payable-outstanding.repository.js'
import { resolvePayableReportingContext } from './payable-reporting-context.service.js'
import { PayableVendorNotFoundError } from './payable-reporting.errors.js'
import type {
  CurrencyBreakdownRow,
  VendorPayableDetailDto,
  VendorPayableSummaryRow,
  VendorSummaryQuery,
} from './payable-reporting.types.js'

function buildVendorRows(
  items: ReturnType<typeof mapOpenItemToOutstandingDto>[],
  debitByVendor: Map<string, string>,
): VendorPayableSummaryRow[] {
  const byVendor = new Map<
    string,
    VendorPayableSummaryRow & { amounts: string[]; baseAmounts: string[]; currencies: Map<string, CurrencyBreakdownRow> }
  >()

  for (const item of items) {
    const existing = byVendor.get(item.vendorId)
    if (!existing) {
      byVendor.set(item.vendorId, {
        vendorId: item.vendorId,
        vendorCode: item.vendorCode,
        vendorName: item.vendorName,
        openItemCount: 1,
        outstandingAmount: item.outstandingAmount,
        baseOutstandingAmount: item.baseOutstandingAmount,
        creditOutstandingBase: item.baseOutstandingAmount,
        debitOutstandingBase: '0.0000',
        netPayableBase: item.baseOutstandingAmount,
        oldestDueDate: item.dueDate,
        maxDaysOverdue: item.daysOverdue,
        disputedCount: item.isDisputed ? 1 : 0,
        onHoldCount: item.isOnHold ? 1 : 0,
        currencyBreakdown: [],
        amounts: [item.outstandingAmount],
        baseAmounts: [item.baseOutstandingAmount],
        currencies: new Map(),
      })
    } else {
      existing.openItemCount += 1
      existing.amounts.push(item.outstandingAmount)
      existing.baseAmounts.push(item.baseOutstandingAmount)
      existing.disputedCount += item.isDisputed ? 1 : 0
      existing.onHoldCount += item.isOnHold ? 1 : 0
      if (item.dueDate && (!existing.oldestDueDate || item.dueDate < existing.oldestDueDate)) {
        existing.oldestDueDate = item.dueDate
      }
      if (item.daysOverdue != null) {
        existing.maxDaysOverdue =
          existing.maxDaysOverdue == null ? item.daysOverdue : Math.max(existing.maxDaysOverdue, item.daysOverdue)
      }
      if (!existing.vendorCode && item.vendorCode) existing.vendorCode = item.vendorCode
      if (!existing.vendorName && item.vendorName) existing.vendorName = item.vendorName
    }

    const row = byVendor.get(item.vendorId)!
    const currencyRow = row.currencies.get(item.currencyCode) ?? {
      currencyCode: item.currencyCode,
      outstandingAmount: '0.0000',
      baseOutstandingAmount: '0.0000',
      openItemCount: 0,
    }
    currencyRow.openItemCount += 1
    currencyRow.outstandingAmount = formatForPersistence(
      sumDecimals([currencyRow.outstandingAmount, item.outstandingAmount]),
    )
    currencyRow.baseOutstandingAmount = formatForPersistence(
      sumDecimals([currencyRow.baseOutstandingAmount, item.baseOutstandingAmount]),
    )
    row.currencies.set(item.currencyCode, currencyRow)
  }

  for (const [vendorId, debitBase] of debitByVendor) {
    if (!byVendor.has(vendorId)) {
      byVendor.set(vendorId, {
        vendorId,
        vendorCode: null,
        vendorName: null,
        openItemCount: 0,
        outstandingAmount: '0.0000',
        baseOutstandingAmount: '0.0000',
        creditOutstandingBase: '0.0000',
        debitOutstandingBase: debitBase,
        netPayableBase: formatForPersistence(subtract('0', debitBase)),
        oldestDueDate: null,
        maxDaysOverdue: null,
        disputedCount: 0,
        onHoldCount: 0,
        currencyBreakdown: [],
        amounts: [],
        baseAmounts: [],
        currencies: new Map(),
      })
    }
  }

  return [...byVendor.values()].map(({ amounts, baseAmounts, currencies, ...row }) => {
    const creditOutstandingBase = formatForPersistence(sumDecimals(baseAmounts.length ? baseAmounts : ['0']))
    const debitOutstandingBase = debitByVendor.get(row.vendorId) ?? '0.0000'
    const netPayableBase = formatForPersistence(subtract(creditOutstandingBase, debitOutstandingBase))
    return {
      ...row,
      outstandingAmount: formatForPersistence(sumDecimals(amounts.length ? amounts : ['0'])),
      baseOutstandingAmount: creditOutstandingBase,
      creditOutstandingBase,
      debitOutstandingBase,
      netPayableBase,
      currencyBreakdown: [...currencies.values()].sort((a, b) => a.currencyCode.localeCompare(b.currencyCode)),
    }
  })
}

function sortVendorRows(rows: VendorPayableSummaryRow[], query: VendorSummaryQuery): VendorPayableSummaryRow[] {
  const sortBy = query.sortBy ?? 'outstandingAmount'
  const order = query.sortOrder ?? 'desc'
  const factor = order === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    switch (sortBy) {
      case 'vendorName':
        return factor * (a.vendorName ?? '').localeCompare(b.vendorName ?? '')
      case 'openItemCount':
        return factor * (a.openItemCount - b.openItemCount)
      case 'oldestDueDate':
        return factor * (a.oldestDueDate ?? '9999-99-99').localeCompare(b.oldestDueDate ?? '9999-99-99')
      case 'outstandingAmount':
      default:
        return factor * Number(a.netPayableBase) - Number(b.netPayableBase)
    }
  })
}

async function loadDebitOutstandingByVendor(
  tenantId: string,
  legalEntityId: string,
  includeSettled?: boolean,
  vendorId?: string,
): Promise<Map<string, string>> {
  const items = await prisma.payableOpenItem.findMany({
    where: {
      tenantId,
      legalEntityId,
      ...DEBIT_OPEN_ITEM_SIDE_FILTER,
      ...(vendorId ? { vendorId } : {}),
      ...buildOutstandingStatusFilter(includeSettled),
    },
    select: { vendorId: true, baseOutstandingAmount: true },
  })
  const map = new Map<string, string>()
  for (const item of items) {
    const prev = map.get(item.vendorId) ?? '0'
    map.set(item.vendorId, formatForPersistence(toDecimal(prev).add(item.baseOutstandingAmount)))
  }
  return map
}

export async function listVendorSummaries(tenantId: string, query: VendorSummaryQuery) {
  const ctx = await resolvePayableReportingContext(tenantId, query.legalEntityId, query.reportDate)
  const [rows, debitByVendor] = await Promise.all([
    findOutstandingOpenItems(ctx, { includeSettled: query.includeSettled }),
    loadDebitOutstandingByVendor(tenantId, query.legalEntityId, query.includeSettled),
  ])
  let items = rows.map((row) => mapOpenItemToOutstandingDto(row, ctx.reportDate))
  if (query.search?.trim()) {
    const term = query.search.trim().toLowerCase()
    items = items.filter(
      (item) =>
        item.vendorName?.toLowerCase().includes(term) ||
        item.vendorCode?.toLowerCase().includes(term),
    )
  }
  const allRows = sortVendorRows(buildVendorRows(items, debitByVendor), query)
  const page = query.page ?? 1
  const pageSize = query.pageSize ?? 20
  const start = (page - 1) * pageSize
  return {
    reportDate: ctx.reportDate,
    limitations: ctx.limitations,
    items: allRows.slice(start, start + pageSize),
    total: allRows.length,
    page,
    pageSize,
  }
}

export async function getVendorSummary(
  tenantId: string,
  vendorId: string,
  query: Omit<VendorSummaryQuery, 'search' | 'page' | 'pageSize' | 'sortBy' | 'sortOrder'>,
): Promise<VendorPayableDetailDto> {
  const ctx = await resolvePayableReportingContext(tenantId, query.legalEntityId, query.reportDate)
  const vendor = await prisma.masterVendor.findFirst({ where: { id: vendorId, tenantId } })
  if (!vendor) throw new PayableVendorNotFoundError(vendorId)

  const [rows, debitByVendor] = await Promise.all([
    findOutstandingOpenItems(ctx, { includeSettled: query.includeSettled, vendorId }),
    loadDebitOutstandingByVendor(tenantId, query.legalEntityId, query.includeSettled, vendorId),
  ])
  const items = rows.map((row) => mapOpenItemToOutstandingDto(row, ctx.reportDate))
  const summaries = buildVendorRows(items, debitByVendor)
  const summary = summaries[0]
  if (!summary) {
    const debitOutstandingBase = debitByVendor.get(vendorId) ?? '0.0000'
    return {
      vendorId,
      vendorCode: vendor.code,
      vendorName: vendor.name,
      openItemCount: 0,
      outstandingAmount: '0.0000',
      baseOutstandingAmount: '0.0000',
      creditOutstandingBase: '0.0000',
      debitOutstandingBase,
      netPayableBase: formatForPersistence(subtract('0', debitOutstandingBase)),
      oldestDueDate: null,
      maxDaysOverdue: null,
      disputedCount: 0,
      onHoldCount: 0,
      currencyBreakdown: [],
      reportDate: ctx.reportDate,
      limitations: ctx.limitations,
    }
  }
  return {
    ...summary,
    vendorCode: summary.vendorCode ?? vendor.code,
    vendorName: summary.vendorName ?? vendor.name,
    reportDate: ctx.reportDate,
    limitations: ctx.limitations,
  }
}
