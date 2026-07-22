import { prisma } from '../../../config/database.js'
import { applyDateRangeFilter, normalizeStatusFilterList } from './helpers.js'
import type { ExecutorContext, ExecutorOutput, ReportRow } from '../types.js'

export async function executeIssuesDowntime(ctx: ExecutorContext): Promise<ExecutorOutput> {
  const { tenantId, filters, timezone } = ctx
  const f = filters as { status?: string | string[]; severity?: string; workCentreId?: string }

  const where: Record<string, unknown> = { tenantId }
  const statuses = normalizeStatusFilterList(f.status)
  if (statuses) where.status = { in: statuses }
  if (f.severity) where.severity = f.severity
  if (f.workCentreId) where.workCentreId = f.workCentreId
  applyDateRangeFilter(where, 'startedAt', filters as { dateFrom?: string; dateTo?: string }, timezone)

  const issues = await prisma.productionIssue.findMany({
    where: where as never,
    select: {
      id: true,
      issueNumber: true,
      issueType: true,
      severity: true,
      status: true,
      title: true,
      startedAt: true,
      resolvedAt: true,
      actualDowntimeMinutes: true,
      productionBlocked: true,
      productionOrder: { select: { orderNumber: true } },
      downtimes: { select: { durationMinutes: true } },
    },
    orderBy: { startedAt: 'desc' },
    take: 3000,
  })

  const rows: ReportRow[] = issues.map((i) => {
    const linkedDowntime = i.downtimes.reduce((s, d) => s + (d.durationMinutes ?? 0), 0)
    return {
      id: i.id,
      issueNumber: i.issueNumber,
      orderNumber: i.productionOrder.orderNumber,
      issueType: i.issueType,
      severity: i.severity,
      status: i.status,
      title: i.title,
      startedAt: i.startedAt.toISOString(),
      resolvedAt: i.resolvedAt?.toISOString() ?? null,
      actualDowntimeMinutes: i.actualDowntimeMinutes ?? linkedDowntime,
      productionBlocked: i.productionBlocked,
    }
  })

  return {
    rows,
    summary: {
      totalIssues: rows.length,
      openIssues: rows.filter((r) => r.status === 'OPEN' || r.status === 'ACKNOWLEDGED' || r.status === 'IN_PROGRESS').length,
      totalDowntimeMinutes: rows.reduce((s, r) => s + Number(r.actualDowntimeMinutes ?? 0), 0),
    },
    warnings: [],
  }
}
