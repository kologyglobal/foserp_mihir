import { prisma } from '../../../../config/database.js'
import { formatForPersistence, subtract, sumDecimals, toDecimal } from '../../shared/finance-decimal.js'
import { DEBIT_OPEN_ITEM_SIDE_FILTER } from '../receipts/receivable-open-item-side.validators.js'
import {
  buildOutstandingStatusFilter,
  findOutstandingOpenItems,
  mapOpenItemToOutstandingDto,
} from './receivable-outstanding.repository.js'
import { resolveReceivableReportingContext } from './receivable-reporting-context.service.js'
import { ReceivableCustomerNotFoundError } from './receivable-reporting.errors.js'
import type {
  CurrencyBreakdownRow,
  CustomerReceivableDetailDto,
  CustomerReceivableSummaryRow,
  CustomerSummaryQuery,
} from './receivable-reporting.types.js'

function buildCustomerRows(
  items: ReturnType<typeof mapOpenItemToOutstandingDto>[],
  creditByCustomer: Map<string, string>,
): CustomerReceivableSummaryRow[] {
  const byCustomer = new Map<
    string,
    CustomerReceivableSummaryRow & { amounts: string[]; baseAmounts: string[]; currencies: Map<string, CurrencyBreakdownRow> }
  >()

  for (const item of items) {
    const existing = byCustomer.get(item.customerId)
    if (!existing) {
      byCustomer.set(item.customerId, {
        customerId: item.customerId,
        customerCode: item.customerCode,
        customerName: item.customerName,
        openItemCount: 1,
        outstandingAmount: item.outstandingAmount,
        baseOutstandingAmount: item.baseOutstandingAmount,
        debitOutstandingBase: item.baseOutstandingAmount,
        creditOutstandingBase: '0.0000',
        netReceivableBase: item.baseOutstandingAmount,
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
      if (!existing.customerCode && item.customerCode) existing.customerCode = item.customerCode
      if (!existing.customerName && item.customerName) existing.customerName = item.customerName
    }

    const row = byCustomer.get(item.customerId)!
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

  // Include customers that only have credits
  for (const [customerId, creditBase] of creditByCustomer) {
    if (!byCustomer.has(customerId)) {
      byCustomer.set(customerId, {
        customerId,
        customerCode: null,
        customerName: null,
        openItemCount: 0,
        outstandingAmount: '0.0000',
        baseOutstandingAmount: '0.0000',
        debitOutstandingBase: '0.0000',
        creditOutstandingBase: creditBase,
        netReceivableBase: formatForPersistence(subtract('0', creditBase)),
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

  return [...byCustomer.values()].map(({ amounts, baseAmounts, currencies, ...row }) => {
    const debitOutstandingBase = formatForPersistence(sumDecimals(baseAmounts.length ? baseAmounts : ['0']))
    const creditOutstandingBase = creditByCustomer.get(row.customerId) ?? '0.0000'
    const netReceivableBase = formatForPersistence(subtract(debitOutstandingBase, creditOutstandingBase))
    return {
      ...row,
      outstandingAmount: formatForPersistence(sumDecimals(amounts.length ? amounts : ['0'])),
      baseOutstandingAmount: debitOutstandingBase,
      debitOutstandingBase,
      creditOutstandingBase,
      netReceivableBase,
      currencyBreakdown: [...currencies.values()].sort((a, b) => a.currencyCode.localeCompare(b.currencyCode)),
    }
  })
}

function sortCustomerRows(rows: CustomerReceivableSummaryRow[], query: CustomerSummaryQuery): CustomerReceivableSummaryRow[] {
  const sortBy = query.sortBy ?? 'outstandingAmount'
  const order = query.sortOrder ?? 'desc'
  const factor = order === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    switch (sortBy) {
      case 'customerName':
        return factor * (a.customerName ?? '').localeCompare(b.customerName ?? '')
      case 'openItemCount':
        return factor * (a.openItemCount - b.openItemCount)
      case 'oldestDueDate':
        return factor * (a.oldestDueDate ?? '9999-99-99').localeCompare(b.oldestDueDate ?? '9999-99-99')
      case 'outstandingAmount':
      default:
        return factor * Number(a.netReceivableBase) - Number(b.netReceivableBase)
    }
  })
}

async function loadCreditOutstandingByCustomer(
  tenantId: string,
  legalEntityId: string,
  includeSettled?: boolean,
  customerId?: string,
): Promise<Map<string, string>> {
  const items = await prisma.receivableOpenItem.findMany({
    where: {
      tenantId,
      legalEntityId,
      side: 'CREDIT',
      ...(customerId ? { customerId } : {}),
      ...buildOutstandingStatusFilter(includeSettled),
    },
    select: { customerId: true, baseOpenAmount: true, customerNameSnapshot: true },
  })
  const map = new Map<string, string>()
  for (const item of items) {
    const prev = map.get(item.customerId) ?? '0'
    map.set(item.customerId, formatForPersistence(toDecimal(prev).add(item.baseOpenAmount)))
  }
  return map
}

export async function listCustomerSummaries(tenantId: string, query: CustomerSummaryQuery) {
  const ctx = await resolveReceivableReportingContext(tenantId, query.legalEntityId, query.reportDate)
  const [rows, creditByCustomer] = await Promise.all([
    findOutstandingOpenItems(ctx, { includeSettled: query.includeSettled }),
    loadCreditOutstandingByCustomer(tenantId, query.legalEntityId, query.includeSettled),
  ])
  let items = rows.map((row) => mapOpenItemToOutstandingDto(row, ctx.reportDate))
  if (query.search?.trim()) {
    const term = query.search.trim().toLowerCase()
    items = items.filter(
      (item) =>
        item.customerName?.toLowerCase().includes(term) ||
        item.customerCode?.toLowerCase().includes(term),
    )
  }
  const allRows = sortCustomerRows(buildCustomerRows(items, creditByCustomer), query)
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

export async function getCustomerSummary(
  tenantId: string,
  customerId: string,
  query: Omit<CustomerSummaryQuery, 'search' | 'page' | 'pageSize' | 'sortBy' | 'sortOrder'>,
): Promise<CustomerReceivableDetailDto> {
  const ctx = await resolveReceivableReportingContext(tenantId, query.legalEntityId, query.reportDate)
  const customer = await prisma.crmCompany.findFirst({ where: { id: customerId, tenantId } })
  if (!customer) throw new ReceivableCustomerNotFoundError(customerId)

  const [rows, creditByCustomer] = await Promise.all([
    findOutstandingOpenItems(ctx, { includeSettled: query.includeSettled, customerId }),
    loadCreditOutstandingByCustomer(tenantId, query.legalEntityId, query.includeSettled, customerId),
  ])
  const items = rows.map((row) => mapOpenItemToOutstandingDto(row, ctx.reportDate))
  const summaries = buildCustomerRows(items, creditByCustomer)
  const summary = summaries[0]
  if (!summary) {
    return {
      customerId,
      customerCode: customer.companyCode,
      customerName: customer.name,
      openItemCount: 0,
      outstandingAmount: '0.0000',
      baseOutstandingAmount: '0.0000',
      debitOutstandingBase: '0.0000',
      creditOutstandingBase: '0.0000',
      netReceivableBase: '0.0000',
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
    customerCode: summary.customerCode ?? customer.companyCode,
    customerName: summary.customerName ?? customer.name,
    reportDate: ctx.reportDate,
    limitations: ctx.limitations,
  }
}

// Keep DEBIT filter import used for documentation / future credit-only paths
void DEBIT_OPEN_ITEM_SIDE_FILTER
