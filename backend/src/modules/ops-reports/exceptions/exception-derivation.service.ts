import { prisma } from '../../../config/database.js'
import { ageInDays } from '../executors/helpers.js'
import type { DerivedException } from './exception.types.js'

const OPEN_WO_STATUSES = ['DRAFT', 'READY', 'IN_PROGRESS', 'ON_HOLD']
const OPEN_JOB_WORK_STATUSES = ['DRAFT', 'MATERIAL_SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'RECONCILIATION_PENDING']
const OPEN_ISSUE_STATUSES = ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS']
const OPEN_QUALITY_STATUSES = ['PENDING', 'READY', 'IN_PROGRESS']
const OPEN_SO_STATUSES = ['open', 'confirmed', 'in_production', 'ready_dispatch', 'dispatched']

async function deriveOverdueWorkOrders(tenantId: string, now: Date): Promise<DerivedException[]> {
  const where: Record<string, unknown> = {
    tenantId,
    deletedAt: null,
    status: { in: OPEN_WO_STATUSES },
    requiredCompletionDate: { lt: now },
  }
  const orders = await prisma.productionOrder.findMany({
    where: where as never,
    select: { id: true, orderNumber: true, requiredCompletionDate: true, productItem: { select: { code: true } } },
    take: 2000,
  })
  return orders.map((o) => {
    const ageDays = ageInDays(o.requiredCompletionDate, now)
    return {
      exceptionKey: `WO_OVERDUE:${o.id}`,
      category: 'WORK_ORDER_OVERDUE' as const,
      severity: ageDays > 7 ? ('HIGH' as const) : ('MEDIUM' as const),
      sourceType: 'ProductionOrder',
      sourceId: o.id,
      title: `Work order ${o.orderNumber} is overdue`,
      detail: `Item ${o.productItem.code} — required completion date has passed (${ageDays} day(s) overdue).`,
      ageDays,
      referenceDate: o.requiredCompletionDate.toISOString(),
    }
  })
}

async function deriveMaterialShortages(tenantId: string, now: Date): Promise<DerivedException[]> {
  const where: Record<string, unknown> = {
    tenantId,
    status: 'SHORT',
    productionOrder: { status: { in: OPEN_WO_STATUSES }, deletedAt: null },
  }
  const materials = await prisma.productionOrderMaterial.findMany({
    where: where as never,
    select: {
      id: true,
      shortageQty: true,
      updatedAt: true,
      item: { select: { code: true } },
      productionOrder: { select: { orderNumber: true } },
    },
    take: 2000,
  })
  return materials.map((m) => ({
    exceptionKey: `MATERIAL_SHORTAGE:${m.id}`,
    category: 'MATERIAL_SHORTAGE' as const,
    severity: 'HIGH' as const,
    sourceType: 'ProductionOrderMaterial',
    sourceId: m.id,
    title: `Material shortage on ${m.productionOrder.orderNumber}`,
    detail: `Item ${m.item.code} is short by ${Number(m.shortageQty)}.`,
    ageDays: ageInDays(m.updatedAt, now),
    referenceDate: m.updatedAt.toISOString(),
  }))
}

async function deriveCriticalIssues(tenantId: string, now: Date): Promise<DerivedException[]> {
  const where: Record<string, unknown> = { tenantId, severity: 'CRITICAL', status: { in: OPEN_ISSUE_STATUSES } }
  const issues = await prisma.productionIssue.findMany({
    where: where as never,
    select: { id: true, issueNumber: true, title: true, startedAt: true, productionOrder: { select: { orderNumber: true } } },
    take: 2000,
  })
  return issues.map((i) => ({
    exceptionKey: `ISSUE_CRITICAL:${i.id}`,
    category: 'CRITICAL_ISSUE' as const,
    severity: 'CRITICAL' as const,
    sourceType: 'ProductionIssue',
    sourceId: i.id,
    title: `Critical issue ${i.issueNumber} on ${i.productionOrder.orderNumber}`,
    detail: i.title,
    ageDays: ageInDays(i.startedAt, now),
    referenceDate: i.startedAt.toISOString(),
  }))
}

async function derivePendingQualityInspections(tenantId: string, now: Date): Promise<DerivedException[]> {
  const where: Record<string, unknown> = { tenantId, status: { in: OPEN_QUALITY_STATUSES } }
  const inspections = await prisma.manufacturingQualityInspection.findMany({
    where: where as never,
    select: { id: true, inspectionNumber: true, requestedAt: true, item: { select: { code: true } } },
    take: 2000,
  })
  return inspections.map((i) => {
    const ageDays = ageInDays(i.requestedAt, now)
    return {
      exceptionKey: `QUALITY_PENDING:${i.id}`,
      category: 'QUALITY_PENDING' as const,
      severity: ageDays > 3 ? ('HIGH' as const) : ('MEDIUM' as const),
      sourceType: 'QualityInspection',
      sourceId: i.id,
      title: `Inspection ${i.inspectionNumber} awaiting decision`,
      detail: `Item ${i.item?.code ?? 'n/a'} — pending for ${ageDays} day(s).`,
      ageDays,
      referenceDate: i.requestedAt.toISOString(),
    }
  })
}

async function deriveOpenNcrs(tenantId: string, now: Date): Promise<DerivedException[]> {
  const where: Record<string, unknown> = { tenantId, status: { not: 'CLOSED' } }
  const ncrs = await prisma.qualityNcr.findMany({
    where: where as never,
    select: { id: true, ncrNumber: true, title: true, severity: true, createdAt: true },
    take: 2000,
  })
  return ncrs.map((n) => ({
    exceptionKey: `NCR_OPEN:${n.id}`,
    category: 'NCR_OPEN' as const,
    severity: (n.severity as DerivedException['severity']) ?? 'MEDIUM',
    sourceType: 'QualityNcr',
    sourceId: n.id,
    title: `NCR ${n.ncrNumber} is open`,
    detail: n.title,
    ageDays: ageInDays(n.createdAt, now),
    referenceDate: n.createdAt.toISOString(),
  }))
}

async function deriveOverdueJobWork(tenantId: string, now: Date): Promise<DerivedException[]> {
  const where: Record<string, unknown> = {
    tenantId,
    deletedAt: null,
    status: { in: OPEN_JOB_WORK_STATUSES },
    expectedReturnDate: { lt: now },
  }
  const jobWorks = await prisma.jobWorkOrder.findMany({
    where: where as never,
    select: { id: true, jwNumber: true, expectedReturnDate: true, vendor: { select: { name: true } } },
    take: 2000,
  })
  return jobWorks.map((j) => {
    const ageDays = ageInDays(j.expectedReturnDate, now)
    return {
      exceptionKey: `JOB_WORK_OVERDUE:${j.id}`,
      category: 'JOB_WORK_OVERDUE' as const,
      severity: ageDays > 7 ? ('HIGH' as const) : ('MEDIUM' as const),
      sourceType: 'JobWorkOrder',
      sourceId: j.id,
      title: `Job work ${j.jwNumber} is overdue for return`,
      detail: `Vendor ${j.vendor.name} — expected return date has passed (${ageDays} day(s) overdue).`,
      ageDays,
      referenceDate: j.expectedReturnDate!.toISOString(),
    }
  })
}

async function deriveOverdueSalesOrderLines(tenantId: string, now: Date): Promise<DerivedException[]> {
  const where: Record<string, unknown> = {
    tenantId,
    deletedAt: null,
    status: { in: OPEN_SO_STATUSES },
    OR: [{ requiredDate: { lt: now } }, { expectedDeliveryDate: { lt: now } }],
  }
  const orders = await prisma.crmSalesOrder.findMany({
    where: where as never,
    select: { id: true, salesOrderNo: true, requiredDate: true, expectedDeliveryDate: true, lines: true },
    take: 500,
  })
  if (orders.length === 0) return []

  const cancelledRows = await prisma.salesOrderLineFulfilment.findMany({
    where: { tenantId, salesOrderId: { in: orders.map((o) => o.id) } },
  })
  const cancelledMap = new Map(cancelledRows.map((r) => [`${r.salesOrderId}:${r.salesOrderLineId}`, Number(r.cancelledQty)]))
  const dispatchedRows = await prisma.outboundDispatchLine.findMany({
    where: {
      tenantId,
      salesOrderId: { in: orders.map((o) => o.id) },
      salesOrderLineId: { not: null },
      outboundDispatch: { tenantId, status: 'CONFIRMED', deletedAt: null },
    },
    select: { salesOrderId: true, salesOrderLineId: true, quantity: true },
  })
  const dispatchedMap = new Map<string, number>()
  for (const row of dispatchedRows) {
    if (!row.salesOrderId || !row.salesOrderLineId) continue
    const key = `${row.salesOrderId}:${row.salesOrderLineId}`
    dispatchedMap.set(key, (dispatchedMap.get(key) ?? 0) + Number(row.quantity))
  }

  const out: DerivedException[] = []
  for (const so of orders) {
    const dueDate = so.requiredDate ?? so.expectedDeliveryDate!
    const lines = Array.isArray(so.lines) ? (so.lines as Array<{ id: string; lineNo: number; qty: number }>) : []
    for (const line of lines) {
      const key = `${so.id}:${line.id}`
      const cancelledQty = cancelledMap.get(key) ?? 0
      const netOrderedQty = Math.max(0, line.qty - cancelledQty)
      const dispatchedQty = dispatchedMap.get(key) ?? 0
      const remainingQty = Math.max(0, Math.round((netOrderedQty - dispatchedQty) * 10000) / 10000)
      if (remainingQty <= 0) continue
      const ageDays = ageInDays(dueDate, now)
      out.push({
        exceptionKey: `SO_LINE_OVERDUE:${so.id}:${line.lineNo}`,
        category: 'SALES_ORDER_LINE_OVERDUE',
        severity: ageDays > 7 ? 'HIGH' : 'MEDIUM',
        sourceType: 'CrmSalesOrderLine',
        sourceId: `${so.id}:${line.lineNo}`,
        title: `SO ${so.salesOrderNo} line ${line.lineNo} is overdue`,
        detail: `Remaining qty ${remainingQty} not yet dispatched — required/expected delivery date has passed (${ageDays} day(s) overdue).`,
        ageDays,
        referenceDate: dueDate.toISOString(),
      })
    }
  }
  return out
}

async function deriveDispatchRequirementExceptions(tenantId: string, now: Date): Promise<DerivedException[]> {
  const requirements = await prisma.dispatchRequirement.findMany({
    where: {
      tenantId,
      deletedAt: null,
      status: { in: ['ACTIVE', 'ON_HOLD', 'RECONCILIATION_REQUIRED'] },
      remainingQuantitySnapshot: { gt: 0 },
      OR: [
        { requestedDeliveryDate: { lt: now } },
        { readinessStatus: { in: ['BLOCKED', 'ON_HOLD', 'RECONCILIATION_REQUIRED'] } },
      ],
    },
    select: {
      id: true,
      requirementNumber: true,
      readinessStatus: true,
      primaryBlockerCode: true,
      requestedDeliveryDate: true,
      remainingQuantitySnapshot: true,
      updatedAt: true,
      salesOrder: { select: { salesOrderNo: true } },
    },
    take: 2000,
  })

  return requirements.map((r) => {
    const overdue = r.requestedDeliveryDate != null && r.requestedDeliveryDate < now
    const reconciliation = r.readinessStatus === 'RECONCILIATION_REQUIRED'
    const blocked = r.readinessStatus === 'BLOCKED' || r.readinessStatus === 'ON_HOLD'
    const ageDays = ageInDays(r.requestedDeliveryDate ?? r.updatedAt, now)
    if (reconciliation) {
      return {
        exceptionKey: `DISPATCH_RECON:${r.id}`,
        category: 'DISPATCH_RECONCILIATION_REQUIRED' as const,
        severity: 'HIGH' as const,
        sourceType: 'DispatchRequirement',
        sourceId: r.id,
        title: `Dispatch requirement ${r.requirementNumber} needs reconciliation`,
        detail: `SO ${r.salesOrder.salesOrderNo} — blocker ${r.primaryBlockerCode ?? 'RECONCILIATION_REQUIRED'}; remaining ${Number(r.remainingQuantitySnapshot)}.`,
        ageDays,
        referenceDate: (r.requestedDeliveryDate ?? r.updatedAt).toISOString(),
      }
    }
    if (blocked) {
      return {
        exceptionKey: `DISPATCH_BLOCKED:${r.id}`,
        category: 'DISPATCH_REQUIREMENT_BLOCKED' as const,
        severity: 'HIGH' as const,
        sourceType: 'DispatchRequirement',
        sourceId: r.id,
        title: `Dispatch requirement ${r.requirementNumber} is blocked`,
        detail: `SO ${r.salesOrder.salesOrderNo} — ${r.readinessStatus}${r.primaryBlockerCode ? ` (${r.primaryBlockerCode})` : ''}.`,
        ageDays,
        referenceDate: (r.requestedDeliveryDate ?? r.updatedAt).toISOString(),
      }
    }
    return {
      exceptionKey: `DISPATCH_OVERDUE:${r.id}`,
      category: 'DISPATCH_REQUIREMENT_OVERDUE' as const,
      severity: ageDays > 7 ? ('HIGH' as const) : ('MEDIUM' as const),
      sourceType: 'DispatchRequirement',
      sourceId: r.id,
      title: `Dispatch requirement ${r.requirementNumber} is overdue`,
      detail: `SO ${r.salesOrder.salesOrderNo} — remaining ${Number(r.remainingQuantitySnapshot)}${overdue ? `; delivery date passed (${ageDays} day(s))` : ''}.`,
      ageDays,
      referenceDate: (r.requestedDeliveryDate ?? r.updatedAt).toISOString(),
    }
  })
}

async function deriveDispatchPickShortages(tenantId: string, now: Date): Promise<DerivedException[]> {
  const lines = await prisma.dispatchPickLine.findMany({
    where: {
      tenantId,
      status: 'SHORT',
      shortageQuantity: { gt: 0 },
      pickList: { status: { notIn: ['CANCELLED'] } },
    },
    select: {
      id: true,
      shortageQuantity: true,
      primaryShortageReason: true,
      updatedAt: true,
      pickList: { select: { pickListNumber: true, outboundDispatch: { select: { dispatchNo: true } } } },
      item: { select: { code: true } },
    },
    take: 2000,
  })
  return lines.map((l) => {
    const ageDays = ageInDays(l.updatedAt, now)
    return {
      exceptionKey: `DISPATCH_PICK_SHORT:${l.id}`,
      category: 'DISPATCH_PICK_SHORTAGE' as const,
      severity: ageDays > 2 ? ('HIGH' as const) : ('MEDIUM' as const),
      sourceType: 'DispatchPickLine',
      sourceId: l.id,
      title: `Pick shortage on ${l.pickList.pickListNumber}`,
      detail: `Dispatch ${l.pickList.outboundDispatch.dispatchNo} item ${l.item.code} short ${Number(l.shortageQuantity)}${l.primaryShortageReason ? ` (${l.primaryShortageReason})` : ''}. Picked ≠ Dispatched.`,
      ageDays,
      referenceDate: l.updatedAt.toISOString(),
    }
  })
}

async function deriveDispatchPackingShortages(tenantId: string, now: Date): Promise<DerivedException[]> {
  const events = await prisma.dispatchPackingEvent.findMany({
    where: {
      tenantId,
      eventType: 'SHORTAGE_REPORTED',
      packingSession: { status: { notIn: ['CANCELLED', 'VERIFIED'] } },
    },
    select: {
      id: true,
      packingSessionId: true,
      itemId: true,
      quantity: true,
      reasonCode: true,
      performedAt: true,
      packingSession: {
        select: {
          packingSessionNumber: true,
          outboundDispatch: { select: { dispatchNo: true } },
        },
      },
    },
    take: 2000,
  })

  // DispatchPackingEvent has no item relation — resolve codes in one batch.
  const itemIds = [...new Set(events.map((e) => e.itemId).filter((id): id is string => Boolean(id)))]
  const items = itemIds.length
    ? await prisma.masterItem.findMany({ where: { tenantId, id: { in: itemIds } }, select: { id: true, code: true } })
    : []
  const itemCodeById = new Map(items.map((i) => [i.id, i.code]))

  const resolved = await prisma.dispatchPackingEvent.findMany({
    where: { tenantId, eventType: 'SHORTAGE_RESOLVED' },
    select: { packingSessionId: true, itemId: true },
    take: 5000,
  })
  const resolvedKeys = new Set(resolved.map((r) => `${r.packingSessionId}:${r.itemId ?? ''}`))

  return events
    .filter((e) => !resolvedKeys.has(`${e.packingSessionId}:${e.itemId ?? ''}`))
    .map((e) => {
      const ageDays = ageInDays(e.performedAt, now)
      const itemCode = e.itemId ? itemCodeById.get(e.itemId) : undefined
      return {
        exceptionKey: `DISPATCH_PACK_SHORT:${e.id}`,
        category: 'DISPATCH_PACKING_SHORTAGE' as const,
        severity: ageDays > 2 ? ('HIGH' as const) : ('MEDIUM' as const),
        sourceType: 'DispatchPackingEvent',
        sourceId: e.id,
        title: `Packing shortage on ${e.packingSession.packingSessionNumber}`,
        detail: `Dispatch ${e.packingSession.outboundDispatch.dispatchNo}${itemCode ? ` item ${itemCode}` : ''} short ${Number(e.quantity ?? 0)}${e.reasonCode ? ` (${e.reasonCode})` : ''}. Packed ≠ Dispatched.`,
        ageDays,
        referenceDate: e.performedAt.toISOString(),
      }
    })
}

export async function deriveOpenExceptions(tenantId: string, now = new Date()): Promise<DerivedException[]> {
  const groups = await Promise.all([
    deriveOverdueWorkOrders(tenantId, now),
    deriveMaterialShortages(tenantId, now),
    deriveCriticalIssues(tenantId, now),
    derivePendingQualityInspections(tenantId, now),
    deriveOpenNcrs(tenantId, now),
    deriveOverdueJobWork(tenantId, now),
    deriveOverdueSalesOrderLines(tenantId, now),
    deriveDispatchRequirementExceptions(tenantId, now),
    deriveDispatchPickShortages(tenantId, now),
    deriveDispatchPackingShortages(tenantId, now),
  ])
  return groups.flat()
}
