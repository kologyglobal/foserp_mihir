import type { PurchasePlanningRow } from '@prisma/client'
import { decimalToNumber, toIso } from '../../../shared/index.js'

function toDateOnly(date: Date | null | undefined): string | null {
  if (!date) return null
  return date.toISOString().slice(0, 10)
}

function enumToApi(value: string): string {
  return value.toLowerCase()
}

export function mapPlanningRowToDto(row: PurchasePlanningRow) {
  return {
    id: row.id,
    planningNumber: row.planningNumber,
    planningDate: toDateOnly(row.planningDate),
    purchaseRequisitionId: row.purchaseRequisitionId,
    purchaseRequisitionLineId: row.purchaseRequisitionLineId,
    purchaseRequisitionNumber: row.purchaseRequisitionNumberSnapshot,
    departmentId: row.departmentId,
    requestedById: row.requestedById,
    itemId: row.itemId,
    itemCode: row.itemCodeSnapshot,
    itemName: row.itemNameSnapshot,
    itemDescription: row.itemDescriptionSnapshot,
    requiredQuantity: decimalToNumber(row.requiredQuantity),
    uomId: row.uomId,
    currentStockQuantity: decimalToNumber(row.currentStockQuantity),
    openPurchaseOrderQuantity: decimalToNumber(row.openPurchaseOrderQuantity),
    netPurchaseQuantity: decimalToNumber(row.netPurchaseQuantity),
    preferredVendorId: row.preferredVendorId,
    selectedVendorId: row.selectedVendorId,
    lastPurchaseVendorId: row.lastPurchaseVendorId,
    lastPurchaseRate: row.lastPurchaseRate != null ? decimalToNumber(row.lastPurchaseRate) : null,
    expectedRate: decimalToNumber(row.expectedRate),
    negotiatedRate: row.negotiatedRate != null ? decimalToNumber(row.negotiatedRate) : null,
    estimatedAmount: decimalToNumber(row.estimatedAmount),
    requiredDate: toDateOnly(row.requiredDate),
    purchaseType: enumToApi(row.purchaseType),
    priority: enumToApi(row.priority),
    buyerId: row.buyerId,
    status: enumToApi(row.status),
    actionMessage: row.actionMessage,
    purchaseOrderId: row.purchaseOrderId,
    purchaseOrderNumber: row.purchaseOrderNumberSnapshot,
    convertedAt: toIso(row.convertedAt),
    remarks: row.remarks,
    createdById: row.createdById,
    updatedById: row.updatedById,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  }
}

export type PlanningSummaryDto = {
  totalPendingPlanning: number
  criticalItems: number
  overdueItems: number
  vendorSelectionPending: number
  poPending: number
  poCreated: number
  totalEstimatedPurchaseValue: number
}
