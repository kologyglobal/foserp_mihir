import type { PurchaseRequisition, PurchaseRequisitionLine } from '@prisma/client'
import { dec } from '../../inventory/shared/quantity.helpers.js'

type ItemRef = { id: string; code: string; name: string }
type WarehouseRef = { id: string; code: string; name: string }

export type RequisitionLineRow = PurchaseRequisitionLine & {
  item?: ItemRef | null
  warehouse?: WarehouseRef | null
}

export type RequisitionRow = PurchaseRequisition & {
  lines?: RequisitionLineRow[]
  warehouse?: WarehouseRef | null
}

function dateOnly(value: Date | null | undefined): string | null {
  if (!value) return null
  return value.toISOString().slice(0, 10)
}

function isoDateTime(value: Date | null | undefined): string | null {
  if (!value) return null
  return value.toISOString()
}

export function mapRequisitionLine(row: RequisitionLineRow) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    requisitionId: row.requisitionId,
    lineNo: row.lineNo,
    itemId: row.itemId,
    warehouseId: row.warehouseId,
    uomId: row.uomId,
    quantity: dec(row.quantity),
    requiredDate: dateOnly(row.requiredDate),
    productionOrderId: row.productionOrderId,
    stageId: row.stageId,
    operationId: row.operationId,
    bomLineId: row.bomLineId,
    salesOrderId: row.salesOrderId,
    salesOrderLineKey: row.salesOrderLineKey,
    preferredVendorId: row.preferredVendorId,
    remarks: row.remarks,
    item: row.item ?? undefined,
    warehouse: row.warehouse ?? undefined,
    createdAt: isoDateTime(row.createdAt),
    updatedAt: isoDateTime(row.updatedAt),
  }
}

export function mapRequisition(row: RequisitionRow) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    prNumber: row.prNumber,
    source: row.source,
    status: row.status,
    priority: row.priority,
    purpose: row.purpose,
    requestedByUserId: row.requestedByUserId,
    requiredByDate: dateOnly(row.requiredByDate),
    warehouseId: row.warehouseId,
    productionOrderId: row.productionOrderId,
    salesOrderId: row.salesOrderId,
    projectRef: row.projectRef,
    notes: row.notes,
    submittedAt: isoDateTime(row.submittedAt),
    submittedBy: row.submittedBy,
    approvedAt: isoDateTime(row.approvedAt),
    approvedBy: row.approvedBy,
    rejectedAt: isoDateTime(row.rejectedAt),
    rejectedBy: row.rejectedBy,
    rejectionReason: row.rejectionReason,
    cancelledAt: isoDateTime(row.cancelledAt),
    cancelledBy: row.cancelledBy,
    cancellationReason: row.cancellationReason,
    idempotencyKey: row.idempotencyKey,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: isoDateTime(row.createdAt),
    updatedAt: isoDateTime(row.updatedAt),
    warehouse: row.warehouse ?? undefined,
    lines: row.lines?.map(mapRequisitionLine),
  }
}
