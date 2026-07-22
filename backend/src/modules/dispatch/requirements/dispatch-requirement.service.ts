import { prisma } from '../../../config/database.js'
import { InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { getLineFulfilmentPosition, getSalesOrderFulfilmentPositions } from '../fulfilment/sales-order-fulfilment-position.service.js'
import { overdueDays, roundQty } from '../shared/dispatch-qty.js'
import type { DispatchRequirementListItem } from '../shared/dispatch.types.js'
import * as repo from './dispatch-requirement.repository.js'
import { synchroniseDispatchRequirements } from './dispatch-requirement-sync.service.js'

function mapListItem(
  row: Awaited<ReturnType<typeof repo.list>>['items'][number],
  position?: Awaited<ReturnType<typeof getLineFulfilmentPosition>>,
): DispatchRequirementListItem {
  const remaining = position?.remainingToDispatchQty ?? Number(row.remainingQuantitySnapshot)
  const due = row.requestedDeliveryDate
  return {
    id: row.id,
    requirementNumber: row.requirementNumber,
    salesOrderId: row.salesOrderId,
    salesOrderNo: row.salesOrder.salesOrderNo,
    salesOrderLineId: row.salesOrderLineId,
    lineNo: position?.lineNo ?? 0,
    customerId: row.customerId,
    customerName: row.salesOrder.company?.name ?? null,
    shipToKey: row.shipToKey,
    shipToAddress: row.shipToAddress,
    itemId: row.itemId,
    itemCode: position?.itemCode ?? null,
    itemName: position?.itemName ?? null,
    productOrItem: position?.productOrItem ?? row.itemId ?? row.salesOrderLineId,
    orderedQty: position?.orderedQty ?? Number(row.orderedQuantitySnapshot),
    cancelledQty: position?.cancelledQty ?? Number(row.cancelledQuantitySnapshot),
    netDispatchedQty: position?.netDispatchedQty ?? Number(row.netDispatchedQuantitySnapshot),
    remainingQty: remaining,
    unrestrictedFgOnHand: position?.unrestrictedFgOnHand ?? 0,
    qualityHoldQty: position?.qualityHoldQty ?? 0,
    readyQty: position?.readyQty ?? 0,
    shortageQty: position?.shortageQty ?? 0,
    requestedDeliveryDate: due?.toISOString().slice(0, 10) ?? null,
    overdueDays: remaining > 0 ? overdueDays(due) : null,
    readinessStatus: position?.readinessStatus ?? row.readinessStatus,
    status: row.status,
    primaryBlockerCode: position?.primaryBlockerCode ?? row.primaryBlockerCode,
    currentDraftDispatchQuantity: position?.activeDraftDispatchQty ?? Number(row.currentDraftDispatchQuantity),
    priority: row.priority,
    allowedActions: position?.allowedActions ?? ['view_fulfilment'],
    sourceFingerprint: position?.sourceFingerprint ?? row.sourceFingerprint ?? '',
    lastCalculatedAt: row.lastCalculatedAt?.toISOString() ?? null,
  }
}

export async function synchronise(tenantId: string, userId: string | undefined, salesOrderId?: string) {
  return synchroniseDispatchRequirements(tenantId, { salesOrderId, userId })
}

export async function listRequirements(
  tenantId: string,
  query: Parameters<typeof repo.list>[1] & { refresh?: boolean },
  userId?: string,
) {
  if (query.refresh) {
    await synchroniseDispatchRequirements(tenantId, { salesOrderId: query.salesOrderId, userId })
  }
  const result = await repo.list(tenantId, query)
  const items: DispatchRequirementListItem[] = []
  for (const row of result.items) {
    try {
      const position = await getLineFulfilmentPosition(tenantId, row.salesOrderId, row.salesOrderLineId)
      items.push(mapListItem(row, position))
    } catch {
      items.push(mapListItem(row))
    }
  }
  return { total: result.total, items }
}

export async function getRequirementDetail(tenantId: string, id: string) {
  const row = await repo.findById(tenantId, id)
  if (!row) throw new NotFoundError('Dispatch requirement not found')
  const position = await getLineFulfilmentPosition(tenantId, row.salesOrderId, row.salesOrderLineId)
  return {
    ...mapListItem(row, position),
    fulfilment: position,
    activity: [
      { at: row.createdAt.toISOString(), type: 'REQUIREMENT_CREATED', label: 'Dispatch requirement created' },
      ...(row.lastCalculatedAt
        ? [{ at: row.lastCalculatedAt.toISOString(), type: 'READINESS_CALCULATED', label: 'Readiness recalculated' }]
        : []),
    ],
  }
}

export async function getRequirementReadiness(tenantId: string, id: string) {
  const detail = await getRequirementDetail(tenantId, id)
  return {
    requirementId: detail.id,
    readinessStatus: detail.readinessStatus,
    primaryBlockerCode: detail.primaryBlockerCode,
    blockers: detail.fulfilment.blockers,
    warnings: detail.fulfilment.warnings,
    readyQty: detail.readyQty,
    shortageQty: detail.shortageQty,
    sourceFingerprint: detail.sourceFingerprint,
    allowedActions: detail.allowedActions,
  }
}

export async function getRequirementFulfilmentPosition(tenantId: string, id: string) {
  const row = await repo.findById(tenantId, id)
  if (!row) throw new NotFoundError('Dispatch requirement not found')
  return getLineFulfilmentPosition(tenantId, row.salesOrderId, row.salesOrderLineId)
}

export async function holdRequirement(tenantId: string, id: string, reason: string | undefined, userId?: string) {
  const row = await repo.findById(tenantId, id)
  if (!row) throw new NotFoundError('Dispatch requirement not found')
  if (row.status === 'FULFILLED' || row.status === 'CANCELLED') {
    throw new InvalidStateError(`Cannot hold requirement in status ${row.status}`)
  }
  return prisma.dispatchRequirement.update({
    where: { id },
    data: {
      dispatchHold: true,
      holdReason: reason?.trim() || 'Dispatch hold',
      status: 'ON_HOLD',
      readinessStatus: 'ON_HOLD',
      primaryBlockerCode: 'ON_HOLD',
      updatedBy: userId ?? null,
    },
  })
}

export async function releaseHold(tenantId: string, id: string, userId?: string) {
  const row = await repo.findById(tenantId, id)
  if (!row) throw new NotFoundError('Dispatch requirement not found')
  await prisma.dispatchRequirement.update({
    where: { id },
    data: {
      dispatchHold: false,
      holdReason: null,
      status: 'ACTIVE',
      updatedBy: userId ?? null,
    },
  })
  await synchroniseDispatchRequirements(tenantId, { salesOrderId: row.salesOrderId, userId })
  return getRequirementDetail(tenantId, id)
}

export async function readinessPreview(tenantId: string, requirementIds: string[]) {
  if (!requirementIds.length) throw new ValidationError('requirementIds is required')
  const rows = []
  for (const id of requirementIds) {
    rows.push(await getRequirementReadiness(tenantId, id))
  }
  return { items: rows }
}

export async function listForSalesOrder(tenantId: string, salesOrderId: string) {
  await synchroniseDispatchRequirements(tenantId, { salesOrderId })
  return listRequirements(tenantId, { page: 1, limit: 100, salesOrderId })
}

export async function dispatchHistoryForSalesOrder(tenantId: string, salesOrderId: string) {
  const order = await prisma.crmSalesOrder.findFirst({
    where: { id: salesOrderId, tenantId, deletedAt: null },
    select: { id: true },
  })
  if (!order) throw new NotFoundError('Sales order not found')
  const dispatches = await prisma.outboundDispatch.findMany({
    where: { tenantId, deletedAt: null, OR: [{ salesOrderId }, { lines: { some: { salesOrderId } } }] },
    include: { lines: { orderBy: { lineNo: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  })
  return {
    salesOrderId,
    items: dispatches.map((d) => ({
      id: d.id,
      dispatchNo: d.dispatchNo,
      status: d.status,
      planningSource: d.planningSource,
      plannedDispatchDate: d.plannedDispatchDate?.toISOString().slice(0, 10) ?? null,
      confirmedAt: d.confirmedAt?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
      lineCount: d.lines.length,
      totalQty: roundQty(d.lines.reduce((s, l) => s + Number(l.quantity), 0)),
    })),
  }
}

export async function salesOrderFulfilmentSummary(tenantId: string, salesOrderId: string) {
  const positions = await getSalesOrderFulfilmentPositions(tenantId, salesOrderId)
  const totals = positions.reduce(
    (acc, p) => {
      acc.orderedQty += p.orderedQty
      acc.cancelledQty += p.cancelledQty
      acc.netDispatchedQty += p.netDispatchedQty
      acc.remainingQty += p.remainingToDispatchQty
      acc.readyQty += p.readyQty
      if (p.readinessStatus === 'WAITING_FOR_PRODUCTION') acc.waitingForProduction += 1
      if (p.readinessStatus === 'WAITING_FOR_QUALITY') acc.waitingForQuality += 1
      if (p.readinessStatus === 'READY_TO_DISPATCH' || p.readinessStatus === 'PARTIALLY_READY') acc.readyLines += 1
      return acc
    },
    {
      orderedQty: 0,
      cancelledQty: 0,
      netDispatchedQty: 0,
      remainingQty: 0,
      readyQty: 0,
      waitingForProduction: 0,
      waitingForQuality: 0,
      readyLines: 0,
      reservedQty: 0,
      pickedQty: 0,
      packedQty: 0,
      challanQty: 0,
    },
  )

  // Operational quantities (≠ dispatched/fulfilled). Document-only challan qty included separately.
  const [reservations, pickLines, packageLines, challanLines] = await Promise.all([
    prisma.inventoryStockReservation.aggregate({
      where: {
        tenantId,
        demandType: 'DISPATCH',
        status: 'ACTIVE',
        salesOrderId,
      },
      _sum: { quantity: true },
    }),
    prisma.dispatchPickLine.findMany({
      where: {
        tenantId,
        salesOrderId,
        pickList: { deletedAt: null, status: { not: 'CANCELLED' } },
      },
      select: { pickedQuantity: true },
    }),
    prisma.dispatchPackageLine.findMany({
      where: {
        tenantId,
        status: { in: ['PACKED', 'MOVED'] },
        salesOrderId,
      },
      select: { packedQuantity: true },
    }),
    prisma.deliveryChallanLine.findMany({
      where: {
        tenantId,
        salesOrderId,
        deliveryChallan: {
          deletedAt: null,
          status: { in: ['DRAFT', 'READY_FOR_REVIEW', 'APPROVED', 'ISSUED', 'SENT_BACK'] },
        },
      },
      select: { challanQuantity: true },
    }),
  ])

  totals.reservedQty = roundQty(Number(reservations._sum?.quantity ?? 0))
  totals.pickedQty = roundQty(pickLines.reduce((s, l) => s + Number(l.pickedQuantity), 0))
  totals.packedQty = roundQty(packageLines.reduce((s, l) => s + Number(l.packedQuantity), 0))
  totals.challanQty = roundQty(challanLines.reduce((s, l) => s + Number(l.challanQuantity), 0))

  const challans = await prisma.deliveryChallan.findMany({
    where: {
      tenantId,
      deletedAt: null,
      lines: { some: { salesOrderId } },
    },
    select: {
      id: true,
      challanNumber: true,
      status: true,
      versionNumber: true,
      totalQuantity: true,
      documentDate: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 20,
  })

  return {
    salesOrderId,
    lines: positions,
    totals,
    deliveryChallans: challans.map((c) => ({
      id: c.id,
      challanNumber: c.challanNumber,
      status: c.status,
      versionNumber: c.versionNumber,
      totalQuantity: Number(c.totalQuantity),
      documentDate: c.documentDate.toISOString().slice(0, 10),
    })),
    notes: {
      challanVsDispatch:
        'Delivery Challan Quantity ≠ Dispatched Quantity ≠ Fulfilled Quantity. Challan is document-only until Phase 7C5 posting.',
    },
    invoiceReadiness: null as null | { ready: boolean; note: string },
  }
}
