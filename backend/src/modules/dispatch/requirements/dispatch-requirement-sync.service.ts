import { prisma } from '../../../config/database.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { getSalesOrderFulfilmentPositions } from '../fulfilment/sales-order-fulfilment-position.service.js'
import { shipToKeyFromAddress } from '../shared/dispatch-qty.js'
import * as repo from './dispatch-requirement.repository.js'

const ELIGIBLE_SO_STATUSES = new Set(['confirmed', 'in_production', 'ready_dispatch', 'dispatched'])

export interface SyncResult {
  scannedOrders: number
  created: number
  updated: number
  fulfilled: number
  cancelled: number
  unchanged: number
  requirementIds: string[]
}

export async function synchroniseDispatchRequirements(
  tenantId: string,
  options: { salesOrderId?: string; userId?: string } = {},
): Promise<SyncResult> {
  const orders = await prisma.crmSalesOrder.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(options.salesOrderId ? { id: options.salesOrderId } : { status: { in: [...ELIGIBLE_SO_STATUSES] } }),
    },
    select: { id: true, status: true },
    take: 500,
  })

  const result: SyncResult = {
    scannedOrders: orders.length,
    created: 0,
    updated: 0,
    fulfilled: 0,
    cancelled: 0,
    unchanged: 0,
    requirementIds: [],
  }

  for (const order of orders) {
    if (!ELIGIBLE_SO_STATUSES.has(order.status) && !options.salesOrderId) continue
    const positions = await getSalesOrderFulfilmentPositions(tenantId, order.id)

    for (const pos of positions) {
      const existing = await repo.findBySource(tenantId, pos.salesOrderId, pos.salesOrderLineId)
      const status =
        pos.readinessStatus === 'CANCELLED'
          ? 'CANCELLED'
          : pos.readinessStatus === 'FULLY_FULFILLED'
            ? 'FULFILLED'
            : pos.readinessStatus === 'RECONCILIATION_REQUIRED'
              ? 'RECONCILIATION_REQUIRED'
              : pos.readinessStatus === 'ON_HOLD'
                ? 'ON_HOLD'
                : 'ACTIVE'

      if (pos.netOrderedQty <= 0 && !existing) {
        result.unchanged += 1
        continue
      }
      // Skip non-positive remaining brand-new lines that never had a requirement and are fully cancelled
      if (!existing && pos.remainingToDispatchQty <= 0 && pos.netDispatchedQty <= 0) {
        result.unchanged += 1
        continue
      }
      if (!pos.itemId && pos.remainingToDispatchQty <= 0 && !existing) {
        result.unchanged += 1
        continue
      }

      const shipToKey = pos.shipToKey ?? shipToKeyFromAddress(pos.shipToAddress, null)
      const updatePayload = {
        customerId: pos.customerId,
        shipToKey,
        shipToAddress: pos.shipToAddress,
        itemId: pos.itemId,
        productId: pos.productId,
        uomCode: pos.uom,
        orderedQuantitySnapshot: pos.orderedQty,
        cancelledQuantitySnapshot: pos.cancelledQty,
        netOrderedQuantitySnapshot: pos.netOrderedQty,
        netDispatchedQuantitySnapshot: pos.netDispatchedQty,
        remainingQuantitySnapshot: pos.remainingToDispatchQty,
        currentDraftDispatchQuantity: pos.activeDraftDispatchQty,
        requestedDeliveryDate: pos.requestedDeliveryDate ? new Date(`${pos.requestedDeliveryDate}T00:00:00.000Z`) : null,
        committedDeliveryDate: pos.committedDeliveryDate ? new Date(`${pos.committedDeliveryDate}T00:00:00.000Z`) : null,
        readinessStatus: pos.readinessStatus,
        primaryBlockerCode: pos.primaryBlockerCode,
        status: status as 'ACTIVE' | 'ON_HOLD' | 'FULFILLED' | 'CANCELLED' | 'RECONCILIATION_REQUIRED',
        sourceFingerprint: pos.sourceFingerprint,
        lastCalculatedAt: new Date(),
        updatedBy: options.userId ?? null,
        sourceVersion: existing ? existing.sourceVersion + 1 : 1,
      }

      if (!existing) {
        const requirementNumber = await nextCode(tenantId, 'DISPATCH_REQUIREMENT')
        const created = await repo.upsertRequirement(
          tenantId,
          {
            tenantId,
            requirementNumber,
            salesOrderId: pos.salesOrderId,
            salesOrderLineId: pos.salesOrderLineId,
            ...updatePayload,
            createdBy: options.userId ?? null,
          },
          updatePayload,
        )
        result.created += 1
        result.requirementIds.push(created.id)
      } else if (existing.sourceFingerprint === pos.sourceFingerprint && existing.status === status) {
        result.unchanged += 1
        result.requirementIds.push(existing.id)
      } else {
        const updated = await prisma.dispatchRequirement.update({
          where: { id: existing.id },
          data: updatePayload,
        })
        result.updated += 1
        if (status === 'FULFILLED') result.fulfilled += 1
        if (status === 'CANCELLED') result.cancelled += 1
        result.requirementIds.push(updated.id)
      }
    }
  }

  return result
}
