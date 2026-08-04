import type { PurchaseRequisition, PurchaseRequisitionLine } from '@prisma/client'
import { decimalToNumber, toIso } from '../../../shared/index.js'

function statusToApi(status: string): string {
  return status.toLowerCase()
}

function priorityToApi(priority: string): string {
  return priority.toLowerCase()
}

export function mapPurchaseRequisitionLineToDto(
  line: PurchaseRequisitionLine & {
    item?: { productType: string | null } | null
  },
) {
  return {
    id: line.id,
    lineNumber: line.lineNumber,
    itemId: line.itemId,
    itemCode: line.itemCodeSnapshot,
    itemName: line.itemNameSnapshot,
    productType: line.item?.productType ?? null,
    description: line.description,
    requiredQuantity: decimalToNumber(line.requiredQuantity),
    orderedQuantity: decimalToNumber(line.orderedQuantity),
    remainingQuantity: Math.max(
      0,
      decimalToNumber(line.requiredQuantity) - decimalToNumber(line.orderedQuantity),
    ),
    uomId: line.uomId,
    estimatedRate: decimalToNumber(line.estimatedRate),
    estimatedAmount: decimalToNumber(line.estimatedAmount),
    warehouseId: line.warehouseId,
    binId: line.binId,
    preferredVendorId: line.preferredVendorId,
    requiredDate: line.requiredDate ? toDateOnly(line.requiredDate) : null,
    remarks: line.remarks,
    status: statusToApi(line.status),
    purchaseOrderId: line.purchaseOrderId,
    purchaseOrderNumber: line.purchaseOrderNumberSnapshot,
    createdAt: toIso(line.createdAt),
    updatedAt: toIso(line.updatedAt),
  }
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function formatPurchaseRequisitionUserName(user: {
  firstName: string
  lastName: string
  email: string
} | null | undefined): string | null {
  if (!user) return null
  const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()
  return name || user.email || null
}

export function mapPurchaseRequisitionToDto(
  pr: PurchaseRequisition & { lines?: PurchaseRequisitionLine[] },
  ctx?: { requestedByName?: string | null },
) {
  return {
    id: pr.id,
    requisitionNumber: pr.requisitionNumber,
    revisionNo: pr.revisionNo ?? 0,
    requisitionDate: toDateOnly(pr.requisitionDate),
    departmentId: pr.departmentId,
    requestedById: pr.requestedById,
    requestedByName: ctx?.requestedByName ?? null,
    warehouseId: pr.warehouseId,
    requiredDate: pr.requiredDate ? toDateOnly(pr.requiredDate) : null,
    priority: priorityToApi(pr.priority),
    purchasePurpose: pr.purchasePurpose,
    rfqRequired: pr.rfqRequired,
    sourceType: pr.sourceType ?? null,
    sourceId: pr.sourceId ?? null,
    sourceDocumentNumber: pr.sourceDocumentNumber ?? null,
    status: statusToApi(pr.status),
    submittedAt: toIso(pr.submittedAt),
    approvedAt: toIso(pr.approvedAt),
    rejectedAt: toIso(pr.rejectedAt),
    rejectionReason: pr.rejectionReason,
    remarks: pr.remarks,
    createdById: pr.createdById,
    updatedById: pr.updatedById,
    createdAt: toIso(pr.createdAt),
    updatedAt: toIso(pr.updatedAt),
    lines: (pr.lines ?? []).map(mapPurchaseRequisitionLineToDto),
  }
}
