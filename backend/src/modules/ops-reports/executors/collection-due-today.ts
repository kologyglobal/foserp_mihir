import { prisma } from '../../../config/database.js'
import { parseDateOnly } from '../../accounting/shared/finance.helpers.js'
import { OUTSTANDING_ACTIVE_STATUSES } from '../../accounting/receivables/reporting/receivable-reporting.types.js'
import { formatLocalDate } from '../timezone.js'
import { round2, toNum } from './helpers.js'
import type { ExecutorContext, ExecutorOutput, ReportRow } from '../types.js'

export async function executeCollectionDueToday(ctx: ExecutorContext): Promise<ExecutorOutput> {
  const { tenantId, filters, timezone } = ctx
  const f = filters as { customerId?: string; legalEntityId?: string }

  const today = formatLocalDate(new Date(), timezone)

  const items = await prisma.receivableOpenItem.findMany({
    where: {
      tenantId,
      side: 'DEBIT',
      openAmount: { gt: 0 },
      status: { in: OUTSTANDING_ACTIVE_STATUSES },
      dueDate: parseDateOnly(today),
      ...(f.customerId ? { customerId: f.customerId } : {}),
      ...(f.legalEntityId ? { legalEntityId: f.legalEntityId } : {}),
    },
    select: {
      id: true,
      documentNumberSnapshot: true,
      customerNameSnapshot: true,
      dueDate: true,
      openAmount: true,
      currencyCode: true,
      salesInvoice: { select: { invoiceNumber: true } },
    },
    orderBy: [{ openAmount: 'desc' }, { customerNameSnapshot: 'asc' }],
    take: 2000,
  })

  const rows: ReportRow[] = items.map((item) => ({
    openItemId: item.id,
    invoiceNumber: item.salesInvoice?.invoiceNumber ?? item.documentNumberSnapshot,
    customer: item.customerNameSnapshot,
    dueDate: item.dueDate?.toISOString().slice(0, 10) ?? today,
    openAmount: round2(toNum(item.openAmount)),
    currencyCode: item.currencyCode,
  }))

  return {
    rows,
    summary: {
      dueDate: today,
      openItemCount: rows.length,
      totalOpenAmount: round2(rows.reduce((s, r) => s + toNum(r.openAmount), 0)),
    },
    warnings: [],
  }
}
