import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import { mapProductionOrder } from '../shared/manufacturing.mappers.js'
import { ACTIVE_ASSIGNMENT_STATUSES } from '../assignments/assignment.helpers.js'

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

const LIST_LIMIT = 25
const OPEN_ISSUE_STATUSES = ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'] as const

function mapOrderCard(order: Parameters<typeof mapProductionOrder>[0] & {
  currentStage?: { assignedUserId?: string | null; assignedMachineId?: string | null; activeAssignmentCount?: number } | null
}) {
  return {
    ...mapProductionOrder(order),
    assignedUserId: order.currentStage?.assignedUserId ?? null,
    assignedMachineId: order.currentStage?.assignedMachineId ?? null,
    activeAssignmentCount: order.currentStage?.activeAssignmentCount ?? 0,
  }
}

export async function getTodayOverview(tenantId: string, now: Date = new Date()) {
  const dayStart = startOfDay(now)
  const dayEnd = endOfDay(now)

  const [running, dueToday, delayed, onHold, completedToday, openIssues, pausedTasks, unassignedReadyWork, myTeamRunning] =
    await Promise.all([
      prisma.productionOrder.findMany({
        where: { ...tenantActiveFilter(tenantId), status: 'IN_PROGRESS' },
        orderBy: { requiredCompletionDate: 'asc' },
        take: LIST_LIMIT,
        include: {
          stages: {
            select: { id: true, assignedUserId: true, assignedMachineId: true, activeAssignmentCount: true },
          },
        },
      }),
      prisma.productionOrder.findMany({
        where: {
          ...tenantActiveFilter(tenantId),
          requiredCompletionDate: { gte: dayStart, lte: dayEnd },
          status: { notIn: ['COMPLETED', 'CLOSED', 'CANCELLED'] },
        },
        orderBy: { requiredCompletionDate: 'asc' },
        take: LIST_LIMIT,
      }),
      prisma.productionOrder.findMany({
        where: { ...tenantActiveFilter(tenantId), healthStatus: 'DELAYED' },
        orderBy: { requiredCompletionDate: 'asc' },
        take: LIST_LIMIT,
      }),
      prisma.productionOrder.findMany({
        where: { ...tenantActiveFilter(tenantId), status: 'ON_HOLD' },
        orderBy: { updatedAt: 'desc' },
        take: LIST_LIMIT,
      }),
      prisma.productionOrder.findMany({
        where: { ...tenantActiveFilter(tenantId), actualCompletedAt: { gte: dayStart, lte: dayEnd } },
        orderBy: { actualCompletedAt: 'desc' },
        take: LIST_LIMIT,
      }),
      prisma.productionIssue.findMany({
        where: { tenantId, status: { in: [...OPEN_ISSUE_STATUSES] } },
        orderBy: { createdAt: 'desc' },
        take: LIST_LIMIT,
        select: {
          id: true,
          issueNumber: true,
          title: true,
          severity: true,
          status: true,
          productionOrderId: true,
          stageId: true,
          productionBlocked: true,
        },
      }),
      prisma.productionAssignment.findMany({
        where: { tenantId, status: 'PAUSED' },
        orderBy: { pausedAt: 'desc' },
        take: LIST_LIMIT,
        include: {
          stage: { select: { code: true, name: true } },
          machine: { select: { code: true, name: true } },
          productionOrder: { select: { orderNumber: true } },
        },
      }),
      prisma.productionOrderStage.count({
        where: {
          tenantId,
          status: 'READY',
          activeAssignmentCount: 0,
          productionOrder: { ...tenantActiveFilter(tenantId), status: { in: ['READY', 'IN_PROGRESS'] } },
        },
      }),
      prisma.productionAssignment.findMany({
        where: { tenantId, status: 'IN_PROGRESS' },
        orderBy: { startedAt: 'desc' },
        take: LIST_LIMIT,
        include: {
          stage: { select: { code: true, name: true } },
          machine: { select: { code: true, name: true, status: true } },
          productionOrder: { select: { orderNumber: true } },
        },
      }),
    ])

  const enrichRunning = running.map((order) => {
    const currentStage = order.stages.find((s) => s.id === order.currentStageId)
    return mapOrderCard({ ...order, currentStage })
  })

  return {
    counts: {
      running: running.length,
      dueToday: dueToday.length,
      delayed: delayed.length,
      onHold: onHold.length,
      completedToday: completedToday.length,
      openIssues: openIssues.length,
      pausedTasks: pausedTasks.length,
      unassignedReadyWork,
      myTeamRunning: myTeamRunning.length,
    },
    running: enrichRunning,
    dueToday: dueToday.map(mapProductionOrder),
    delayed: delayed.map(mapProductionOrder),
    onHold: onHold.map(mapProductionOrder),
    completedToday: completedToday.map(mapProductionOrder),
    openIssues,
    pausedTasks,
    myTeamRunning,
  }
}

