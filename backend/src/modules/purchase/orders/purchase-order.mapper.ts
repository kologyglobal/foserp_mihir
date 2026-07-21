import type { MasterVendor, MasterWarehouse, PurchaseOrder, PurchaseOrderLine } from '@prisma/client'
import { allowedActions } from './purchase-order.workflow.js'

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
  deliveryWarehouse?: Pick<MasterWarehouse, 'id' | 'code' | 'name' | 'plantId'> | null
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
    deliveryWarehouseId: order.deliveryWarehouseId,
    deliveryWarehouseCode: order.deliveryWarehouse?.code ?? '',
    deliveryWarehouseName: order.deliveryWarehouse?.name ?? '',
    deliveryWarehousePlantId: order.deliveryWarehouse?.plantId ?? null,
    subtotalAmount: num(order.subtotalAmount),
    taxAmount: num(order.taxAmount),
    freightAmount: num(order.freightAmount),
    totalAmount: num(order.totalAmount),
    remarks: order.remarks,
    submittedAt: iso(order.submittedAt),
    approvedAt: iso(order.approvedAt),
    rejectedAt: iso(order.rejectedAt),
    rejectionReason: order.rejectionReason,
    sentBackAt: iso(order.sentBackAt),
    sendBackReason: order.sendBackReason,
    sentAt: iso(order.sentAt),
    closedAt: iso(order.closedAt),
    cancelledAt: iso(order.cancelledAt),
    createdAt: iso(order.createdAt),
    updatedAt: iso(order.updatedAt),
    allowedActions: allowedActions(order),
    lines: order.lines.map((line) => {
      const quantity = num(line.quantity)
      const received = num(line.receivedQuantity)
      return {
        id: line.id,
        lineNumber: line.lineNumber,
        itemId: line.itemId,
        itemCode: line.itemCodeSnapshot,
        itemName: line.itemNameSnapshot,
        description: line.description,
        quantity,
        uomId: line.uomId,
        rate: num(line.rate),
        amount: num(line.amount),
        receivedQuantity: received,
        acceptedQuantity: num(line.acceptedQuantity),
        rejectedQuantity: num(line.rejectedQuantity),
        returnedQuantity: num(line.returnedQuantity),
        invoicedQuantity: num(line.invoicedQuantity),
        openQuantity: Math.max(0, quantity - received),
        requiredDate: date(line.requiredDate),
        purchaseRequisitionLineId: line.purchaseRequisitionLineId,
        purchasePlanningRowId: line.purchasePlanningRowId,
        remarks: line.remarks,
      }
    }),
  }
}
