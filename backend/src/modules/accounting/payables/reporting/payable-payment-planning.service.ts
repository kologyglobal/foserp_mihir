import { formatForPersistence, sumDecimals } from '../../shared/finance-decimal.js'
import { addDays } from './payable-ageing.service.js'
import {
  findOutstandingOpenItems,
  mapOpenItemToOutstandingDto,
} from './payable-outstanding.repository.js'
import { resolvePayableReportingContext } from './payable-reporting-context.service.js'
import type {
  PaymentPlanningDto,
  PaymentPlanningDueGroup,
  PaymentPlanningOpenItemRow,
  PaymentPlanningQuery,
  PaymentPlanningVendorGroup,
} from './payable-reporting.types.js'

function toPlanningItem(item: ReturnType<typeof mapOpenItemToOutstandingDto>): PaymentPlanningOpenItemRow {
  return {
    openItemId: item.openItemId,
    documentType: item.documentType,
    documentNumber: item.documentNumber,
    vendorInvoiceId: item.vendorInvoiceId,
    dueDate: item.dueDate,
    outstandingAmount: item.outstandingAmount,
    baseOutstandingAmount: item.baseOutstandingAmount,
    currencyCode: item.currencyCode,
    daysOverdue: item.daysOverdue,
  }
}

function buildDueGroups(items: PaymentPlanningOpenItemRow[]): PaymentPlanningDueGroup[] {
  const byDue = new Map<string | null, PaymentPlanningOpenItemRow[]>()
  for (const item of items) {
    const key = item.dueDate
    const list = byDue.get(key) ?? []
    list.push(item)
    byDue.set(key, list)
  }

  return [...byDue.entries()]
    .sort(([a], [b]) => {
      if (a == null) return 1
      if (b == null) return -1
      return a.localeCompare(b)
    })
    .map(([dueDate, groupItems]) => ({
      dueDate,
      openItemCount: groupItems.length,
      outstandingAmount: formatForPersistence(sumDecimals(groupItems.map((i) => i.outstandingAmount))),
      baseOutstandingAmount: formatForPersistence(sumDecimals(groupItems.map((i) => i.baseOutstandingAmount))),
      items: groupItems,
    }))
}

export async function getPaymentPlanning(tenantId: string, query: PaymentPlanningQuery): Promise<PaymentPlanningDto> {
  const ctx = await resolvePayableReportingContext(tenantId, query.legalEntityId, query.asOfDate)
  const horizonDays = query.horizonDays ?? 7
  const horizonEndDate = addDays(ctx.reportDate, horizonDays)

  const rows = await findOutstandingOpenItems(ctx, {
    includeSettled: query.includeSettled,
    vendorId: query.vendorId,
  })

  const filtered = rows
    .filter((row) => {
      if (!row.dueDate) return true
      const due = row.dueDate.toISOString().slice(0, 10)
      return due <= horizonEndDate
    })
    .map((row) => mapOpenItemToOutstandingDto(row, ctx.reportDate))

  const byVendor = new Map<string, ReturnType<typeof mapOpenItemToOutstandingDto>[]>()
  for (const item of filtered) {
    const list = byVendor.get(item.vendorId) ?? []
    list.push(item)
    byVendor.set(item.vendorId, list)
  }

  const vendors: PaymentPlanningVendorGroup[] = [...byVendor.entries()]
    .sort(([, a], [, b]) => (a[0]?.vendorName ?? '').localeCompare(b[0]?.vendorName ?? ''))
    .map(([vendorId, vendorItems]) => {
      const planningItems = vendorItems.map(toPlanningItem)
      return {
        vendorId,
        vendorCode: vendorItems[0]?.vendorCode ?? null,
        vendorName: vendorItems[0]?.vendorName ?? null,
        openItemCount: vendorItems.length,
        outstandingAmount: formatForPersistence(sumDecimals(vendorItems.map((i) => i.outstandingAmount))),
        baseOutstandingAmount: formatForPersistence(sumDecimals(vendorItems.map((i) => i.baseOutstandingAmount))),
        dueGroups: buildDueGroups(planningItems),
      }
    })

  return {
    asOfDate: ctx.reportDate,
    horizonDays,
    horizonEndDate,
    limitations: ctx.limitations,
    totals: {
      openItemCount: filtered.length,
      vendorCount: vendors.length,
      outstandingAmount: formatForPersistence(sumDecimals(filtered.map((i) => i.outstandingAmount))),
      baseOutstandingAmount: formatForPersistence(sumDecimals(filtered.map((i) => i.baseOutstandingAmount))),
    },
    vendors,
  }
}
