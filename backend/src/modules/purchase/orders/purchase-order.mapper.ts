import type { MasterVendor, PurchaseOrder, PurchaseOrderLine } from '@prisma/client'

const num = (value: unknown) => Number(value ?? 0)
const date = (value: Date | null | undefined) => value?.toISOString().slice(0, 10) ?? null
const iso = (value: Date | null | undefined) => value?.toISOString() ?? null

type OrderWithRelations = PurchaseOrder & {
  lines: PurchaseOrderLine[]
  vendor?: Pick<
    MasterVendor,
    'id' | 'code' | 'name' | 'gstin' | 'state' | 'address' | 'city'
  > | null
  purchaseRequisition?: { id: string; requisitionNumber: string } | null
  requestForQuotation?: { id: string; rfqNumber: string } | null
}

export function mapPurchaseOrderToDto(order: OrderWithRelations) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    orderDate: date(order.orderDate),
    vendorId: order.vendorId,
    vendorCode: order.vendor?.code ?? '',
    vendorName: order.vendor?.name ?? '',
    vendorGstin: order.vendor?.gstin ?? '',
    vendorState: order.vendor?.state ?? '',
    vendorAddress: order.vendor?.address ?? '',
    vendorCity: order.vendor?.city ?? '',
    status: order.status,
    origin: order.origin,
    purchaseRequisitionId: order.purchaseRequisitionId,
    purchaseRequisitionNumber: order.purchaseRequisition?.requisitionNumber ?? null,
    requestForQuotationId: order.requestForQuotationId,
    requestForQuotationNumber: order.requestForQuotation?.rfqNumber ?? null,
    vendorQuotationId: order.vendorQuotationId,
    vendorComparisonId: order.vendorComparisonId,
    currencyCode: order.currencyCode,
    expectedDeliveryDate: date(order.expectedDeliveryDate),
    paymentTerms: order.paymentTerms,
    deliveryTerms: order.deliveryTerms,
    subtotalAmount: num(order.subtotalAmount),
    taxAmount: num(order.taxAmount),
    freightAmount: num(order.freightAmount),
    totalAmount: num(order.totalAmount),
    remarks: order.remarks,
    submittedAt: iso(order.submittedAt),
    approvedAt: iso(order.approvedAt),
    sentAt: iso(order.sentAt),
    closedAt: iso(order.closedAt),
    cancelledAt: iso(order.cancelledAt),
    createdAt: iso(order.createdAt),
    updatedAt: iso(order.updatedAt),
    lines: order.lines.map((line) => ({
      id: line.id,
      lineNumber: line.lineNumber,
      itemId: line.itemId,
      itemCode: line.itemCodeSnapshot,
      itemName: line.itemNameSnapshot,
      description: line.description,
      quantity: num(line.quantity),
      uomId: line.uomId,
      rate: num(line.rate),
      amount: num(line.amount),
      receivedQuantity: num(line.receivedQuantity),
      requiredDate: date(line.requiredDate),
      purchaseRequisitionLineId: line.purchaseRequisitionLineId,
      purchasePlanningRowId: line.purchasePlanningRowId,
      remarks: line.remarks,
    })),
  }
}
