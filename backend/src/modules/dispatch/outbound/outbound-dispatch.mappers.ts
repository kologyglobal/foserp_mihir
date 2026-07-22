import type { OutboundDispatch, OutboundDispatchLine } from '@prisma/client'

function n(value: { toString(): string } | number | null | undefined): number {
  if (value == null) return 0
  return Number(value)
}

export function mapOutboundDispatchLine(line: OutboundDispatchLine) {
  return {
    id: line.id,
    lineNo: line.lineNo,
    itemId: line.itemId,
    warehouseId: line.warehouseId,
    quantity: n(line.quantity),
    salesOrderId: line.salesOrderId,
    salesOrderLineId: line.salesOrderLineId,
    dispatchRequirementId: line.dispatchRequirementId ?? null,
    readyQuantitySnapshot: line.readyQuantitySnapshot != null ? n(line.readyQuantitySnapshot) : null,
    inventoryMovementId: line.inventoryMovementId,
    inventoryMovementNo: line.inventoryMovementNo,
    remarks: line.remarks,
  }
}

export function mapOutboundDispatch(
  row: OutboundDispatch & { lines?: OutboundDispatchLine[] },
) {
  return {
    id: row.id,
    dispatchNo: row.dispatchNo,
    status: row.status,
    salesOrderId: row.salesOrderId,
    salesOrderNo: row.salesOrderNo,
    customerId: row.customerId ?? null,
    shipToKey: row.shipToKey ?? null,
    shipToAddress: row.shipToAddress ?? null,
    plannedDispatchDate: row.plannedDispatchDate?.toISOString().slice(0, 10) ?? null,
    preferredWarehouseId: row.preferredWarehouseId ?? null,
    planningSource: row.planningSource ?? 'BASIC_7C0',
    planBeforeStockAllowed: row.planBeforeStockAllowed ?? false,
    remarks: row.remarks,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    confirmedBy: row.confirmedBy,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    cancelledBy: row.cancelledBy,
    cancellationReason: row.cancellationReason,
    idempotencyKey: row.idempotencyKey,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lines: (row.lines ?? []).map(mapOutboundDispatchLine),
  }
}
