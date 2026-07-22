import { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'

const D = (value: Prisma.Decimal.Value = 0) => new Prisma.Decimal(value)

export async function getWorkspaceSummary(tenantId: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [unposted, failed, provisional, latestSnapshots, fgToday, readyToClose] = await Promise.all([
    prisma.productionAccountingEvent.count({ where: { tenantId, status: 'RECORDED' } }),
    prisma.productionAccountingEvent.count({ where: { tenantId, status: 'FAILED' } }),
    prisma.workOrderCostSnapshot.count({ where: { tenantId, provisionalCost: { gt: 0 } } }),
    prisma.workOrderCostSnapshot.findMany({
      where: { tenantId },
      orderBy: [{ productionOrderId: 'asc' }, { snapshotVersion: 'desc' }],
      distinct: ['productionOrderId'],
    }),
    prisma.productionAccountingEvent.aggregate({
      where: { tenantId, eventType: 'FINISHED_GOODS_RECEIVED', status: 'POSTED', postedAt: { gte: today } },
      _sum: { amount: true },
    }),
    prisma.productionOrder.count({ where: { tenantId, deletedAt: null, status: { in: ['COMPLETED', 'CLOSED'] } } }),
  ])
  const fgByWorkOrder = await prisma.productionAccountingEvent.groupBy({
    by: ['productionOrderId'],
    where: { tenantId, eventType: 'FINISHED_GOODS_RECEIVED', status: 'POSTED', productionOrderId: { not: null } },
    _sum: { amount: true },
  })
  const fgMap = new Map(fgByWorkOrder.map((row) => [row.productionOrderId, D(row._sum.amount ?? 0)]))
  const wipValue = latestSnapshots.reduce(
    (sum, snapshot) => sum.plus(snapshot.totalActualCost.minus(fgMap.get(snapshot.productionOrderId) ?? D(0))),
    D(0),
  )
  return {
    unpostedCount: unposted,
    failedCount: failed,
    provisionalCount: provisional,
    wipValue,
    fgCapitalisedToday: fgToday._sum.amount ?? D(0),
    workOrdersReadyToClose: readyToClose,
  }
}

export function listUnposted(tenantId: string) {
  return prisma.productionAccountingEvent.findMany({
    where: { tenantId, status: 'RECORDED' },
    orderBy: { createdAt: 'desc' },
  })
}

export function listFailed(tenantId: string) {
  return prisma.productionAccountingEvent.findMany({
    where: { tenantId, status: 'FAILED' },
    orderBy: { updatedAt: 'desc' },
  })
}

export function listProvisional(tenantId: string) {
  return prisma.workOrderCostSnapshot.findMany({
    where: { tenantId, provisionalCost: { gt: 0 } },
    orderBy: { calculationDate: 'desc' },
    include: { productionOrder: { select: { orderNumber: true, status: true } } },
  })
}

export function listCloseReady(tenantId: string) {
  return prisma.productionOrder.findMany({
    where: {
      tenantId,
      deletedAt: null,
      status: { in: ['COMPLETED', 'CLOSED'] },
      costSnapshots: { some: {} },
      accountingEvents: { none: { status: 'FAILED' } },
    },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      completedGoodQuantity: true,
      costSnapshots: { orderBy: { snapshotVersion: 'desc' }, take: 1 },
    },
    orderBy: { actualCompletedAt: 'desc' },
  })
}

export async function listReconciliation(tenantId: string) {
  const snapshots = await prisma.workOrderCostSnapshot.findMany({
    where: { tenantId },
    orderBy: [{ productionOrderId: 'asc' }, { snapshotVersion: 'desc' }],
    distinct: ['productionOrderId'],
    include: { productionOrder: { select: { orderNumber: true, status: true } } },
  })
  const posted = await prisma.productionAccountingEvent.groupBy({
    by: ['productionOrderId'],
    where: { tenantId, status: 'POSTED', productionOrderId: { not: null } },
    _sum: { amount: true },
  })
  const failed = await prisma.productionAccountingEvent.groupBy({
    by: ['productionOrderId'],
    where: { tenantId, status: 'FAILED', productionOrderId: { not: null } },
    _count: { _all: true },
  })
  const postedMap = new Map(posted.map((row) => [row.productionOrderId, D(row._sum.amount ?? 0)]))
  const failedSet = new Set(failed.map((row) => row.productionOrderId))
  return snapshots.map((snapshot) => {
    const postedAmount = postedMap.get(snapshot.productionOrderId) ?? D(0)
    const difference = snapshot.totalActualCost.minus(postedAmount)
    const status = failedSet.has(snapshot.productionOrderId)
      ? 'BLOCKED'
      : snapshot.provisionalCost.greaterThan(0)
        ? 'PROVISIONAL'
        : postedAmount.equals(0)
          ? 'UNPOSTED'
          : difference.abs().lessThanOrEqualTo(0.01)
            ? 'RECONCILED'
            : 'DIFFERENCE'
    return {
      productionOrderId: snapshot.productionOrderId,
      orderNumber: snapshot.productionOrder.orderNumber,
      operationalCost: snapshot.totalActualCost,
      postedAmount,
      difference,
      status,
      snapshotVersion: snapshot.snapshotVersion,
    }
  })
}
