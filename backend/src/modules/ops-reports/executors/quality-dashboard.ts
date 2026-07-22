import { prisma } from '../../../config/database.js'
import { applyDateRangeFilter, chartFromCounts } from './helpers.js'
import type { ExecutorContext, ExecutorOutput, ReportRow } from '../types.js'

export async function executeQualityDashboard(ctx: ExecutorContext): Promise<ExecutorOutput> {
  const { tenantId, filters, timezone } = ctx

  const inspectionWhere: Record<string, unknown> = { tenantId }
  applyDateRangeFilter(inspectionWhere, 'requestedAt', filters as { dateFrom?: string; dateTo?: string }, timezone)
  const inspections = await prisma.manufacturingQualityInspection.findMany({
    where: inspectionWhere as never,
    select: { category: true, status: true },
    take: 20000,
  })

  const ncrWhere: Record<string, unknown> = { tenantId }
  applyDateRangeFilter(ncrWhere, 'createdAt', filters as { dateFrom?: string; dateTo?: string }, timezone)
  const ncrs = await prisma.qualityNcr.findMany({
    where: ncrWhere as never,
    select: { severity: true, status: true },
    take: 20000,
  })

  const rows: ReportRow[] = []
  const byInspectionStatus = new Map<string, number>()
  for (const i of inspections) {
    const key = `${i.category}::${i.status}`
    byInspectionStatus.set(key, (byInspectionStatus.get(key) ?? 0) + 1)
  }
  for (const [key, count] of byInspectionStatus) {
    const [category, status] = key.split('::')
    rows.push({ category: `INSPECTION:${category}`, status, count })
  }
  const byNcrStatus = new Map<string, number>()
  for (const n of ncrs) {
    const key = `${n.severity}::${n.status}`
    byNcrStatus.set(key, (byNcrStatus.get(key) ?? 0) + 1)
  }
  for (const [key, count] of byNcrStatus) {
    const [severity, status] = key.split('::')
    rows.push({ category: `NCR:${severity}`, status, count })
  }

  const inspectionStatusCounts: Record<string, number> = {}
  for (const i of inspections) inspectionStatusCounts[i.status] = (inspectionStatusCounts[i.status] ?? 0) + 1
  const ncrSeverityCounts: Record<string, number> = {}
  for (const n of ncrs) ncrSeverityCounts[n.severity] = (ncrSeverityCounts[n.severity] ?? 0) + 1

  return {
    rows,
    summary: {
      totalInspections: inspections.length,
      totalNcrs: ncrs.length,
      openNcrs: ncrs.filter((n) => !['CLOSED', 'CANCELLED'].includes(n.status)).length,
    },
    chartData: [
      chartFromCounts('Inspections by Status', 'bar', inspectionStatusCounts),
      chartFromCounts('NCRs by Severity', 'pie', ncrSeverityCounts),
    ],
    warnings: [],
  }
}
