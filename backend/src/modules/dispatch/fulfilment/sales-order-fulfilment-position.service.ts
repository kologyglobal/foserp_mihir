import { createHash } from 'node:crypto'
import type { DispatchReadinessStatus } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { NotFoundError } from '../../../utils/errors.js'
import type { SalesOrderLineDto } from '../../crm/sales-orders/sales-order.types.js'
import { resolveManufacturedProductItem } from '../../manufacturing/shared/manufacturing.helpers.js'
import { collectQualityBlockers } from '../../quality/shared/blockers.service.js'
import { getFgAvailabilityByItemIds } from '../availability/dispatch-availability.service.js'
import { fingerprint, n, overdueDays, roundQty, shipToKeyFromAddress, startOfTenantDay } from '../shared/dispatch-qty.js'
import type { DispatchBlocker, SalesOrderLineFulfilmentPosition } from '../shared/dispatch.types.js'
import { evaluateDispatchReadiness } from '../readiness/dispatch-readiness.service.js'

function parseLines(value: unknown): SalesOrderLineDto[] {
  return Array.isArray(value) ? (value as SalesOrderLineDto[]) : []
}

async function resolveItemId(tenantId: string, productId: string | null | undefined): Promise<string | null> {
  if (!productId) return null
  try {
    const item = await resolveManufacturedProductItem(tenantId, productId)
    return item.id
  } catch {
    return null
  }
}