export async function getWorkOrdersSummary(tenantId: string) {
  const [byStatus, byHealth, total] = await Promise.all([
    prisma.productionOrder.groupBy({ by: ['status'], where: tenantActiveFilter(tenantId), _count: { _all: true } }),
    prisma.productionOrder.groupBy({ by: ['healthStatus'], where: tenantActiveFilter(tenantId), _count: { _all: true } }),
    prisma.productionOrder.count({ where: tenantActiveFilter(tenantId) }),
  ])

  return {
    total,
    byStatus: byStatus.map((row) => ({ status: row.status, count: row._count._all })),
    byHealth: byHealth.map((row) => ({ healthStatus: row.healthStatus, count: row._count._all })),
  }
}

export async function getControlRoomOverview(tenantId: string) {
  const [byStatus, byHealth, activeOrders, openIssues, pausedTasks, unassignedReadyWork, myTeamRunning] = await Promise.all([
    prisma.productionOrder.groupBy({
      by: ['status'],
      where: tenantActiveFilter(tenantId),
      _count: { _all: true },
    }),
    prisma.productionOrder.groupBy({
      by: ['healthStatus'],
      where: tenantActiveFilter(tenantId),
      _count: { _all: true },
    }),
    prisma.productionOrder.findMany({
      where: { ...tenantActiveFilter(tenantId), status: { in: ['READY', 'IN_PROGRESS', 'ON_HOLD'] } },
      include: {
        stages: {
          where: { status: { in: ['IN_PROGRESS', 'READY'] } },
          include: { workCentre: true, assignedMachine: { select: { id: true, code: true, name: true, status: true } } },
        },
      },
    }),
    prisma.productionIssue.findMany({
      where: { tenantId, status: { in: [...OPEN_ISSUE_STATUSES] } },
      orderBy: { createdAt: 'desc' },
      take: LIST_LIMIT,
      select: { id: true, issueNumber: true, title: true, severity: true, status: true, productionBlocked: true },
    }),
    prisma.productionAssignment.count({ where: { tenantId, status: 'PAUSED' } }),
    prisma.productionOrderStage.count({
      where: {
        tenantId,
        status: 'READY',
        activeAssignmentCount: 0,
        productionOrder: { ...tenantActiveFilter(tenantId), status: { in: ['READY', 'IN_PROGRESS'] } },
      },
    }),
    prisma.productionAssignment.count({ where: { tenantId, status: 'IN_PROGRESS' } }),
  ])

  const workCentreBreakdown = new Map<string, { workCentreId: string | null; workCentreName: string; orderCount: number }>()
  const stageBreakdown = new Map<string, { stageName: string; orderCount: number }>()

  for (const order of activeOrders) {
    const currentStage = order.stages.find((s) => s.id === order.currentStageId) ?? order.stages[0]
    if (!currentStage) continue

    const wcKey = currentStage.workCentreId ?? 'UNASSIGNED'
    const wcEntry = workCentreBreakdown.get(wcKey) ?? {
      workCentreId: currentStage.workCentreId,
      workCentreName: currentStage.workCentre?.name ?? 'Unassigned',
      orderCount: 0,
    }
    wcEntry.orderCount += 1
    workCentreBreakdown.set(wcKey, wcEntry)

    const stageEntry = stageBreakdown.get(currentStage.name) ?? { stageName: currentStage.name, orderCount: 0 }
    stageEntry.orderCount += 1
    stageBreakdown.set(currentStage.name, stageEntry)
  }

  return {
    byStatus: byStatus.map((row) => ({ status: row.status, count: row._count._all })),
    byHealth: byHealth.map((row) => ({ healthStatus: row.healthStatus, count: row._count._all })),
    byWorkCentre: Array.from(workCentreBreakdown.values()),
    byCurrentStage: Array.from(stageBreakdown.values()),
    activeOrderCount: activeOrders.length,
    openIssues,
    pausedTasks,
    unassignedReadyWork,
    myTeamRunning,
    activeAssignmentsInProgress: await prisma.productionAssignment.count({
      where: { tenantId, status: { in: ACTIVE_ASSIGNMENT_STATUSES } },
    }),
  }
}
