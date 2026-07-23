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
 * Shopfloor shows only stages that are actionable now:
 * - IN_PROGRESS / ON_HOLD / QC_PENDING (work or attention needed)
 * - the WO's current READY stage (routing pointer)
 *
 * Showing every READY stage duplicates the same WO across all work centres when
 * routing dependencies were not snapshotted (all stages incorrectly READY).
 */
const BOARD_STAGE_STATUSES = ['READY', 'IN_PROGRESS', 'ON_HOLD', 'QC_PENDING'] as const
const ALWAYS_SHOW_STATUSES = new Set(['IN_PROGRESS', 'ON_HOLD', 'QC_PENDING'])

/**
 * Currently active stages across the shop floor — reused by the
 * `shopfloor-live` report executor and the dedicated `/manufacturing/shopfloor/live` route.
 * No OEE / capacity-utilisation figures are computed (out of scope for Phase 7D).
 */
export async function getShopfloorLive(tenantId: string, filters: ShopfloorLiveFilters): Promise<ShopfloorLiveResult> {
  const where: Record<string, unknown> = {
    tenantId,
    status: { in: [...BOARD_STAGE_STATUSES] },
    productionOrder: { deletedAt: null, status: { notIn: ['CANCELLED', 'CLOSED'] } },
  }
  if (filters.workCentreId) where.workCentreId = filters.workCentreId

  const stages = await prisma.productionOrderStage.findMany({
    where: where as never,
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      displayOrder: true,
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
          currentStageId: true,
          productItem: { select: { code: true, name: true } },
        },
      },
    },
    orderBy: [{ displayOrder: 'asc' }, { startedAt: 'asc' }],
    take: 1000,
  })

  const plantFiltered = filters.plantCode
    ? stages.filter((s) => s.productionOrder.plantCode === filters.plantCode)
    : stages

  // Per WO: keep always-active stages + current READY stage (fallback: earliest READY by displayOrder).
  const byOrder = new Map<string, typeof plantFiltered>()
  for (const stage of plantFiltered) {
    const key = stage.productionOrder.id
    const list = byOrder.get(key) ?? []
    list.push(stage)
    byOrder.set(key, list)
  }

  const actionable: typeof plantFiltered = []
  for (const list of byOrder.values()) {
    const currentId = list[0]?.productionOrder.currentStageId ?? null
    const readySorted = list
      .filter((s) => s.status === 'READY')
      .sort((a, b) => a.displayOrder - b.displayOrder)
    const currentReady =
      (currentId ? readySorted.find((s) => s.id === currentId) : undefined) ?? readySorted[0] ?? null

    for (const stage of list) {
      if (ALWAYS_SHOW_STATUSES.has(stage.status)) {
        actionable.push(stage)
        continue
      }
      if (stage.status === 'READY' && currentReady && stage.id === currentReady.id) {
        actionable.push(stage)
      }
    }
  }

  const rows: ReportRow[] = actionable.map((s) => ({
    workOrderId: s.productionOrder.id,
    orderNumber: s.productionOrder.orderNumber,
    productItemCode: s.productionOrder.productItem.code,
    productItemName: s.productionOrder.productItem.name,
    priority: s.productionOrder.priority,
    plantCode: s.productionOrder.plantCode,
    status: s.status,
    orderStatus: s.productionOrder.status,
    stageId: s.id,
    stageCode: s.code,
    stageName: s.name,
    displayOrder: s.displayOrder,
    isCurrentStage: s.id === s.productionOrder.currentStageId,
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