export async function getSalesOrderFulfilmentPositions(
  tenantId: string,
  salesOrderId: string,
): Promise<SalesOrderLineFulfilmentPosition[]> {
  const order = await prisma.crmSalesOrder.findFirst({
    where: { id: salesOrderId, tenantId, deletedAt: null },
    include: { company: { select: { id: true, name: true } } },
  })
  if (!order) throw new NotFoundError('Sales order not found')

  const lines = parseLines(order.lines)
  const cancelledRows = await prisma.salesOrderLineFulfilment.findMany({
    where: { tenantId, salesOrderId },
  })
  const cancelledMap = new Map(cancelledRows.map((r) => [r.salesOrderLineId, n(r.cancelledQty)]))

  const confirmedLines = await prisma.outboundDispatchLine.findMany({
    where: {
      tenantId,
      salesOrderId,
      salesOrderLineId: { not: null },
      outboundDispatch: { tenantId, status: 'CONFIRMED', deletedAt: null },
    },
    select: {
      salesOrderLineId: true,
      quantity: true,
      inventoryMovementId: true,
      outboundDispatchId: true,
    },
  })
  const dispatchedMap = new Map<string, number>()
  const movementIds: string[] = []
  const dispatchIdsByLine = new Map<string, Set<string>>()
  for (const row of confirmedLines) {
    if (!row.salesOrderLineId) continue
    dispatchedMap.set(row.salesOrderLineId, (dispatchedMap.get(row.salesOrderLineId) ?? 0) + n(row.quantity))
    if (row.inventoryMovementId) movementIds.push(row.inventoryMovementId)
    const set = dispatchIdsByLine.get(row.salesOrderLineId) ?? new Set<string>()
    set.add(row.outboundDispatchId)
    dispatchIdsByLine.set(row.salesOrderLineId, set)
  }

  const draftLines = await prisma.outboundDispatchLine.findMany({
    where: {
      tenantId,
      salesOrderId,
      salesOrderLineId: { not: null },
      outboundDispatch: { tenantId, status: 'DRAFT', deletedAt: null },
    },
    select: { salesOrderLineId: true, quantity: true, outboundDispatchId: true },
  })
  const draftMap = new Map<string, number>()
  for (const row of draftLines) {
    if (!row.salesOrderLineId) continue
    draftMap.set(row.salesOrderLineId, (draftMap.get(row.salesOrderLineId) ?? 0) + n(row.quantity))
    const set = dispatchIdsByLine.get(row.salesOrderLineId) ?? new Set<string>()
    set.add(row.outboundDispatchId)
    dispatchIdsByLine.set(row.salesOrderLineId, set)
  }

  const itemIds: string[] = []
  const lineItemMap = new Map<string, string | null>()
  for (const line of lines) {
    const itemId = await resolveItemId(tenantId, line.productId ?? null)
    lineItemMap.set(line.id, itemId)
    if (itemId) itemIds.push(itemId)
  }
  const availability = await getFgAvailabilityByItemIds(tenantId, itemIds)

  const demands = await prisma.productionDemand.findMany({
    where: { tenantId, salesOrderId, deletedAt: null },
    select: { id: true, sourceLineReference: true, status: true },
  })
  const workOrders = await prisma.productionOrder.findMany({
    where: { tenantId, salesOrderId, deletedAt: null },
    select: { id: true, sourceLineReference: true, status: true, productItemId: true },
  })
  const fgReceipts = await prisma.productionFinishedGoodsReceipt.findMany({
    where: {
      tenantId,
      deletedAt: null,
      productionOrderId: { in: workOrders.map((w) => w.id) },
      status: 'POSTED',
    },
    select: { id: true, productionOrderId: true, itemId: true },
  })
  const inspections = await prisma.qualityInspection.findMany({
    where: {
      tenantId,
      productionOrderId: { in: workOrders.map((w) => w.id) },
    },
    select: { id: true, productionOrderId: true, category: true, status: true, decision: true },
  })

  const movementSumByDispatch = new Map<string, number>()
  if (movementIds.length) {
    const movements = await prisma.inventoryStockMovement.findMany({
      where: { tenantId, id: { in: movementIds } },
      select: { id: true, quantity: true },
    })
    const byId = new Map(movements.map((m) => [m.id, Math.abs(n(m.quantity))]))
    for (const row of confirmedLines) {
      if (!row.inventoryMovementId || !row.salesOrderLineId) continue
      const qty = byId.get(row.inventoryMovementId) ?? 0
      movementSumByDispatch.set(
        row.salesOrderLineId,
        (movementSumByDispatch.get(row.salesOrderLineId) ?? 0) + qty,
      )
    }
  }

  const reservedRows = itemIds.length
    ? await prisma.inventoryStockReservation.findMany({
        where: {
          tenantId,
          itemId: { in: itemIds },
          status: 'ACTIVE',
          demandType: { in: ['SO', 'DISPATCH'] },
        },
        select: { itemId: true, quantity: true, fulfilledQty: true, demandId: true },
      })
    : []

  const shipToKey = shipToKeyFromAddress(order.shippingAddress, order.deliveryLocation)
  const dueDate = order.expectedDeliveryDate ?? order.requiredDate
  const today = startOfTenantDay()

  const positions: SalesOrderLineFulfilmentPosition[] = []
  for (const line of lines) {
    const orderedQty = n(line.qty)
    const cancelledQty = cancelledMap.get(line.id) ?? 0
    const netOrderedQty = roundQty(Math.max(0, orderedQty - cancelledQty))
    const grossPostedDispatchQty = roundQty(dispatchedMap.get(line.id) ?? 0)
    const reversedDispatchQty = 0 // 7C0/7C1: confirmed reverse not supported
    const netDispatchedQty = roundQty(Math.max(0, grossPostedDispatchQty - reversedDispatchQty))
    const activeDraftDispatchQty = roundQty(draftMap.get(line.id) ?? 0)
    const remainingToDispatchQty = roundQty(Math.max(0, netOrderedQty - netDispatchedQty))
    const itemId = lineItemMap.get(line.id) ?? null
    const avail = itemId ? availability.get(itemId) : undefined
    const unrestrictedFgOnHand = avail?.unrestrictedOnHand ?? 0
    const qualityHoldQty = avail?.qualityHoldOnHand ?? 0
    const availableToDispatchQty = avail?.availableToDispatch ?? 0
    const reservedQty = reservedRows
      .filter((r) => r.itemId === itemId && (r.demandId === salesOrderId || r.demandId === line.id))
      .reduce((s, r) => s + Math.max(0, n(r.quantity) - n(r.fulfilledQty)), 0)

    const linkedDemandIds = demands
      .filter((d) => d.sourceLineReference === `${salesOrderId}:${line.id}` || d.sourceLineReference === line.id)
      .map((d) => d.id)
    const linkedWo = workOrders.filter(
      (w) =>
        w.sourceLineReference === `${salesOrderId}:${line.id}` ||
        w.sourceLineReference === line.id ||
        (itemId != null && w.productItemId === itemId),
    )
    const linkedWoIds = linkedWo.map((w) => w.id)
    const linkedFgIds = fgReceipts.filter((f) => linkedWoIds.includes(f.productionOrderId)).map((f) => f.id)
    const linkedInspectionIds = inspections
      .filter((i) => i.productionOrderId && linkedWoIds.includes(i.productionOrderId))
      .map((i) => i.id)

    const blockers: DispatchBlocker[] = []
    const warnings: string[] = []

    if (order.status === 'closed' || order.status === 'cancelled') {
      // cancelled commercial status is rare (string); treat closed separately later
    }
    if (!order.companyId) {
      blockers.push({ code: 'MISSING_CUSTOMER', message: 'Customer is missing on the sales order', severity: 'BLOCKER' })
    }
    if (!shipToKey || shipToKey === 'UNSPECIFIED') {
      blockers.push({
        code: 'MISSING_SHIP_TO',
        message: 'Ship-to address is missing',
        severity: 'WARNING',
      })
    }
    if (!itemId) {
      blockers.push({
        code: 'ITEM_MAPPING_MISSING',
        message: 'Sales order line product could not be resolved to a stockable finished-good item',
        severity: 'BLOCKER',
      })
    } else {
      const item = await prisma.masterItem.findFirst({
        where: { id: itemId, tenantId, deletedAt: null },
        select: { isStockable: true, isBlocked: true, status: true, code: true, name: true },
      })
      if (!item || item.status !== 'ACTIVE' || item.isBlocked || !item.isStockable) {
        blockers.push({
          code: 'ITEM_NOT_DISPATCHABLE',
          message: 'Item is inactive, blocked, or not stockable for dispatch',
          severity: 'BLOCKER',
        })
      }
    }

    const movementTotal = roundQty(movementSumByDispatch.get(line.id) ?? 0)
    if (grossPostedDispatchQty > 0 && Math.abs(movementTotal - grossPostedDispatchQty) > 0.0001) {
      blockers.push({
        code: 'FULFILMENT_MOVEMENT_MISMATCH',
        message: `Sales Order fulfilment shows ${grossPostedDispatchQty} units dispatched, but linked FG_DISPATCH movements total ${movementTotal}.`,
        severity: 'BLOCKER',
      })
    }
    if (grossPostedDispatchQty > netOrderedQty + 1e-9) {
      blockers.push({
        code: 'DISPATCH_EXCEEDS_NET_ORDER',
        message: 'Dispatch quantity exceeds the current net Sales Order quantity',
        severity: 'BLOCKER',
      })
    }
    for (const row of confirmedLines.filter((c) => c.salesOrderLineId === line.id)) {
      if (!row.inventoryMovementId) {
        blockers.push({
          code: 'CONFIRMED_WITHOUT_MOVEMENT',
          message: 'Outbound Dispatch is confirmed but no linked Inventory stock movement exists',
          severity: 'BLOCKER',
        })
        break
      }
    }

    let openWoQualityBlockers = 0
    for (const wo of linkedWo.filter((w) => !['CLOSED', 'CANCELLED', 'COMPLETED'].includes(w.status))) {
      const qb = await collectQualityBlockers(tenantId, wo.id)
      openWoQualityBlockers += qb.length
      for (const b of qb) {
        blockers.push({
          code: b.code,
          message: b.message,
          severity: b.code === 'FINAL_QC_REQUIRED' || b.code === 'OPEN_NCR' ? 'BLOCKER' : 'WARNING',
        })
      }
    }
    if (qualityHoldQty > 0 && availableToDispatchQty < remainingToDispatchQty) {
      blockers.push({
        code: 'STOCK_IN_QUALITY_HOLD',
        message: `${qualityHoldQty} units are in Quality Hold and are excluded from available-to-dispatch`,
        severity: 'WARNING',
      })
    }

    const openProduction =
      linkedDemandIds.length > 0 ||
      linkedWo.some((w) => !['CLOSED', 'CANCELLED', 'COMPLETED'].includes(w.status))
    const hasFg = unrestrictedFgOnHand > 0 || linkedFgIds.length > 0

    const readiness = evaluateDispatchReadiness({
      salesOrderStatus: order.status,
      remainingToDispatchQty,
      netOrderedQty,
      netDispatchedQty,
      activeDraftDispatchQty,
      availableToDispatchQty,
      unrestrictedFgOnHand,
      qualityHoldQty,
      hasItemMapping: Boolean(itemId),
      hasCustomer: Boolean(order.companyId),
      hasShipTo: Boolean(shipToKey && shipToKey !== 'UNSPECIFIED'),
      commercialHold: false,
      dispatchHold: false,
      fulfilmentMismatch: blockers.some((b) => b.code.startsWith('FULFILMENT') || b.code === 'CONFIRMED_WITHOUT_MOVEMENT' || b.code === 'DISPATCH_EXCEEDS_NET_ORDER'),
      waitingForProduction: remainingToDispatchQty > 0 && !hasFg && (openProduction || !linkedFgIds.length),
      waitingForQuality: remainingToDispatchQty > 0 && (openWoQualityBlockers > 0 || (qualityHoldQty > 0 && availableToDispatchQty <= 0)),
      waitingForStock: remainingToDispatchQty > 0 && hasFg === false ? false : remainingToDispatchQty > 0 && availableToDispatchQty <= 0 && openWoQualityBlockers === 0,
      blockers,
    })

    const readyQty = roundQty(Math.min(remainingToDispatchQty, availableToDispatchQty))
    const shortageQty = roundQty(Math.max(0, remainingToDispatchQty - readyQty))
    const itemMeta = itemId
      ? await prisma.masterItem.findFirst({
          where: { id: itemId, tenantId },
          select: { code: true, name: true },
        })
      : null

    const sourceFingerprint = fingerprint({
      salesOrderId,
      salesOrderLineId: line.id,
      orderedQty,
      cancelledQty,
      netDispatchedQty,
      activeDraftDispatchQty,
      remainingToDispatchQty,
      availableToDispatchQty,
      qualityHoldQty,
      readiness: readiness.readinessStatus,
      shipToKey,
      updatedAt: order.updatedAt.toISOString(),
    })

    const allowedActions: string[] = ['view_fulfilment', 'open_sales_order']
    if (['READY_TO_DISPATCH', 'PARTIALLY_READY', 'ALREADY_IN_DRAFT_DISPATCH'].includes(readiness.readinessStatus) && remainingToDispatchQty > 0) {
      allowedActions.push('create_draft_dispatch')
    }
    if (itemId) allowedActions.push('view_stock', 'view_traceability')

    let fulfilmentStatus = 'OPEN'
    if (remainingToDispatchQty <= 0 && netOrderedQty > 0) fulfilmentStatus = 'FULLY_DISPATCHED'
    else if (netDispatchedQty > 0) fulfilmentStatus = 'PARTIALLY_DISPATCHED'
    else if (netOrderedQty <= 0) fulfilmentStatus = 'CANCELLED'

    positions.push({
      salesOrderId: order.id,
      salesOrderNo: order.salesOrderNo,
      salesOrderStatus: order.status,
      salesOrderLineId: line.id,
      lineNo: line.lineNo,
      customerId: order.companyId,
      customerName: order.company?.name ?? null,
      shipToKey,
      shipToAddress: order.shippingAddress ?? order.deliveryLocation ?? null,
      productId: line.productId ?? null,
      itemId,
      itemCode: itemMeta?.code ?? null,
      itemName: itemMeta?.name ?? null,
      productOrItem: line.productOrItem,
      uom: line.uom,
      orderedQty,
      cancelledQty,
      netOrderedQty,
      grossPostedDispatchQty,
      reversedDispatchQty,
      netDispatchedQty,
      activeDraftDispatchQty,
      reservedQty: roundQty(reservedQty),
      pickedQty: 0,
      packedQty: 0,
      remainingToDispatchQty,
      unrestrictedFgOnHand,
      qualityHoldQty,
      availableToDispatchQty,
      readyQty,
      shortageQty,
      requestedDeliveryDate: order.requiredDate?.toISOString().slice(0, 10) ?? null,
      committedDeliveryDate: order.expectedDeliveryDate?.toISOString().slice(0, 10) ?? null,
      overdueDays: remainingToDispatchQty > 0 ? overdueDays(dueDate, today) : null,
      fulfilmentStatus,
      readinessStatus: readiness.readinessStatus,
      primaryBlockerCode: readiness.primaryBlockerCode,
      blockers: readiness.blockers,
      warnings,
      allowedActions,
      sourceFingerprint,
      linkedProductionDemandIds: linkedDemandIds,
      linkedWorkOrderIds: linkedWoIds,
      linkedFgReceiptIds: linkedFgIds,
      linkedInspectionIds: linkedInspectionIds,
      linkedDispatchIds: [...(dispatchIdsByLine.get(line.id) ?? [])],
    })
  }

  return positions
}

export async function getLineFulfilmentPosition(
  tenantId: string,
  salesOrderId: string,
  salesOrderLineId: string,
): Promise<SalesOrderLineFulfilmentPosition> {
  const rows = await getSalesOrderFulfilmentPositions(tenantId, salesOrderId)
  const row = rows.find((r) => r.salesOrderLineId === salesOrderLineId)
  if (!row) throw new NotFoundError('Sales order line fulfilment position not found')
  return row
}

/** Stable digest helper exported for sync service. */
export function positionFingerprint(position: SalesOrderLineFulfilmentPosition): string {
  return position.sourceFingerprint || createHash('sha256').update(position.salesOrderLineId).digest('hex')
}

export type { DispatchReadinessStatus }
