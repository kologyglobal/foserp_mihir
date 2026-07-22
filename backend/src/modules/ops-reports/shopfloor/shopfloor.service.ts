import { prisma } from '../../../config/database.js'
import { toNum } from '../executors/helpers.js'
import type { ReportRow } from '../types.js'

export interface ShopfloorLiveFilters {
  plantCode?: string
  workCentreId?: string
}

export interface ShopfloorLiveResult {
  rows: ReportRow[]
  lastRefreshed: string
  suggestedRefreshSeconds: number
}

/**
 * Currently active (IN_PROGRESS) stages across the shop floor — reused by the
 * `shopfloor-live` report executor and the dedicated `/manufacturing/shopfloor/live` route.
 * No OEE / capacity-utilisation figures are computed (out of scope for Phase 7D).
 */
export async function getShopfloorLive(tenantId: string, filters: ShopfloorLiveFilters): Promise<ShopfloorLiveResult> {
  const where: Record<string, unknown> = { tenantId, status: 'IN_PROGRESS' }
  if (filters.workCentreId) where.workCentreId = filters.workCentreId

  const stages = await prisma.productionOrderStage.findMany({
    where: where as never,
    select: {
      id: true,
      code: true,
      name: true,
      startedAt: true,
      goodQuantity: true,
      plannedQuantity: true,
      assignedUserId: true,
      activeAssignmentCount: true,
      openIssueCount: true,
      totalDowntimeMinutes: true,
      workCentre: { select: { id: true, code: true, name: true } },
      assignedMachine: { select: { id: true, code: true, name: true, status: true } },
      productionOrder: {
        select: {
          id: true,
          orderNumber: true,
          plantCode: true,
          status: true,
          healthStatus: true,
          priority: true,
          productItem: { select: { code: true, name: true } },
        },
      },
    },
    orderBy: { startedAt: 'asc' },
    take: 1000,
  })

  const filtered = filters.plantCode ? stages.filter((s) => s.productionOrder.plantCode === filters.plantCode) : stages

  const rows: ReportRow[] = filtered.map((s) => ({
    workOrderId: s.productionOrder.id,
    orderNumber: s.productionOrder.orderNumber,
    productItemCode: s.productionOrder.productItem.code,
    productItemName: s.productionOrder.productItem.name,
    priority: s.productionOrder.priority,
    plantCode: s.productionOrder.plantCode,
    stageId: s.id,
    stageCode: s.code,
    stageName: s.name,
    workCentre: s.workCentre?.name ?? null,
    workCentreId: s.workCentre?.id ?? null,
    machine: s.assignedMachine?.name ?? null,
    machineStatus: s.assignedMachine?.status ?? null,
    assignedUserId: s.assignedUserId,
    activeAssignmentCount: s.activeAssignmentCount,
    openIssueCount: s.openIssueCount,
    goodQuantity: toNum(s.goodQuantity),
    plannedQuantity: toNum(s.plannedQuantity),
    healthStatus: s.productionOrder.healthStatus,
    startedAt: s.startedAt?.toISOString() ?? null,
    totalDowntimeMinutes: s.totalDowntimeMinutes,
  }))

  return {
    rows,
    lastRefreshed: new Date().toISOString(),
    suggestedRefreshSeconds: 30,
  }
}
