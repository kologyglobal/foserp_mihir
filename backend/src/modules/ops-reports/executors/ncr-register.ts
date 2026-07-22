import { prisma } from '../../../config/database.js'
import { ageInDays, applyDateRangeFilter, normalizeStatusFilterList } from './helpers.js'
import type { ExecutorContext, ExecutorOutput, ReportRow } from '../types.js'

export async function executeNcrRegister(ctx: ExecutorContext): Promise<ExecutorOutput> {
  const { tenantId, filters, timezone } = ctx
  const f = filters as { status?: string | string[]; severity?: string; productItemId?: string }

  const where: Record<string, unknown> = { tenantId }
  const statuses = normalizeStatusFilterList(f.status)
  if (statuses) where.status = { in: statuses }
  if (f.severity) where.severity = f.severity
  if (f.productItemId) where.itemId = f.productItemId
  applyDateRangeFilter(where, 'createdAt', filters as { dateFrom?: string; dateTo?: string }, timezone)

  const ncrs = await prisma.qualityNcr.findMany({
    where: where as never,
    select: {
      id: true,
      ncrNumber: true,
      title: true,
      status: true,
      severity: true,
      disposition: true,
      targetDate: true,
      closedAt: true,
      createdAt: true,
      productionOrder: { select: { orderNumber: true } },
      item: { select: { code: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 5000,
  })

  const now = new Date()
  const rows: ReportRow[] = ncrs.map((n) => ({
    id: n.id,
    ncrNumber: n.ncrNumber,
    title: n.title,
    status: n.status,
    severity: n.severity,
    disposition: n.disposition,
    orderNumber: n.productionOrder?.orderNumber ?? null,
    itemCode: n.item?.code ?? null,
    targetDate: n.targetDate?.toISOString() ?? null,
    closedAt: n.closedAt?.toISOString() ?? null,
    ageDays: ageInDays(n.createdAt, n.closedAt ?? now),
  }))

  return {
    rows,
    summary: {
      totalNcrs: rows.length,
      openNcrs: rows.filter((r) => !['CLOSED', 'CANCELLED'].includes(String(r.status))).length,
      criticalOpen: rows.filter((r) => r.severity === 'CRITICAL' && !['CLOSED', 'CANCELLED'].includes(String(r.status))).length,
    },
    warnings: [],
  }
}
