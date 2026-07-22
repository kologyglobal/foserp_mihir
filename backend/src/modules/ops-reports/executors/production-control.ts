import { prisma } from '../../../config/database.js'
import type { ExecutorContext, ExecutorOutput, ReportChartData, ReportRow } from '../types.js'
import { applyDateRangeFilter, chartFromCounts, countBy, toNum } from './helpers.js'

const OPEN_STATUSES = ['DRAFT', 'READY', 'IN_PROGRESS', 'ON_HOLD']

export async function executeProductionControl(ctx: ExecutorContext): Promise<ExecutorOutput> {
  const { tenantId, filters, timezone } = ctx
  const where: Record<string, unknown> = { tenantId, deletedAt: null }
  if (filters.plantCode) where.plantCode = filters.plantCode
  if (filters.productItemId) where.productItemId = filters.productItemId
  if (filters.supervisorId) where.supervisorId = filters.supervisorId
  const statusFilter = filters.status
  if (statusFilter) where.status = Array.isArray(statusFilter) ? { in: statusFilter } : statusFilter
  applyDateRangeFilter(where, 'requiredCompletionDate', filters as { dateFrom?: string; dateTo?: string }, timezone)

  const orders = await prisma.productionOrder.findMany({
    where: where as never,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      healthStatus: true,
      plantCode: true,
      productItemId: true,
      productItem: { select: { code: true, name: true } },
      plannedQuantity: true,
      completedGoodQuantity: true,
      requiredCompletionDate: true,
      supervisorId: true,
      materialControlStatus: true,
      qualityStatus: true,
    },
    orderBy: { requiredCompletionDate: 'asc' },
    take: 5000,
  })

  const now = new Date()
  const rows: ReportRow[] = []
  let overdueCount = 0
  let openCount = 0
  for (const o of orders) {
    const isOpen = OPEN_STATUSES.includes(o.status)
    if (isOpen) openCount++
    const overdue = isOpen && o.requiredCompletionDate < now
    if (overdue) overdueCount++
    if (isOpen && (overdue || o.healthStatus !== 'ON_TRACK')) {
      rows.push({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        healthStatus: o.healthStatus,
        productItemCode: o.productItem.code,
        productItemName: o.productItem.name,
        plannedQuantity: toNum(o.plannedQuantity),
        completedGoodQuantity: toNum(o.completedGoodQuantity),
        requiredCompletionDate: o.requiredCompletionDate.toISOString(),
        overdue,
        materialControlStatus: o.materialControlStatus,
        qualityStatus: o.qualityStatus,
      })
    }
  }

  const statusCounts = countBy(
    orders.map((o) => ({ status: o.status })),
    'status',
  )
  const healthCounts = countBy(
    orders.map((o) => ({ healthStatus: o.healthStatus })),
    'healthStatus',
  )

  const chartData: ReportChartData[] = [
    chartFromCounts('Work Orders by Status', 'bar', statusCounts),
    chartFromCounts('Work Orders by Health', 'pie', healthCounts),
  ]

  return {
    rows,
    summary: {
      totalOrders: orders.length,
      openOrders: openCount,
      overdueOrders: overdueCount,
      attentionCount: rows.length,
      statusCounts,
      healthCounts,
    },
    chartData,
    warnings: orders.length >= 5000 ? ['Result set capped at 5000 work orders — narrow filters for a complete view.'] : [],
  }
}
